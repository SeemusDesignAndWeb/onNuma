import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection, findById, update, updatePartial } from '$lib/crm/server/fileStore.js';
import { createAdmin, getAdminByEmail, updateAdminPassword, generateVerificationToken } from '$lib/crm/server/auth.js';
import { invalidateHubDomainCache } from '$lib/crm/server/hubDomain.js';
import { getAreaPermissionsForPlan } from '$lib/crm/server/permissions.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';
import { getPaddleBaseUrl, getPriceIdForPlan } from '$lib/crm/server/paddle.js';
import { env } from '$env/dynamic/private';

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

async function isHubDomainTaken(subdomain, excludeOrgId = null) {
	const orgs = await readCollection('organisations');
	const normalised = subdomain.toLowerCase().trim();
	return orgs.some(
		(o) =>
			o.hubDomain &&
			String(o.hubDomain).toLowerCase().trim() === normalised &&
			o.id !== excludeOrgId
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

export async function load({ url }) {
	return {
		success: url.searchParams.get('success') === '1'
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

		const errors = validateSignup({
			name,
			email,
			contactName,
			address,
			telephone,
			password
		});
		if (errors) {
			return fail(400, {
				errors,
				values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
			});
		}

		// Only one signup per email as organisation owner (block if they already own an org)
		if (await isEmailOrgOwner(email)) {
			return fail(400, {
				errors: { email: 'This email address is already registered. Use a different email or log in.' },
				values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
			});
		}

		// ─── Professional plan: payment first ────────────────────────────
		// Store the signup data as pending, redirect to Paddle checkout.
		// The org and admin are created by the webhook after payment succeeds.
		if (signupPlan === 'professional') {
			const apiKey = env.PADDLE_API_KEY;
			const priceId = getPriceIdForPlan('professional', 1);
			if (!apiKey || !priceId) {
				return fail(503, {
					errors: { _form: 'Billing is not configured yet. Please try the Free plan or contact us.' },
					values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
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
					status: 'pending',
					createdAt: new Date().toISOString()
				});
			} catch (err) {
				console.error('[signup] Failed to store pending signup:', err);
				return fail(500, {
					errors: { _form: 'Something went wrong. Please try again.' },
					values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
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
					return fail(502, {
						errors: { _form: 'Failed to start checkout. Please try again or choose the Free plan.' },
						values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
					});
				}

				const data = await res.json();
				const checkoutUrl = data?.data?.checkout?.url;
				if (!checkoutUrl) {
					console.error('[signup] No checkout URL in Paddle response:', data);
					return fail(502, {
						errors: { _form: 'Failed to start checkout. Please try again.' },
						values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
					});
				}

				// Redirect to Paddle checkout — payment happens there.
				// On success, Paddle redirects to the success URL and fires the webhook.
				throw redirect(302, checkoutUrl);
			} catch (err) {
				if (err.status === 302) throw err; // re-throw redirect
				console.error('[signup] Paddle checkout unexpected error:', err);
				return fail(500, {
					errors: { _form: 'Something went wrong starting checkout. Please try again.' },
					values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
				});
			}
		}

		// ─── Free plan: create org + admin immediately ───────────────────

		// Auto-generate hub domain from organisation name
		const hubDomain = await generateUniqueHubDomain(name);

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
				hubDomain: hubDomain || null,
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
				permissions: FULL_PERMISSIONS
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

			// Verify org is visible in the store
			const verifyOrg = await findById('organisations', org.id);
			if (!verifyOrg) {
				console.error('[signup] Organisation not found after create:', org.id);
				return fail(500, {
					errors: { _form: 'Organisation was created but could not be verified. Please contact support.' },
					values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
				});
			}
		} catch (err) {
			console.error('[signup] create failed:', err);
			const message = err?.message || 'Something went wrong. Please try again.';
			if (message.includes('Password')) {
				return fail(400, {
					errors: { password: message },
					values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
				});
			}
			return fail(500, {
				errors: { _form: message },
				values: { name, address, telephone, email, contactName, marketingConsent, plan: signupPlan }
			});
		}

		// Send welcome/verification email
		console.log('[signup] Looking up admin for welcome email:', email);
		const fullAdmin = await getAdminByEmail(email);
		console.log('[signup] Admin found:', fullAdmin ? 'yes' : 'no', 'Has token:', !!fullAdmin?.emailVerificationToken);
		
		if (fullAdmin?.emailVerificationToken) {
			console.log('[signup] Attempting to send welcome email to:', email);
			try {
				const emailResult = await sendAdminWelcomeEmail({
					to: email,
					name: contactName,
					email,
					verificationToken: fullAdmin.emailVerificationToken,
					password
				}, { url });
				console.log('[signup] Welcome email sent successfully:', JSON.stringify(emailResult));
			} catch (emailErr) {
				console.error('[signup] Welcome email failed:', emailErr?.message || emailErr);
				console.error('[signup] Full error:', JSON.stringify(emailErr, Object.getOwnPropertyNames(emailErr)));
			}
		} else {
			console.warn('[signup] Skipping welcome email - no verification token found for admin:', email);
		}

		throw redirect(302, `/signup?success=1&plan=${signupPlan}`);
	}
};
