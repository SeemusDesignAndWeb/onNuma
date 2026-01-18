import { readCollection } from '$lib/crm/server/fileStore.js';
import { fail } from '@sveltejs/kit';

export async function load() {
	return {};
}

export const actions = {
	search: async ({ request }) => {
		try {
			const data = await request.formData();
			const name = data.get('name')?.trim() || '';
			const email = data.get('email')?.trim().toLowerCase() || '';

			if (!name || !email) {
				return fail(400, { error: 'Name and email are required' });
			}

			// Validate email format
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(email)) {
				return fail(400, { error: 'Please enter a valid email address' });
			}

			// Load all rotas, events, occurrences, and contacts
			const [rotas, events, occurrences, contacts] = await Promise.all([
				readCollection('rotas'),
				readCollection('events'),
				readCollection('occurrences'),
				readCollection('contacts')
			]);

			// Create maps for quick lookup
			const eventsMap = new Map(events.map(e => [e.id, e]));
			const occurrencesMap = new Map(occurrences.map(o => [o.id, o]));
			const contactsMap = new Map(contacts.map(c => [c.id, c]));

			// Find rotas where this person is assigned
			const userRotas = [];

			for (const rota of rotas) {
				if (!rota.assignees || !Array.isArray(rota.assignees)) continue;

				for (const assignee of rota.assignees) {
					let isMatch = false;
					let assigneeOccurrenceId = null;

					// Handle old format: assignee is just a string (contactId)
					if (typeof assignee === 'string') {
						const contact = contactsMap.get(assignee);
						if (contact && contact.email && contact.email.toLowerCase() === email) {
							isMatch = true;
							assigneeOccurrenceId = rota.occurrenceId || null;
						}
					}
					// Handle new format: assignee is an object
					else if (assignee && typeof assignee === 'object') {
						// Public signup format: { name, email, occurrenceId }
						if (assignee.email && assignee.email.toLowerCase() === email) {
							isMatch = true;
							assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
						}
						// Contact format: { contactId, occurrenceId }
						else if (assignee.contactId) {
							const contact = contactsMap.get(assignee.contactId);
							if (contact && contact.email && contact.email.toLowerCase() === email) {
								isMatch = true;
								assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
							}
						}
					}

					if (isMatch) {
						const event = eventsMap.get(rota.eventId);
						
						// Get occurrence details
						let occurrence = null;
						if (assigneeOccurrenceId) {
							occurrence = occurrencesMap.get(assigneeOccurrenceId);
						} else if (rota.occurrenceId) {
							occurrence = occurrencesMap.get(rota.occurrenceId);
						}

						// If rota is for all occurrences (occurrenceId is null), we need to get all occurrences for the event
						let occurrencesToShow = [];
						if (!assigneeOccurrenceId && !rota.occurrenceId) {
							// Rota is for all occurrences - get all occurrences for this event
							occurrencesToShow = occurrences
								.filter(o => o.eventId === rota.eventId)
								.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
						} else if (occurrence) {
							occurrencesToShow = [occurrence];
						}

						// Add to results
						if (occurrencesToShow.length > 0) {
							for (const occ of occurrencesToShow) {
								userRotas.push({
									rotaId: rota.id,
									role: rota.role,
									eventId: rota.eventId,
									eventTitle: event?.title || 'Unknown Event',
									occurrenceId: occ.id,
									date: occ.startsAt,
									startTime: occ.startsAt,
									endTime: occ.endsAt,
									location: occ.location || event?.location || ''
								});
							}
						} else {
							// No occurrence found, but still show the rota
							userRotas.push({
								rotaId: rota.id,
								role: rota.role,
								eventId: rota.eventId,
								eventTitle: event?.title || 'Unknown Event',
								occurrenceId: null,
								date: null,
								startTime: null,
								endTime: null,
								location: event?.location || ''
							});
						}
					}
				}
			}

			// Sort by date (upcoming first, then by event title)
			userRotas.sort((a, b) => {
				if (a.date && b.date) {
					return new Date(a.date) - new Date(b.date);
				}
				if (a.date) return -1;
				if (b.date) return 1;
				return a.eventTitle.localeCompare(b.eventTitle);
			});

			return {
				success: true,
				name,
				email,
				rotas: userRotas
			};
		} catch (error) {
			console.error('Error searching for rotas:', error);
			return fail(500, { error: 'An error occurred while searching for your rotas. Please try again.' });
		}
	}
};
