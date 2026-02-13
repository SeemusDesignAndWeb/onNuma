import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection, findById, update, updatePartial } from '$lib/crm/server/fileStore.js';
import { createAdmin, getAdminByEmail, updateAdminPassword, generateVerificationToken } from '$lib/crm/server/auth.js';
import { invalidateHubDomainCache } from '$lib/crm/server/hubDomain.js';
import { getAreaPermissionsForPlan } from '$lib/crm/server/permissions.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';
import { getPaddleBaseUrl, getPriceIdForProfessionalByTier, getPaddleApiKey } from '$lib/crm/server/paddle.js';

/** Valid signup plans */
const VALID_SIGNUP_PLANS = ['free', 'professional'];

/** Default plan for trial signup */
const DEFAULT_PLAN = 'free';

/** All Hub area permissions for super admin (same as super-admin page) */
const FULL_PERMISSIONS = [
	'contacts',
	'lists',
	'rotas',
	'events',
	'meeting_planners',
	'emails',
	'forms',
	'safeguarding_forms',
	'members',
	'users'
];

function validateSignup(data) {
	const errors = {};
	if (!data.name || !String(data.name).trim()) {
		errors.name = 'Organisation name is required';
	}
	if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
		errors.email = 'Please enter a valid email address';
	}
	if (!data.contactName || !String(data.contactName).trim()) {
		errors.contactName = 'Your name is required';
	}
	if (!data.address || !String(data.address).trim()) {
		errors.address = 'Address is required';
	}
	if (!data.telephone || !String(data.telephone).trim()) {
		errors.telephone = 'Telephone is required';
	}
	if (!data.password) {
		errors.password = 'Password is required';
	} else if (data.password.length < 12) {
		errors.password = 'Password must be at least 12 characters';
	}
	return Object.keys(errors).length ? errors : null;
}

/**
 * Generate a subdomain from organisation name.
 * - Converts to lowercase
 * - Replaces spaces and special chars with hyphens
 * - Removes consecutive hyphens
 * - Trims hyphens from start/end
 * - Limits to 10 chars
 */
function generateSubdomain(name) {
	return String(name)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
		.replace(/-+/g, '-')          // Remove consecutive hyphens
		.replace(/^-|-$/g, '')        // Trim hyphens from start/end
		.slice(0, 10)                 // Limit to 10 characters
		.replace(/-$/g, '');          // Trim trailing hyphen after slice
}

/**
 * Generate a unique hub domain from organisation name.
 * Appends a number if the base subdomain is already taken.
 */
async function generateUniqueHubDomain(name) {
	const baseSubdomain = generateSubdomain(name);
	if (!baseSubdomain) {
		// Fallback if name produces empty subdomain
		return `org-${Date.now()}`;
	}
	
	let subdomain = baseSubdomain;
	let suffix = 1;
	
	// Check if subdomain is taken, append number if so
	while (await isHubDomainTaken(subdomain, null)) {
		subdomain = `${baseSubdomain}-${suffix}`;
		suffix++;
		// Safety limit to prevent infinite loop
		if (suffix > 100) {
			subdomain = `${baseSubdomain}-${Date.now()}`;
			break;
		}
	}
	
	return subdomain;
}

/** Base domain for hub subdomains (e.g. onnuma.com). */
function getHubBaseDomain() {
	return (process.env.HUB_BASE_DOMAIN || 'onnuma.com').toLowerCase().trim().replace(/^\.+|\.+$/g, '') || 'onnuma.com';
}

async function isHubDomainTaken(subdomain, excludeOrgId = null) {
	const orgs = await readCollection('organisations');
	const normalised = (subdomain && String(subdomain).toLowerCase().trim()) || '';
	if (!normalised) return false;
	const baseDomain = getHubBaseDomain();
	const fullHost = baseDomain ? `${normalised}.${baseDomain}` : null;
	return orgs.some(
		(o) => {
			if (!o.hubDomain || o.id === excludeOrgId) return false;
			const d = String(o.hubDomain).toLowerCase().trim();
			return d === normalised || (fullHost && d === fullHost);
		}
	);
}

/** True if this email is already the owner (contact/super admin) of an organisation. */
async function isEmailOrgOwner(email) {
	if (!email || !String(email).trim()) return false;
	const normalised = String(email).toLowerCase().trim();
	const orgs = await readCollection('organisations');
	return orgs.some(
		(o) =>
			(o.email && String(o.email).toLowerCase().trim() === normalised) ||
			(o.hubSuperAdminEmail && String(o.hubSuperAdminEmail).toLowerCase().trim() === normalised)
	);
}

/**
 * Ensure a signup user is available as a marketing contact.
 * This only runs when marketing consent is explicitly granted.
 */
async function registerMarketingContactForSignup({ organisationId, email, contactName, marketingConsent }) {
	if (!organisationId || !email || !marketingConsent) return;

	const nowIso = new Date().toISOString();
	const normalizedEmail = String(email).toLowerCase().trim();
	const nameParts = String(contactName || '').trim().split(/\s+/).filter(Boolean);
	const firstName = nameParts[0] || '';
	const lastName = nameParts.slice(1).join(' ');
	const today = nowIso.slice(0, 10);

	const contacts = await readCollection('contacts');
	const existing = contacts.find(
		(c) =>
			c.organisationId === organisationId &&
			String(c.email || '').toLowerCase().trim() === normalizedEmail
	);

	if (existing) {
		await update('contacts', existing.id, {
			...existing,
			email: normalizedEmail,
			firstName: firstName || existing.firstName || '',
			lastName: lastName || existing.lastName || '',
			subscribed: true,
			joinedAt: existing.joinedAt || nowIso,
			dateJoined: existing.dateJoined || today
		});
		return;
	}

	await create('contacts', {
		organisationId,
		email: normalizedEmail,
		firstName,
		lastName,
		subscribed: true,
		joinedAt: nowIso,
		dateJoined: today,
		notes: 'Created from signup marketing consent'
	});
}

export async function load({ url }) {
	const success = url.searchParams.get('success') === '1';
	const hub = url.searchParams.get('hub')?.trim() || null;
	const plan = url.searchParams.get('plan');
	const selectedPlan = plan === 'professional' || plan === 'free' ? plan : null;
	let hubLoginUrl = null;
	if (success && hub) {
		const baseDomain = process.env.HUB_BASE_DOMAIN || 'onnuma.com';
		const appBase = process.env.APP_BASE_URL || 'https://www.onnuma.com';
		const protocol = appBase.startsWith('http') ? new URL(appBase).protocol : 'https:';
		// Subdomain-only (e.g. "acme") → https://acme.onnuma.com/hub/auth/login
		const host = hub.includes('.') ? hub : `${hub}.${baseDomain}`;
		hubLoginUrl = `${protocol}//${host}/hub/auth/login`;
	}
	const hubSubdomainRequired = url.searchParams.get('hub_subdomain_required') === '1';

	// Only expose Paddle config to Professional signup pages.
	const paddleClientToken =
		selectedPlan === 'professional'
			? (process.env.PUBLIC_PADDLE_CLIENT_TOKEN || '').trim() || null
			: null;
	const paddleEnvironment =
		selectedPlan === 'professional'
			? (process.env.PADDLE_ENVIRONMENT || 'sandbox').toLowerCase()
			: null;

	return {
		success,
		plan: selectedPlan,
		hubLoginUrl,
		hubSubdomainRequired,
		paddleClientToken,
		paddleEnvironment
	};
}

export const actions = {
	create: async ({ request, url }) => {
		const form = await request.formData();
		const name = form.get('name')?.toString()?.trim() || '';
		const address = form.get('address')?.toString()?.trim() || '';
		const telephone = form.get('telephone')?.toString()?.trim() || '';
		const email = form.get('email')?.toString()?.trim() || '';
		const contactName = form.get('contactName')?.toString()?.trim() || '';
		const password = form.get('password')?.toString() || '';
		const marketingConsent = form.get('marketingConsent') === 'on';
		const signupPlanRaw = form.get('plan')?.toString()?.trim() || DEFAULT_PLAN;
		const signupPlan = VALID_SIGNUP_PLANS.includes(signupPlanRaw) ? signupPlanRaw : DEFAULT_PLAN;
		console.log('[signup] create action: plan from form:', JSON.stringify(signupPlanRaw), '→ signupPlan:', signupPlan);

		// Number of contacts (Professional): 1–500, fixed tier pricing. Paddle: one of 3 prices (£15/£25/£50), quantity 1.
		const numberOfContactsRaw = form.get('numberOfContacts')?.toString()?.trim();
		const contactsParsed = parseInt(numberOfContactsRaw || '30', 10);
		const contactCount = Number.isNaN(contactsParsed) ? 30 : Math.min(500, Math.max(1, contactsParsed));

		let errors = validateSignup({
			name,
			email,
			contactName,
			address,
			telephone,
			password
		});
		if (signupPlan === 'professional') {
			if (!numberOfContactsRaw || contactsParsed < 1 || contactsParsed > 500) {
				errors = errors || {};
				errors.numberOfContacts = 'Choose between 1 and 500 contacts';
			}
		}
		const valuesWithSeats = () => ({
			name,
			address,
			telephone,
			email,
			contactName,
			marketingConsent,
			plan: signupPlan,
			numberOfUsers: 1,
			numberOfContacts: signupPlan === 'professional' ? contactCount : 30
		});
		if (errors) {
			return fail(400, {
				errors,
				values: valuesWithSeats()
			});
		}

		// Only one signup per email as organisation owner (block if they already own an org)
		if (await isEmailOrgOwner(email)) {
			return fail(400, {
				errors: { email: 'This email address is already registered. Use a different email or log in.' },
				values: valuesWithSeats()
			});
		}

		// ─── Professional plan: payment first ────────────────────────────
		// Store the signup data as pending, redirect to Paddle checkout.
		// The org and admin are created by the webhook after payment succeeds.
		if (signupPlan === 'professional') {
			const apiKey = getPaddleApiKey();
			const priceId = getPriceIdForProfessionalByTier(contactCount);
			if (!apiKey) {
				console.error('[signup] PADDLE_API_KEY is missing or empty in .env');
				return fail(503, {
					errors: { _form: 'Billing is not configured: PADDLE_API_KEY is missing. Add it to .env and restart the app.' },
					values: valuesWithSeats()
				});
			}
			if (!priceId) {
				console.error('[signup] No Professional price ID for contact count', contactCount, '— set PADDLE_PRICE_ID_PROFESSIONAL_TIER1, _TIER2, _TIER3 in .env');
				return fail(503, {
					errors: { _form: 'Billing is not configured: add PADDLE_PRICE_ID_PROFESSIONAL_TIER1, _TIER2, and _TIER3 to .env, then restart the app.' },
					values: valuesWithSeats()
				});
			}

			// Save all signup data so the webhook can create the org + admin later
			let pendingSignup;
			try {
				pendingSignup = await create('pending_signups', {
					name,
					address,
					telephone,
					email,
					contactName,
					password, // Stored temporarily; deleted after org creation
					marketingConsent,
					plan: signupPlan,
					numberOfContacts: contactCount,
					status: 'pending',
					createdAt: new Date().toISOString()
				});
			} catch (err) {
				console.error('[signup] Failed to store pending signup:', err);
				return fail(500, {
					errors: { _form: 'Something went wrong. Please try again.' },
					values: valuesWithSeats()
				});
			}

			// Create Paddle checkout transaction
			try {
				const baseUrl = getPaddleBaseUrl();
				const body = {
					items: [{ price_id: priceId, quantity: 1 }],
					custom_data: { pending_signup_id: pendingSignup.id },
					collection_mode: 'automatic'
				};

				const res = await fetch(`${baseUrl}/transactions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${apiKey}`
					},
					body: JSON.stringify(body)
				});

				if (!res.ok) {
					const errText = await res.text();
					console.error('[signup] Paddle checkout error:', res.status, errText);
					let formMessage = 'Failed to start checkout. Please try again or choose the Free plan.';
					try {
						const errJson = JSON.parse(errText);
						const code = errJson?.error?.code;
						if (code === 'transaction_item_quantity_out_of_range') {
							formMessage =
								'Checkout failed: this Professional price in Paddle only allows quantity 31–100. Each of your three prices (TIER1, TIER2, TIER3) must allow quantity 1 (set min 1, max 1 in Paddle for each fixed price).';
							console.error(
								'[signup] Paddle price quantity range: the price used only allows 31–100. Set quantity to min 1, max 1 for all three Professional prices (TIER1, TIER2, TIER3) in Paddle.'
							);
						}
					} catch {
						// keep default formMessage
					}
					return fail(502, {
						errors: { _form: formMessage },
						values: valuesWithSeats()
					});
				}

				const data = await res.json();
				const transactionId = data?.data?.id;
				if (!transactionId) {
					console.error('[signup] No transaction ID in Paddle response:', data);
					return fail(502, {
						errors: { _form: 'Failed to start checkout. Please try again.' },
						values: valuesWithSeats()
					});
				}

				console.log('[signup] Paddle transaction created:', transactionId, '— returning to client for Paddle.js overlay checkout');
				// Return transaction ID so the client opens the Paddle.js overlay checkout.
				// Build + email happen only after payment, when we receive transaction.completed webhook.
				return { transactionId };
			} catch (err) {
				console.error('[signup] Paddle checkout unexpected error:', err);
				return fail(500, {
					errors: { _form: 'Something went wrong starting checkout. Please try again.' },
					values: valuesWithSeats()
				});
			}
		}

		// ─── Free plan: create org + admin immediately ───────────────────

		// Auto-generate hub subdomain from organisation name; store full host (subdomain.onnuma.com)
		const subdomain = await generateUniqueHubDomain(name);
		const baseDomain = getHubBaseDomain();
		const fullHubDomain = subdomain && baseDomain ? `${subdomain}.${baseDomain}` : subdomain || null;

		// Get area permissions based on the selected signup plan
		const areaPermissions = getAreaPermissionsForPlan(signupPlan);

		let org;
		let admin;
		try {
			org = await create('organisations', {
				name,
				address,
				telephone,
				email,
				contactName,
				hubDomain: fullHubDomain,
				areaPermissions,
				signupPlan,
				isHubOrganisation: true,
				marketingConsent: !!marketingConsent
			});
			invalidateHubDomainCache();

			// Create Hub admin with full permissions (super admin for this org)
			admin = await createAdmin({
				email,
				password,
				name: contactName,
				permissions: FULL_PERMISSIONS,
				organisationId: org.id
			});

			// Ensure admin has the password they just set
			await updateAdminPassword(admin.id, password);

			// Ensure verification token exists for welcome email
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

			// Link this org's super admin to the new user
			await updatePartial('organisations', org.id, { hubSuperAdminEmail: email });

			// Register as a marketing contact when user opted in during signup.
			await registerMarketingContactForSignup({
				organisationId: org.id,
				email,
				contactName,
				marketingConsent
			});

			// Verify org is visible in the store
			const verifyOrg = await findById('organisations', org.id);
			if (!verifyOrg) {
				console.error('[signup] Organisation not found after create:', org.id);
				return fail(500, {
					errors: { _form: 'Organisation was created but could not be verified. Please contact support.' },
					values: valuesWithSeats()
				});
			}
		} catch (err) {
			console.error('[signup] create failed:', err);
			const message = err?.message || 'Something went wrong. Please try again.';
			if (message.includes('Password')) {
				return fail(400, {
					errors: { password: message },
					values: valuesWithSeats()
				});
			}
			return fail(500, {
				errors: { _form: message },
				values: valuesWithSeats()
			});
		}

		// Send welcome/verification email
		console.log('[signup] Looking up admin for welcome email:', email);
		const fullAdmin = await getAdminByEmail(email);
		console.log('[signup] Admin found:', fullAdmin ? 'yes' : 'no', 'Has token:', !!fullAdmin?.emailVerificationToken);
		
		if (fullAdmin?.emailVerificationToken) {
			console.log('[signup] Attempting to send welcome email to:', email);
			try {
				const appOrigin = url.origin || (process.env.APP_BASE_URL && process.env.APP_BASE_URL.startsWith('http') ? process.env.APP_BASE_URL : 'https://www.onnuma.com');
				const protocol = new URL(appOrigin).protocol;
				const hubBaseUrl = fullHubDomain ? `${protocol}//${fullHubDomain}` : undefined;
				const emailResult = await sendAdminWelcomeEmail({
					to: email,
					name: contactName,
					email,
					verificationToken: fullAdmin.emailVerificationToken,
					password,
					hubBaseUrl
				}, { url });
				console.log('[signup] Welcome email sent successfully:', JSON.stringify(emailResult));
			} catch (emailErr) {
				console.error('[signup] Welcome email failed:', emailErr?.message || emailErr);
				console.error('[signup] Full error:', JSON.stringify(emailErr, Object.getOwnPropertyNames(emailErr)));
			}
		} else {
			console.warn('[signup] Skipping welcome email - no verification token found for admin:', email);
		}

		throw redirect(302, `/signup?success=1&plan=${signupPlan}&hub=${encodeURIComponent(subdomain)}`);
	}
};
