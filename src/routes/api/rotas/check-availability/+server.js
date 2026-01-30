import { json } from '@sveltejs/kit';
import { readCollection, findById } from '$lib/crm/server/fileStore.js';

export async function POST({ request }) {
	try {
		const { contactIds, occurrenceId, currentRotaId } = await request.json();

		if (!contactIds || !Array.isArray(contactIds) || !occurrenceId) {
			return json({ error: 'Invalid parameters' }, { status: 400 });
		}

		// 1. Get the target occurrence to find its date
		const occurrences = await readCollection('occurrences');
		const targetOccurrence = occurrences.find(o => o.id === occurrenceId);
		
		if (!targetOccurrence) {
			return json({ error: 'Occurrence not found' }, { status: 404 });
		}

		const targetDate = new Date(targetOccurrence.startsAt).toISOString().split('T')[0];

		// 2. Find all occurrences on the same date
		const occurrencesOnSameDate = occurrences.filter(o => {
			const date = new Date(o.startsAt).toISOString().split('T')[0];
			return date === targetDate;
		});
		
		const occurrenceIdsOnSameDate = new Set(occurrencesOnSameDate.map(o => o.id));

		// 3. Load all rotas and find conflicts
		const allRotas = await readCollection('rotas');
		const events = await readCollection('events');
		const contacts = await readCollection('contacts');

		const conflicts = [];

		for (const rota of allRotas) {
			// Skip the current rota
			if (rota.id === currentRotaId) continue;

			const rotaAssignees = rota.assignees || [];
			
			for (const assignee of rotaAssignees) {
				let contactId, occId;

				if (typeof assignee === 'string') {
					contactId = assignee;
					occId = rota.occurrenceId;
				} else if (assignee && typeof assignee === 'object') {
					contactId = assignee.contactId || assignee.id;
					occId = assignee.occurrenceId || rota.occurrenceId;
				}

				if (contactIds.includes(contactId) && occId && occurrenceIdsOnSameDate.has(occId)) {
					const contact = contacts.find(c => c.id === contactId);
					const event = events.find(e => e.id === rota.eventId);
					const occurrence = occurrences.find(o => o.id === occId);
					
					conflicts.push({
						contactId,
						contactName: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : 'Unknown',
						rotaId: rota.id,
						rotaRole: rota.role,
						eventName: event ? event.title : 'Unknown Event',
						occurrenceId: occId,
						occurrenceTime: occurrence ? occurrence.startsAt : null
					});
				}
			}
		}

		return json({ conflicts });
	} catch (error) {
		console.error('Error checking availability:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
