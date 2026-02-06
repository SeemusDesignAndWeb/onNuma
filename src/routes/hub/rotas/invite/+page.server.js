import { readCollection } from '$lib/crm/server/fileStore.js';
import { getCsrfToken } from '$lib/crm/server/auth.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';

export async function load({ cookies, parent }) {
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();
	const events = filterByOrganisation(await readCollection('events'), organisationId);
	const rotas = filterByOrganisation(await readCollection('rotas'), organisationId);
	const occurrences = filterByOrganisation(await readCollection('occurrences'), organisationId);
	const orgContacts = filterByOrganisation(await readCollection('contacts'), organisationId);
	const contacts = contactsWithinPlanLimit(orgContacts, plan);
	const lists = filterByOrganisation(await readCollection('lists'), organisationId);

	const csrfToken = getCsrfToken(cookies) || '';
	return { events, rotas, occurrences, contacts, lists, csrfToken };
}

