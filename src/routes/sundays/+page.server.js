import { readCollection } from '$lib/crm/server/fileStore.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';
import { ensureEventToken } from '$lib/crm/server/tokens.js';
import { env } from '$env/dynamic/private';

export async function load({ url }) {
	// Load all events, occurrences, and rotas
	const events = await readCollection('events');
	const allOccurrences = await readCollection('occurrences');
	const allRotas = await readCollection('rotas');
	const contacts = await readCollection('contacts');

	// Filter to only public events
	const publicEvents = events.filter(e => (e.visibility || 'public') === 'public');
	const publicEventIds = new Set(publicEvents.map(e => e.id));

	// Filter occurrences to only those belonging to public events and are upcoming
	const publicOccurrences = allOccurrences.filter(occ => publicEventIds.has(occ.eventId));
	const upcomingOccurrences = filterUpcomingOccurrences(publicOccurrences);

	// Include all rotas (both public and internal) for public events
	const allRotasForPublicEvents = allRotas.filter(r => publicEventIds.has(r.eventId));

	// Get today's date (start of day)
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	
	// Get date 4 weeks from now (28 days)
	const fourWeeksFromNow = new Date(todayStart);
	fourWeeksFromNow.setDate(fourWeeksFromNow.getDate() + 28);

	// Filter occurrences to Sundays only, within the next 4 weeks
	const sundayOccurrences = upcomingOccurrences.filter(occ => {
		const occDate = new Date(occ.startsAt);
		const dayOfWeek = occDate.getDay(); // 0 = Sunday
		return dayOfWeek === 0 && occDate >= todayStart && occDate <= fourWeeksFromNow;
	});

	// Sort by date
	sundayOccurrences.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

	// Group occurrences by Sunday date (date only, ignoring time)
	const sundaysMap = new Map();
	
	sundayOccurrences.forEach(occ => {
		const occDate = new Date(occ.startsAt);
		const dateKey = occDate.toISOString().split('T')[0]; // YYYY-MM-DD
		
		if (!sundaysMap.has(dateKey)) {
			sundaysMap.set(dateKey, {
				date: dateKey,
				dateObj: new Date(occDate.getFullYear(), occDate.getMonth(), occDate.getDate()),
				occurrences: []
			});
		}
		
		const event = publicEvents.find(e => e.id === occ.eventId);
		if (event) {
			sundaysMap.get(dateKey).occurrences.push({
				...occ,
				event
			});
		}
	});

	// For each Sunday, get rotas for the events happening that day
	const eventsMap = new Map(publicEvents.map(e => [e.id, e]));
	
	const sundaysWithRotas = Array.from(sundaysMap.values()).map(sunday => {
		// Get all rotas for events happening on this Sunday
		const eventIdsOnSunday = new Set(sunday.occurrences.map(occ => occ.eventId));
		const rotasForSunday = allRotasForPublicEvents.filter(rota => {
			// Rota must be for an event happening on this Sunday
			if (!eventIdsOnSunday.has(rota.eventId)) return false;
			
			// If rota has a specific occurrenceId, it must match one of the Sunday occurrences
			if (rota.occurrenceId) {
				const sundayOccIds = new Set(sunday.occurrences.map(occ => occ.id));
				return sundayOccIds.has(rota.occurrenceId);
			}
			
			// If rota is for all occurrences, include it
			return true;
		});

		// Enrich rotas with assignee details
		const enrichedRotas = rotasForSunday.map(rota => {
			const assignees = rota.assignees || [];
			const event = eventsMap.get(rota.eventId);
			
			// Get assignees for each occurrence on this Sunday
			const assigneesByOcc = {};
			sunday.occurrences.forEach(occ => {
				if (occ.eventId === rota.eventId) {
					assigneesByOcc[occ.id] = assignees.filter(a => {
						if (typeof a === 'string') {
							// If rota has a specific occurrenceId, only show for that occurrence
							// Otherwise, show for all occurrences
							return !rota.occurrenceId || rota.occurrenceId === occ.id;
						}
						if (a && typeof a === 'object') {
							const aOccId = a.occurrenceId || rota.occurrenceId;
							// If rota is for all occurrences (no occurrenceId), show assignees without occurrenceId for all
							// If rota has occurrenceId, only show assignees matching that occurrence
							if (!rota.occurrenceId) {
								// Rota is for all occurrences - show assignees without occurrenceId for all
								return !aOccId || aOccId === occ.id;
							}
							// Rota is for specific occurrence - only show matching assignees
							return aOccId === occ.id;
						}
						return false;
					}).map(a => {
						if (typeof a === 'string') {
							const contact = contacts.find(c => c.id === a);
							return {
								id: contact?.id,
								name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : 'Unknown',
								email: contact?.email || ''
							};
						}
						if (a && typeof a === 'object' && a.contactId) {
							if (typeof a.contactId === 'string') {
								const contact = contacts.find(c => c.id === a.contactId);
								return {
									id: contact?.id,
									name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : (a.name || 'Unknown'),
									email: contact?.email || a.email || ''
								};
							}
							return {
								id: null,
								name: a.contactId.name || a.name || 'Unknown',
								email: a.contactId.email || a.email || ''
							};
						}
						return {
							id: null,
							name: a.name || 'Unknown',
							email: a.email || ''
						};
					});
				}
			});
			
			// Get all assignees for this rota across all occurrences on this Sunday
			const allAssignees = [];
			sunday.occurrences.forEach(occ => {
				if (occ.eventId === rota.eventId && assigneesByOcc[occ.id]) {
					allAssignees.push(...assigneesByOcc[occ.id]);
				}
			});
			
			// Remove duplicates by name
			const uniqueAssignees = Array.from(
				new Map(allAssignees.map(a => [a.name || a.email, a])).values()
			);

			return {
				...rota,
				event,
				assigneesByOcc,
				allAssignees: uniqueAssignees
			};
		});

		// Sort rotas: internal first, then public
		enrichedRotas.sort((a, b) => {
			const aIsInternal = (a.visibility || 'public') !== 'public';
			const bIsInternal = (b.visibility || 'public') !== 'public';
			if (aIsInternal && !bIsInternal) return -1;
			if (!aIsInternal && bIsInternal) return 1;
			return 0;
		});

		return {
			...sunday,
			rotas: enrichedRotas
		};
	});

	// Generate signup links for events
	const eventSignupLinks = new Map();
	const baseUrl = env.APP_BASE_URL || url.origin || 'http://localhost:5173';
	
	for (const event of publicEvents) {
		try {
			const token = await ensureEventToken(event.id);
			eventSignupLinks.set(event.id, `/signup/event/${token.token}`);
		} catch (error) {
			console.error(`Error generating signup link for event ${event.id}:`, error);
		}
	}

	return {
		sundays: sundaysWithRotas,
		eventSignupLinks: Object.fromEntries(eventSignupLinks)
	};
}
