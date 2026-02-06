import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection, findById, update, updatePartial } from '$lib/crm/server/fileStore.js';
import { createAdmin, getAdminByEmail, updateAdminPassword, generateVerificationToken } from '$lib/crm/server/auth.js';
import { invalidateHubDomainCache } from '$lib/crm/server/hubDomain.js';
import { getAreaPermissionsForPlan } from '$lib/crm/server/permissions.js';
import { isValidHubDomain, normaliseHost } from '$lib/crm/server/hubDomain.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';

/** Free plan only for trial signup */
const PLAN = 'free';

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
	const hubDomain = data.hubDomain ? String(data.hubDomain).trim() : '';
	if (hubDomain && !isValidHubDomain(hubDomain)) {
		errors.hubDomain = 'Enter a valid hostname (e.g. hub.yourchurch.org)';
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

async function isHubDomainTaken(normalisedDomain, excludeOrgId = null) {
	const orgs = await readCollection('organisations');
	return orgs.some(
		(o) =>
			o.hubDomain &&
			normaliseHost(String(o.hubDomain).trim()) === normalisedDomain &&
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
		const hubDomain = form.get('hubDomain')?.toString()?.trim() || '';
		const password = form.get('password')?.toString() || '';
		const marketingConsent = form.get('marketingConsent') === 'on';

		const errors = validateSignup({
			name,
			email,
			hubDomain,
			contactName,
			address,
			telephone,
			password
		});
		if (errors) {
			return fail(400, {
				errors,
				values: { name, address, telephone, email, contactName, hubDomain, marketingConsent }
			});
		}

		// Only one signup per email as organisation owner (block if they already own an org)
		if (await isEmailOrgOwner(email)) {
			return fail(400, {
				errors: { email: 'This email address is already registered. Use a different email or log in.' },
				values: { name, address, telephone, email, contactName, hubDomain, marketingConsent }
			});
		}

		// Only one signup per domain name
		if (hubDomain && (await isHubDomainTaken(normaliseHost(hubDomain), null))) {
			return fail(400, {
				errors: { hubDomain: 'This hub domain is already in use. Choose a different domain.' },
				values: { name, address, telephone, email, contactName, hubDomain, marketingConsent }
			});
		}

		const areaPermissions = getAreaPermissionsForPlan(PLAN);

		let org;
		let admin;
		try {
			// Create organisation (free plan; no email/SMTP settings).
			// marketingConsent stored so we know who we can market to (query organisations where marketingConsent === true).
			org = await create('organisations', {
				name,
				address,
				telephone,
				email,
				contactName,
				hubDomain: hubDomain || null,
				areaPermissions,
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
					values: { name, address, telephone, email, contactName, hubDomain, marketingConsent }
				});
			}
		} catch (err) {
			console.error('[signup] create failed:', err);
			const message = err?.message || 'Something went wrong. Please try again.';
			if (message.includes('Password')) {
				return fail(400, {
					errors: { password: message },
					values: { name, address, telephone, email, contactName, hubDomain, marketingConsent }
				});
			}
			return fail(500, {
				errors: { _form: message },
				values: { name, address, telephone, email, contactName, hubDomain, marketingConsent }
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

		throw redirect(302, '/signup?success=1');
	}
};
