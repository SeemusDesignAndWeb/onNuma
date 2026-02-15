import { fail } from '@sveltejs/kit';
import { readCollection, findById, update } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
import { validateRota } from '$lib/crm/server/validators.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';

export async function load({ cookies, parent }) {
	const { member } = await parent();
	const organisationId = await getCurrentOrganisationId();
	const [rotasRaw, eventsRaw, occurrencesRaw, contactsRaw] = await Promise.all([
		readCollection('rotas'),
		readCollection('events'),
		readCollection('occurrences'),
		readCollection('contacts')
	]);
	const allRotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
	const events = organisationId ? filterByOrganisation(eventsRaw, organisationId) : eventsRaw;
	const allOccurrences = organisationId ? filterByOrganisation(occurrencesRaw, organisationId) : occurrencesRaw;
	const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;
	const rotas = allRotas.filter(r => (r.visibility || 'public') === 'public');
	const occurrences = filterUpcomingOccurrences(allOccurrences);

	// Resolve spouse for the logged-in member
	let spouse = null;
	if (member?.spouseId) {
		spouse = contacts.find(c => c.id === member.spouseId) || null;
		if (spouse) {
			spouse = { id: spouse.id, firstName: spouse.firstName, lastName: spouse.lastName, email: spouse.email };
		}
	}

	const eventsMap = new Map(events.map(e => [e.id, e]));
	const rotasByEvent = new Map();

	rotas.forEach(rota => {
		if (!rotasByEvent.has(rota.eventId)) {
			const event = eventsMap.get(rota.eventId);
			if (event) rotasByEvent.set(rota.eventId, { event, rotas: [] });
		}
	});

	const rotasWithDetails = rotas.map(rota => {
		const assignees = rota.assignees || [];
		const eventOccurrences = occurrences.filter(o => o.eventId === rota.eventId);
		const assigneesByOcc = {};
		if (eventOccurrences.length > 0) {
			eventOccurrences.forEach(occ => {
				assigneesByOcc[occ.id] = assignees.filter(a => {
					if (typeof a === 'string') return rota.occurrenceId === occ.id;
					if (a && typeof a === 'object') {
						const aOccId = a.occurrenceId || rota.occurrenceId;
						return aOccId === occ.id;
					}
					return false;
				}).map(a => {
					if (typeof a === 'string') {
						const contact = contacts.find(c => c.id === a);
						return { id: contact?.id, name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : 'Unknown', email: contact?.email || '' };
					}
					if (a && typeof a === 'object' && a.contactId) {
						if (typeof a.contactId === 'string') {
							const contact = contacts.find(c => c.id === a.contactId);
							return { id: contact?.id, name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : (a.name || 'Unknown'), email: contact?.email || a.email || '' };
						}
						return { id: null, name: a.contactId.name || a.name || 'Unknown', email: a.contactId.email || a.email || '' };
					}
					return { id: null, name: a.name || 'Unknown', email: a.email || '' };
				});
			});
		}
		return { ...rota, assigneesByOcc };
	});

	rotasWithDetails.forEach(rota => {
		if (rotasByEvent.has(rota.eventId)) rotasByEvent.get(rota.eventId).rotas.push(rota);
	});

	const eventsWithRotas = Array.from(rotasByEvent.values())
		.map(({ event, rotas }) => ({
			event,
			rotas,
			occurrences: occurrences.filter(o => o.eventId === event.id)
		}))
		.sort((a, b) => a.event.title.localeCompare(b.event.title));

	const csrfToken = getCsrfToken(cookies) || '';
	return { eventsWithRotas, csrfToken, spouse };
}

export const actions = {
	signup: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}
		try {
			const organisationId = await getCurrentOrganisationId();

			// Use the authenticated member from the cookie
			const contactId = getMemberContactIdFromCookie(cookies);
			if (!contactId) return fail(401, { error: 'You must be signed in. Please refresh and try again.' });
			const matchedContact = await findById('contacts', contactId);
			if (!matchedContact) return fail(400, { error: 'Your account could not be found. Please sign in again.' });
			if (matchedContact.confirmed === false) {
				return fail(400, { error: 'Your contact details need to be confirmed before you can sign up for rotas. Please contact an administrator.' });
			}
			const normalizedEmail = (matchedContact.email || '').toLowerCase();

			const signUpWithSpouse = data.get('signUpWithSpouse') === 'on' || data.get('signUpWithSpouse') === 'true';
			let spouseContact = null;
			if (signUpWithSpouse && matchedContact && matchedContact.spouseId) {
				spouseContact = await findById('contacts', matchedContact.spouseId);
				if (!spouseContact) return fail(400, { error: 'Spouse contact not found' });
			}

			const selectedRotasStr = data.get('selectedRotas') || '[]';
			let selectedRotas;
			try {
				selectedRotas = JSON.parse(selectedRotasStr);
			} catch {
				return fail(400, { error: 'Invalid selection data format' });
			}
			if (!Array.isArray(selectedRotas)) return fail(400, { error: 'Invalid selection data format' });
			if (selectedRotas.length === 0) return fail(400, { error: 'Please select at least one rota and occurrence to sign up for' });

			const [occurrencesRaw, rotasRaw, contactsRaw, holidaysRaw] = await Promise.all([
				readCollection('occurrences'),
				readCollection('rotas'),
				readCollection('contacts'),
				readCollection('holidays')
			]);
			const allOccurrences = organisationId ? filterByOrganisation(occurrencesRaw, organisationId) : occurrencesRaw;
			const upcomingOccurrences = filterUpcomingOccurrences(allOccurrences);
			const allRotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
			const holidays = organisationId ? filterByOrganisation(holidaysRaw, organisationId) : holidaysRaw;
			const errors = [];

			const contactHolidays = holidays.filter(h => h.contactId === matchedContact.id);
			for (const { occurrenceId } of selectedRotas) {
				const occ = upcomingOccurrences.find(o => o.id === occurrenceId);
				if (occ) {
					const occStart = new Date(occ.startsAt);
					const occEnd = new Date(occ.endsAt || occ.startsAt);
					const isAway = contactHolidays.some(h => {
						const hStart = new Date(h.startDate);
						const hEnd = new Date(h.endDate);
						return occStart < hEnd && occEnd > hStart;
					});
					if (isAway) errors.push(`You have booked an away day for ${formatDateTimeUK(occ.startsAt)}`);
				}
			}

			const occurrenceCounts = {};
			for (const { occurrenceId } of selectedRotas) {
				if (occurrenceId) occurrenceCounts[occurrenceId] = (occurrenceCounts[occurrenceId] || 0) + 1;
			}
			for (const [occId, count] of Object.entries(occurrenceCounts)) {
				if (count > 1) return fail(400, { error: 'Your rota selections are clashing, please change one of your rota signups' });
			}

			for (const { rotaId, occurrenceId } of selectedRotas) {
				const rota = allRotas.find(r => r.id === rotaId);
				if (!rota) { errors.push(`Rota not found: ${rotaId}`); continue; }
				const targetOccurrenceId = occurrenceId || rota.occurrenceId || null;
				if (targetOccurrenceId) {
					const occ = upcomingOccurrences.find(o => o.id === targetOccurrenceId);
					if (!occ) { errors.push('The selected occurrence is no longer available for signup'); continue; }
				}
				if (targetOccurrenceId) {
					const eventRotas = allRotas.filter(r => r.eventId === rota.eventId);
					const allRotasForOcc = eventRotas.filter(r => !r.occurrenceId || r.occurrenceId === targetOccurrenceId);
					for (const r of allRotasForOcc) {
						const assignees = Array.isArray(r.assignees) ? r.assignees : [];
						const assigneesForOcc = assignees.filter(a => {
							if (typeof a === 'string') return r.occurrenceId === targetOccurrenceId;
							if (a && typeof a === 'object') return (a.occurrenceId || r.occurrenceId) === targetOccurrenceId;
							return false;
						});
						const alreadySignedUp = assigneesForOcc.some(a => {
							if (typeof a === 'string') return a === matchedContact.id;
							if (a && typeof a === 'object') {
								if (typeof a.contactId === 'string') return a.contactId === matchedContact.id;
								if (a.email && a.email.toLowerCase() === normalizedEmail) return true;
							}
							return false;
						});
						if (alreadySignedUp) {
							const occ = upcomingOccurrences.find(o => o.id === targetOccurrenceId);
							errors.push(`You are already signed up for a rota on ${occ ? formatDateTimeUK(occ.startsAt) : 'this occurrence'}`);
							break;
						}
					}
				}
			}

			if (errors.length > 0) return fail(400, { error: errors.join('; ') });

			for (const { rotaId, occurrenceId } of selectedRotas) {
				const rota = await findById('rotas', rotaId);
				if (!rota) { errors.push(`Rota not found: ${rotaId}`); continue; }
				const targetOccurrenceId = occurrenceId || rota.occurrenceId || null;
				const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
				const assigneesForOccurrence = existingAssignees.filter(a => {
					if (typeof a === 'string') return rota.occurrenceId === targetOccurrenceId;
					if (a && typeof a === 'object') return (a.occurrenceId || rota.occurrenceId) === targetOccurrenceId;
					return false;
				});
				const capacity = rota.capacity ?? rota.slots ?? 1;
				if (assigneesForOccurrence.length >= capacity) {
					errors.push(`Rota "${rota.role}" is full for this occurrence`);
					continue;
				}
				existingAssignees.push({ contactId: matchedContact.id, occurrenceId: targetOccurrenceId });
				if (signUpWithSpouse && spouseContact) {
					const spouseAlreadySignedUp = assigneesForOccurrence.some(a => (typeof a === 'string' ? a === spouseContact.id : a.contactId === spouseContact.id));
					if (!spouseAlreadySignedUp && assigneesForOccurrence.length + 1 < capacity) {
						existingAssignees.push({ contactId: spouseContact.id, occurrenceId: targetOccurrenceId });
					}
				}
				const updatedRota = { ...rota, assignees: existingAssignees };
				const validated = validateRota(updatedRota);
				await update('rotas', rota.id, validated);
			}

			if (errors.length > 0) return fail(400, { error: errors.join('; ') });
			return { success: true, message: 'Successfully signed up for selected rotas!' };
		} catch (error) {
			console.error('Error in rota signup:', error);
			return fail(500, { error: error.message || 'Failed to sign up for rotas' });
		}
	}
};
