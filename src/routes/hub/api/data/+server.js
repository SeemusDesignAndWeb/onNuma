/**
 * Hub Data API
 * 
 * Returns all core Hub data in a single request for client-side caching.
 * Called once after login to populate Svelte stores for SPA-like navigation.
 */

import { json } from '@sveltejs/kit';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';
import { getPlanFromAreaPermissions, getPlanMaxContacts } from '$lib/crm/server/permissions.js';
import { getCachedOrganisations } from '$lib/crm/server/organisationsCache.js';

/** GET: Load all hub data for the current organisation */
export async function GET({ locals }) {
	// Must be authenticated
	if (!locals.admin) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const organisationId = await getCurrentOrganisationId();
	if (!organisationId) {
		return json({ error: 'No organisation context' }, { status: 400 });
	}

	// Get plan from organisation
	const orgs = await getCachedOrganisations();
	const org = orgs.find(o => o.id === organisationId);
	const plan = getPlanFromAreaPermissions(org?.areaPermissions) || 'free';
	const planLimit = getPlanMaxContacts(plan);

	// Load all collections in parallel
	const [contactsRaw, eventsRaw, rotasRaw, listsRaw, formsRaw, emailsRaw, emailStatsRaw] = await Promise.all([
		readCollection('contacts', { organisationId }),
		readCollection('events', { organisationId }),
		readCollection('rotas', { organisationId }),
		readCollection('lists'),
		readCollection('forms'),
		readCollection('emails'),
		readCollection('email_stats')
	]);

	// Filter by org and apply plan limits
	const orgContacts = filterByOrganisation(contactsRaw, organisationId);
	const contacts = contactsWithinPlanLimit(orgContacts, plan);

	// Return minimal contact fields for list view (full contact fetched on demand)
	const contactsForList = contacts.map(c => ({
		id: c.id,
		firstName: c.firstName || '',
		lastName: c.lastName || '',
		email: c.email || '',
		phone: c.phone || '',
		membershipStatus: c.membershipStatus || '',
		dateJoined: c.dateJoined || null,
		smallGroup: c.smallGroup || '',
		organisationId: c.organisationId
	}));

	return json({
		contacts: contactsForList,
		totalContactsInOrg: orgContacts.length,
		planLimit,
		events: filterByOrganisation(eventsRaw, organisationId),
		rotas: filterByOrganisation(rotasRaw, organisationId),
		lists: filterByOrganisation(listsRaw, organisationId),
		forms: filterByOrganisation(formsRaw, organisationId),
		emails: filterByOrganisation(emailsRaw, organisationId),
		emailStats: filterByOrganisation(emailStatsRaw, organisationId)
	});
}
