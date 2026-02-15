import { env } from '$env/dynamic/private';
import { readCollection, readCollectionCount, readLatestFromCollection, findById } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getConfiguredPlanMaxContacts } from '$lib/crm/server/permissions.js';

/** Build rota gaps: upcoming occurrences with zero or insufficient volunteers, sorted by urgency. */
async function getRotaGaps(organisationId) {
	const [rotas, occurrences, events] = await Promise.all([
		readCollection('rotas'),
		readCollection('occurrences'),
		readCollection('events')
	]);
	const eventsMap = new Map(events.filter(Boolean).map(e => [e.id, e]));
	const orgEventIds = organisationId
		? new Set(events.filter(e => e.organisationId === organisationId).map(e => e.id))
		: null;
	const orgRotas = organisationId && orgEventIds
		? rotas.filter(r => r.organisationId === organisationId || (r.eventId && orgEventIds.has(r.eventId)))
		: rotas;
	const now = new Date();
	const gaps = [];
	for (const rota of orgRotas) {
		const event = eventsMap.get(rota.eventId);
		if (!event) continue;
		const eventOccs = occurrences.filter(o => o.eventId === rota.eventId && new Date(o.startsAt) >= now);
		const relevantOccs = rota.occurrenceId
			? eventOccs.filter(o => o.id === rota.occurrenceId)
			: eventOccs;
		for (const occ of relevantOccs.slice(0, 12)) {
			const assigneesForOcc = (rota.assignees || []).filter(a => {
				const assigneeOccId = typeof a === 'object' && a != null && a.occurrenceId != null ? a.occurrenceId : null;
				if (assigneeOccId != null) return assigneeOccId === occ.id;
				if (rota.occurrenceId != null) return occ.id === rota.occurrenceId;
				return true;
			});
			const filled = assigneesForOcc.length;
			const required = rota.slots != null ? Number(rota.slots) : 1;
			if (filled < required) {
				gaps.push({
					rotaId: rota.id,
					rotaName: rota.role || 'Rota',
					eventTitle: event.title,
					occurrenceId: occ.id,
					date: occ.startsAt,
					positionsRequired: required,
					positionsFilled: filled,
					priority: filled === 0 ? 'critical' : 'low'
				});
			}
		}
	}
	gaps.sort((a, b) => new Date(a.date) - new Date(b.date));
	return gaps.slice(0, 10);
}

/** Contact display name: firstName + lastName (or name/email fallback). */
function contactDisplayName(c) {
	if (!c) return null;
	const full = `${(c.firstName || '').trim()} ${(c.lastName || '').trim()}`.trim();
	return full || c.name || c.email || null;
}

/** Resolve person key, display name and email from an assignee. */
function assigneeToPerson(a, contactsMap) {
	if (typeof a === 'string') {
		const c = contactsMap.get(a);
		return { key: a, displayName: contactDisplayName(c), email: c?.email || null };
	}
	if (a && typeof a === 'object') {
		if (a.contactId != null) {
			const c = contactsMap.get(a.contactId);
			return { key: a.contactId, displayName: contactDisplayName(c) || (a.name || null), email: c?.email || a.email || null };
		}
		if (a.email) {
			const key = (a.email || '').toLowerCase().trim();
			return { key, displayName: (a.name && a.name.trim()) || (a.firstName && a.firstName.trim()) || null, email: a.email || null };
		}
	}
	return null;
}

/** True if assignee a is assigned to this occurrence (for this rota). */
function assigneeMatchesOccurrence(a, rota, occurrenceId) {
	const assigneeOccId = typeof a === 'object' && a != null && a.occurrenceId != null ? a.occurrenceId : null;
	if (assigneeOccId != null) return assigneeOccId === occurrenceId;
	if (rota.occurrenceId != null) return occurrenceId === rota.occurrenceId;
	return true; // rota is for all occurrences
}

/** Volunteer leaderboard: top 5 by total rotas, with name, rota count, and serving in last 30 days. */
async function getVolunteerLeaderboard(organisationId, limit = 5) {
	const [contacts, rotas, occurrences] = await Promise.all([
		readCollection('contacts'),
		readCollection('rotas'),
		readCollection('occurrences')
	]);
	const orgRotas = organisationId ? rotas.filter(r => r.organisationId === organisationId) : rotas;
	// Use all contacts for name resolution so assignees from any org get their name shown
	const contactsMap = new Map(contacts.filter(Boolean).map(c => [c.id, c]));

	const now = new Date();
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	// key -> { totalCount, last30Count, displayName, email }
	const byKey = new Map();

	// Total participation count (all time)
	for (const rota of orgRotas) {
		for (const a of rota.assignees || []) {
			const person = assigneeToPerson(a, contactsMap);
			if (!person || !person.key) continue;
			const existing = byKey.get(person.key);
			const totalCount = (existing?.totalCount ?? 0) + 1;
			const name = person.displayName && person.displayName.trim() ? person.displayName.trim() : (person.email || 'Unknown');
			byKey.set(person.key, {
				totalCount,
				last30Count: existing?.last30Count ?? 0,
				displayName: existing?.displayName && existing.displayName !== 'Unknown' ? existing.displayName : name,
				email: person.email || existing?.email
			});
		}
	}

	// Serving in last 30 days: count (assignee, occurrence) where occurrence.startsAt in last 30 days
	for (const rota of orgRotas) {
		const eventOccs = occurrences.filter(o => o.eventId === rota.eventId);
		const occsLast30 = eventOccs.filter(o => {
			const d = new Date(o.startsAt);
			return d >= thirtyDaysAgo && d <= now;
		});
		for (const occ of occsLast30) {
			for (const a of rota.assignees || []) {
				if (!assigneeMatchesOccurrence(a, rota, occ.id)) continue;
				const person = assigneeToPerson(a, contactsMap);
				if (!person || !person.key) continue;
				const existing = byKey.get(person.key);
				if (!existing) continue;
				byKey.set(person.key, { ...existing, last30Count: (existing.last30Count || 0) + 1 });
			}
		}
	}

	const entries = [...byKey.entries()]
		.sort((a, b) => b[1].totalCount - a[1].totalCount)
		.slice(0, limit);

	return entries.map(([id, { totalCount, last30Count, displayName, email }]) => ({
		id,
		name: displayName && displayName !== 'Unknown' ? displayName : (email || 'Unknown'),
		email: email || null,
		rotaCount: totalCount,
		servingLast30Days: last30Count || 0
	}));
}

/** Current engagement state: counts for pie chart (engaged = have rota participation, notEngaged = contacts with none). */
async function getEngagementState(organisationId) {
	const [contacts, rotas] = await Promise.all([
		readCollection('contacts'),
		readCollection('rotas')
	]);
	const orgContacts = organisationId ? contacts.filter(c => c.organisationId === organisationId) : contacts;
	const orgRotas = organisationId ? rotas.filter(r => r.organisationId === organisationId) : rotas;
	const engagedIds = new Set();
	orgRotas.forEach(r => (r.assignees || []).forEach(a => {
		const id = typeof a === 'object' && a.contactId != null ? a.contactId : (typeof a === 'string' ? a : null);
		if (id) engagedIds.add(id);
	}));
	const engaged = engagedIds.size;
	const notEngaged = Math.max(0, orgContacts.length - engaged);
	return { engaged, notEngaged, total: orgContacts.length };
}

import { getSuggestedPeople } from '$lib/crm/server/suggestedToInvite.js';

export async function load({ locals, parent }) {
	const emailModuleEnabled = !!(env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN);
	const organisationId = await getCurrentOrganisationId();
	const parentData = await parent();
	const { plan } = parentData;

	const [
		contactsCount,
		listsCount,
		emailsCount,
		eventsCount,
		rotasCount,
		formsCount,
		emailStatsRaw,
		rotaGaps,
		volunteerLeaderboard,
		engagementState,
		suggestedPeople
	] = await Promise.all([
		readCollectionCount('contacts', { organisationId }),
		readCollectionCount('lists', { organisationId }),
		readCollectionCount('emails', { organisationId }),
		readCollectionCount('events', { organisationId }),
		readCollectionCount('rotas', { organisationId }),
		readCollectionCount('forms', { organisationId }),
		readCollection('email_stats'),
		getRotaGaps(organisationId),
		getVolunteerLeaderboard(organisationId, 5),
		getEngagementState(organisationId),
		getSuggestedPeople(organisationId)
	]);
	const suggestedPeopleAll = suggestedPeople || [];
	const suggestedPeopleTotal = suggestedPeopleAll.length;

	const planLimit = await getConfiguredPlanMaxContacts(plan || 'free');
	const contactsDisplayCount = Math.min(contactsCount, planLimit);

	const emailStats = organisationId ? filterByOrganisation(emailStatsRaw, organisationId) : emailStatsRaw;
	const today = new Date().toISOString().split('T')[0];
	const todayStat = emailStats.find(s => s.date === today);
	const emailsSentToday = todayStat?.count || 0;

	return {
		admin: locals.admin || null,
		organisationId: parentData.organisationId ?? organisationId ?? null,
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
		rotaGaps: rotaGaps || [],
		volunteerLeaderboard: volunteerLeaderboard || [],
		engagementState: engagementState || { engaged: 0, notEngaged: 0, total: 0 },
		suggestedPeople: suggestedPeopleAll.slice(0, 5),
		suggestedPeopleTotal
	};
}

