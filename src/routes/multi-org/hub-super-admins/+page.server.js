import { redirect } from '@sveltejs/kit';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';

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
