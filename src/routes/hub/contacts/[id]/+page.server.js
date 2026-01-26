import { redirect } from '@sveltejs/kit';
import { findById, update, remove, readCollection } from '$lib/crm/server/fileStore.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange, getAdminIdFromEvent } from '$lib/crm/server/audit.js';

export async function load({ params, cookies }) {
	const contact = await findById('contacts', params.id);
	if (!contact) {
		throw redirect(302, '/hub/contacts');
	}

	// Load spouse information if spouseId exists
	let spouse = null;
	if (contact.spouseId) {
		spouse = await findById('contacts', contact.spouseId);
	}

	// Load all contacts for spouse selection dropdown (excluding current contact)
	const allContacts = await readCollection('contacts');
	const contacts = allContacts
		.filter(c => c.id !== params.id) // Exclude current contact
		.sort((a, b) => {
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
	return { contact, spouse, contacts, csrfToken };
}

export const actions = {
	update: async ({ request, params, cookies, locals, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			// Get old data for audit log and spouse relationship sync
			const oldContact = await findById('contacts', params.id);
			
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
				notes: data.get('notes'),
				subscribed: data.get('subscribed') === 'on' || data.get('subscribed') === 'true',
				spouseId: data.get('spouseId') || null
			};

			const validated = validateContact(contactData);
			await update('contacts', params.id, validated);

			// Sync bidirectional spouse relationship
			const oldSpouseId = oldContact?.spouseId || null;
			const newSpouseId = validated.spouseId;

			// If spouseId changed, update both old and new spouses
			if (oldSpouseId !== newSpouseId) {
				// Remove spouseId from old spouse if it exists
				if (oldSpouseId) {
					const oldSpouse = await findById('contacts', oldSpouseId);
					if (oldSpouse && oldSpouse.spouseId === params.id) {
						await update('contacts', oldSpouseId, { spouseId: null });
					}
				}
				// Set spouseId on new spouse if it exists
				if (newSpouseId) {
					await update('contacts', newSpouseId, { spouseId: params.id });
				}
			}

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'update', 'contact', params.id, {
				email: validated.email,
				name: `${validated.firstName || ''} ${validated.lastName || ''}`.trim()
			}, event);

			return { success: true };
		} catch (error) {
			return { error: error.message };
		}
	},

	delete: async ({ params, cookies, request, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		// Get contact data before deletion for audit log
		const contact = await findById('contacts', params.id);
		
		await remove('contacts', params.id);

		// Log audit event
		const adminId = locals?.admin?.id || null;
		const event = { getClientAddress: () => 'unknown', request };
		await logDataChange(adminId, 'delete', 'contact', params.id, {
			email: contact?.email,
			name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : 'unknown'
		}, event);

		throw redirect(302, '/hub/contacts');
	}
};

