import { json, error } from '@sveltejs/kit';
import { findById, readCollection, findMany } from '$lib/crm/server/fileStore.js';
import { ensureRotaTokens, ensureEventToken } from '$lib/crm/server/tokens.js';
import { sendCombinedRotaInvites } from '$lib/crm/server/email.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { env } from '$env/dynamic/private';

export async function POST({ request, cookies, url }) {
	const data = await request.json();
	const csrfToken = data._csrf;

	if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
		throw error(403, 'CSRF token validation failed');
	}

	const { eventId, rotaIds, occurrenceIds, listId, customMessage } = data;

	if (!eventId || !rotaIds || !Array.isArray(rotaIds) || rotaIds.length === 0 || !listId) {
		throw error(400, 'Invalid request data');
	}

	const list = await findById('lists', listId);
	if (!list) {
		throw error(404, 'List not found');
	}

	const contacts = await readCollection('contacts');
	const listContacts = contacts.filter(c => list.contactIds?.includes(c.id));

	const event = await findById('events', eventId);
	if (!event) {
		throw error(404, 'Event not found');
	}

	const rotas = await readCollection('rotas');
	const selectedRotas = rotas.filter(r => rotaIds.includes(r.id));

	const occurrences = occurrenceIds && occurrenceIds.length > 0
		? await findMany('occurrences', o => occurrenceIds.includes(o.id))
		: [null]; // null means recurring/all occurrences

	// Build rota occurrence combinations
	const rotaOccurrences = [];
	for (const rota of selectedRotas) {
		for (const occurrence of occurrences) {
			rotaOccurrences.push({
				eventId,
				rotaId: rota.id,
				occurrenceId: occurrence?.id || null
			});
		}
	}

	// Ensure tokens exist
	const tokens = await ensureRotaTokens(rotaOccurrences);

	// Get event page URL
	let eventPageUrl = null;
	try {
		const eventToken = await ensureEventToken(eventId);
		const baseUrl = env.APP_BASE_URL || url.origin || 'http://localhost:5173';
		eventPageUrl = `${baseUrl}/event/${eventToken.token}`;
	} catch (error) {
		console.error('Error generating event token:', error);
		// Continue without event page link if token generation fails
	}

	// Group invites by contact (one email per contact with all rotas)
	const contactInvitesMap = new Map();
	
	for (const contact of listContacts) {
		if (!contact.email) continue; // Skip contacts without email
		
		const contactInvites = [];
		
		for (const tokenData of tokens) {
			const rota = selectedRotas.find(r => r.id === tokenData.rotaId);
			const occurrence = tokenData.occurrenceId
				? occurrences.find(o => o.id === tokenData.occurrenceId)
				: null;

			contactInvites.push({
				token: tokenData.token,
				rotaData: {
					rota,
					event,
					occurrence
				}
			});
		}
		
		if (contactInvites.length > 0) {
			contactInvitesMap.set(contact.id, {
				contact,
				invites: contactInvites
			});
		}
	}

	// Convert map to array
	const contactInvites = Array.from(contactInvitesMap.values());

	// Send combined invites (one email per contact)
	const results = await sendCombinedRotaInvites(contactInvites, event, eventPageUrl, { url }, customMessage || '');

	return json({ success: true, results });
}

