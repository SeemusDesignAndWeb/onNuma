/**
 * Hub organisation context. All Hub content is scoped by current organisation ID.
 * Use getCurrentOrganisationId() and filter/set organisationId when reading/creating.
 */

import { getCurrentOrganisationId } from './settings.js';
import { ORG_SCOPED_COLLECTIONS } from './collections.js';
import { getPlanMaxContacts } from './permissions.js';

export { getCurrentOrganisationId } from './settings.js';

/**
 * Filter records to current organisation (strict). Only rows with matching organisationId
 * are returned. No data for an org shows as empty lists / no results.
 * @param {Array<{ organisationId?: string | null }>} records
 * @param {string | null} organisationId - Current Hub organisation ID
 * @returns {Array}
 */
export function filterByOrganisation(records, organisationId) {
	if (!organisationId || !Array.isArray(records)) return records;
	return records.filter((r) => r.organisationId === organisationId);
}

/** Stable sort: firstName then lastName (case-insensitive). */
function sortContactsByName(contacts) {
	return [...contacts].sort((a, b) => {
		const aFirst = (a.firstName || '').toLowerCase();
		const bFirst = (b.firstName || '').toLowerCase();
		const aLast = (a.lastName || '').toLowerCase();
		const bLast = (b.lastName || '').toLowerCase();
		if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
		return aLast.localeCompare(bLast);
	});
}

/**
 * Return only the first N contacts allowed by the plan (sorted by firstName, lastName).
 * Excess contacts are not deleted; they are just not included. Use for list views and pickers.
 * @param {Array<{ firstName?: string, lastName?: string }>} contacts - Already org-scoped contacts
 * @param {string} plan - 'free' | 'professional' | 'enterprise'
 * @returns {Array} Sorted, capped list
 */
export function contactsWithinPlanLimit(contacts, plan) {
	if (!Array.isArray(contacts)) return [];
	const sorted = sortContactsByName(contacts);
	const max = getPlanMaxContacts(plan || 'free');
	return sorted.slice(0, max);
}

/**
 * Check if a collection is org-scoped.
 * @param {string} collection
 * @returns {boolean}
 */
export function isOrgScopedCollection(collection) {
	return ORG_SCOPED_COLLECTIONS.includes(collection);
}

/**
 * Add organisationId to data for create. Use when creating a row in an org-scoped collection.
 * @param {object} data - Row data for create
 * @param {string | null} organisationId - Current Hub organisation ID
 * @returns {object} data with organisationId set
 */
export function withOrganisationId(data, organisationId) {
	if (!organisationId) return data;
	return { ...data, organisationId };
}
