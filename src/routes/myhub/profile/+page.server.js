import { fail } from '@sveltejs/kit';
import { readCollection, findById, update } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { verifyCsrfToken, getCsrfToken, generateVerificationToken } from '$lib/crm/server/auth.js';
import { validateString, isValidEmail } from '$lib/crm/server/validators.js';
import { sendMemberEmailChangeVerification } from '$lib/crm/server/email.js';
import { env } from '$env/dynamic/private';

export async function load({ cookies, url }) {
	const contactId = getMemberContactIdFromCookie(cookies);
	if (!contactId) return { contact: null, emailVerifyStatus: null };
	try {
		const contact = await findById('contacts', contactId);
		if (!contact) return { contact: null, emailVerifyStatus: null };
		const emailVerifyStatus = url.searchParams.get('email_verified') || url.searchParams.get('email_verify');
		return {
			contact: {
				id: contact.id,
				email: contact.email || '',
				firstName: contact.firstName || '',
				lastName: contact.lastName || '',
				phone: contact.phone || '',
				addressLine1: contact.addressLine1 || '',
				addressLine2: contact.addressLine2 || '',
				city: contact.city || '',
				county: contact.county || '',
				postcode: contact.postcode || '',
				country: contact.country || 'United Kingdom'
			},
			emailVerifyStatus: emailVerifyStatus || null
		};
	} catch (err) {
		console.error('[myhub/profile] load failed:', err?.message || err);
		return { contact: null, emailVerifyStatus: null };
	}
}

export const actions = {
	update: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.' });
		}
		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in to update your details.' });
		}
		try {
			const existing = await findById('contacts', contactId);
			if (!existing) {
				return fail(404, { error: 'Contact not found. Please sign in again.' });
			}

			const firstName = validateString(data.get('firstName') || '', 'First name', 100);
			const lastName = validateString(data.get('lastName') || '', 'Last name', 100);
			const phone = validateString(data.get('phone') || '', 'Phone', 50);
			const addressLine1 = validateString(data.get('addressLine1') || '', 'Address line 1', 200);
			const addressLine2 = validateString(data.get('addressLine2') || '', 'Address line 2', 200);
			const city = validateString(data.get('city') || '', 'City', 100);
			const county = validateString(data.get('county') || '', 'County', 100);
			const postcode = validateString(data.get('postcode') || '', 'Postcode', 20);
			const country = validateString(data.get('country') || '', 'Country', 100);

			if (!firstName.trim()) {
				return fail(400, { error: 'First name is required.' });
			}

			const newEmailRaw = (data.get('newEmail') || '').toString().trim().toLowerCase();
			let emailVerificationSent = false;
			if (newEmailRaw) {
				if (!isValidEmail(newEmailRaw)) {
					return fail(400, { error: 'Please enter a valid email address.' });
				}
				const currentEmail = (existing.email || '').toLowerCase();
				if (newEmailRaw === currentEmail) {
					return fail(400, { error: 'New email is the same as your current email.' });
				}
				const organisationId = await getCurrentOrganisationId();
				const allContacts = await readCollection('contacts');
				const contacts = organisationId ? filterByOrganisation(allContacts, organisationId) : allContacts;
				const alreadyUsed = contacts.some(
					(c) => c.id !== contactId && (c.email || '').toLowerCase() === newEmailRaw
				);
				if (alreadyUsed) {
					return fail(400, { error: 'That email address is already in use. Please use a different one or contact your organiser.' });
				}
				const token = generateVerificationToken();
				const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
				const withPending = {
					...existing,
					firstName,
					lastName,
					phone,
					addressLine1,
					addressLine2,
					city,
					county,
					postcode,
					country: country || 'United Kingdom',
					updatedAt: new Date().toISOString(),
					pendingNewEmail: newEmailRaw,
					pendingEmailVerificationToken: token,
					pendingEmailVerificationExpires: expiresAt
				};
				await update('contacts', contactId, withPending);
				const baseUrl = env.APP_BASE_URL || url.origin || 'https://onnuma.com';
				const verificationLink = `${baseUrl}/myhub/verify-email?token=${encodeURIComponent(token)}`;
				const name = [existing.firstName, existing.lastName].filter(Boolean).join(' ').trim() || existing.email;
				await sendMemberEmailChangeVerification(
					{
						to: newEmailRaw,
						name,
						verificationLink,
						currentEmail: existing.email || ''
					},
					{ url: { origin: baseUrl } }
				);
				emailVerificationSent = true;
			}

			const updated = {
				...existing,
				firstName,
				lastName,
				phone,
				addressLine1,
				addressLine2,
				city,
				county,
				postcode,
				country: country || 'United Kingdom',
				updatedAt: new Date().toISOString()
			};
			if (!emailVerificationSent) {
				await update('contacts', contactId, updated);
			}

			return {
				success: true,
				emailVerificationSent,
				contact: {
					id: updated.id,
					email: updated.email || existing.email || '',
					firstName: updated.firstName || '',
					lastName: updated.lastName || '',
					phone: updated.phone || '',
					addressLine1: updated.addressLine1 || '',
					addressLine2: updated.addressLine2 || '',
					city: updated.city || '',
					county: updated.county || '',
					postcode: updated.postcode || '',
					country: updated.country || 'United Kingdom'
				}
			};
		} catch (err) {
			console.error('[myhub/profile] update failed:', err?.message || err);
			return fail(500, { error: err?.message || 'Something went wrong. Please try again.' });
		}
	}
};
