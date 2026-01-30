import { readCollection, writeCollection } from '$lib/crm/server/fileStore.js';
import { verifyCsrfToken, getCsrfToken } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { fail } from '@sveltejs/kit';
import { logDataChange } from '$lib/crm/server/audit.js';

const ITEMS_PER_PAGE = 20;

export async function load({ url, cookies, locals }) {
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';

	const contacts = await readCollection('contacts');
	
	// Sort contacts alphabetically by first name, then last name
	const sorted = contacts.sort((a, b) => {
		const aFirstName = (a.firstName || '').toLowerCase();
		const bFirstName = (b.firstName || '').toLowerCase();
		const aLastName = (a.lastName || '').toLowerCase();
		const bLastName = (b.lastName || '').toLowerCase();
		
		// First sort by first name
		if (aFirstName !== bFirstName) {
			return aFirstName.localeCompare(bFirstName);
		}
		// If first names are the same, sort by last name
		return aLastName.localeCompare(bLastName);
	});
	
	let filtered = sorted;
	if (search) {
		const searchLower = search.toLowerCase();
		filtered = sorted.filter(c => 
			c.email?.toLowerCase().includes(searchLower) ||
			c.firstName?.toLowerCase().includes(searchLower) ||
			c.lastName?.toLowerCase().includes(searchLower)
		);
	}

	const total = filtered.length;
	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const paginated = filtered.slice(start, end);

	const csrfToken = getCsrfToken(cookies) || '';
	const admin = locals.admin || null;
	const isSuperAdminUser = isSuperAdmin(admin);

	return {
		contacts: paginated,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		search,
		csrfToken,
		isSuperAdmin: isSuperAdminUser
	};
}

export const actions = {
	bulkUpdateMembershipStatus: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		// Check if user is super admin
		const admin = locals.admin || null;
		if (!isSuperAdmin(admin)) {
			return fail(403, { error: 'Only super admins can perform bulk updates' });
		}

		try {
			const updateField = data.get('updateField'); // 'membershipStatus' or 'dateJoined'
			const updateValue = data.get('updateValue'); // The value to set
			const filterCondition = data.get('filterCondition'); // 'all' or 'empty'

			if (!updateField || !updateValue) {
				return fail(400, { error: 'Update field and value are required' });
			}

			// Read all contacts
			const contacts = await readCollection('contacts');
			
			// Filter contacts based on condition
			let contactsToUpdate;
			if (filterCondition === 'empty') {
				// Only update contacts where the field is empty/null
				contactsToUpdate = contacts.filter(contact => {
					if (updateField === 'membershipStatus') {
						return !contact.membershipStatus || contact.membershipStatus.trim() === '';
					} else if (updateField === 'dateJoined') {
						return !contact.dateJoined || contact.dateJoined.trim() === '';
					}
					return false;
				});
			} else {
				// Update all contacts
				contactsToUpdate = contacts;
			}

			if (contactsToUpdate.length === 0) {
				return {
					success: true,
					message: `No contacts match the filter condition.`,
					updatedCount: 0
				};
			}

			// Validate and format the update value
			let validatedValue = updateValue.trim();
			
			if (updateField === 'membershipStatus') {
				// Validate membership status
				const validStatuses = ['member', 'regular-attender', 'visitor', 'former-member'];
				if (validatedValue && !validStatuses.includes(validatedValue)) {
					return fail(400, { error: `Invalid membership status. Must be one of: ${validStatuses.join(', ')}` });
				}
			} else if (updateField === 'dateJoined') {
				// Validate date format (YYYY-MM-DD)
				const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
				if (validatedValue && !dateRegex.test(validatedValue)) {
					return fail(400, { error: 'Invalid date format. Must be YYYY-MM-DD' });
				}
				// Convert empty string to null
				if (validatedValue === '') {
					validatedValue = null;
				}
			}

			// Update contacts
			const contactIdsToUpdate = new Set(contactsToUpdate.map(c => c.id));
			const updatedContacts = contacts.map(contact => {
				if (contactIdsToUpdate.has(contact.id)) {
					const updates = {
						...contact,
						updatedAt: new Date().toISOString()
					};
					
					if (updateField === 'membershipStatus') {
						updates.membershipStatus = validatedValue || '';
					} else if (updateField === 'dateJoined') {
						updates.dateJoined = validatedValue || null;
					}
					
					return updates;
				}
				return contact;
			});

			// Write all contacts back
			await writeCollection('contacts', updatedContacts);

			// Log audit event for bulk update
			const adminId = admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'bulk_update', 'contact', 'multiple', {
				field: updateField,
				value: validatedValue,
				count: contactsToUpdate.length,
				filterCondition
			}, event);

			const fieldName = updateField === 'membershipStatus' ? 'membership status' : 'date joined';
			const valueDisplay = updateField === 'dateJoined' && validatedValue 
				? new Date(validatedValue).toLocaleDateString('en-GB')
				: validatedValue || '(empty)';

			return {
				success: true,
				message: `Successfully updated ${contactsToUpdate.length} contact(s) ${fieldName} to "${valueDisplay}".`,
				updatedCount: contactsToUpdate.length
			};
		} catch (error) {
			console.error('[Bulk Update] Error:', error);
			return fail(500, { error: error.message || 'Failed to update contacts' });
		}
	}
};

