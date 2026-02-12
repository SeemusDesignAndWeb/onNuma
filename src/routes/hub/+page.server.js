import { env } from '$env/dynamic/private';
import { readCollection, readCollectionCount, readLatestFromCollection, findById } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getPlanMaxContacts } from '$lib/crm/server/permissions.js';

export async function load({ locals, parent }) {
	const emailModuleEnabled = !!(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN);
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();

	// Optimized: Use counts for stats (no row loading) and limited queries for latest items
	const [
		contactsCount,
		listsCount,
		emailsCount,
		eventsCount,
		rotasCount,
		formsCount,
		latestNewslettersRaw,
		latestRotasRaw,
		latestEventsRaw,
		emailStatsRaw
	] = await Promise.all([
		readCollectionCount('contacts', { organisationId }),
		readCollectionCount('lists', { organisationId }),
		readCollectionCount('emails', { organisationId }),
		readCollectionCount('events', { organisationId }),
		readCollectionCount('rotas', { organisationId }),
		readCollectionCount('forms', { organisationId }),
		readLatestFromCollection('emails', 3, { organisationId }),
		readLatestFromCollection('rotas', 3, { organisationId }),
		readLatestFromCollection('events', 3, { organisationId }),
		// email_stats still needs full load to find today's stat
		readCollection('email_stats')
	]);

	const planLimit = getPlanMaxContacts(plan || 'free');
	const contactsDisplayCount = Math.min(contactsCount, planLimit);

	// Filter out any null/undefined entries (e.g. malformed data on Railway)
	const latestNewsletters = latestNewslettersRaw.filter(Boolean);
	const latestRotas = latestRotasRaw.filter(Boolean);
	const latestEvents = latestEventsRaw.filter(Boolean);

	// Enrich rotas with event titles - look up the specific events the rotas need
	// (latestEvents may not contain the events these rotas are linked to)
	const rotaEventIds = [...new Set(latestRotas.map(r => r.eventId).filter(Boolean))];
	const rotaEvents = await Promise.all(rotaEventIds.map(id => findById('events', id)));
	const eventsMap = new Map(rotaEvents.filter(Boolean).map(e => [e.id, e]));
	const enrichedRotas = latestRotas.map(rota => ({
		...rota,
		eventTitle: eventsMap.get(rota.eventId)?.title || 'Unknown Event'
	}));

	// Calculate emails sent today
	const emailStats = organisationId ? filterByOrganisation(emailStatsRaw, organisationId) : emailStatsRaw;
	const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
	const todayStat = emailStats.find(s => s.date === today);
	const emailsSentToday = todayStat?.count || 0;

	return {
		admin: locals.admin || null,
		emailModuleEnabled,
		stats: {
			contacts: contactsDisplayCount,
			lists: listsCount,
			newsletters: emailsCount,
			events: eventsCount,
			rotas: rotasCount,
			forms: formsCount,
			emailsSentToday
		},
		latestNewsletters,
		latestRotas: enrichedRotas,
		latestEvents
	};
}

