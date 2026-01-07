import { readCollection } from '$lib/crm/server/fileStore.js';
import { ensureEventToken } from '$lib/crm/server/tokens.js';
import { env } from '$env/dynamic/private';

export async function load({ url }) {
	const events = await readCollection('events');
	const occurrences = await readCollection('occurrences');

	// Filter to only public events
	const publicEvents = events.filter(e => e.visibility === 'public');
	const publicEventIds = new Set(publicEvents.map(e => e.id));

	// Filter occurrences to only those belonging to public events
	const publicOccurrences = occurrences.filter(occ => publicEventIds.has(occ.eventId));

	// Enrich occurrences with event data
	const eventsMap = new Map(publicEvents.map(e => [e.id, e]));
	const enrichedOccurrences = publicOccurrences.map(occ => ({
		...occ,
		event: eventsMap.get(occ.eventId) || null
	})).filter(occ => occ.event !== null);

	// Generate public event links (tokens) for each event
	const eventLinks = new Map();
	for (const event of publicEvents) {
		try {
			const token = await ensureEventToken(event.id);
			const baseUrl = env.APP_BASE_URL || url.origin || 'http://localhost:5173';
			eventLinks.set(event.id, `/event/${token.token}`);
		} catch (error) {
			console.error(`Error generating token for event ${event.id}:`, error);
			// Continue without link if token generation fails
		}
	}

	return {
		events: publicEvents,
		occurrences: enrichedOccurrences,
		eventLinks: Object.fromEntries(eventLinks)
	};
}

