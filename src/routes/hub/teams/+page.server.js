import { fail, redirect } from '@sveltejs/kit';
import { getCsrfToken, verifyCsrfToken, getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';
import {
	getTeamsForOrganisation,
	createTeam,
	deleteTeam,
	getTeamTemplates
} from '$lib/crm/server/teams.js';

function canManageTeams(admin) {
	if (!admin) return false;
	if (isSuperAdmin(admin)) return true;
	return Array.isArray(admin.permissions) && admin.permissions.includes('teams');
}

export async function load({ cookies, locals }) {
	const admin = locals.admin || await getAdminFromCookies(cookies);
	if (!admin) throw redirect(302, '/hub/auth/login');

	const organisationId = await getCurrentOrganisationId();
	const allTeams = await getTeamsForOrganisation(organisationId);

	const canManage = canManageTeams(admin);
	const leaderTeamIds = Array.isArray(admin.teamLeaderForTeamIds) ? admin.teamLeaderForTeamIds : [];

	// Restricted team leaders only see their assigned teams
	const teams = canManage
		? allTeams
		: leaderTeamIds.length > 0
			? allTeams.filter(t => leaderTeamIds.includes(t.id))
			: allTeams;

	return {
		teams,
		templates: getTeamTemplates(),
		canManage,
		csrfToken: getCsrfToken(cookies)
	};
}

export const actions = {
	create: async ({ request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) {
			return fail(403, { error: 'Forbidden' });
		}
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}
		const name = (data.get('name') || '').trim();
		if (!name) return fail(400, { error: 'Team name is required' });
		const description = (data.get('description') || '').trim();
		let roles = [];
		try { roles = JSON.parse(data.get('roles') || '[]'); } catch (_) {}
		const organisationId = await getCurrentOrganisationId();
		const team = await createTeam({ name, description, roles, organisationId });
		throw redirect(302, `/hub/teams/${team.id}`);
	},

	delete: async ({ request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) {
			return fail(403, { error: 'Forbidden' });
		}
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}
		const teamId = data.get('teamId');
		if (!teamId) return fail(400, { error: 'Team ID is required' });
		const organisationId = await getCurrentOrganisationId();
		try {
			await deleteTeam(teamId, organisationId);
		} catch (err) {
			return fail(400, { error: err?.message || 'Failed to delete team' });
		}
		return { success: true };
	}
};
