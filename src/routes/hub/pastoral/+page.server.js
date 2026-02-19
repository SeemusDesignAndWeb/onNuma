import { redirect } from '@sveltejs/kit';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { findById } from '$lib/crm/server/fileStore.js';
import { isSuperAdmin, hasRouteAccess } from '$lib/crm/server/permissions.js';
import { getAllActivePastoralFlags } from '$lib/crm/server/pastoral.js';

export async function load({ parent }) {
	const { organisationId, currentOrganisation, organisationAreaPermissions, admin, superAdminEmail } = await parent();
	if (!organisationId || !(currentOrganisation?.dbsBoltOn ?? currentOrganisation?.churchBoltOn)) {
		throw redirect(302, '/hub');
	}
	const canAccess =
		admin && (
			isSuperAdmin(admin, superAdminEmail) ||
			hasRouteAccess(admin, '/hub/contacts', superAdminEmail, organisationAreaPermissions) ||
			hasRouteAccess(admin, '/hub/schedules', superAdminEmail, organisationAreaPermissions) ||
			(Array.isArray(admin.teamLeaderForTeamIds) && admin.teamLeaderForTeamIds.length > 0)
		);
	if (!canAccess) throw redirect(302, '/hub');

	const flags = await getAllActivePastoralFlags(organisationId);
	return { flags };
}
