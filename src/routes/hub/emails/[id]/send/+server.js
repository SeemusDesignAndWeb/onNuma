import { json, error } from '@sveltejs/kit';
import { findById, readCollection, update } from '$lib/crm/server/fileStore.js';
import { prepareNewsletterEmail, sendNewsletterBatch } from '$lib/crm/server/email.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';
import { getPlanFromAreaPermissions } from '$lib/crm/server/permissions.js';

export async function POST({ request, cookies, params, url }) {
	const data = await request.json();
	const csrfToken = data._csrf;

	if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
		throw error(403, 'CSRF token validation failed');
	}

	const organisationId = await getCurrentOrganisationId();
	const email = await findById('emails', params.id);
	if (!email) {
		throw error(404, 'Email not found');
	}
	if (email.organisationId != null && email.organisationId !== organisationId) {
		throw error(404, 'Email not found');
	}

	const orgs = await readCollection('organisations');
	const plan = getPlanFromAreaPermissions((Array.isArray(orgs) ? orgs : []).find(o => o?.id === organisationId)?.areaPermissions) || 'free';
	const orgContacts = filterByOrganisation(await readCollection('contacts'), organisationId);
	const allContacts = contactsWithinPlanLimit(orgContacts, plan);

	const listId = data.listId;
	const contactIds = Array.isArray(data.contactIds) ? data.contactIds : [];

	let listContacts;
	if (contactIds.length > 0) {
		// Manual contact selection
		listContacts = allContacts.filter(c =>
			contactIds.includes(c.id) &&
			c.subscribed !== false &&
			c.email
		);
		if (listContacts.length === 0) {
			return json({ success: false, error: 'No valid contacts selected. Ensure they have an email and are subscribed.' }, { status: 400 });
		}
	} else {
		if (!listId) {
			throw error(400, 'List ID or contact selection is required');
		}
		const list = await findById('lists', listId);
		if (!list) {
			throw error(404, 'List not found');
		}
		if (list.organisationId != null && list.organisationId !== organisationId) {
			throw error(404, 'List not found');
		}
		listContacts = allContacts.filter(c =>
			list.contactIds?.includes(c.id) &&
			c.subscribed !== false
		);
	}

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

