import { env } from '$env/dynamic/private';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';

export async function load({ locals, parent }) {
	const emailModuleEnabled = !!env.RESEND_API_KEY;
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();

	const [contactsRaw, listsRaw, emailsRaw, eventsRaw, rotasRaw, formsRaw, emailStatsRaw] = await Promise.all([
		readCollection('contacts'),
		readCollection('lists'),
		readCollection('emails'),
		readCollection('events'),
		readCollection('rotas'),
		readCollection('forms'),
		readCollection('email_stats')
	]);

	const orgContacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;
	const contacts = organisationId ? contactsWithinPlanLimit(orgContacts, plan) : orgContacts;
	const lists = organisationId ? filterByOrganisation(listsRaw, organisationId) : listsRaw;
	const emails = organisationId ? filterByOrganisation(emailsRaw, organisationId) : emailsRaw;
	const events = organisationId ? filterByOrganisation(eventsRaw, organisationId) : eventsRaw;
	const rotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
	const forms = organisationId ? filterByOrganisation(formsRaw, organisationId) : formsRaw;
	const emailStats = organisationId ? filterByOrganisation(emailStatsRaw, organisationId) : emailStatsRaw;

	// Filter out any null/undefined entries from collections (e.g. malformed data on Railway)
	const validEmails = emails.filter(Boolean);
	const validRotas = rotas.filter(Boolean);
	const validEvents = events.filter(Boolean);

	// Get latest 3 emails (sorted by updatedAt or createdAt, most recent first)
	const latestNewsletters = [...validEmails]
		.sort((a, b) => {
			const dateA = new Date(a.updatedAt || a.createdAt || 0);
			const dateB = new Date(b.updatedAt || b.createdAt || 0);
			return dateB - dateA;
		})
		.slice(0, 3);

	// Get latest 5 rotas (sorted by updatedAt or createdAt, most recent first)
	const latestRotas = [...validRotas]
		.sort((a, b) => {
			const dateA = new Date(a.updatedAt || a.createdAt || 0);
			const dateB = new Date(b.updatedAt || b.createdAt || 0);
			return dateB - dateA;
		})
		.slice(0, 5);

	// Get latest 5 events (sorted by updatedAt or createdAt, most recent first)
	const latestEvents = [...validEvents]
		.sort((a, b) => {
			const dateA = new Date(a.updatedAt || a.createdAt || 0);
			const dateB = new Date(b.updatedAt || b.createdAt || 0);
			return dateB - dateA;
		})
		.slice(0, 5);

	// Enrich rotas with event titles
	const eventsMap = new Map(validEvents.map(e => [e.id, e]));
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
		emailModuleEnabled,
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

