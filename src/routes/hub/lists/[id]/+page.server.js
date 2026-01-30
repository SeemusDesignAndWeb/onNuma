import { redirect } from '@sveltejs/kit';
import { findById, update, remove, readCollection } from '$lib/crm/server/fileStore.js';
import { validateList } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange } from '$lib/crm/server/audit.js';

export async function load({ params, cookies, url }) {
	const list = await findById('lists', params.id);
	if (!list) {
		throw redirect(302, '/hub/lists');
	}

	// Get contact IDs in this list
	const contacts = await readCollection('contacts');
	
	// Sort contacts alphabetically by first name, then last name
	const sortContacts = (contacts) => {
		return contacts.sort((a, b) => {
			const aFirstName = (a.firstName || '').toLowerCase();
			const bFirstName = (b.firstName || '').toLowerCase();
			const aLastName = (a.lastName || '').toLowerCase();
			const bLastName = (b.lastName || '').toLowerCase();
			
			if (aFirstName !== bFirstName) {
				return aFirstName.localeCompare(bFirstName);
			}
			return aLastName.localeCompare(bLastName);
		});
	};
	
	const listContacts = sortContacts(contacts.filter(c => list.contactIds?.includes(c.id)));
	
	// Get all contacts for the add contacts search (excluding those already in list)
	const availableContacts = sortContacts(contacts.filter(c => !list.contactIds?.includes(c.id)));
	
	// Search filter if provided
	const search = url.searchParams.get('search') || '';
	const filteredContacts = search 
		? sortContacts(availableContacts.filter(c => 
			(c.email || '').toLowerCase().includes(search.toLowerCase()) ||
			(c.firstName || '').toLowerCase().includes(search.toLowerCase()) ||
			(c.lastName || '').toLowerCase().includes(search.toLowerCase())
		))
		: availableContacts; // Show all available contacts (already sorted)

	const csrfToken = getCsrfToken(cookies) || '';
	return { list, contacts: listContacts, availableContacts: filteredContacts, csrfToken };
}

export const actions = {
	update: async ({ request, params, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const existingList = await findById('lists', params.id);
			const listData = {
				name: data.get('name'),
				description: data.get('description'),
				contactIds: existingList?.contactIds || []
			};

			const validated = validateList(listData);
			await update('lists', params.id, validated);

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'update', 'list', params.id, {
				name: validated.name
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

		// Get list data before deletion for audit log
		const list = await findById('lists', params.id);
		
		await remove('lists', params.id);

		// Log audit event
		const adminId = locals?.admin?.id || null;
		const event = { getClientAddress: () => 'unknown', request };
		await logDataChange(adminId, 'delete', 'list', params.id, {
			name: list?.name || 'unknown'
		}, event);

		throw redirect(302, '/hub/lists');
	},

	addContacts: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const list = await findById('lists', params.id);
			if (!list) {
				return { error: 'List not found' };
			}

			const contactIdsJson = data.get('contactIds');
			if (!contactIdsJson) {
				return { error: 'No contacts provided' };
			}

			const newContactIds = JSON.parse(contactIdsJson);
			const existingContactIds = Array.isArray(list.contactIds) ? list.contactIds : [];
			
			// Merge and deduplicate
			const updatedContactIds = [...new Set([...existingContactIds, ...newContactIds])];

			await update('lists', params.id, { contactIds: updatedContactIds });

			return { success: true, type: 'addContacts' };
		} catch (error) {
			return { error: error.message };
		}
	},

	removeContact: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const list = await findById('lists', params.id);
			if (!list) {
				return { error: 'List not found' };
			}

			const contactId = data.get('contactId');
			if (!contactId) {
				return { error: 'Contact ID required' };
			}

			const existingContactIds = Array.isArray(list.contactIds) ? list.contactIds : [];
			const updatedContactIds = existingContactIds.filter(id => id !== contactId);

			await update('lists', params.id, { contactIds: updatedContactIds });

			return { success: true, type: 'removeContact' };
		} catch (error) {
			return { error: error.message };
		}
	}
};

