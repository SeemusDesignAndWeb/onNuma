import { redirect, fail } from '@sveltejs/kit';
import { readCollection, remove } from '$lib/crm/server/fileStore.js';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { invalidateAdminSessions } from '$lib/crm/server/auth.js';

/**
 * Hub super admins audit page.
 * Each organisation has one Hub super admin (hubSuperAdminEmail).
 * This page lists: (1) each org and its super admin; (2) all Hub admins and whether they are attached to an org or orphaned.
 */
export async function load({ locals }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
	if (!multiOrgAdmin) {
		throw redirect(302, base('/multi-org/auth/login'));
	}

	const [rawOrgs, rawAdmins] = await Promise.all([
		readCollection('organisations'),
		readCollection('admins')
	]);
	const organisations = (Array.isArray(rawOrgs) ? rawOrgs : []).filter(Boolean);
	const admins = (Array.isArray(rawAdmins) ? rawAdmins : []).map((a) => ({
		id: a.id,
		email: a.email || '',
		name: a.name || '—',
		createdAt: a.createdAt || null
	}));

	const normalise = (e) => (e && String(e).toLowerCase().trim()) || '';
	const orgBySuperAdminEmail = new Map();
	organisations.forEach((org) => {
		const email = org.hubSuperAdminEmail || org.email;
		if (email) orgBySuperAdminEmail.set(normalise(email), { id: org.id, name: org.name || '—' });
	});

	const sortedOrgs = [...organisations].sort((a, b) => ((a.name || '').localeCompare(b.name || '')));
	// Per org: super admin email and whether that admin exists
	const orgsWithSuperAdmin = sortedOrgs
		.map((org) => {
			const email = org.hubSuperAdminEmail || org.email || null;
			const admin = email ? admins.find((a) => normalise(a.email) === normalise(email)) : null;
			return {
				id: org.id,
				name: org.name || '—',
				hubSuperAdminEmail: email,
				adminName: admin?.name ?? null,
				adminExists: !!admin,
				missing: !email || !admin
			};
		});

	// Per admin: attached to which org (if any)
	const adminStatusList = admins.map((admin) => {
		const org = admin.email ? orgBySuperAdminEmail.get(normalise(admin.email)) : null;
		return {
			id: admin.id,
			email: admin.email,
			name: admin.name,
			createdAt: admin.createdAt,
			attachedToOrgId: org?.id ?? null,
			attachedToOrgName: org?.name ?? null,
			orphaned: !org
		};
	});

	const orphanedAdmins = adminStatusList.filter((a) => a.orphaned);

	return {
		multiOrgAdmin,
		multiOrgBasePath: locals.multiOrgAdminDomain ? '' : '/multi-org',
		orgsWithSuperAdmin,
		adminStatusList,
		orphanedAdmins,
		organisations
	};
}

/** Build the same orphaned set as load (admin id -> true if orphaned). */
async function getOrphanedAdminIds() {
	const [rawOrgs, rawAdmins] = await Promise.all([
		readCollection('organisations'),
		readCollection('admins')
	]);
	const organisations = (Array.isArray(rawOrgs) ? rawOrgs : []).filter(Boolean);
	const admins = (Array.isArray(rawAdmins) ? rawAdmins : []).filter(Boolean);
	const normalise = (e) => (e && String(e).toLowerCase().trim()) || '';
	const superAdminEmails = new Set();
	organisations.forEach((org) => {
		const email = org.hubSuperAdminEmail || org.email;
		if (email) superAdminEmails.add(normalise(email));
	});
	const orphanedIds = new Set(
		admins
			.filter((a) => !a.email || !superAdminEmails.has(normalise(a.email)))
			.map((a) => a.id)
	);
	return orphanedIds;
}

export const actions = {
	deleteOrphanedAdmin: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const data = await request.formData();
		const adminId = data.get('adminId')?.toString()?.trim();
		if (!adminId) {
			return fail(400, { error: 'Missing admin ID' });
		}
		const orphanedIds = await getOrphanedAdminIds();
		if (!orphanedIds.has(adminId)) {
			return fail(400, { error: 'This admin is attached to an organisation and cannot be deleted here.' });
		}
		try {
			await invalidateAdminSessions(adminId);
			await remove('admins', adminId);
		} catch (err) {
			console.error('[hub-super-admins] deleteOrphanedAdmin failed:', err?.message || err);
			return fail(500, { error: 'Failed to delete admin. Please try again.' });
		}
		return { deleted: true };
	}
};
