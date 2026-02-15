import { readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';

/**
 * Automatically load rotas for the logged-in member (contact).
 * The member is resolved by the parent layout from the signed cookie.
 */
export async function load({ parent }) {
	const { member } = await parent();
	if (!member) return { rotas: [] };

	const email = (member.email || '').toLowerCase();
	const contactId = member.id;
	if (!email && !contactId) return { rotas: [] };

	try {
		const organisationId = await getCurrentOrganisationId();
		const [rotasRaw, eventsRaw, occurrencesRaw, contactsRaw] = await Promise.all([
			readCollection('rotas'),
			readCollection('events'),
			readCollection('occurrences'),
			readCollection('contacts')
		]);
		const rotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
		const events = organisationId ? filterByOrganisation(eventsRaw, organisationId) : eventsRaw;
		const occurrences = organisationId ? filterByOrganisation(occurrencesRaw, organisationId) : occurrencesRaw;
		const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;

		const eventsMap = new Map(events.map(e => [e.id, e]));
		const occurrencesMap = new Map(occurrences.map(o => [o.id, o]));
		const contactsMap = new Map(contacts.map(c => [c.id, c]));

		let userRotas = [];

		for (const rota of rotas) {
			if (!rota.assignees || !Array.isArray(rota.assignees)) continue;

			for (const assignee of rota.assignees) {
				let isMatch = false;
				let assigneeOccurrenceId = null;

				if (typeof assignee === 'string') {
					// assignee is a contactId string
					if (assignee === contactId) {
						isMatch = true;
						assigneeOccurrenceId = rota.occurrenceId || null;
					} else {
						const contact = contactsMap.get(assignee);
						if (contact && contact.email && contact.email.toLowerCase() === email) {
							isMatch = true;
							assigneeOccurrenceId = rota.occurrenceId || null;
						}
					}
				} else if (assignee && typeof assignee === 'object') {
					if (assignee.contactId === contactId) {
						isMatch = true;
						assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
					} else if (assignee.email && assignee.email.toLowerCase() === email) {
						isMatch = true;
						assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
					} else if (assignee.contactId) {
						const contact = contactsMap.get(assignee.contactId);
						if (contact && contact.email && contact.email.toLowerCase() === email) {
							isMatch = true;
							assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
						}
					}
				}

				if (isMatch) {
					const event = eventsMap.get(rota.eventId);
					let occurrence = null;
					if (assigneeOccurrenceId) {
						occurrence = occurrencesMap.get(assigneeOccurrenceId);
					} else if (rota.occurrenceId) {
						occurrence = occurrencesMap.get(rota.occurrenceId);
					}

					let occurrencesToShow = [];
					if (!assigneeOccurrenceId && !rota.occurrenceId) {
						occurrencesToShow = occurrences
							.filter(o => o.eventId === rota.eventId)
							.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
					} else if (occurrence) {
						occurrencesToShow = [occurrence];
					}

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

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		userRotas = userRotas.filter(rota => {
			if (!rota.date) return true;
			return new Date(rota.date) >= today;
		});

		userRotas.sort((a, b) => {
			if (a.date && b.date) return new Date(a.date) - new Date(b.date);
			if (a.date) return -1;
			if (b.date) return 1;
			return a.eventTitle.localeCompare(b.eventTitle);
		});

		return { rotas: userRotas };
	} catch (error) {
		console.error('[my rotas] Error loading rotas:', error);
		return { rotas: [], error: 'Could not load your rotas. Please try again.' };
	}
}
