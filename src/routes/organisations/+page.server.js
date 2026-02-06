import { redirect } from '@sveltejs/kit';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { setCurrentOrganisationId, getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { getPlanFromAreaPermissions } from '$lib/crm/server/permissions.js';

/** List load: organisations and current hub. Layout handles redirect when not on admin subdomain. */
export async function load({ locals }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	if (!multiOrgAdmin) {
		return { organisations: [], currentHubOrganisationId: null };
	}
	const raw = await readCollection('organisations');
	const organisations = (Array.isArray(raw) ? raw : []).filter(Boolean);
	organisations.sort((a, b) => ((a && a.name) || '').localeCompare((b && b.name) || ''));

	const contactsRaw = await readCollection('contacts');
	const contacts = Array.isArray(contactsRaw) ? contactsRaw : [];
	const contactCountByOrg = contacts.reduce((acc, c) => {
		const id = c.organisationId ?? null;
		if (id) acc[id] = (acc[id] ?? 0) + 1;
		return acc;
	}, /** @type {Record<string, number>} */ ({}));

	const organisationsWithCounts = organisations.map((org) => ({
		...org,
		contactCount: org?.id ? (contactCountByOrg[org.id] ?? 0) : 0,
		plan: getPlanFromAreaPermissions(org?.areaPermissions) || 'free'
	}));

	const currentHubOrganisationId = await getCurrentOrganisationId();
	return {
		organisations: organisationsWithCounts,
		currentHubOrganisationId
	};
}

export const actions = {
	setAsHub: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) {
			return { error: 'Not authorised' };
		}
		const form = await request.formData();
		const organisationId = form.get('organisationId')?.toString()?.trim();
		if (!organisationId) {
			return { error: 'Organisation ID required' };
		}
		await setCurrentOrganisationId(organisationId);
		throw redirect(302, '/organisations?hub_set=1');
	}
};
