import { fail } from '@sveltejs/kit';
import { readCollection, findById, update } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { verifyCsrfToken, getCsrfToken } from '$lib/crm/server/auth.js';
import { validateString, isValidEmail } from '$lib/crm/server/validators.js';

export async function load({ cookies }) {
	const contactId = getMemberContactIdFromCookie(cookies);
	if (!contactId) return { contact: null };
	try {
		const contact = await findById('contacts', contactId);
		if (!contact) return { contact: null };
		// Return only the fields the member is allowed to see/edit
		return {
			contact: {
				id: contact.id,
				email: contact.email || '',
				firstName: contact.firstName || '',
				lastName: contact.lastName || '',
				phone: contact.phone || '',
				addressLine1: contact.addressLine1 || '',
				addressLine2: contact.addressLine2 || '',
				city: contact.city || '',
				county: contact.county || '',
				postcode: contact.postcode || '',
				country: contact.country || 'United Kingdom'
			}
		};
	} catch (err) {
		console.error('[my/profile] load failed:', err?.message || err);
		return { contact: null };
	}
}

export const actions = {
	update: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.' });
		}
		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in to update your details.' });
		}
		try {
			const existing = await findById('contacts', contactId);
			if (!existing) {
				return fail(404, { error: 'Contact not found. Please sign in again.' });
			}

			// Members can update: firstName, lastName, phone, address fields
			// Email is read-only (it is their identity)
			const firstName = validateString(data.get('firstName') || '', 'First name', 100);
			const lastName = validateString(data.get('lastName') || '', 'Last name', 100);
			const phone = validateString(data.get('phone') || '', 'Phone', 50);
			const addressLine1 = validateString(data.get('addressLine1') || '', 'Address line 1', 200);
			const addressLine2 = validateString(data.get('addressLine2') || '', 'Address line 2', 200);
			const city = validateString(data.get('city') || '', 'City', 100);
			const county = validateString(data.get('county') || '', 'County', 100);
			const postcode = validateString(data.get('postcode') || '', 'Postcode', 20);
			const country = validateString(data.get('country') || '', 'Country', 100);

			if (!firstName.trim()) {
				return fail(400, { error: 'First name is required.' });
			}

			const updated = {
				...existing,
				firstName,
				lastName,
				phone,
				addressLine1,
				addressLine2,
				city,
				county,
				postcode,
				country: country || 'United Kingdom',
				updatedAt: new Date().toISOString()
			};

			await update('contacts', contactId, updated);

			return {
				success: true,
				contact: {
					id: updated.id,
					email: updated.email || '',
					firstName: updated.firstName || '',
					lastName: updated.lastName || '',
					phone: updated.phone || '',
					addressLine1: updated.addressLine1 || '',
					addressLine2: updated.addressLine2 || '',
					city: updated.city || '',
					county: updated.county || '',
					postcode: updated.postcode || '',
					country: updated.country || 'United Kingdom'
				}
			};
		} catch (err) {
			console.error('[my/profile] update failed:', err?.message || err);
			return fail(500, { error: err?.message || 'Something went wrong. Please try again.' });
		}
	}
};
