import { fail, redirect } from '@sveltejs/kit';
import { findById, update } from '$lib/crm/server/fileStore.js';
import { getAdminByEmail, createAdmin, updateAdminPassword } from '$lib/crm/server/auth.js';
import { setHubSuperAdminEmail, getHubSuperAdminEmail } from '$lib/crm/server/settings.js';
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
	'users'
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
	// This organisation's Hub super admin (per-org)
	const currentHubSuperAdminEmail = org.hubSuperAdminEmail || (await getHubSuperAdminEmail());
	let currentHubSuperAdminName = null;
	if (currentHubSuperAdminEmail) {
		const existing = await getAdminByEmail(currentHubSuperAdminEmail, params.id);
		if (existing) currentHubSuperAdminName = existing.name || null;
	}
	return {
		organisation: org,
		multiOrgAdmin,
		currentHubSuperAdminEmail: currentHubSuperAdminEmail || null,
		currentHubSuperAdminName: currentHubSuperAdminName || null
	};
}

export const actions = {
	set: async ({ request, params, locals }) => {
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

		const existing = await getAdminByEmail(email, params.id);
		if (existing) {
			// Update existing Hub admin: set name and full permissions
			await update('admins', existing.id, {
				name,
				permissions: FULL_PERMISSIONS
			});
			if (password) {
				try {
					await updateAdminPassword(existing.id, password);
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
				await createAdmin({
					email,
					password,
					name,
					permissions: FULL_PERMISSIONS,
					organisationId: params.id
				});
			} catch (err) {
				return fail(400, { error: err.message || 'Failed to create admin' });
			}
		}

		await setHubSuperAdminEmail(email);
		// Store Hub super admin per organisation so this org's super admin is recognised
		await update('organisations', params.id, {
			...org,
			hubSuperAdminEmail: email,
			updatedAt: new Date().toISOString()
		});
		invalidateOrganisationsCache();

		throw redirect(302, getMultiOrgPublicPath('/multi-org/organisations/' + params.id + '?super_admin=set', !!locals.multiOrgAdminDomain));
	}
};
