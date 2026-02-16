/**
 * GET /hub/settings/contact-data/export?contactId=xxx
 * Super admin only. Returns JSON file of all data related to the contact (GDPR export).
 */

import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { gatherContactData } from '$lib/crm/server/contactData.js';

export async function GET({ url, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
	if (!isSuperAdmin(admin)) return new Response(JSON.stringify({ error: 'Forbidden: Super admin only' }), { status: 403, headers: { 'Content-Type': 'application/json' } });

	const contactId = url.searchParams.get('contactId')?.trim();
	if (!contactId) return new Response(JSON.stringify({ error: 'contactId is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

	const organisationId = await getCurrentOrganisationId();
	if (!organisationId) return new Response(JSON.stringify({ error: 'No organisation context' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

	const data = await gatherContactData(contactId, organisationId);
	if (!data.contact) return new Response(JSON.stringify({ error: 'Contact not found or not in current organisation' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

	const name = [data.contact.firstName, data.contact.lastName].filter(Boolean).join(' ') || data.contact.email || 'contact';
	const safeName = name.replace(/[^a-zA-Z0-9-_]/g, '-').slice(0, 50);
	const filename = `contact-data-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;

	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'Content-Type': 'application/json',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
}
