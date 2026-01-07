import { json, error } from '@sveltejs/kit';
import { findById, readCollection, update } from '$lib/crm/server/fileStore.js';
import { sendNewsletterEmail } from '$lib/crm/server/email.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';

export async function POST({ request, cookies, params, url }) {
	const data = await request.json();
	const csrfToken = data._csrf;

	if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
		throw error(403, 'CSRF token validation failed');
	}

	const newsletter = await findById('newsletters', params.id);
	if (!newsletter) {
		throw error(404, 'Newsletter not found');
	}

	const listId = data.listId;
	if (!listId) {
		throw error(400, 'List ID is required');
	}

	const list = await findById('lists', listId);
	if (!list) {
		throw error(404, 'List not found');
	}

	const contacts = await readCollection('contacts');
	// Filter to only subscribed contacts (subscribed !== false)
	const listContacts = contacts.filter(c => 
		list.contactIds?.includes(c.id) && 
		c.subscribed !== false
	);

	const results = [];
	for (const contact of listContacts) {
		try {
			await sendNewsletterEmail(
				{
					newsletterId: newsletter.id,
					to: contact.email,
					name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
					contact: contact
				},
				{ url }
			);
			results.push({ email: contact.email, status: 'sent' });
		} catch (err) {
			results.push({ email: contact.email, status: 'error', error: err.message });
		}
	}

	// Update newsletter status
	await update('newsletters', newsletter.id, {
		status: 'sent',
		sentAt: new Date().toISOString()
	});

	return json({ success: true, results });
}

