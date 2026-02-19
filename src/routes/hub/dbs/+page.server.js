import { redirect } from '@sveltejs/kit';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { findById } from '$lib/crm/server/fileStore.js';
import { getTeamsForOrganisation } from '$lib/crm/server/teams.js';
import { getDbsDashboardRows } from '$lib/crm/server/dbs.js';
import { hasRouteAccess, isSuperAdmin } from '$lib/crm/server/permissions.js';

export async function load({ parent, url }) {
	const { organisationId, currentOrganisation, organisationAreaPermissions, admin, superAdminEmail } = await parent();
	if (!organisationId || !(currentOrganisation?.dbsBoltOn ?? currentOrganisation?.churchBoltOn)) {
		throw redirect(302, '/hub');
	}
	const canAccess = admin && (
		isSuperAdmin(admin, superAdminEmail) ||
		hasRouteAccess(admin, '/hub/contacts', superAdminEmail, organisationAreaPermissions) ||
		hasRouteAccess(admin, '/hub/schedules', superAdminEmail, organisationAreaPermissions) ||
		(Array.isArray(admin.teamLeaderForTeamIds) && admin.teamLeaderForTeamIds.length > 0)
	);
	if (!canAccess) {
		throw redirect(302, '/hub');
	}

	const dbsRenewalYears = currentOrganisation?.dbsRenewalYears ?? 3;
	const filterTeamId = url.searchParams.get('team') || null;

	const [teams, rows] = await Promise.all([
		getTeamsForOrganisation(organisationId),
		getDbsDashboardRows(organisationId, dbsRenewalYears, filterTeamId)
	]);

	return {
		rows,
		teams,
		filterTeamId,
		dbsRenewalYears
	};
}
