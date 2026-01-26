import { json } from '@sveltejs/kit';
import { findMany, findById } from '$lib/crm/server/fileStore.js';

/**
 * Check if a contact exists by email and name, and return spouse information if available
 * GET /api/check-contact-spouse?email=user@example.com&name=John Doe
 */
export async function GET({ url }) {
	const email = url.searchParams.get('email');
	const name = url.searchParams.get('name');
	
	if (!email) {
		return json({ error: 'Email parameter is required' }, { status: 400 });
	}

	try {
		const normalizedEmail = email.trim().toLowerCase();
		const contacts = await findMany('contacts', c => 
			c.email && c.email.toLowerCase() === normalizedEmail
		);

		if (contacts.length === 0) {
			return json({ 
				contact: null, 
				spouse: null,
				matched: false
			});
		}

		const contact = contacts[0];
		
		// If name is provided, validate it matches the contact
		if (name) {
			const nameParts = name.trim().split(/\s+/);
			const firstName = nameParts[0] || '';
			const lastName = nameParts.slice(1).join(' ') || '';
			
			const contactFirstName = (contact.firstName || '').trim().toLowerCase();
			const contactLastName = (contact.lastName || '').trim().toLowerCase();
			const inputFirstName = firstName.trim().toLowerCase();
			const inputLastName = lastName.trim().toLowerCase();
			
			// Check if names match (allow partial matches - at least first name should match)
			const firstNameMatches = !inputFirstName || contactFirstName.includes(inputFirstName) || inputFirstName.includes(contactFirstName);
			const lastNameMatches = !inputLastName || !contactLastName || contactLastName.includes(inputLastName) || inputLastName.includes(contactLastName) || inputLastName === '';
			
			// If we have a last name in the contact, require it to match
			if (contactLastName && inputLastName && !lastNameMatches) {
				return json({ 
					contact: null, 
					spouse: null,
					matched: false
				});
			}
			
			// Require first name to match if provided
			if (inputFirstName && !firstNameMatches) {
				return json({ 
					contact: null, 
					spouse: null,
					matched: false
				});
			}
		}

		let spouse = null;

		if (contact.spouseId) {
			spouse = await findById('contacts', contact.spouseId);
		}

		return json({
			contact: {
				id: contact.id,
				firstName: contact.firstName,
				lastName: contact.lastName,
				email: contact.email,
				confirmed: contact.confirmed !== false // Default to true if not set
			},
			spouse: spouse ? {
				id: spouse.id,
				firstName: spouse.firstName,
				lastName: spouse.lastName,
				email: spouse.email
			} : null,
			matched: true
		});
	} catch (error) {
		console.error('[Check Contact Spouse] Error:', error);
		return json({ error: 'Failed to check contact' }, { status: 500 });
	}
}
