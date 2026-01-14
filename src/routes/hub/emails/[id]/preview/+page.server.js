import { redirect } from '@sveltejs/kit';
import { findById, readCollection } from '$lib/crm/server/fileStore.js';
import { personalizeContent, getUpcomingEvents, getUpcomingRotas, hasAnyRotas } from '$lib/crm/server/email.js';

export async function load({ params, url, event }) {
	const newsletter = await findById('emails', params.id);
	if (!newsletter) {
		throw redirect(302, '/hub/emails');
	}

	// Get all contacts for the user selector
	const contacts = await readCollection('contacts');
	// Sort contacts alphabetically by last name, then first name
	const sortedContacts = contacts.sort((a, b) => {
		const aLastName = (a.lastName || '').toLowerCase();
		const bLastName = (b.lastName || '').toLowerCase();
		const aFirstName = (a.firstName || '').toLowerCase();
		const bFirstName = (b.firstName || '').toLowerCase();
		
		if (aLastName !== bLastName) {
			return aLastName.localeCompare(bLastName);
		}
		return aFirstName.localeCompare(bFirstName);
	});

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
			const upcomingEvents = await getUpcomingEvents(event);
			
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

