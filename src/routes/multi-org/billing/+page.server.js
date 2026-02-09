import { redirect } from '@sveltejs/kit';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { getPlanFromAreaPermissions } from '$lib/crm/server/permissions.js';

export async function load({ locals }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
	if (!multiOrgAdmin) {
		throw redirect(302, base('/multi-org/auth/login'));
	}
	const raw = await readCollection('organisations');
	const organisations = (Array.isArray(raw) ? raw : []).filter(Boolean);
	organisations.sort((a, b) => ((a && a.name) || '').localeCompare((b && b.name) || ''));

	const billingList = organisations.map((org) => ({
		id: org.id,
		name: org.name || '—',
		contactName: org.contactName || null,
		plan: getPlanFromAreaPermissions(org.areaPermissions) || 'free',
		subscriptionStatus: org.subscriptionStatus ?? null,
		currentPeriodEnd: org.currentPeriodEnd ?? null,
		cancelAtPeriodEnd: !!org.cancelAtPeriodEnd,
		hasPaddleCustomer: !!(org.paddleCustomerId),
		archivedAt: org.archivedAt ?? null
	}));

	return {
		billingList,
		multiOrgAdmin,
		multiOrgBasePath: locals.multiOrgAdminDomain ? '' : '/multi-org'
	};
}
