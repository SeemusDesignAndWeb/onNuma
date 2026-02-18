import { readCollection, writeCollection, readCollectionCount } from '$lib/crm/server/fileStore.js';
import { verifyCsrfToken, getCsrfToken } from '$lib/crm/server/auth.js';
import { isSuperAdmin, getConfiguredPlanFromAreaPermissions, getConfiguredPlanMaxContacts } from '$lib/crm/server/permissions.js';
import { fail } from '@sveltejs/kit';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';

const ITEMS_PER_PAGE = 10;
const AVAILABILITY_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const AVAILABILITY_TIMES = ['morning', 'afternoon', 'evening'];

export async function load({ url, cookies, locals, parent }) {
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';
	const availabilityDay = url.searchParams.get('availabilityDay') || '';
	const availabilityTime = url.searchParams.get('availabilityTime') || '';
	const availabilityMode = url.searchParams.get('availabilityMode') || 'available'; // 'available' | 'unavailable'
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();
	const planLimit = await getConfiguredPlanMaxContacts(plan);
	const offset = (page - 1) * ITEMS_PER_PAGE;

	// Load contacts: DB store filters by org; file store returns all, we filter below
	const allContacts = await readCollection('contacts', {
		organisationId,
		search: search || undefined,
		limit: ITEMS_PER_PAGE,
		offset
	});

	// For file store compatibility: filter by org (DB store already did this)
	const orgContacts = filterByOrganisation(allContacts, organisationId);

	// Get total count for pagination (efficient for DB store)
	const totalInOrg = await readCollectionCount('contacts', { organisationId });

	// Apply plan limits
	let contacts = contactsWithinPlanLimit(orgContacts, plan);

	// When availability filter is active we need full org list to filter (file store may have returned limited set)
	const hasAvailabilityFilter = availabilityDay && availabilityTime &&
		AVAILABILITY_DAYS.includes(availabilityDay) && AVAILABILITY_TIMES.includes(availabilityTime);
	let availabilityFiltered = contacts;
	if (hasAvailabilityFilter) {
		// If we got a limited set (DB with limit), we cannot correctly filter by availability without loading all.
		// For consistency, re-read without limit when availability filter is on (only for this code path).
		const fullOrg = await readCollection('contacts', { organisationId });
		const fullPlanLimited = contactsWithinPlanLimit(filterByOrganisation(fullOrg, organisationId), plan);
		const mode = availabilityMode === 'unavailable' ? 'unavailable' : 'available';
		availabilityFiltered = fullPlanLimited.filter((c) => {
			const isUnav = !!(c.unavailability?.[availabilityDay]?.[availabilityTime]);
			return mode === 'unavailable' ? isUnav : !isUnav;
		});
	}

	// Apply search filter
	let filtered = availabilityFiltered;
	if (search) {
		const searchLower = search.toLowerCase();
		filtered = availabilityFiltered.filter(c =>
			c.firstName?.toLowerCase().includes(searchLower) ||
			c.lastName?.toLowerCase().includes(searchLower) ||
			c.email?.toLowerCase().includes(searchLower)
		);
	}

	// Total for pagination (filtered list is already plan-limited)
	const totalForPagination = filtered.length;

	// Paginate
	let paginated = filtered;
	if (filtered.length > ITEMS_PER_PAGE) {
		const start = (page - 1) * ITEMS_PER_PAGE;
		const end = start + ITEMS_PER_PAGE;
		paginated = filtered.slice(start, end);
	}

	const csrfToken = getCsrfToken(cookies) || '';
	const admin = locals.admin || null;
	const isSuperAdminUser = isSuperAdmin(admin);

	return {
		contacts: paginated,
		currentPage: page,
		totalPages: Math.ceil(totalForPagination / ITEMS_PER_PAGE),
		total: totalForPagination,
		search,
		availabilityDay: hasAvailabilityFilter ? availabilityDay : '',
		availabilityTime: hasAvailabilityFilter ? availabilityTime : '',
		availabilityMode: hasAvailabilityFilter ? availabilityMode : 'available',
		csrfToken,
		isSuperAdmin: isSuperAdminUser,
		planLimit,
		totalInOrg
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

			// Read all contacts for current organisation (plan-limited: only first N are updatable)
			const organisationId = await getCurrentOrganisationId();
			const allContacts = await readCollection('contacts', { organisationId });
			const orgContacts = filterByOrganisation(allContacts, organisationId);
			const orgs = await readCollection('organisations');
			const plan = (await getConfiguredPlanFromAreaPermissions((Array.isArray(orgs) ? orgs : []).find(o => o?.id === organisationId)?.areaPermissions)) || 'free';
			const planLimit = await getConfiguredPlanMaxContacts(plan);
			const contacts = contactsWithinPlanLimit(orgContacts, planLimit);

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

			// Update contacts (work on full collection for write, but only update org-scoped contacts)
			const contactIdsToUpdate = new Set(contactsToUpdate.map(c => c.id));
			const allContactsForWrite = await readCollection('contacts');
			const updatedContacts = allContactsForWrite.map(contact => {
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

			// Write all contacts back (only contacts we're allowed to update are in contactIdsToUpdate and in current org)
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

