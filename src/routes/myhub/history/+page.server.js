import { readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getSettings } from '$lib/crm/server/settings.js';

export async function load({ parent }) {
	const { member } = await parent();
	if (!member) return { pastShifts: [], orgName: '', shiftCount: 0 };

	const email = (member.email || '').toLowerCase();
	const contactId = member.id;
	if (!email && !contactId) return { pastShifts: [], orgName: '', shiftCount: 0 };

	try {
		const organisationId = await getCurrentOrganisationId();
		const [rotasRaw, eventsRaw, occurrencesRaw, contactsRaw, thankyouRaw] = await Promise.all([
			readCollection('rotas'),
			readCollection('events'),
			readCollection('occurrences'),
			readCollection('contacts'),
			readCollection('volunteer_thankyou').catch(() => [])
		]);
		const rotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
		const events = organisationId ? filterByOrganisation(eventsRaw, organisationId) : eventsRaw;
		const occurrences = organisationId ? filterByOrganisation(occurrencesRaw, organisationId) : occurrencesRaw;
		const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;

		const eventsMap = new Map(events.map((e) => [e.id, e]));
		const occurrencesMap = new Map(occurrences.map((o) => [o.id, o]));
		const contactsMap = new Map(contacts.map((c) => [c.id, c]));

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const allShifts = [];

		for (const rota of rotas) {
			if (!rota.assignees || !Array.isArray(rota.assignees)) continue;

			for (const assignee of rota.assignees) {
				let isMatch = false;
				let assigneeOccurrenceId = null;

				if (typeof assignee === 'string') {
					if (assignee === contactId) {
						isMatch = true;
						assigneeOccurrenceId = rota.occurrenceId || null;
					} else {
						const contact = contactsMap.get(assignee);
						if (contact?.email && contact.email.toLowerCase() === email) {
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
						if (contact?.email && contact.email.toLowerCase() === email) {
							isMatch = true;
							assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
						}
					}
				}

				if (!isMatch) continue;

				const event = eventsMap.get(rota.eventId);
				let occsToCheck = [];

				if (!assigneeOccurrenceId && !rota.occurrenceId) {
					occsToCheck = occurrences
						.filter((o) => o.eventId === rota.eventId)
						.sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt));
				} else {
					const occ = occurrencesMap.get(assigneeOccurrenceId || rota.occurrenceId);
					if (occ) occsToCheck = [occ];
				}

				for (const occ of occsToCheck) {
					if (!occ.startsAt) continue;
					if (new Date(occ.startsAt) >= today) continue; // only past shifts
					allShifts.push({
						eventTitle: event?.title || 'Event',
						role: rota.role || '',
						date: occ.startsAt
					});
				}
			}
		}

		// Sort newest first
		allShifts.sort((a, b) => new Date(b.date) - new Date(a.date));

		// Org name for the header
		let orgName = '';
		try {
			const settings = await getSettings();
			orgName = settings?.organisationName || settings?.name || '';
		} catch (_) {}

		// Thank-you messages addressed to this volunteer
		const thankyouMessages = thankyouRaw
			.filter(
				(t) =>
					t.contactId === contactId &&
					(!organisationId || !t.organisationId || t.organisationId === organisationId)
			)
			.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

		return {
			pastShifts: allShifts,
			shiftCount: allShifts.length,
			orgName,
			thankyouMessages
		};
	} catch (err) {
		console.error('[myhub/history] load error:', err?.message || err);
		return { pastShifts: [], shiftCount: 0, orgName: '', thankyouMessages: [] };
	}
}
