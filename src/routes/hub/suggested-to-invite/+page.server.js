import { redirect } from '@sveltejs/kit';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';
import { getSuggestedPeople } from '$lib/crm/server/suggestedToInvite.js';
import { hasRouteAccess } from '$lib/crm/permissions.js';
import { getCachedOrganisations } from '$lib/crm/server/organisationsCache.js';

export async function load({ locals, parent }) {
	const admin = locals?.admin;
	if (!admin) {
		throw redirect(302, '/hub/auth/login');
	}
	const organisationId = await getCurrentOrganisationId();
	const { superAdminEmail, organisationAreaPermissions } = await parent();
	const canAccessContacts = hasRouteAccess(admin, '/hub/contacts', superAdminEmail, organisationAreaPermissions);
	if (!canAccessContacts) {
		throw redirect(302, '/hub?error=access_denied');
	}
	const organisations = await getCachedOrganisations();
	const org = organisationId ? organisations?.find((o) => o.id === organisationId) : null;

	const suggestedPeople = await getSuggestedPeople(organisationId);

	return {
		admin,
		organisationId,
		organisationName: org?.name || 'Organisation',
		suggestedPeople: suggestedPeople || []
	};
}
