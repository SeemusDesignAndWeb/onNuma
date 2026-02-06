import { redirect } from '@sveltejs/kit';
import { findById, readCollection } from '$lib/crm/server/fileStore.js';
import { getCsrfToken } from '$lib/crm/server/auth.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';

export async function load({ params, cookies }) {
	const organisationId = await getCurrentOrganisationId();
	const newsletter = await findById('emails', params.id);
	if (!newsletter) {
		throw redirect(302, '/hub/emails');
	}
	if (newsletter.organisationId != null && newsletter.organisationId !== organisationId) {
		throw redirect(302, '/hub/emails');
	}

	const lists = filterByOrganisation(await readCollection('lists'), organisationId);
	const allContacts = filterByOrganisation(await readCollection('contacts'), organisationId);
	const contacts = allContacts
		.filter(c => c.subscribed !== false && c.email)
		.map(c => ({ id: c.id, email: c.email, name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email }));

	// Enrich lists with actual contact counts (only count contacts that exist and are subscribed)
	const listsWithCounts = lists.map(list => {
		const validContacts = allContacts.filter(c =>
			list.contactIds?.includes(c.id) &&
			c.subscribed !== false
		);
		return {
			...list,
			contactCount: validContacts.length
		};
	});

	const csrfToken = getCsrfToken(cookies) || '';

	return { newsletter, lists: listsWithCounts, contacts, csrfToken };
}

