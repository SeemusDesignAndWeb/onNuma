/**
 * Schedule helpers — utilities for the invite-by-past-role feature.
 */

import { readCollection } from './fileStore.js';
import { filterByOrganisation } from './orgContext.js';

/**
 * Find contacts who have been assigned to a given role on other
 * schedules (rotas), excluding a specific schedule.
 *
 * @param {string} roleName - The role name to search for.
 * @param {string} excludeRotaId - The schedule to exclude (the one
 *   the coordinator is currently inviting for).
 * @param {string} organisationId - Scope to this organisation.
 * @returns {Promise<string[]>} Distinct contact IDs.
 */
export async function findContactsByPastRole(roleName, excludeRotaId, organisationId) {
	if (!roleName || !organisationId) return [];

	const rotas = filterByOrganisation(await readCollection('rotas'), organisationId);
	const normalised = roleName.trim().toLowerCase();

	const contactIds = new Set();

	for (const rota of rotas) {
		if (rota.id === excludeRotaId) continue;
		if ((rota.role || '').trim().toLowerCase() !== normalised) continue;

		for (const assignee of (rota.assignees || [])) {
			const cid = typeof assignee === 'string'
				? assignee
				: (assignee?.contactId ?? null);
			if (typeof cid === 'string' && cid) {
				contactIds.add(cid);
			}
		}
	}

	return [...contactIds];
}
