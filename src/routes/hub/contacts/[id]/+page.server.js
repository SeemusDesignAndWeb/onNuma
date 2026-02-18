import { redirect, fail } from '@sveltejs/kit';
import { findById, update, remove, readCollection, create } from '$lib/crm/server/fileStore.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange, getAdminIdFromEvent } from '$lib/crm/server/audit.js';
import { getSettings } from '$lib/crm/server/settings.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';
import { generateId } from '$lib/crm/server/ids.js';

export async function load({ params, cookies, parent }) {
	const organisationId = await getCurrentOrganisationId();
	const contact = await findById('contacts', params.id);
	if (!contact) {
		throw redirect(302, '/hub/contacts');
	}
	// Ensure contact belongs to current organisation (or legacy null)
	if (contact.organisationId != null && contact.organisationId !== organisationId) {
		throw redirect(302, '/hub/contacts');
	}

	// Load spouse information if spouseId exists
	let spouse = null;
	if (contact.spouseId) {
		spouse = await findById('contacts', contact.spouseId);
	}

	// Load contacts for spouse dropdown (plan-limited, excluding current contact)
	const { plan } = await parent();
	const allContacts = await readCollection('contacts');
	const orgContacts = filterByOrganisation(allContacts, organisationId);
	const capped = contactsWithinPlanLimit(orgContacts, plan);
	const contacts = capped.filter(c => c.id !== params.id);

	const csrfToken = getCsrfToken(cookies) || '';
	const settings = await getSettings();

	// Load thank-you messages sent to this volunteer
	const allThankyou = await readCollection('volunteer_thankyou').catch(() => []);
	const thankyouMessages = allThankyou
		.filter((t) => t.contactId === params.id && (!organisationId || !t.organisationId || t.organisationId === organisationId))
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	return { contact, spouse, contacts, csrfToken, theme: settings?.theme || null, thankyouMessages };
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
	},

	sendThankyou: async ({ request, params, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.', action: 'sendThankyou' });
		}

		const message = (data.get('message') || '').toString().trim();
		if (!message) return fail(400, { error: 'Please write a message before sending.', action: 'sendThankyou' });
		if (message.length > 1000) return fail(400, { error: 'Message is too long (max 1000 characters).', action: 'sendThankyou' });

		const organisationId = await getCurrentOrganisationId();
		const contact = await findById('contacts', params.id);
		if (!contact) return fail(404, { error: 'Contact not found.', action: 'sendThankyou' });

		const admin = locals?.admin;
		const fromName = admin
			? ([admin.firstName, admin.lastName].filter(Boolean).join(' ').trim() || admin.email || 'Your coordinator')
			: 'Your coordinator';

		await create('volunteer_thankyou', {
			id: generateId(),
			contactId: params.id,
			organisationId: organisationId || '',
			fromName,
			fromAdminId: admin?.id || null,
			message,
			createdAt: new Date().toISOString()
		});

		// Send email notification to the volunteer (non-fatal)
		if (contact.email) {
			try {
				const { sendThankyouEmail } = await import('$lib/crm/server/email.js');
				const settings = await getSettings();
				const orgName = settings?.organisationName || settings?.name || '';
				await sendThankyouEmail(
					{ to: contact.email, firstName: contact.firstName || contact.email, fromName, message, orgName },
					{ url: { origin: process.env.APP_BASE_URL || 'https://onnuma.com' } }
				);
			} catch (err) {
				console.error('[sendThankyou] Email failed (non-fatal):', err?.message);
			}
		}

		return { success: true, action: 'sendThankyou' };
	}
};

