import { error, fail } from '@sveltejs/kit';
import { getRotaTokenByToken } from '$lib/crm/server/tokens.js';
import { findById, update, findMany, create } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';
import { getCsrfToken, generateCsrfToken, setCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';
import { validateRota } from '$lib/crm/server/validators.js';
import { env } from '$env/dynamic/private';
import { getThemeForCurrentOrganisation } from '$lib/crm/server/settings.js';

export async function load({ params, cookies }) {
	const token = await getRotaTokenByToken(params.token);
	if (!token) throw error(404, 'Invalid or expired signup link.');

	const event = await findById('events', token.eventId);
	if (!event) throw error(404, 'Event not found.');

	const organisationId = await getCurrentOrganisationId();
	if (organisationId != null && event.organisationId != null && event.organisationId !== organisationId) {
		throw error(404, 'Event not found.');
	}

	const eventOccurrences = await findMany('occurrences', (o) => o.eventId === event.id);
	const occurrences = filterUpcomingOccurrences(eventOccurrences);

	const allRotas = token.rotaId
		? await findMany('rotas', (r) => r.eventId === event.id && r.id === token.rotaId)
		: await findMany('rotas', (r) => r.eventId === event.id);
	const rotas = allRotas.filter((r) => (r.visibility || 'public') === 'public');

	// Build slot display: { id, role, capacity, countsByOcc }
	const rotasForDisplay = rotas.map((rota) => {
		const assignees = rota.assignees || [];
		const countsByOcc = {};
		occurrences.forEach((occ) => {
			countsByOcc[occ.id] = assignees.filter((a) => {
				if (typeof a === 'string') return rota.occurrenceId === occ.id;
				if (a && typeof a === 'object') return (a.occurrenceId || rota.occurrenceId) === occ.id;
				return false;
			}).length;
		});
		return { id: rota.id, role: rota.role || 'Volunteer', capacity: rota.capacity ?? 1, countsByOcc };
	});

	let csrfToken = getCsrfToken(cookies);
	if (!csrfToken) {
		csrfToken = generateCsrfToken();
		setCsrfToken(cookies, csrfToken, env.NODE_ENV === 'production');
	}

	let theme = null;
	try {
		theme = await getThemeForCurrentOrganisation();
	} catch {
		// non-fatal
	}

	return {
		event: { id: event.id, title: event.title || 'Event' },
		occurrences: occurrences.map((o) => ({ id: o.id, startsAt: o.startsAt, endsAt: o.endsAt })),
		rotas: rotasForDisplay,
		csrfToken,
		theme
	};
}

export const actions = {
	signup: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh the page and try again.' });
		}

		const firstName = (data.get('firstName') || '').trim();
		const lastName = (data.get('lastName') || '').trim();
		const email = (data.get('email') || '').trim().toLowerCase();
		const phone = (data.get('phone') || '').trim();

		if (!firstName || !email) {
			return fail(400, { error: 'First name and email address are required.' });
		}

		let selectedRotas;
		try {
			selectedRotas = JSON.parse(data.get('selectedRotas') || '[]');
		} catch {
			return fail(400, { error: 'Invalid slot selection. Please go back and try again.' });
		}
		if (!Array.isArray(selectedRotas) || selectedRotas.length === 0) {
			return fail(400, { error: 'Please select at least one slot.' });
		}

		const token = await getRotaTokenByToken(params.token);
		if (!token) return fail(404, { error: 'Invalid signup link.' });

		const event = await findById('events', token.eventId);
		if (!event) return fail(404, { error: 'Event not found.' });

		const organisationId = await getCurrentOrganisationId();
		if (organisationId != null && event.organisationId != null && event.organisationId !== organisationId) {
			return fail(404, { error: 'Event not found.' });
		}

		// Path resolution: find contact by email
		const existingContacts = await findMany('contacts', (c) => c.email && c.email.toLowerCase() === email);
		const matchedContact = existingContacts[0] || null;
		const isConfirmed = matchedContact && matchedContact.confirmed !== false;

		if (isConfirmed) {
			// Path A: known + confirmed — assign directly
			const eventOccurrences = await findMany('occurrences', (o) => o.eventId === event.id);
			const occurrences = filterUpcomingOccurrences(eventOccurrences);
			const allRotas = await findMany('rotas', (r) => r.eventId === event.id);
			const errors = [];

			// Duplicate occurrence check
			const occCounts = {};
			for (const { occurrenceId } of selectedRotas) {
				if (occurrenceId) occCounts[occurrenceId] = (occCounts[occurrenceId] || 0) + 1;
			}
			for (const count of Object.values(occCounts)) {
				if (count > 1) return fail(400, { error: 'Your selections conflict — you have chosen the same date twice.' });
			}

			for (const { rotaId, occurrenceId } of selectedRotas) {
				const rota = await findById('rotas', rotaId);
				if (!rota) { errors.push(`Opportunity not found.`); continue; }

				const targetOccId = occurrenceId || rota.occurrenceId || null;
				if (targetOccId && !occurrences.find((o) => o.id === targetOccId)) {
					errors.push('One of the selected dates is no longer available.');
					continue;
				}

				const existing = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
				const forOcc = existing.filter((a) => {
					if (typeof a === 'string') return rota.occurrenceId === targetOccId;
					if (a && typeof a === 'object') return (a.occurrenceId || rota.occurrenceId) === targetOccId;
					return false;
				});

				// Already signed up check
				const alreadySignedUp = forOcc.some((a) => {
					if (typeof a === 'string') return a === matchedContact.id;
					if (a && typeof a === 'object') {
						if (typeof a.contactId === 'string') return a.contactId === matchedContact.id;
						if (a.email && a.email.toLowerCase() === email) return true;
					}
					return false;
				});
				if (alreadySignedUp) {
					errors.push(`You are already signed up for this slot.`);
					continue;
				}

				const cap = rota.capacity ?? 1;
				if (forOcc.length >= cap) {
					errors.push(`The "${rota.role}" slot is full for that date.`);
					continue;
				}

				existing.push({ contactId: matchedContact.id, occurrenceId: targetOccId });
				await update('rotas', rota.id, validateRota({ ...rota, assignees: existing }));
			}

			if (errors.length > 0) return fail(400, { error: errors.join(' ') });
			return { success: true, path: 'A', name: firstName };
		}

		// Paths B / C / D — create pending volunteer record
		const eventOccurrences = await findMany('occurrences', (o) => o.eventId === event.id);
		const occurrences = filterUpcomingOccurrences(eventOccurrences);
		const allRotas = await findMany('rotas', (r) => r.eventId === event.id);

		const rotaSlots = selectedRotas
			.map(({ rotaId, occurrenceId }) => {
				const rota = allRotas.find((r) => r.id === rotaId);
				const occ = occurrences.find((o) => o.id === occurrenceId);
				if (!rota) return null;
				return {
					rotaId,
					rotaRole: rota.role || 'Volunteer',
					occurrenceId: occurrenceId || null,
					occurrenceDate: occ?.startsAt || null,
					eventId: event.id,
					eventTitle: event.title || ''
				};
			})
			.filter(Boolean);

		if (rotaSlots.length === 0) {
			return fail(400, { error: 'No valid slots selected. Please go back and try again.' });
		}

		await create('pending_volunteers', {
			firstName,
			lastName,
			email,
			phone,
			contactId: matchedContact?.id || null,
			rotaSlots,
			status: 'pending',
			notes: '',
			organisationId: organisationId || null,
			createdAt: new Date().toISOString()
		});

		// Coordinator notification is sent from the hub/volunteers page on review
		return { success: true, path: 'pending', name: firstName };
	}
};
