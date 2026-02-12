/**
 * Paddle Billing webhook endpoint.
 * Receives subscription (and optionally transaction) events, verifies signature,
 * and updates the organisation's subscription state and areaPermissions.
 *
 * Two flows:
 *   1. Existing organisation (custom_data contains organisation_id)
 *      → update subscription state on the org.
 *   2. New signup (custom_data contains pending_signup_id)
 *      → create the organisation + admin from the pending signup, then set subscription state.
 *
 * @see https://developer.paddle.com/webhooks/respond-to-webhooks
 * @see https://developer.paddle.com/webhooks/signature-verification
 */

import { json } from '@sveltejs/kit';
import { createHmac, timingSafeEqual } from 'crypto';
import { create, findById, updatePartial, update, remove } from '$lib/crm/server/fileStore.js';
import { createAdmin, getAdminByEmail, updateAdminPassword, generateVerificationToken } from '$lib/crm/server/auth.js';
import { getAreaPermissionsForPlan } from '$lib/crm/server/permissions.js';
import { invalidateOrganisationsCache } from '$lib/crm/server/organisationsCache.js';
import { invalidateHubDomainCache } from '$lib/crm/server/hubDomain.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { env } from '$env/dynamic/private';

const SUBSCRIPTION_EVENTS = new Set([
	'subscription.created',
	'subscription.activated',
	'subscription.updated',
	'subscription.canceled',
	'subscription.past_due',
	'subscription.paused',
	'subscription.resumed',
	'subscription.trialing'
]);

const REPLAY_TOLERANCE_SEC = 300; // 5 minutes

/** All Hub area permissions for super admin */
const FULL_PERMISSIONS = [
	'contacts', 'lists', 'rotas', 'events', 'meeting_planners',
	'emails', 'forms', 'safeguarding_forms', 'members', 'users'
];

// ── Signature verification ──────────────────────────────────────────────────

function verifyPaddleSignature(rawBody, signatureHeader, secret) {
	if (!secret || !signatureHeader || typeof rawBody !== 'string') {
		return false;
	}
	const parts = {};
	for (const part of signatureHeader.split(';')) {
		const [key, value] = part.trim().split('=');
		if (key && value) parts[key] = value;
	}
	const ts = parts.ts;
	const h1 = parts.h1;
	if (!ts || !h1) return false;
	const tsNum = parseInt(ts, 10);
	if (!Number.isFinite(tsNum)) return false;
	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - tsNum) > REPLAY_TOLERANCE_SEC) {
		return false;
	}
	const signedPayload = `${ts}:${rawBody}`;
	const expected = createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
	try {
		return timingSafeEqual(Buffer.from(h1, 'hex'), Buffer.from(expected, 'hex'));
	} catch {
		return false;
	}
}

// ── Plan detection ──────────────────────────────────────────────────────────

/**
 * Map Paddle subscription status and items to plan.
 * Recognises both tier-1 and tier-2 price IDs for each plan.
 */
function subscriptionToPlan(data) {
	const status = data?.status;
	if (status === 'canceled' || status === 'past_due' || status === 'paused') {
		return 'free';
	}

	const enterpriseIds = new Set(
		[env.PADDLE_PRICE_ID_ENTERPRISE, env.PADDLE_PRICE_ID_ENTERPRISE_TIER2].filter(Boolean)
	);
	const professionalIds = new Set(
		[
			env.PADDLE_PRICE_ID_PROFESSIONAL_TIER1,
			env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2,
			env.PADDLE_PRICE_ID_PROFESSIONAL_TIER3
		].filter(Boolean)
	);

	const items = data?.items;
	if (Array.isArray(items) && items.length > 0) {
		const priceId = items[0]?.price?.id;
		if (priceId && enterpriseIds.has(priceId)) return 'enterprise';
		if (priceId && professionalIds.has(priceId)) return 'professional';
	}
	return 'free';
}

// ── Custom data extraction ──────────────────────────────────────────────────

function getCustomData(data) {
	const custom = data?.custom_data;
	if (custom && typeof custom === 'object') return custom;
	return {};
}

// ── Hub domain generation (duplicated from signup for isolation) ─────────────

function generateSubdomain(name) {
	return String(name)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 10)
		.replace(/-$/g, '');
}

async function generateUniqueHubDomain(name) {
	const baseSubdomain = generateSubdomain(name);
	if (!baseSubdomain) return `org-${Date.now()}`;
	let subdomain = baseSubdomain;
	let suffix = 1;
	const orgs = await readCollection('organisations');
	const taken = new Set(orgs.map((o) => (o.hubDomain || '').toLowerCase().trim()));
	while (taken.has(subdomain)) {
		subdomain = `${baseSubdomain}-${suffix}`;
		suffix++;
		if (suffix > 100) { subdomain = `${baseSubdomain}-${Date.now()}`; break; }
	}
	return subdomain;
}

// ── Pending signup fulfilment ───────────────────────────────────────────────

/**
 * Create the organisation and admin from a pending signup record.
 * Called when a subscription.created webhook arrives with a pending_signup_id.
 * Returns the new organisation ID.
 */
async function fulfillPendingSignup(pendingSignup, subscriptionData) {
	const { name, address, telephone, email, contactName, password, marketingConsent, plan: signupPlan } = pendingSignup;

	const hubDomain = await generateUniqueHubDomain(name);
	const areaPermissions = getAreaPermissionsForPlan(signupPlan);

	// Create organisation
	const org = await create('organisations', {
		name,
		address,
		telephone,
		email,
		contactName,
		hubDomain: hubDomain || null,
		areaPermissions,
		signupPlan,
		isHubOrganisation: true,
		marketingConsent: !!marketingConsent
	});
	invalidateHubDomainCache();

	// Create Hub admin with full permissions
	const admin = await createAdmin({
		email,
		password,
		name: contactName,
		permissions: FULL_PERMISSIONS
	});
	await updateAdminPassword(admin.id, password);

	// Set verification token for welcome email
	const adminRecord = await findById('admins', admin.id);
	if (adminRecord) {
		const now = new Date();
		const token = adminRecord.emailVerificationToken || generateVerificationToken();
		const expires = adminRecord.emailVerificationTokenExpires || new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
		await update('admins', admin.id, {
			...adminRecord,
			emailVerificationToken: token,
			emailVerificationTokenExpires: expires,
			marketingConsent: !!marketingConsent,
			updatedAt: now.toISOString()
		});
	}

	// Link super admin email
	await updatePartial('organisations', org.id, { hubSuperAdminEmail: email });

	// Send welcome email (fire-and-forget)
	try {
		const fullAdmin = await getAdminByEmail(email);
		if (fullAdmin?.emailVerificationToken) {
			await sendAdminWelcomeEmail({
				to: email,
				name: contactName,
				email,
				verificationToken: fullAdmin.emailVerificationToken,
				password
			}, { url: new URL(env.APP_BASE_URL || 'http://localhost:5173') });
		}
	} catch (emailErr) {
		console.error('[paddle webhook] Welcome email failed:', emailErr?.message || emailErr);
	}

	// Mark pending signup as fulfilled, then remove the password
	await updatePartial('pending_signups', pendingSignup.id, {
		status: 'fulfilled',
		organisationId: org.id,
		fulfilledAt: new Date().toISOString(),
		password: null // Remove stored password
	});

	console.log(`[paddle webhook] Fulfilled pending signup ${pendingSignup.id} → org ${org.id}`);
	return org.id;
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function POST({ request }) {
	const secret = env.PADDLE_WEBHOOK_SECRET;
	if (!secret) {
		console.error('[paddle webhook] PADDLE_WEBHOOK_SECRET not set');
		return json({ error: 'Webhook not configured' }, { status: 503 });
	}

	let rawBody;
	try {
		rawBody = await request.text();
	} catch (e) {
		console.error('[paddle webhook] Failed to read body:', e?.message);
		return json({ error: 'Invalid body' }, { status: 400 });
	}

	const signatureHeader = request.headers.get('Paddle-Signature') || request.headers.get('paddle-signature');
	if (!verifyPaddleSignature(rawBody, signatureHeader, secret)) {
		console.error('[paddle webhook] Invalid or missing signature');
		return json({ error: 'Invalid signature' }, { status: 401 });
	}

	let payload;
	try {
		payload = JSON.parse(rawBody);
	} catch (e) {
		console.error('[paddle webhook] Invalid JSON:', e?.message);
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const eventType = payload?.event_type;
	if (!eventType) {
		return json({ error: 'Missing event_type' }, { status: 400 });
	}

	if (!SUBSCRIPTION_EVENTS.has(eventType)) {
		return json({ received: true }, { status: 200 });
	}

	const data = payload.data;
	if (!data || typeof data !== 'object') {
		return json({ received: true }, { status: 200 });
	}

	const customData = getCustomData(data);

	// ─── Determine the organisation ID ──────────────────────────────────
	let organisationId = null;

	// Flow 1: existing organisation
	const orgIdFromPayload = customData.organisation_id ?? customData.organisationId;
	if (orgIdFromPayload && typeof orgIdFromPayload === 'string') {
		organisationId = orgIdFromPayload.trim();
	}

	// Flow 2: new signup via pending_signup_id
	const pendingSignupId = customData.pending_signup_id ?? customData.pendingSignupId;
	if (!organisationId && pendingSignupId) {
		const pendingSignup = await findById('pending_signups', String(pendingSignupId).trim());
		if (!pendingSignup) {
			console.warn('[paddle webhook] Pending signup not found:', pendingSignupId);
			return json({ received: true }, { status: 200 });
		}
		if (pendingSignup.status === 'fulfilled' && pendingSignup.organisationId) {
			// Already fulfilled (e.g. duplicate webhook) — just use the existing org
			organisationId = pendingSignup.organisationId;
		} else {
			// Fulfil the signup: create org + admin
			try {
				organisationId = await fulfillPendingSignup(pendingSignup, data);
			} catch (err) {
				console.error('[paddle webhook] Failed to fulfil pending signup:', err?.message || err);
				return json({ error: 'Signup fulfilment failed' }, { status: 500 });
			}
		}
	}

	if (!organisationId) {
		console.warn('[paddle webhook] No organisation_id or pending_signup_id in custom_data for', eventType);
		return json({ received: true }, { status: 200 });
	}

	// ─── Update subscription state on the organisation ──────────────────

	const org = await findById('organisations', organisationId);
	if (!org) {
		console.warn('[paddle webhook] Organisation not found:', organisationId);
		return json({ received: true }, { status: 200 });
	}

	const plan = subscriptionToPlan(data);
	const areaPermissions = getAreaPermissionsForPlan(plan);
	const status = data.status || '';
	const subscriptionId = data.id || '';
	const customerId = data.customer_id || org.paddleCustomerId || '';
	const nextBilledAt = data.next_billed_at ?? null;
	const scheduledChange = data.scheduled_change;
	const cancelAtPeriodEnd = !!(scheduledChange && scheduledChange.action === 'cancel');

	// Per-seat quantity: read from subscription items
	const seatQuantity = (Array.isArray(data.items) && data.items.length > 0)
		? (data.items[0]?.quantity ?? 1)
		: 1;

	const patch = {
		paddleCustomerId: customerId || undefined,
		paddleSubscriptionId: subscriptionId || undefined,
		subscriptionStatus: status || undefined,
		subscriptionPlan: plan !== 'free' ? plan : null,
		currentPeriodEnd: nextBilledAt || null,
		cancelAtPeriodEnd: cancelAtPeriodEnd || undefined,
		paddleSeatQuantity: seatQuantity,
		areaPermissions
	};

	await updatePartial('organisations', organisationId, patch);
	invalidateOrganisationsCache();

	return json({ received: true }, { status: 200 });
}
