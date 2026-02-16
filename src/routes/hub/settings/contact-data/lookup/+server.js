/**
 * GET /hub/settings/contact-data/lookup?q=emailOrId
 * Super admin only. Returns minimal contact info for the given email or contact ID (current org).
 */

import { json, error } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { findById, readCollection } from '$lib/crm/server/fileStore.js';
import { filterByOrganisation } from '$lib/crm/server/orgContext.js';

export async function GET({ url, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) throw error(401, 'Unauthorized');
	if (!isSuperAdmin(admin)) throw error(403, 'Forbidden: Super admin only');

	const q = (url.searchParams.get('q') || '').trim();
	if (!q) return json({ contact: null });

	const organisationId = await getCurrentOrganisationId();
	if (!organisationId) return json({ contact: null });

	// Try as ID first
	let contact = await findById('contacts', q);
	if (contact && contact.organisationId != null && contact.organisationId !== organisationId) {
		contact = null;
	}
	if (!contact) {
		const all = await readCollection('contacts');
		const orgContacts = filterByOrganisation(all, organisationId);
		const lower = q.toLowerCase();
		contact = orgContacts.find(
			(c) =>
				c.id === q ||
				(c.email && c.email.toLowerCase() === lower) ||
				(c.email && c.email.toLowerCase().includes(lower))
		) || null;
	}
	if (!contact) return json({ contact: null });

	return json({
		contact: {
			id: contact.id,
			firstName: contact.firstName,
			lastName: contact.lastName,
			email: contact.email
		}
	});
}
