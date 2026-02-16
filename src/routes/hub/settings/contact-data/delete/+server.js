/**
 * POST /hub/settings/contact-data/delete
 * Body: { contactId: string }
 * Super admin only. Deletes the contact and all related data (GDPR right to erasure).
 */

import { json } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { deleteContactData } from '$lib/crm/server/contactData.js';

export async function POST({ request, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) return json({ error: 'Unauthorized' }, { status: 401 });
	if (!isSuperAdmin(admin)) return json({ error: 'Forbidden: Super admin only' }, { status: 403 });

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	const contactId = (body.contactId || '').trim();
	if (!contactId) return json({ error: 'contactId is required' }, { status: 400 });

	const organisationId = await getCurrentOrganisationId();
	if (!organisationId) return json({ error: 'No organisation context' }, { status: 400 });

	const event = { getClientAddress: () => request.headers.get('x-forwarded-for') || 'unknown', request };
	try {
		const result = await deleteContactData(contactId, organisationId, {
			adminId: admin.id,
			request: event.request
		});
		return json({ success: true, ...result });
	} catch (err) {
		return json({ error: err.message || 'Delete failed' }, { status: 400 });
	}
}
