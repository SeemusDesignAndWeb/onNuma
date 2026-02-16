import { fail, redirect } from '@sveltejs/kit';
import { findById, update } from '$lib/crm/server/fileStore.js';
import { getAdminByEmail, getAdminById, createAdmin, updateAdminPassword, regenerateVerificationToken } from '$lib/crm/server/auth.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';
import { setHubSuperAdminEmail, getHubSuperAdminEmail, setCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { invalidateOrganisationsCache } from '$lib/crm/server/organisationsCache.js';

/** All Hub area permissions for super admin (same as permissions.js HUB_AREAS minus SUPER_ADMIN) */
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
	'users',
	'super_admin'
];

export async function load({ params, locals }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
	if (!multiOrgAdmin || multiOrgAdmin.role !== 'super_admin') {
		throw redirect(302, base('/multi-org/organisations'));
	}
	const org = await findById('organisations', params.id);
	if (!org) {
		throw redirect(302, base('/multi-org/organisations/' + params.id));
	}
	// This organisation's Hub super admin (per-org). When none set, pre-fill from org contact so "create org then set super admin" flow is smooth.
	const currentHubSuperAdminEmail = org.hubSuperAdminEmail || (await getHubSuperAdminEmail());
	let currentHubSuperAdminName = null;
	if (currentHubSuperAdminEmail) {
		const existing = await getAdminByEmail(currentHubSuperAdminEmail, params.id);
		if (existing) currentHubSuperAdminName = existing.name || null;
	}
	// When no super admin set for this org, pre-fill from org contact (create-org then set-password flow)
	const emailDefault = org.hubSuperAdminEmail ? currentHubSuperAdminEmail : (org.email || null);
	const nameDefault = org.hubSuperAdminEmail ? currentHubSuperAdminName : (org.contactName || org.email || null);
	return {
		organisation: org,
		multiOrgAdmin,
		currentHubSuperAdminEmail: emailDefault || null,
		currentHubSuperAdminName: nameDefault || null
	};
}

export const actions = {
	set: async ({ request, params, locals, url }) => {
		const multiOrgAdmin = locals.multiOrgAdmin;
		if (!multiOrgAdmin || multiOrgAdmin.role !== 'super_admin') {
			return fail(403, { error: 'Not authorised' });
		}
		const org = await findById('organisations', params.id);
		if (!org) {
			return fail(404, { error: 'Organisation not found' });
		}

		const form = await request.formData();
		const email = form.get('email')?.toString()?.trim() || '';
		const name = form.get('name')?.toString()?.trim() || '';
		const password = form.get('password')?.toString() || '';

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, { error: 'A valid email address is required' });
		}
		if (!name) {
			return fail(400, { error: 'Name is required' });
		}

		const normalizedEmail = email.toLowerCase().trim();
		let targetAdminId = null;

		const existingInOrg = await getAdminByEmail(email, params.id);
		const existingGlobal = await getAdminByEmail(email);
		if (existingInOrg) {
			// Update existing Hub admin in this org: ensure full super-admin capability and clear any lockout.
			await update('admins', existingInOrg.id, {
				name,
				permissions: FULL_PERMISSIONS,
				organisationId: params.id,
				failedLoginAttempts: 0,
				accountLockedUntil: null
			});
			targetAdminId = existingInOrg.id;
			if (password) {
				try {
					await updateAdminPassword(existingInOrg.id, password);
				} catch (err) {
					return fail(400, { error: err.message || 'Invalid password' });
				}
			}
		} else if (existingGlobal) {
			// Do not allow one Hub admin account to be super admin for multiple orgs.
			if (existingGlobal.organisationId && existingGlobal.organisationId !== params.id) {
				return fail(400, { error: 'This email is already used by another organisation.' });
			}
			await update('admins', existingGlobal.id, {
				name,
				permissions: FULL_PERMISSIONS,
				organisationId: params.id,
				failedLoginAttempts: 0,
				accountLockedUntil: null
			});
			targetAdminId = existingGlobal.id;
			if (password) {
				try {
					await updateAdminPassword(existingGlobal.id, password);
				} catch (err) {
					return fail(400, { error: err.message || 'Invalid password' });
				}
			}
		} else {
			// Create new Hub admin with full permissions
			if (!password) {
				return fail(400, { error: 'Password is required for a new Hub super admin' });
			}
			try {
				const created = await createAdmin({
					email: normalizedEmail,
					password,
					name,
					permissions: FULL_PERMISSIONS,
					organisationId: params.id
				});
				targetAdminId = created?.id ?? null;
				// If createAdmin returned an existing admin (e.g. race), ensure they're linked to this org and have full permissions
				if (targetAdminId) {
					const createdRecord = await getAdminById(targetAdminId);
					if (createdRecord && createdRecord.organisationId !== params.id) {
						await update('admins', targetAdminId, {
							organisationId: params.id,
							permissions: FULL_PERMISSIONS,
							name,
							failedLoginAttempts: 0,
							accountLockedUntil: null
						});
					}
				}
			} catch (err) {
				return fail(400, { error: err.message || 'Failed to create admin' });
			}
		}

		// Send welcome email only for new/unverified accounts.
		try {
			const targetAdmin = targetAdminId ? await getAdminById(targetAdminId) : null;
			const hubBaseUrl = org.hubDomain ? `https://${String(org.hubDomain).trim()}` : undefined;
			if (targetAdmin && !targetAdmin.emailVerified) {
				let verificationToken = targetAdmin.emailVerificationToken || null;
				const tokenExpired = !targetAdmin.emailVerificationTokenExpires
					|| new Date(targetAdmin.emailVerificationTokenExpires).getTime() <= Date.now();
				if (!verificationToken || tokenExpired) {
					verificationToken = await regenerateVerificationToken(targetAdmin.id);
				}
				await sendAdminWelcomeEmail({
					to: normalizedEmail,
					name,
					email: normalizedEmail,
					verificationToken,
					password: password || null,
					hubBaseUrl
				}, { url });
			}
		} catch (err) {
			return fail(500, { error: err.message || 'Hub super admin updated, but failed to send verification email.' });
		}

		await setHubSuperAdminEmail(email);
		// Store Hub super admin per organisation so this org's super admin is recognised
		await update('organisations', params.id, {
			...org,
			hubSuperAdminEmail: email,
			updatedAt: new Date().toISOString()
		});
		invalidateOrganisationsCache();
		// Set Hub's current org to this one so /hub login uses this org and finds the new super admin
		await setCurrentOrganisationId(params.id);

		// Canonical path so destination page always shows success notification
		throw redirect(302, '/multi-org/organisations/' + params.id + '?super_admin=set&organisationsUpdated=1');
	}
};
