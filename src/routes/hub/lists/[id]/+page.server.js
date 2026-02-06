import { redirect } from '@sveltejs/kit';
import { findById, update, remove, readCollection } from '$lib/crm/server/fileStore.js';
import { validateList } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';

export async function load({ params, cookies, url, parent }) {
	const organisationId = await getCurrentOrganisationId();
	const list = await findById('lists', params.id);
	if (!list) {
		throw redirect(302, '/hub/lists');
	}
	if (list.organisationId != null && list.organisationId !== organisationId) {
		throw redirect(302, '/hub/lists');
	}

	const { plan } = await parent();
	const allContacts = await readCollection('contacts');
	const orgContacts = filterByOrganisation(allContacts, organisationId);
	const contacts = contactsWithinPlanLimit(orgContacts, plan);

	const listContacts = contacts.filter(c => list.contactIds?.includes(c.id));
	const availableContacts = contacts.filter(c => !list.contactIds?.includes(c.id));

	const search = url.searchParams.get('search') || '';
	const filteredContacts = search
		? availableContacts.filter(c =>
			(c.firstName || '').toLowerCase().includes(search.toLowerCase()) ||
			(c.lastName || '').toLowerCase().includes(search.toLowerCase())
		)
		: availableContacts;

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

