import { fail, error } from '@sveltejs/kit';
import { ulid } from 'ulid';
import { getCsrfToken, verifyCsrfToken, getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { readCollection, findById, update } from '$lib/crm/server/fileStore.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';
import {
	getTeamById,
	updateTeam,
	addTeamLeaderToTeam,
	removeTeamLeaderFromTeam,
	detectAssignmentClashes
} from '$lib/crm/server/teams.js';
import { findContactsByPastRole } from '$lib/crm/server/scheduleHelpers.js';
import { hasCurrentDbs } from '$lib/crm/server/dbs.js';

const MAX_SCHEDULE_OCCURRENCES = 8;

function canManageTeams(admin) {
	if (!admin) return false;
	if (isSuperAdmin(admin)) return true;
	return Array.isArray(admin.permissions) && admin.permissions.includes('teams');
}

function canAccessTeam(admin, teamId) {
	if (canManageTeams(admin)) return true;
	const leaderTeamIds = Array.isArray(admin.teamLeaderForTeamIds) ? admin.teamLeaderForTeamIds : [];
	return leaderTeamIds.includes(teamId);
}

function contactDisplayName(contact) {
	const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
	return name || contact.email || 'Unknown';
}

export async function load({ params, cookies, locals }) {
	const admin = locals.admin || await getAdminFromCookies(cookies);
	if (!admin) throw error(401, 'Unauthorized');

	const team = await getTeamById(params.id);
	if (!team) throw error(404, 'Team not found');

	const canManage = canManageTeams(admin);
	if (!canManage && !canAccessTeam(admin, params.id)) throw error(403, 'Forbidden');

	const organisationId = await getCurrentOrganisationId();
	const [allRotas, allEvents, allAdmins, allOccurrences, allContacts] = await Promise.all([
		readCollection('rotas').then(r => filterByOrganisation(r, organisationId)),
		readCollection('events').then(r => filterByOrganisation(r, organisationId)),
		readCollection('admins').then(r => filterByOrganisation(r, organisationId)),
		readCollection('occurrences').then(r => filterByOrganisation(r, organisationId)),
		readCollection('contacts').then(r => filterByOrganisation(r, organisationId))
	]);

	const rotaOptions = allRotas.map(r => {
		const event = allEvents.find(e => e.id === r.eventId);
		return {
			id: r.id,
			label: `${event?.title || 'Unknown Event'} – ${r.role || 'Unnamed Role'}`
		};
	});

	const teamLeaders = (team.teamLeaderIds || [])
		.map(id => allAdmins.find(a => a.id === id))
		.filter(Boolean)
		.map(a => ({ id: a.id, name: a.name || a.email, email: a.email }));

	const adminOptions = canManage
		? allAdmins
			.filter(a => !isSuperAdmin(a) && !(team.teamLeaderIds || []).includes(a.id))
			.map(a => ({ id: a.id, name: a.name || a.email }))
		: [];

	// --- Build schedule: occurrence × roles × assignees ---
	const roles = team.roles || [];
	const linkedRotaIds = roles.map(r => r.rotaId).filter(Boolean);
	const linkedRotas = allRotas.filter(r => linkedRotaIds.includes(r.id));
	const linkedEventIds = [...new Set(linkedRotas.map(r => r.eventId).filter(Boolean))];

	const relevantOccurrences = filterUpcomingOccurrences(
		allOccurrences.filter(o => linkedEventIds.includes(o.eventId))
	).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
		.slice(0, MAX_SCHEDULE_OCCURRENCES);

	const contactsMap = new Map(allContacts.map(c => [c.id, c]));

	const schedule = relevantOccurrences.map(occ => {
		const event = allEvents.find(e => e.id === occ.eventId);
		const schedRoles = roles.map(role => {
			if (!role.rotaId) {
				return {
					roleId: role.id,
					roleName: role.name,
					capacity: role.capacity,
					rotaId: null,
					assignees: [],
					filledCount: 0,
					isFull: false
				};
			}
			const rota = linkedRotas.find(r => r.id === role.rotaId);
			if (!rota) {
				return {
					roleId: role.id,
					roleName: role.name,
					capacity: role.capacity,
					rotaId: role.rotaId,
					assignees: [],
					filledCount: 0,
					isFull: false
				};
			}
			// Only include rotas that match this occurrence's event
			if (rota.eventId !== occ.eventId) {
				return {
					roleId: role.id,
					roleName: role.name,
					capacity: role.capacity,
					rotaId: role.rotaId,
					assignees: [],
					filledCount: 0,
					isFull: false
				};
			}
			const assignees = (rota.assignees || [])
				.filter(a => {
					const aOccId = typeof a === 'object' ? (a.occurrenceId ?? null) : null;
					return aOccId === occ.id || (aOccId === null && rota.occurrenceId === null);
				})
				.map(a => {
					const cid = typeof a === 'string' ? a : a?.contactId;
					const contact = cid ? contactsMap.get(cid) : null;
					return {
						contactId: cid || null,
						name: contact ? contactDisplayName(contact) : (a?.name || a?.email || 'Unknown')
					};
				});
			return {
				roleId: role.id,
				roleName: role.name,
				capacity: role.capacity,
				rotaId: role.rotaId,
				assignees,
				filledCount: assignees.length,
				isFull: assignees.length >= role.capacity
			};
		});

		return {
			occurrence: { id: occ.id, startsAt: occ.startsAt },
			event: { id: event?.id || null, title: event?.title || 'Unknown Event' },
			roles: schedRoles
		};
	});

	const contacts = allContacts.map(c => ({
		id: c.id,
		firstName: c.firstName || '',
		lastName: c.lastName || '',
		name: contactDisplayName(c)
	})).sort((a, b) => a.name.localeCompare(b.name));

	const allLists = filterByOrganisation(await readCollection('lists'), organisationId);
	const lists = allLists.map(l => ({ id: l.id, name: l.name, contactIds: l.contactIds || [] }));

	const pastRoleMap = {};
	for (const role of roles) {
		if (role.rotaId && role.name) {
			pastRoleMap[role.rotaId] = await findContactsByPastRole(role.name, role.rotaId, organisationId);
		}
	}

	const org = organisationId ? await findById('organisations', organisationId) : null;
	const dbsBoltOn = !!(org?.dbsBoltOn ?? org?.churchBoltOn);

	return {
		team,
		rotaOptions,
		teamLeaders,
		adminOptions,
		dbsBoltOn,
		canManage,
		schedule,
		contacts,
		lists,
		pastRoleMap,
		csrfToken: getCsrfToken(cookies)
	};
}

export const actions = {
	updateDetails: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });
		const name = (data.get('name') || '').trim();
		if (!name) return fail(400, { error: 'Name is required' });
		const description = (data.get('description') || '').trim();
		await updateTeam(params.id, { name, description });
		return { success: true };
	},

	addRole: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });
		const roleName = (data.get('roleName') || '').trim();
		if (!roleName) return fail(400, { error: 'Role name is required' });
		const capacity = Math.max(1, parseInt(data.get('capacity') || '1', 10) || 1);
		const team = await getTeamById(params.id);
		if (!team) return fail(404, { error: 'Team not found' });
		const dbsRequired = data.get('dbsRequired') === 'on' || data.get('dbsRequired') === 'true';
		const roles = [...(team.roles || []), { id: ulid(), name: roleName, capacity, rotaId: null, dbsRequired }];
		await updateTeam(params.id, { roles });
		return { success: true };
	},

	deleteRole: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });
		const roleId = data.get('roleId');
		if (!roleId) return fail(400, { error: 'Role ID is required' });
		const team = await getTeamById(params.id);
		if (!team) return fail(404, { error: 'Team not found' });
		const roles = (team.roles || []).filter(r => r.id !== roleId);
		await updateTeam(params.id, { roles });
		return { success: true };
	},

	linkRota: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });
		const roleId = data.get('roleId');
		const rotaId = (data.get('rotaId') || '').trim() || null;
		const team = await getTeamById(params.id);
		if (!team) return fail(404, { error: 'Team not found' });
		const roles = (team.roles || []).map(r => r.id === roleId ? { ...r, rotaId } : r);
		await updateTeam(params.id, { roles });
		return { success: true };
	},

	setRoleDbsRequired: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });
		const roleId = data.get('roleId');
		const dbsRequired = data.get('dbsRequired') === 'on' || data.get('dbsRequired') === 'true';
		if (!roleId) return fail(400, { error: 'Role ID is required' });
		const team = await getTeamById(params.id);
		if (!team) return fail(404, { error: 'Team not found' });
		const roles = (team.roles || []).map(r => r.id === roleId ? { ...r, dbsRequired } : r);
		await updateTeam(params.id, { roles });
		return { success: true };
	},

	addTeamLeader: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });
		const adminId = data.get('adminId');
		if (!adminId) return fail(400, { error: 'Admin ID is required' });
		// Validate admin belongs to this organisation
		const organisationId = await getCurrentOrganisationId();
		const allAdmins = filterByOrganisation(await readCollection('admins'), organisationId);
		if (!allAdmins.find(a => a.id === adminId)) return fail(404, { error: 'Admin not found' });
		await addTeamLeaderToTeam(adminId, params.id);
		return { success: true };
	},

	removeTeamLeader: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canManageTeams(admin)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });
		const adminId = data.get('adminId');
		if (!adminId) return fail(400, { error: 'Admin ID is required' });
		await removeTeamLeaderFromTeam(adminId, params.id);
		return { success: true };
	},

	addAssignee: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canAccessTeam(admin, params.id)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });

		const rotaId = data.get('rotaId');
		const occurrenceId = data.get('occurrenceId') || null;
		const contactId = data.get('contactId');
		const guestName = (data.get('guestName') || '').trim();

		if (!rotaId) return fail(400, { error: 'Schedule is required' });
		if (!contactId && !guestName) return fail(400, { error: 'Contact or guest name is required' });

		const rota = await findById('rotas', rotaId);
		if (!rota) return fail(404, { error: 'Schedule not found' });

		const assignees = Array.isArray(rota.assignees) ? rota.assignees : [];

		if (guestName) {
			assignees.push({ contactId: { name: `Guest: ${guestName}`, email: '' }, occurrenceId });
			await update('rotas', rotaId, { ...rota, assignees });
			return { success: true, type: 'addAssignee' };
		}

		const alreadyAssigned = assignees.some(a => {
			const cid = typeof a === 'string' ? a : a?.contactId;
			const oid = typeof a === 'object' ? (a.occurrenceId ?? null) : null;
			return cid === contactId && oid === occurrenceId;
		});
		if (alreadyAssigned) return fail(400, { error: 'This person is already assigned to this role for this date' });

		const organisationId = await getCurrentOrganisationId();
		const clashes = await detectAssignmentClashes(contactId, occurrenceId, organisationId, rotaId);
		if (clashes.length > 0) {
			const clashNames = clashes.map(c => c.role || 'another schedule').join(', ');
			return fail(400, { error: `This person is already assigned to: ${clashNames}` });
		}

		assignees.push({ contactId, occurrenceId });
		await update('rotas', rotaId, { ...rota, assignees });

		// Church Bolt-On: warn (do not block) if role is DBS-required and contact has no current DBS
		let warning = null;
		const org = organisationId ? await findById('organisations', organisationId) : null;
		if ((org?.dbsBoltOn ?? org?.churchBoltOn) && rota.teamId && rota.teamRoleId) {
			const team = await getTeamById(rota.teamId);
			const role = team?.roles?.find((r) => r.id === rota.teamRoleId);
			if (role?.dbsRequired) {
				const contact = await findById('contacts', contactId);
				const renewalYears = org.dbsRenewalYears ?? 3;
				if (contact && !hasCurrentDbs(contact, renewalYears)) {
					warning = 'This role requires a current DBS certificate. The assigned person does not have a current DBS record on file. Consider updating their profile or your safeguarding arrangements.';
				}
			}
		}
		return { success: true, type: 'addAssignee', warning };
	},

	removeAssignee: async ({ params, request, cookies, locals }) => {
		const admin = locals.admin || await getAdminFromCookies(cookies);
		if (!admin || !canAccessTeam(admin, params.id)) return fail(403, { error: 'Forbidden' });
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) return fail(403, { error: 'CSRF validation failed' });

		const rotaId = data.get('rotaId');
		const occurrenceId = data.get('occurrenceId') || null;
		const contactId = data.get('contactId');
		if (!rotaId || !contactId) return fail(400, { error: 'Rota and contact are required' });

		const rota = await findById('rotas', rotaId);
		if (!rota) return fail(404, { error: 'Schedule not found' });

		const assignees = Array.isArray(rota.assignees) ? rota.assignees : [];
		let removed = false;
		const filtered = assignees.filter(a => {
			if (removed) return true;
			const cid = typeof a === 'string' ? a : a?.contactId;
			const oid = typeof a === 'object' ? (a.occurrenceId ?? null) : null;
			if (cid === contactId && oid === occurrenceId) {
				removed = true;
				return false;
			}
			return true;
		});

		await update('rotas', rotaId, { ...rota, assignees: filtered });
		return { success: true, type: 'removeAssignee' };
	}
};
