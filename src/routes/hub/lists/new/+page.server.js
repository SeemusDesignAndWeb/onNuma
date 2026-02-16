import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection } from '$lib/crm/server/fileStore.js';
import { validateList } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId, withOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';

export async function load({ cookies, parent }) {
	const csrfToken = getCsrfToken(cookies) || '';
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();
	const allContacts = await readCollection('contacts');
	const orgContacts = filterByOrganisation(allContacts, organisationId);
	const contacts = contactsWithinPlanLimit(orgContacts, plan);
	return { csrfToken, contacts };
}

export const actions = {
	create: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const contactIdsRaw = data.get('contactIds');
		let contactIds = [];
		if (contactIdsRaw) {
			try {
				contactIds = JSON.parse(contactIdsRaw);
				if (!Array.isArray(contactIds)) contactIds = [];
			} catch (_) {
				contactIds = [];
			}
		}

		const listData = {
			name: data.get('name'),
			description: data.get('description'),
			contactIds
		};

		try {
			const validated = validateList(listData);
			const organisationId = await getCurrentOrganisationId();
			const list = await create('lists', withOrganisationId(validated, organisationId));

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'create', 'list', list.id, {
				name: list.name,
				contactCount: contactIds.length
			}, event);

			throw redirect(302, `/hub/lists/${list.id}?created=true`);
		} catch (error) {
			if (error?.status === 302 || error?.status === 301 || (error?.status >= 300 && error?.status < 400)) {
				throw error;
			}
			if (error?.location) {
				throw error;
			}
			console.error('Error creating list:', error);
			return fail(400, { error: error.message || 'Failed to create list' });
		}
	}
};
