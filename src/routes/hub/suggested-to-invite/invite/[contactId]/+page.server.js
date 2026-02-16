import { redirect, error } from '@sveltejs/kit';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getCsrfToken } from '$lib/crm/server/auth.js';
import { hasRouteAccess } from '$lib/crm/permissions.js';
import { getCachedOrganisations } from '$lib/crm/server/organisationsCache.js';
import { readCollection, findById } from '$lib/crm/server/fileStore.js';

export async function load({ params, locals, parent, cookies }) {
	const admin = locals?.admin;
	if (!admin) {
		throw redirect(302, '/hub/auth/login');
	}
	const organisationId = await getCurrentOrganisationId();
	const { superAdminEmail, organisationAreaPermissions } = await parent();
	const canAccessContacts = hasRouteAccess(admin, '/hub/contacts', superAdminEmail, organisationAreaPermissions);
	if (!canAccessContacts) {
		throw redirect(302, '/hub?error=access_denied');
	}

	const contactId = params.contactId;
	const contacts = filterByOrganisation(await readCollection('contacts'), organisationId);
	const contact = contacts.find((c) => c.id === contactId);
	if (!contact) {
		throw error(404, 'Contact not found');
	}
	if (!contact.email) {
		throw error(400, 'This contact has no email address');
	}

	const organisations = await getCachedOrganisations();
	const org = organisationId ? organisations?.find((o) => o.id === organisationId) : null;
	const events = filterByOrganisation(await readCollection('events'), organisationId);
	const rotas = filterByOrganisation(await readCollection('rotas'), organisationId);

	// Enrich rotas with event title for display
	const rotasWithEvent = rotas.map((r) => {
		const event = events.find((e) => e.id === r.eventId);
		return { ...r, eventTitle: event?.title || 'Unknown event' };
	});

	return {
		contact,
		organisationName: org?.name || 'Organisation',
		events,
		rotas: rotasWithEvent,
		csrfToken: getCsrfToken(cookies) || ''
	};
}
