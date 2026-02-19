import { json, error } from '@sveltejs/kit';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { ensureRotaToken } from '$lib/crm/server/tokens.js';
import { sendSuggestedInviteEmail } from '$lib/crm/server/email.js';
import { env } from '$env/dynamic/private';

export async function POST({ request, cookies, url }) {
	const data = await request.json();
	const csrfToken = data._csrf;

	if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
		throw error(403, 'CSRF token validation failed');
	}

	const { contactId, rotaIds, customMessage } = data;

	if (!contactId || !rotaIds || !Array.isArray(rotaIds) || rotaIds.length === 0) {
		throw error(400, 'Contact and at least one rota are required');
	}

	const organisationId = await getCurrentOrganisationId();
	const contacts = filterByOrganisation(await readCollection('contacts'), organisationId);
	const contact = contacts.find((c) => c.id === contactId);
	if (!contact) {
		throw error(404, 'Contact not found');
	}
	if (!contact.email) {
		throw error(400, 'This contact has no email address');
	}

	const rotas = filterByOrganisation(await readCollection('rotas'), organisationId);
	const events = filterByOrganisation(await readCollection('events'), organisationId);
	const selectedRotas = rotas.filter((r) => rotaIds.includes(r.id));
	if (selectedRotas.length === 0) {
		throw error(400, 'No valid rotas selected');
	}

	const baseUrl = env.APP_BASE_URL || url.origin || 'http://localhost:5173';

	const rotaInvites = [];
	for (const rota of selectedRotas) {
		const tokenData = await ensureRotaToken(rota.eventId, rota.id, null);
		const eventData = events.find((e) => e.id === rota.eventId) || null;
		rotaInvites.push({
			rota,
			event: eventData,
			signupUrl: `${baseUrl}/signup/schedule/${tokenData.token}#rota-${rota.id}`
		});
	}

	const event = { url, cookies };
	const result = await sendSuggestedInviteEmail(
		contact,
		rotaInvites,
		typeof customMessage === 'string' ? customMessage : '',
		event
	);

	if (result.status === 'error') {
		return json({ success: false, error: result.error || 'Failed to send email' });
	}

	return json({ success: true });
}
