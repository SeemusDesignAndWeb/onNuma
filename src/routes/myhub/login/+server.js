import { redirect } from '@sveltejs/kit';
import { getCurrentOrganisationId, getSettings } from '$lib/crm/server/settings.js';
import { readCollection, findById } from '$lib/crm/server/fileStore.js';
import { filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getHubBaseUrlFromOrg } from '$lib/crm/server/hubDomain.js';
import { createMagicLinkToken } from '$lib/crm/server/memberAuth.js';
import { sendMagicLinkEmail } from '$lib/crm/server/email.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { env } from '$env/dynamic/private';

function jsonOk() {
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}

/** GET: redirect to My home (magic link unauthenticated screen is shown there). */
export function GET() {
	throw redirect(302, '/myhub');
}

/**
 * POST: accept an email address, generate a magic link token, and send it to the
 * volunteer. Always returns { ok: true } regardless of whether the email matches a
 * contact — this prevents enumeration of registered emails.
 */
export async function POST(event) {
	const { request, cookies } = event;
	const data = await request.formData();

	if (!verifyCsrfToken(cookies, data.get('_csrf'))) {
		// Return ok anyway to avoid leaking CSRF state to unauthenticated callers.
		return jsonOk();
	}

	const email = (data.get('email') || '').toString().trim().toLowerCase();
	if (!email) return jsonOk();

	// Best-effort: if anything fails here we still return ok so the UI shows
	// "check your email" and we log the error server-side.
	try {
		await dispatchMagicLink(email, event);
	} catch (err) {
		console.error('[myhub/login] Error dispatching magic link:', err?.message || err);
	}

	return jsonOk();
}

/**
 * Find the contact, create a token, and email the magic link.
 * Silently returns if the email is not in the system.
 */
async function dispatchMagicLink(email, event) {
	let organisationId = null;
	try {
		organisationId = await getCurrentOrganisationId();
	} catch {
		// Proceed without org filter if unavailable.
	}

	const contactsRaw = await readCollection('contacts');
	const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;
	const contact = contacts.find((c) => c.email && c.email.toLowerCase() === email);

	// Silently skip unknown or unconfirmed contacts.
	if (!contact || contact.confirmed === false) return;

	const token = await createMagicLinkToken(contact.id);
	// Use org's hub domain so link points to correct subdomain (e.g. acme.onnuma.com), not main app
	const fallbackOrigin = event?.url?.origin || env.APP_BASE_URL || 'http://localhost:5173';
	const org = contact.organisationId ? await findById('organisations', contact.organisationId) : null;
	const baseUrl = getHubBaseUrlFromOrg(org, fallbackOrigin);
	const magicLink = `${baseUrl}/myhub/auth/${token}`;

	let orgName = '';
	try {
		const settings = await getSettings();
		orgName = settings?.organisationName || settings?.name || '';
	} catch {
		// Non-fatal — email sends without org name.
	}

	const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
	await sendMagicLinkEmail({ to: contact.email, name, magicLink, orgName }, event);
}
