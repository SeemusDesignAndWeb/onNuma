import { readCollection } from '$lib/crm/server/fileStore.js';

export async function load({ locals }) {
	const [contacts, lists, emails, events, rotas, forms, emailStats] = await Promise.all([
		readCollection('contacts'),
		readCollection('lists'),
		readCollection('emails'),
		readCollection('events'),
		readCollection('rotas'),
		readCollection('forms'),
		readCollection('email_stats')
	]);

	// Get latest 3 emails (sorted by updatedAt or createdAt, most recent first)
	const latestNewsletters = [...emails]
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

	// Calculate emails sent today
	const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
	const todayStat = emailStats.find(s => s.date === today);
	const emailsSentToday = todayStat?.count || 0;

	return {
		admin: locals.admin || null,
		stats: {
			contacts: contacts.length,
			lists: lists.length,
			newsletters: emails.length,
			events: events.length,
			rotas: rotas.length,
			forms: forms.length,
			emailsSentToday
		},
		latestNewsletters,
		latestRotas: enrichedRotas,
		latestEvents
	};
}

