import { fail, redirect } from '@sveltejs/kit';
import { create, update, readCollection } from '$lib/crm/server/fileStore.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId, filterByOrganisation, withOrganisationId, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';

export async function load({ cookies, parent }) {
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();
	const allContacts = await readCollection('contacts');
	const orgContacts = filterByOrganisation(allContacts, organisationId);
	const contacts = contactsWithinPlanLimit(orgContacts, plan);

	const csrfToken = getCsrfToken(cookies) || '';
	return { contacts, csrfToken };
}

export const actions = {
	create: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
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
			const organisationId = await getCurrentOrganisationId();
			const contact = await create('contacts', withOrganisationId(validated, organisationId));

			// Sync bidirectional spouse relationship
			if (validated.spouseId) {
				await update('contacts', validated.spouseId, { spouseId: contact.id });
			}

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'create', 'contact', contact.id, {
				email: contact.email,
				name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
			}, event);

			throw redirect(302, `/hub/contacts/${contact.id}`);
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			return fail(400, { error: error.message });
		}
	}
};

