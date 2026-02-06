import { redirect } from '@sveltejs/kit';
import { findById, readCollection } from '$lib/crm/server/fileStore.js';
import { personalizeContent, getUpcomingEvents, getUpcomingRotas, hasAnyRotas } from '$lib/crm/server/email.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';

export async function load({ params, url, event, parent }) {
	const organisationId = await getCurrentOrganisationId();
	const newsletter = await findById('emails', params.id);
	if (!newsletter) {
		throw redirect(302, '/hub/emails');
	}
	if (newsletter.organisationId != null && newsletter.organisationId !== organisationId) {
		throw redirect(302, '/hub/emails');
	}

	const { plan } = await parent();
	const orgContacts = filterByOrganisation(await readCollection('contacts'), organisationId);
	const sortedContacts = contactsWithinPlanLimit(orgContacts, plan);

	// Check if a contactId is provided in query params
	const contactId = url.searchParams.get('contactId');
	let personalizedContent = null;
	let selectedContact = null;

	if (contactId) {
		// Find the selected contact
		selectedContact = sortedContacts.find(c => c.id === contactId);
		
		if (selectedContact) {
			// Get upcoming rotas and events for this contact
			const upcomingRotas = await getUpcomingRotas(contactId, event);
			const upcomingEvents = await getUpcomingEvents(event, selectedContact);
			
			// Check if contact has any rotas
			const contactHasRotas = await hasAnyRotas(contactId);
			
			// Personalize the content
			const isHtml = !!newsletter.htmlContent;
			const content = newsletter.htmlContent || newsletter.textContent || '';
			personalizedContent = await personalizeContent(
				content,
				selectedContact,
				upcomingRotas,
				upcomingEvents,
				event,
				!isHtml,
				contactHasRotas
			);
		}
	}

	return {
		newsletter,
		contacts: sortedContacts,
		selectedContact,
		personalizedContent
	};
}

