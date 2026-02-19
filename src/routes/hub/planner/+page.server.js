import { redirect, fail } from '@sveltejs/kit';
import { getAdminFromCookies, getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { readCollection, findById, update } from '$lib/crm/server/fileStore.js';
import { getTeamsForOrganisation } from '$lib/crm/server/teams.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';
import { validateRota } from '$lib/crm/server/validators.js';

const MAX_OCCURRENCES = 8;

function isRestrictedTeamLeader(admin) {
	if (!admin) return false;
	if (isSuperAdmin(admin)) return false;
	if (!Array.isArray(admin.teamLeaderForTeamIds) || admin.teamLeaderForTeamIds.length === 0) return false;
	const broadAreas = ['contacts', 'lists', 'events', 'meeting_planners', 'emails', 'forms', 'members', 'safeguarding_forms'];
	const perms = new Set(Array.isArray(admin.permissions) ? admin.permissions : []);
	return !broadAreas.some(p => perms.has(p));
}

function contactDisplayName(contact) {
	const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
	return name || contact.email || 'Unknown';
}

export async function load({ url, cookies, locals, parent }) {
	const admin = locals.admin || await getAdminFromCookies(cookies);
	if (!admin) throw redirect(302, '/hub/auth/login');

	const hasAccess =
		isSuperAdmin(admin) ||
		(Array.isArray(admin.permissions) && (admin.permissions.includes('rotas') || admin.permissions.includes('teams') || admin.permissions.includes('meeting_planners'))) ||
		(Array.isArray(admin.teamLeaderForTeamIds) && admin.teamLeaderForTeamIds.length > 0);
	if (!hasAccess) throw redirect(302, '/hub');

	const organisationId = await getCurrentOrganisationId();
	const selectedEventId = url.searchParams.get('eventId') || '';
	// Redirect away from legacy meeting-plan/session URL params to schedule-only planner
	const view = url.searchParams.get('view');
	const sessionId = url.searchParams.get('id');
	const isNewSession = url.searchParams.get('new');
	if (view === 'session' || sessionId || isNewSession) {
		throw redirect(302, selectedEventId ? `/hub/planner?eventId=${encodeURIComponent(selectedEventId)}` : '/hub/planner');
	}

	const [allEvents, allOccurrences, allRotas, allContacts] = await Promise.all([
		readCollection('events').then(r => filterByOrganisation(r, organisationId)),
		readCollection('occurrences').then(r => filterByOrganisation(r, organisationId)),
		readCollection('rotas').then(r => filterByOrganisation(r, organisationId)),
		readCollection('contacts').then(r => filterByOrganisation(r, organisationId))
	]);

	const events = [...allEvents].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
	const csrfToken = await getCsrfToken(cookies);
	const restricted = isRestrictedTeamLeader(admin);

	const base = { events, csrfToken, canEdit: !restricted };

	if (!selectedEventId) {
		return { ...base, selectedEvent: null, occurrences: [], teamRows: [], unlinkedRows: [], plannerNotes: '' };
	}

	const selectedEvent = events.find(e => e.id === selectedEventId);
	if (!selectedEvent) {
		return { ...base, selectedEvent: null, occurrences: [], teamRows: [], unlinkedRows: [], plannerNotes: '' };
	}

	// === Schedule view data (always loaded when event selected) ===
	const occurrences = [...new Map(
		filterUpcomingOccurrences(allOccurrences.filter(o => o.eventId === selectedEventId))
			.map(o => [o.id, o])
	).values()]
		.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
		.slice(0, MAX_OCCURRENCES);

	const eventRotas = allRotas.filter(r => r.eventId === selectedEventId);
	const contactsMap = new Map(allContacts.map(c => [c.id, c]));

	function getAssigneesForOccurrence(rota, occurrenceId) {
		if (!rota) return [];
		return (rota.assignees || [])
			.filter(a => {
				const aOccId = typeof a === 'object' ? (a.occurrenceId ?? null) : null;
				return aOccId === occurrenceId || (aOccId === null && rota.occurrenceId === null);
			})
			.map(a => {
				const cid = typeof a === 'string' ? a : a?.contactId;
				if (cid && typeof cid === 'object' && cid.name) return cid.name;
				const contact = cid ? contactsMap.get(cid) : null;
				return contact ? contactDisplayName(contact) : null;
			})
			.filter(Boolean);
	}

	let teams = await getTeamsForOrganisation(organisationId);
	if (restricted) {
		teams = teams.filter(t => admin.teamLeaderForTeamIds.includes(t.id));
	}

	const linkedRotaIds = new Set();
	const teamRows = teams
		.map(team => {
			const rolesMap = new Map();
			for (const role of (team.roles || [])) {
				const rota = role.rotaId ? eventRotas.find(r => r.id === role.rotaId) : null;
				if (!rota || rolesMap.has(rota.id)) continue;
				linkedRotaIds.add(rota.id);
				rolesMap.set(rota.id, {
					roleName: role.name,
					capacity: rota.capacity,
					rotaId: rota.id,
					occurrences: Object.fromEntries(
						occurrences.map(occ => [occ.id, getAssigneesForOccurrence(rota, occ.id)])
					)
				});
			}
			const roles = [...rolesMap.values()];
			if (roles.length === 0) return null;
			return { teamId: team.id, teamName: team.name, roles };
		})
		.filter(Boolean);

	const unlinkedRows = restricted
		? []
		: eventRotas
			.filter(r => !linkedRotaIds.has(r.id))
			.map(rota => ({
				roleName: rota.role || 'Unnamed Role',
				capacity: rota.capacity,
				rotaId: rota.id,
				occurrences: Object.fromEntries(
					occurrences.map(occ => [occ.id, getAssigneesForOccurrence(rota, occ.id)])
				)
			}));

	return {
		...base,
		selectedEvent,
		occurrences,
		teamRows,
		unlinkedRows,
		plannerNotes: selectedEvent.plannerNotes || ''
	};
}

export const actions = {
	saveNotes: async ({ request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin) return fail(401, { error: 'Not authenticated' });
		const data = await request.formData();
		if (!verifyCsrfToken(cookies, data.get('_csrf'))) return fail(403, { error: 'CSRF token invalid' });
		const eventId = data.get('eventId');
		if (!eventId) return fail(400, { error: 'Missing event ID' });
		const plannerNotes = (data.get('plannerNotes') || '').slice(0, 5000);
		await update('events', eventId, { plannerNotes });
		return { success: true };
	},

	addAssignee: async ({ request, cookies }) => {
		const data = await request.formData();
		if (!verifyCsrfToken(cookies, data.get('_csrf'))) return fail(403, { error: 'CSRF token invalid' });
		try {
			const rotaId = data.get('rotaId');
			const contactIdsJson = data.get('contactIds');
			const occurrenceId = data.get('occurrenceId') || null;
			if (!rotaId || !contactIdsJson) return fail(400, { error: 'Missing required fields' });
			let newContactIds;
			try { newContactIds = JSON.parse(contactIdsJson); } catch { return fail(400, { error: 'Invalid contact IDs format' }); }
			if (!Array.isArray(newContactIds)) return fail(400, { error: 'Contact IDs must be an array' });

			const guestJson = data.get('guest');
			let guestData = null;
			if (guestJson) { try { guestData = JSON.parse(guestJson); } catch { return fail(400, { error: 'Invalid guest data' }); } }

			const organisationId = await getCurrentOrganisationId();
			const rota = await findById('rotas', rotaId);
			if (!rota || (rota.organisationId != null && rota.organisationId !== organisationId)) return fail(404, { error: 'Schedule not found' });

			const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
			const assigneesForOcc = existingAssignees.filter(a => {
				const aOccId = typeof a === 'object' ? (a.occurrenceId || rota.occurrenceId) : rota.occurrenceId;
				return aOccId === occurrenceId;
			});
			const existingIds = assigneesForOcc.map(a => typeof a === 'string' ? a : a?.contactId).filter(id => typeof id === 'string');
			const unique = newContactIds.filter(id => !existingIds.includes(id));
			if (unique.length === 0 && !guestData) return { success: true, type: 'addAssignee', message: 'No new assignees' };

			const totalToAdd = unique.length + (guestData ? 1 : 0);
			if (assigneesForOcc.length + totalToAdd > rota.capacity) {
				return fail(400, { error: `Cannot add ${totalToAdd} assignee(s). Capacity is ${rota.capacity}, currently ${assigneesForOcc.length} assigned.` });
			}

			const newAssignees = unique.map(cid => ({ contactId: cid, occurrenceId }));
			if (guestData) newAssignees.push({ contactId: { name: `Guest: ${guestData.name}`, email: '' }, occurrenceId });

			await update('rotas', rotaId, validateRota({ ...rota, assignees: [...existingAssignees, ...newAssignees] }));
			return { success: true, type: 'addAssignee', message: `Added ${unique.length + (guestData ? 1 : 0)} assignee(s).` };
		} catch (err) {
			return fail(400, { error: err.message || 'Failed to add assignee' });
		}
	},

	removeAssignee: async ({ request, cookies }) => {
		const data = await request.formData();
		if (!verifyCsrfToken(cookies, data.get('_csrf'))) return fail(403, { error: 'CSRF token invalid' });
		try {
			const rotaId = data.get('rotaId');
			const index = parseInt(data.get('index'), 10);
			if (!rotaId || isNaN(index)) return fail(400, { error: 'Missing required fields' });
			const organisationId = await getCurrentOrganisationId();
			const rota = await findById('rotas', rotaId);
			if (!rota || (rota.organisationId != null && rota.organisationId !== organisationId)) return fail(404, { error: 'Schedule not found' });
			const assignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
			if (index >= assignees.length) return fail(400, { error: 'Index out of range' });
			assignees.splice(index, 1);
			await update('rotas', rotaId, validateRota({ ...rota, assignees }));
			return { success: true, type: 'removeAssignee' };
		} catch (err) {
			return fail(400, { error: err.message || 'Failed to remove assignee' });
		}
	}
};
