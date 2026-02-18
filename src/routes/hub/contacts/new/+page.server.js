import { fail, redirect } from '@sveltejs/kit';
import { create, update, readCollection, readCollectionCount } from '$lib/crm/server/fileStore.js';
import { getHubBaseUrlFromOrg } from '$lib/crm/server/hubDomain.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId, filterByOrganisation, withOrganisationId, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';
import { getConfiguredPlanFromAreaPermissions, getConfiguredPlanMaxContacts } from '$lib/crm/server/permissions.js';
import { getSettings } from '$lib/crm/server/settings.js';

export async function load({ cookies, parent }) {
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();
	const planLimit = await getConfiguredPlanMaxContacts(plan);
	const allContacts = await readCollection('contacts');
	const orgContacts = filterByOrganisation(allContacts, organisationId);
	const contacts = contactsWithinPlanLimit(orgContacts, planLimit);

	const csrfToken = getCsrfToken(cookies) || '';
	return { contacts, csrfToken };
}

export const actions = {
	create: async ({ request, cookies, locals, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const sendWelcome = data.get('sendWelcome') === 'on';

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
			const organisations = await readCollection('organisations');
			const org = (Array.isArray(organisations) ? organisations : []).find((o) => o?.id === organisationId);
			const plan = org ? (await getConfiguredPlanFromAreaPermissions(org.areaPermissions)) || 'free' : 'free';
			const planLimit = await getConfiguredPlanMaxContacts(plan || 'free');
			const totalInOrg = await readCollectionCount('contacts', { organisationId });
			if (totalInOrg >= planLimit) {
				return fail(400, {
					error: `Contact limit reached (${planLimit}). Upgrade your plan to add more contacts.`
				});
			}
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

			// Send MyHub welcome email if the coordinator opted in and the contact has an email
			if (sendWelcome && contact.email) {
				try {
					const { createMagicLinkToken } = await import('$lib/crm/server/memberAuth.js');
					const { sendVolunteerWelcomeEmail } = await import('$lib/crm/server/email.js');
					const { env } = await import('$env/dynamic/private');

					const token = await createMagicLinkToken(contact.id);
					// Use org's hub domain so "Go to My Hub" link points to the correct subdomain (e.g. acme.onnuma.com)
					const hubBase = getHubBaseUrlFromOrg(org, env.APP_BASE_URL || url.origin);
					const magicLink = `${hubBase}/myhub/auth/${token}`;

					const settings = await getSettings();
					const orgName = settings?.organisationName || settings?.name || '';

					const admin = locals?.admin;
					const coordinatorName = admin
						? ([admin.firstName, admin.lastName].filter(Boolean).join(' ').trim() || admin.email || '')
						: '';

					const volunteerName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();

					await sendVolunteerWelcomeEmail({
						to: contact.email,
						name: volunteerName,
						magicLink,
						orgName,
						coordinatorName
					}, { url });
				} catch (emailErr) {
					// Non-fatal — contact was created successfully; log and continue
					console.error('[contacts/new] Failed to send welcome email:', emailErr?.message || emailErr);
				}
			}

			throw redirect(302, `/hub/contacts/${contact.id}`);
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			return fail(400, { error: error.message });
		}
	}
};

