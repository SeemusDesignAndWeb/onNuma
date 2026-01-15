import { json, error } from '@sveltejs/kit';
import { findById, readCollection, update } from '$lib/crm/server/fileStore.js';
import { prepareNewsletterEmail, sendNewsletterBatch } from '$lib/crm/server/email.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';

export async function POST({ request, cookies, params, url }) {
	const data = await request.json();
	const csrfToken = data._csrf;

	if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
		throw error(403, 'CSRF token validation failed');
	}

	const email = await findById('emails', params.id);
	if (!email) {
		throw error(404, 'Email not found');
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

	// Prepare all emails first
	const emailDataPromises = listContacts.map(contact => 
		prepareNewsletterEmail(
			{
				newsletterId: email.id,
				to: contact.email,
				name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
				contact: contact
			},
			{ url }
		).catch(err => {
			// If preparation fails, return error result
			return { error: true, contactEmail: contact.email, errorMessage: err.message };
		})
	);

	const emailDataArray = await Promise.all(emailDataPromises);
	
	// Filter out errors and prepare valid emails
	const validEmails = [];
	const prepErrors = [];
	
	emailDataArray.forEach((data, index) => {
		if (data.error) {
			prepErrors.push({ 
				email: data.contactEmail || listContacts[index].email, 
				status: 'error', 
				error: data.errorMessage 
			});
		} else {
			validEmails.push(data);
		}
	});

	// Send emails in batches
	const batchResults = await sendNewsletterBatch(validEmails, email.id);
	
	// Combine preparation errors with batch results
	const results = [...prepErrors, ...batchResults];

	// Update email status
	await update('emails', email.id, {
		status: 'sent',
		sentAt: new Date().toISOString()
	});

	return json({ success: true, results });
}

