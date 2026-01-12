import { redirect } from '@sveltejs/kit';
import { findById, update, remove } from '$lib/crm/server/fileStore.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange, getAdminIdFromEvent } from '$lib/crm/server/audit.js';

export async function load({ params, cookies }) {
	const contact = await findById('contacts', params.id);
	if (!contact) {
		throw redirect(302, '/hub/contacts');
	}

	const csrfToken = getCsrfToken(cookies) || '';
	return { contact, csrfToken };
}

export const actions = {
	update: async ({ request, params, cookies, locals, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			// Get old data for audit log
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
				subscribed: data.get('subscribed') === 'on' || data.get('subscribed') === 'true'
			};

			const validated = validateContact(contactData);
			await update('contacts', params.id, validated);

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

