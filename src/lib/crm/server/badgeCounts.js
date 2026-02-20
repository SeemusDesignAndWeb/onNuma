/**
 * Hub sidebar notification badge counts.
 * Called from both the hub layout server (SSR seed) and the badge-counts API endpoint (polling).
 * DBS and pastoral counts are forced to 0 and their queries are skipped when dbsBoltOn is false.
 * Seen notifications (viewed by a coordinator) are excluded from all counts.
 */

import { readCollection } from './fileStore.js';
import { filterByOrganisation } from './orgContext.js';
import { getDbsDashboardRows } from './dbs.js';
import { getSeenIds } from './seenNotifications.js';

/**
 * Compute notification badge counts for the Hub sidebar.
 * @param {string|null} organisationId
 * @param {boolean} dbsBoltOn
 * @param {number} [dbsRenewalYears=3]
 * @returns {Promise<{ pendingVolunteers: number, pastoralConcerns: number, formSubmissions: number, dbsNotifications: number }>}
 */
export async function getBadgeCounts(organisationId, dbsBoltOn = false, dbsRenewalYears = 3) {
	const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

	const [pendingRaw, registersRaw, pastoralRaw, dbsRows, seenVolunteers, seenPastoral, seenForms, seenDbs] =
		await Promise.all([
			readCollection('pending_volunteers'),
			readCollection('registers'),
			dbsBoltOn ? readCollection('volunteer_pastoral_flags') : Promise.resolve([]),
			dbsBoltOn ? getDbsDashboardRows(organisationId, dbsRenewalYears) : Promise.resolve([]),
			organisationId ? getSeenIds(organisationId, 'pending_volunteer') : Promise.resolve(new Set()),
			organisationId && dbsBoltOn ? getSeenIds(organisationId, 'pastoral_concern') : Promise.resolve(new Set()),
			organisationId ? getSeenIds(organisationId, 'form_submission') : Promise.resolve(new Set()),
			organisationId && dbsBoltOn ? getSeenIds(organisationId, 'dbs_notification') : Promise.resolve(new Set())
		]);

	// Pending volunteers (status='pending', org-scoped; include legacy records with no organisationId)
	const pendingVolunteers = (
		organisationId
			? pendingRaw.filter((p) => !p.organisationId || p.organisationId === organisationId)
			: pendingRaw
	).filter((p) => p.status === 'pending' && !seenVolunteers.has(p.id)).length;

	// Form submissions: non-archived, submitted within the last 7 days, not seen
	const formSubmissions = filterByOrganisation(registersRaw, organisationId).filter(
		(r) => !r.archived && (r.submittedAt || r.createdAt || '') >= sevenDaysAgo && !seenForms.has(r.id)
	).length;

	// Pastoral concerns: active flags (bolt-on gated), not seen
	const pastoralConcerns = dbsBoltOn
		? filterByOrganisation(pastoralRaw, organisationId).filter(
				(f) => f.status === 'active' && !seenPastoral.has(f.id)
		  ).length
		: 0;

	// DBS notifications: amber or red status, contacts in DBS-required roles only (bolt-on gated), not seen
	const dbsNotifications = dbsBoltOn
		? dbsRows.filter((r) => (r.status === 'amber' || r.status === 'red') && !seenDbs.has(r.contactId)).length
		: 0;

	return { pendingVolunteers, pastoralConcerns, formSubmissions, dbsNotifications };
}
