/**
 * Teams management — CRUD and template presets.
 * Teams group volunteers into named roles and can assign devolved Team Leader access.
 *
 * Team schema:
 * {
 *   id, organisationId, name, description,
 *   eventId: null,          // optional: which event type this team serves
 *   roles: [{ id, name, capacity, rotaId }],
 *   teamLeaderIds: [],      // admin IDs who are team leaders for this team
 *   createdAt, updatedAt
 * }
 */

import { ulid } from 'ulid';
import { readCollection, findById, create, update, updatePartial, remove } from './fileStore.js';
import { filterByOrganisation, withOrganisationId } from './orgContext.js';

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Read all teams for an organisation. */
export async function getTeamsForOrganisation(organisationId) {
	const teams = await readCollection('teams');
	return filterByOrganisation(teams, organisationId);
}

/** Find a single team by ID. */
export async function getTeamById(teamId) {
	return findById('teams', teamId);
}

/**
 * Create a new team.
 * @param {{ name: string, description?: string, eventId?: string|null, roles?: Array<{name,capacity}>, teamLeaderIds?: string[], organisationId: string }} data
 */
export async function createTeam({ name, description, eventId, roles, teamLeaderIds, organisationId }) {
	return create('teams', withOrganisationId({
		name: (name || '').trim(),
		description: (description || '').trim(),
		eventId: eventId || null,
		roles: (roles || []).map(r => ({
			id: ulid(),
			name: (r.name || '').trim(),
			capacity: typeof r.capacity === 'number' && r.capacity >= 1 ? r.capacity : 1,
			rotaId: r.rotaId || null,
			dbsRequired: r.dbsRequired === true
		})),
		teamLeaderIds: Array.isArray(teamLeaderIds) ? teamLeaderIds : []
	}, organisationId));
}

/**
 * Full replacement update for a team. Pass the complete updated team object.
 * @param {string} teamId
 * @param {object} updates — fields to merge over the existing record
 */
export async function updateTeam(teamId, updates) {
	const existing = await findById('teams', teamId);
	if (!existing) throw new Error('Team not found');
	const now = new Date().toISOString();
	const updated = { ...existing, ...updates, id: existing.id, updatedAt: now };
	await update('teams', teamId, updated);
	return updated;
}

/** Delete a team and clean up teamLeaderForTeamIds references on admins. */
export async function deleteTeam(teamId, organisationId) {
	// Remove teamId from any admins that reference it
	const admins = await readCollection('admins');
	const affected = admins.filter(a =>
		Array.isArray(a.teamLeaderForTeamIds) && a.teamLeaderForTeamIds.includes(teamId)
	);
	for (const admin of affected) {
		const cleaned = admin.teamLeaderForTeamIds.filter(id => id !== teamId);
		await updatePartial('admins', admin.id, { teamLeaderForTeamIds: cleaned });
	}
	// Remove teamId from any rota records that reference it
	const rotas = filterByOrganisation(await readCollection('rotas'), organisationId);
	const rotasToClean = rotas.filter(r => r.teamId === teamId);
	for (const rota of rotasToClean) {
		await updatePartial('rotas', rota.id, { teamId: null, teamRoleId: null });
	}
	return remove('teams', teamId);
}

// ---------------------------------------------------------------------------
// Clash detection
// ---------------------------------------------------------------------------

/**
 * Check whether a contact has overlapping assignments across all rotas for a given occurrence.
 * Returns an array of conflicting rota roles (empty = no clash).
 * @param {string} contactId
 * @param {string} occurrenceId
 * @param {string} organisationId
 * @param {string|null} excludeRotaId — rota being edited (exclude from check)
 */
export async function detectAssignmentClashes(contactId, occurrenceId, organisationId, excludeRotaId = null) {
	const rotas = filterByOrganisation(await readCollection('rotas'), organisationId);
	const clashes = [];
	for (const rota of rotas) {
		if (rota.id === excludeRotaId) continue;
		if (!Array.isArray(rota.assignees)) continue;
		const assigned = rota.assignees.some(a => {
			const cid = typeof a === 'string' ? a : a?.contactId;
			const oid = typeof a === 'object' ? (a.occurrenceId ?? null) : null;
			if (cid !== contactId) return false;
			// Match if same occurrence OR rota is for all occurrences and occurrenceId matches event
			return oid === occurrenceId || oid === null;
		});
		if (assigned) {
			clashes.push({ rotaId: rota.id, role: rota.role, eventId: rota.eventId });
		}
	}
	return clashes;
}

// ---------------------------------------------------------------------------
// Team Leader helpers
// ---------------------------------------------------------------------------

/** Check if an admin is a team leader (has any team assignments). */
export function isTeamLeader(admin) {
	return Array.isArray(admin?.teamLeaderForTeamIds) && admin.teamLeaderForTeamIds.length > 0;
}

/** Get the teams an admin leads, filtered to the current organisation. */
export async function getTeamsForTeamLeader(admin, organisationId) {
	if (!isTeamLeader(admin)) return [];
	const teams = await getTeamsForOrganisation(organisationId);
	return teams.filter(t => admin.teamLeaderForTeamIds.includes(t.id));
}

/**
 * Assign an admin as a team leader for the given team.
 * Sets permissions to at minimum ['rotas', 'teams'] and adds teamId to teamLeaderForTeamIds.
 */
export async function addTeamLeaderToTeam(adminId, teamId) {
	const admins = await readCollection('admins');
	const admin = admins.find(a => a.id === adminId);
	if (!admin) throw new Error('Admin not found');

	const existingTeamIds = Array.isArray(admin.teamLeaderForTeamIds) ? admin.teamLeaderForTeamIds : [];
	if (existingTeamIds.includes(teamId)) return; // already a leader

	const teamLeaderForTeamIds = [...existingTeamIds, teamId];
	// Ensure they have at least rotas + teams permissions
	const existingPerms = Array.isArray(admin.permissions) ? admin.permissions : [];
	const permissions = [...new Set([...existingPerms, 'rotas', 'teams'])];

	await updatePartial('admins', adminId, { teamLeaderForTeamIds, permissions });

	// Also add to team.teamLeaderIds
	const team = await findById('teams', teamId);
	if (team) {
		const leaderIds = Array.isArray(team.teamLeaderIds) ? team.teamLeaderIds : [];
		if (!leaderIds.includes(adminId)) {
			await updatePartial('teams', teamId, { teamLeaderIds: [...leaderIds, adminId] });
		}
	}
}

/**
 * Remove an admin as a team leader for the given team.
 * If they have no remaining team assignments, their permissions are unaffected (coordinator may still want them).
 */
export async function removeTeamLeaderFromTeam(adminId, teamId) {
	const admins = await readCollection('admins');
	const admin = admins.find(a => a.id === adminId);
	if (!admin) return;

	const teamLeaderForTeamIds = (admin.teamLeaderForTeamIds || []).filter(id => id !== teamId);
	await updatePartial('admins', adminId, { teamLeaderForTeamIds });

	// Remove from team.teamLeaderIds
	const team = await findById('teams', teamId);
	if (team) {
		const leaderIds = (team.teamLeaderIds || []).filter(id => id !== adminId);
		await updatePartial('teams', teamId, { teamLeaderIds: leaderIds });
	}
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Returns the preset team templates available in the template picker.
 * "Church / Parish" category from the spec, plus a set of generic templates.
 * Templates are seed data — not hard-coded config — and are always fully editable after loading.
 */
export function getTeamTemplates() {
	return [
		// Church / Parish templates (from spec)
		{
			id: 'welcome-team',
			category: 'Church / Parish',
			name: 'Welcome Team',
			description: 'Greet visitors and manage the entrance',
			roles: [
				{ name: 'Greeter', capacity: 2 },
				{ name: 'Usher', capacity: 2 },
				{ name: 'Door Steward', capacity: 1 },
				{ name: 'Car Park Marshal', capacity: 2 }
			]
		},
		{
			id: 'hospitality-team',
			category: 'Church / Parish',
			name: 'Hospitality Team',
			description: 'Tea, coffee and refreshments for the congregation',
			roles: [
				{ name: 'Tea & Coffee', capacity: 2 },
				{ name: 'Kitchen Lead', capacity: 1 },
				{ name: 'Setup & Tidying', capacity: 2 }
			]
		},
		{
			id: 'music-worship',
			category: 'Church / Parish',
			name: 'Music & Worship Team',
			description: 'Musicians and vocalists leading worship',
			roles: [
				{ name: 'Worship Leader', capacity: 1 },
				{ name: 'Keyboard / Piano', capacity: 1 },
				{ name: 'Guitar', capacity: 1 },
				{ name: 'Drums', capacity: 1 },
				{ name: 'Bass Guitar', capacity: 1 },
				{ name: 'Lead Vocalist', capacity: 1 },
				{ name: 'Backing Vocalist', capacity: 2 }
			]
		},
		{
			id: 'readings-prayers',
			category: 'Church / Parish',
			name: 'Readings & Prayers',
			description: 'Bible readings and intercessions',
			roles: [
				{ name: 'Bible Reading', capacity: 1 },
				{ name: 'Intercessions', capacity: 1 },
				{ name: 'Introduction', capacity: 1 }
			]
		},
		{
			id: 'eucharistic-ministry',
			category: 'Church / Parish',
			name: 'Eucharistic Ministry',
			description: 'Chalice bearers, sidespeople and communion preparation',
			roles: [
				{ name: 'Chalice Bearer', capacity: 2 },
				{ name: 'Sidesperson', capacity: 2 },
				{ name: 'Communion Preparation', capacity: 1 }
			]
		},
		{
			id: 'childrens-team',
			category: 'Church / Parish',
			name: "Children's Team",
			description: "Sunday school, crèche and children's ministry",
			roles: [
				{ name: "Children's Leader", capacity: 1 },
				{ name: 'Helper', capacity: 2 },
				{ name: 'Crèche', capacity: 1 }
			]
		},
		{
			id: 'tech-av',
			category: 'Church / Parish',
			name: 'Technology & AV',
			description: 'Sound, projection, livestream and lighting',
			roles: [
				{ name: 'Sound Desk', capacity: 1 },
				{ name: 'Projection / Slides', capacity: 1 },
				{ name: 'Livestream', capacity: 1 },
				{ name: 'Lighting', capacity: 1 }
			]
		},
		{
			id: 'pastoral-visiting',
			category: 'Church / Parish',
			name: 'Pastoral & Visiting',
			description: 'Pastoral care and visitor follow-up',
			roles: [
				{ name: 'Welcomer', capacity: 1 },
				{ name: 'Pastoral Contact', capacity: 1 },
				{ name: 'Visitor Follow-up', capacity: 1 }
			]
		},
		{
			id: 'buildings-setup',
			category: 'Church / Parish',
			name: 'Buildings & Setup',
			description: 'Setting up and locking up the building',
			roles: [
				{ name: 'Setup', capacity: 2 },
				{ name: 'Lock-up', capacity: 1 },
				{ name: 'Cleaning', capacity: 1 }
			]
		},
		{
			id: 'events-outreach',
			category: 'Church / Parish',
			name: 'Events & Outreach',
			description: 'Community events and outreach activities',
			roles: [
				{ name: 'Event Lead', capacity: 1 },
				{ name: 'Catering', capacity: 2 },
				{ name: 'Setup', capacity: 2 },
				{ name: 'Promotion', capacity: 1 }
			]
		},
		// Generic templates
		{
			id: 'event-team',
			category: 'Generic',
			name: 'Event Team',
			description: 'A general-purpose team for running events',
			roles: [
				{ name: 'Team Lead', capacity: 1 },
				{ name: 'Setup', capacity: 2 },
				{ name: 'On the Door', capacity: 2 },
				{ name: 'Tidy Up', capacity: 2 }
			]
		},
		{
			id: 'first-aid',
			category: 'Generic',
			name: 'First Aid & Safety',
			description: 'First aiders and safety marshals',
			roles: [
				{ name: 'First Aider', capacity: 2 },
				{ name: 'Safety Marshal', capacity: 1 }
			]
		}
	];
}
