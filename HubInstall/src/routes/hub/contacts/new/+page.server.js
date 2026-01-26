import { fail, redirect } from '@sveltejs/kit';
import { create, update, readCollection } from '$lib/crm/server/fileStore.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';

export async function load({ cookies }) {
	// Load all contacts for spouse selection dropdown
	const contacts = await readCollection('contacts');
	// Sort contacts alphabetically by last name, then first name
	const sortedContacts = contacts.sort((a, b) => {
		const aLastName = (a.lastName || '').toLowerCase();
		const bLastName = (b.lastName || '').toLowerCase();
		const aFirstName = (a.firstName || '').toLowerCase();
		const bFirstName = (b.firstName || '').toLowerCase();
		
		if (aLastName !== bLastName) {
			return aLastName.localeCompare(bLastName);
		}
		return aFirstName.localeCompare(bFirstName);
	});

	const csrfToken = getCsrfToken(cookies) || '';
	return { contacts: sortedContacts, csrfToken };
}

export const actions = {
	create: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const servingAreas = data.get('servingAreas');
			const giftings = data.get('giftings');
			
			const contactData = {
				email: data.get('email'),
				firstName: data.get('firstName'),
				lastName: data.get('lastName'),
				phone: data.get('phone'),
				addressLine1: data.get('addressLine1'),
				addressLine2: data.get('addressLine2'),
				city: data.get('city'),
				county: data.get('county'),
				postcode: data.get('postcode'),
				country: data.get('country'),
				membershipStatus: data.get('membershipStatus'),
				dateJoined: data.get('dateJoined') || null,
				baptismDate: data.get('baptismDate') || null,
				servingAreas: servingAreas ? JSON.parse(servingAreas) : [],
				giftings: giftings ? JSON.parse(giftings) : [],
				notes: data.get('notes'),
				subscribed: data.get('subscribed') === 'on' || data.get('subscribed') === 'true',
				spouseId: data.get('spouseId') || null
			};

			const validated = validateContact(contactData);
			const contact = await create('contacts', validated);

			// Sync bidirectional spouse relationship
			if (validated.spouseId) {
				await update('contacts', validated.spouseId, { spouseId: contact.id });
			}

			throw redirect(302, `/hub/contacts/${contact.id}`);
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			return fail(400, { error: error.message });
		}
	}
};

