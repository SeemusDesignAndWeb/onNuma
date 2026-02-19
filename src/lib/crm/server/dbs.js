/**
 * DBS compliance tracking (DBS Bolt-On). Record-keeping only; does not process DBS applications.
 * Status: green (current), amber (due within 60 days), red (overdue or not on record).
 */

import { readCollection, findById } from './fileStore.js';
import { filterByOrganisation } from './orgContext.js';

const DBS_LEVELS = ['basic', 'standard', 'enhanced', 'enhanced_barred'];
const AMBER_DAYS = 60;

/**
 * Compute renewal due date from issue date and org renewal years (default 3).
 * @param {string} dateIssued - ISO date
 * @param {number} renewalYears - 2 or 3
 * @returns {string|null} ISO date
 */
export function computeRenewalDueDate(dateIssued, renewalYears = 3) {
	if (!dateIssued || (renewalYears !== 2 && renewalYears !== 3)) return null;
	const d = new Date(dateIssued);
	if (Number.isNaN(d.getTime())) return null;
	d.setFullYear(d.getFullYear() + renewalYears);
	return d.toISOString().slice(0, 10);
}

/**
 * Get DBS status for display: 'green' | 'amber' | 'red'.
 * Green: current (renewal due > 60 days away or Update Service registered).
 * Amber: due within 60 days.
 * Red: overdue or no record.
 * @param {{ level?: string, dateIssued?: string, renewalDueDate?: string, updateServiceRegistered?: boolean }} dbs
 * @param {number} [renewalYears=3]
 * @returns {{ status: 'green'|'amber'|'red', renewalDueDate: string|null, label: string }}
 */
export function getDbsStatus(dbs, renewalYears = 3) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (!dbs || !dbs.level || !DBS_LEVELS.includes(dbs.level)) {
		return { status: 'red', renewalDueDate: null, label: 'No record' };
	}

	const renewalDue = dbs.renewalDueDate || computeRenewalDueDate(dbs.dateIssued, renewalYears);
	if (dbs.updateServiceRegistered === true) {
		return { status: 'green', renewalDueDate: renewalDue, label: 'Current (Update Service)' };
	}
	if (!renewalDue) {
		return { status: 'red', renewalDueDate: null, label: 'No renewal date' };
	}

	const dueDate = new Date(renewalDue);
	dueDate.setHours(0, 0, 0, 0);
	const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

	if (daysUntilDue < 0) return { status: 'red', renewalDueDate: renewalDue, label: 'Overdue' };
	if (daysUntilDue <= AMBER_DAYS) return { status: 'amber', renewalDueDate: renewalDue, label: 'Due soon' };
	return { status: 'green', renewalDueDate: renewalDue, label: 'Current' };
}

/**
 * Get all contact IDs that have at least one DBS-required role (assignee on a rota linked to a team role with dbsRequired).
 * @param {string} organisationId
 * @returns {Promise<Set<string>>}
 */
export async function getContactIdsWithDbsRequiredRoles(organisationId) {
	const [teamsRaw, rotasRaw] = await Promise.all([
		readCollection('teams'),
		readCollection('rotas')
	]);
	const teams = filterByOrganisation(teamsRaw, organisationId);
	const rotas = filterByOrganisation(rotasRaw, organisationId);

	// Set of rota IDs that are DBS-required (linked to a team role with dbsRequired)
	const dbsRequiredRotaIds = new Set();
	for (const team of teams) {
		const roles = team.roles || [];
		for (const role of roles) {
			if (role.dbsRequired && role.rotaId) {
				const rota = rotas.find((r) => r.id === role.rotaId);
				if (rota && rota.teamId === team.id && rota.teamRoleId === role.id) {
					dbsRequiredRotaIds.add(rota.id);
				}
			}
		}
	}
	// Also match rotas by teamId+teamRoleId without requiring role.rotaId (rota might link to team role)
	for (const rota of rotas) {
		if (!rota.teamId || !rota.teamRoleId) continue;
		const team = teams.find((t) => t.id === rota.teamId);
		if (!team) continue;
		const role = (team.roles || []).find((r) => r.id === rota.teamRoleId);
		if (role && role.dbsRequired) dbsRequiredRotaIds.add(rota.id);
	}

	const contactIds = new Set();
	for (const rota of rotas) {
		if (!dbsRequiredRotaIds.has(rota.id)) continue;
		const assignees = rota.assignees || [];
		for (const a of assignees) {
			const cid = typeof a === 'string' ? a : a?.contactId;
			if (cid) contactIds.add(cid);
		}
	}
	return contactIds;
}

/**
 * Build DBS dashboard rows: volunteers with DBS-required roles, with status and contact info.
 * @param {string} organisationId
 * @param {number} dbsRenewalYears - 2 or 3
 * @param {string|null} [filterTeamId] - optional filter by team
 * @returns {Promise<Array<{ contactId: string, name: string, email: string, teamNames: string[], roleNames: string[], dbs: object|null, status: string, renewalDueDate: string|null, label: string }>>}
 */
export async function getDbsDashboardRows(organisationId, dbsRenewalYears = 3, filterTeamId = null) {
	const [contactsRaw, teamsRaw, rotasRaw] = await Promise.all([
		readCollection('contacts'),
		readCollection('teams'),
		readCollection('rotas')
	]);
	const contacts = filterByOrganisation(contactsRaw, organisationId);
	const teams = filterByOrganisation(teamsRaw, organisationId);
	const rotas = filterByOrganisation(rotasRaw, organisationId);

	// Which rotas are DBS-required and which team/role names
	const rotaToTeamRole = new Map(); // rotaId -> { teamName, roleName, teamId }
	for (const team of teams) {
		for (const role of team.roles || []) {
			if (!role.dbsRequired) continue;
			const rota = rotas.find((r) => r.teamId === team.id && r.teamRoleId === role.id);
			if (rota) {
				rotaToTeamRole.set(rota.id, { teamName: team.name || '', roleName: role.name || '', teamId: team.id });
			}
		}
	}

	const contactIds = await getContactIdsWithDbsRequiredRoles(organisationId);
	const contactMap = new Map(contacts.map((c) => [c.id, c]));

	const rows = [];
	for (const contactId of contactIds) {
		const contact = contactMap.get(contactId);
		if (!contact) continue;

		// Which teams/roles this contact has (from rotas that are DBS-required)
		const teamNames = new Set();
		const roleNames = new Set();
		for (const rota of rotas) {
			if (!rotaToTeamRole.has(rota.id)) continue;
			const info = rotaToTeamRole.get(rota.id);
			if (filterTeamId && info.teamId !== filterTeamId) continue;
			const assignees = rota.assignees || [];
			const assigned = assignees.some((a) => (typeof a === 'string' ? a : a?.contactId) === contactId);
			if (assigned) {
				teamNames.add(info.teamName);
				roleNames.add(info.roleName);
			}
		}
		if (filterTeamId && teamNames.size === 0) continue;

		const dbs = contact.dbs || null;
		const { status, renewalDueDate, label } = getDbsStatus(dbs, dbsRenewalYears);
		rows.push({
			contactId,
			name: [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.email || 'Unknown',
			email: contact.email || '',
			teamNames: [...teamNames],
			roleNames: [...roleNames],
			dbs,
			status,
			renewalDueDate: renewalDueDate || null,
			label
		});
	}

	rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
	return rows;
}

/**
 * Check if a contact has current DBS (green status). Used for warning when assigning to DBS-required role.
 * @param {object} contact - contact record with optional dbs
 * @param {number} renewalYears
 * @returns {boolean}
 */
export function hasCurrentDbs(contact, renewalYears = 3) {
	const dbs = contact?.dbs;
	const { status } = getDbsStatus(dbs || null, renewalYears);
	return status === 'green';
}
