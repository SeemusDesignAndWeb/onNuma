import { json } from '@sveltejs/kit';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';
import { getCachedOrganisations } from '$lib/crm/server/organisationsCache.js';
import { getBadgeCounts } from '$lib/crm/server/badgeCounts.js';

const EMPTY = { pendingVolunteers: 0, pastoralConcerns: 0, formSubmissions: 0, dbsNotifications: 0 };

export async function GET({ locals }) {
	if (!locals.admin) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const [organisationId, orgs] = await Promise.all([
			getCurrentOrganisationId(),
			getCachedOrganisations()
		]);

		const org = organisationId ? orgs.find((o) => o.id === organisationId) : null;
		const dbsBoltOn = !!(org?.dbsBoltOn ?? org?.churchBoltOn);
		const dbsRenewalYears = org?.dbsRenewalYears ?? 3;

		const counts = await getBadgeCounts(organisationId, dbsBoltOn, dbsRenewalYears);
		return json(counts);
	} catch (err) {
		console.error('[badge-counts] error:', err?.message || err);
		return json(EMPTY);
	}
}
