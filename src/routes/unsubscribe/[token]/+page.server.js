import { redirect } from '@sveltejs/kit';
import { findById, update, readCollection } from '$lib/crm/server/fileStore.js';
import { getUnsubscribeTokenByToken } from '$lib/crm/server/tokens.js';

export async function load({ params }) {
	const token = await getUnsubscribeTokenByToken(params.token);
	
	if (!token) {
		return {
			error: 'Invalid unsubscribe link. Please contact us if you need assistance.',
			success: false
		};
	}

	// Find contact by ID or email
	const contacts = await readCollection('contacts');
	const contact = contacts.find(c => 
		(token.contactId && c.id === token.contactId) || 
		(token.email && c.email === token.email)
	);

	if (!contact) {
		return {
			error: 'Contact not found. Please contact us if you need assistance.',
			success: false
		};
	}

	return {
		contact: {
			id: contact.id,
			email: contact.email,
			firstName: contact.firstName,
			lastName: contact.lastName,
			subscribed: contact.subscribed !== false
		},
		success: false // Will be set to true after unsubscribe
	};
}

export const actions = {
	unsubscribe: async ({ params, request }) => {
		const token = await getUnsubscribeTokenByToken(params.token);
		
		if (!token) {
			return {
				error: 'Invalid unsubscribe link.',
				success: false
			};
		}

		// Find contact by ID or email
		const contacts = await readCollection('contacts');
		const contact = contacts.find(c => 
			(token.contactId && c.id === token.contactId) || 
			(token.email && c.email === token.email)
		);

		if (!contact) {
			return {
				error: 'Contact not found.',
				success: false
			};
		}

		// Update contact to unsubscribed
		await update('contacts', contact.id, {
			...contact,
			subscribed: false
		});

		return {
			success: true,
			message: 'You have been successfully unsubscribed from our newsletter.'
		};
	}
};

