/**
 * Paddle Billing webhook endpoint.
 * Receives subscription (and optionally transaction) events, verifies signature,
 * and updates the organisation's subscription state and areaPermissions.
 * @see https://developer.paddle.com/webhooks/respond-to-webhooks
 * @see https://developer.paddle.com/webhooks/signature-verification
 */

import { json } from '@sveltejs/kit';
import { createHmac, timingSafeEqual } from 'crypto';
import { findById, updatePartial } from '$lib/crm/server/fileStore.js';
import { getAreaPermissionsForPlan } from '$lib/crm/server/permissions.js';
import { invalidateOrganisationsCache } from '$lib/crm/server/organisationsCache.js';
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

/**
 * Map Paddle subscription status and items to plan.
 * Recognises both tier-1 and tier-2 price IDs for each plan so that
 * crossing the seat threshold doesn't break plan detection.
 */
function subscriptionToPlan(data) {
	const status = data?.status;
	if (status === 'canceled' || status === 'past_due' || status === 'paused') {
		return 'free';
	}

	// Collect all known price IDs per plan (tier 1 + tier 2)
	const enterpriseIds = new Set(
		[env.PADDLE_PRICE_ID_ENTERPRISE, env.PADDLE_PRICE_ID_ENTERPRISE_TIER2].filter(Boolean)
	);
	const professionalIds = new Set(
		[env.PADDLE_PRICE_ID_PROFESSIONAL, env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2].filter(Boolean)
	);

	const items = data?.items;
	if (Array.isArray(items) && items.length > 0) {
		const priceId = items[0]?.price?.id;
		if (priceId && enterpriseIds.has(priceId)) return 'enterprise';
		if (priceId && professionalIds.has(priceId)) return 'professional';
	}
	return 'free';
}

/**
 * Extract organisation_id from subscription or transaction custom_data.
 */
function getOrganisationIdFromPayload(data) {
	const custom = data?.custom_data;
	if (custom && typeof custom === 'object') {
		const id = custom.organisation_id ?? custom.organisationId;
		if (id && typeof id === 'string') return id.trim();
	}
	return null;
}

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

	const organisationId = getOrganisationIdFromPayload(data);
	if (!organisationId) {
		console.warn('[paddle webhook] No organisation_id in custom_data for', eventType);
		return json({ received: true }, { status: 200 });
	}

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
