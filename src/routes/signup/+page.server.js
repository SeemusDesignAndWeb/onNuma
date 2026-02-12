import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection, findById, update, updatePartial } from '$lib/crm/server/fileStore.js';
import { createAdmin, getAdminByEmail, updateAdminPassword, generateVerificationToken } from '$lib/crm/server/auth.js';
import { invalidateHubDomainCache } from '$lib/crm/server/hubDomain.js';
import { getAreaPermissionsForPlan } from '$lib/crm/server/permissions.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';

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

		// Auto-generate hub domain from organisation name
		const hubDomain = await generateUniqueHubDomain(name);

		// Get area permissions based on the selected signup plan
		const areaPermissions = getAreaPermissionsForPlan(signupPlan);

		let org;
		let admin;
		try {
			// Create organisation with selected plan permissions.
			// signupPlan stored so we know what plan they signed up for (for billing/upgrade tracking).
			// marketingConsent stored so we know who we can market to (query organisations where marketingConsent === true).
			org = await create('organisations', {
				name,
				address,
				telephone,
				email,
				contactName,
				hubDomain: hubDomain || null,
				areaPermissions,
				signupPlan, // Track which plan button they clicked (free or professional)
				isHubOrganisation: true,
				marketingConsent: !!marketingConsent
			});
			invalidateHubDomainCache();

			// Create Hub admin with full permissions (super admin for this org), or get existing if email already in admins
			admin = await createAdmin({
				email,
				password,
				name: contactName,
				permissions: FULL_PERMISSIONS
			});

			// Ensure admin has the password they just set (required when reusing an existing admin who had no org)
			await updateAdminPassword(admin.id, password);

			// Ensure verification token exists for welcome email (existing admins don't get one from createAdmin)
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

			// Link this org's super admin to the new user (use updatePartial to avoid full read-modify-write race)
			await updatePartial('organisations', org.id, { hubSuperAdminEmail: email });

			// Verify org is visible in the store (so multi-org list will show it)
			const verifyOrg = await findById('organisations', org.id);
			if (!verifyOrg) {
				console.error('[signup] Organisation not found after create:', org.id);
				return fail(500, {
					errors: { _form: 'Organisation was created but could not be verified. Please contact support or check the organisations list.' },
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

		// Send welcome/verification email (app uses Resend/Mailgun; no org email settings)
		const fullAdmin = await getAdminByEmail(email);
		if (fullAdmin?.emailVerificationToken) {
			try {
				await sendAdminWelcomeEmail({
					to: email,
					name: contactName,
					email,
					verificationToken: fullAdmin.emailVerificationToken,
					password
				}, { url });
			} catch (emailErr) {
				console.error('[signup] welcome email failed:', emailErr);
			}
		}

		throw redirect(302, `/signup?success=1&plan=${signupPlan}`);
	}
};
