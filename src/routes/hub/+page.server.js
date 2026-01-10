import { readCollection } from '$lib/crm/server/fileStore.js';

export async function load() {
	const [contacts, lists, newsletters, events, rotas, forms] = await Promise.all([
		readCollection('contacts'),
		readCollection('lists'),
		readCollection('newsletters'),
		readCollection('events'),
		readCollection('rotas'),
		readCollection('forms')
	]);

	// Get latest 3 newsletters (sorted by updatedAt or createdAt, most recent first)
	const latestNewsletters = [...newsletters]
		.sort((a, b) => {
			const dateA = new Date(a.updatedAt || a.createdAt || 0);
			const dateB = new Date(b.updatedAt || b.createdAt || 0);
			return dateB - dateA;
		})
		.slice(0, 3);

	// Get latest 5 rotas (sorted by updatedAt or createdAt, most recent first)
	const latestRotas = [...rotas]
		.sort((a, b) => {
			const dateA = new Date(a.updatedAt || a.createdAt || 0);
			const dateB = new Date(b.updatedAt || b.createdAt || 0);
			return dateB - dateA;
		})
		.slice(0, 5);

	// Get latest 5 events (sorted by updatedAt or createdAt, most recent first)
	const latestEvents = [...events]
		.sort((a, b) => {
			const dateA = new Date(a.updatedAt || a.createdAt || 0);
			const dateB = new Date(b.updatedAt || b.createdAt || 0);
			return dateB - dateA;
		})
		.slice(0, 5);

	// Enrich rotas with event titles
	const eventsMap = new Map(events.map(e => [e.id, e]));
	const enrichedRotas = latestRotas.map(rota => ({
		...rota,
		eventTitle: eventsMap.get(rota.eventId)?.title || 'Unknown Event'
	}));

	return {
		stats: {
			contacts: contacts.length,
			lists: lists.length,
			newsletters: newsletters.length,
			events: events.length,
			rotas: rotas.length,
			forms: forms.length
		},
		latestNewsletters,
		latestRotas: enrichedRotas,
		latestEvents
	};
}

