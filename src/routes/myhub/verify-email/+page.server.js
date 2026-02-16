import { redirect } from '@sveltejs/kit';
import { readCollection, update } from '$lib/crm/server/fileStore.js';

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Verify email change token from the link sent to the member's new address.
 * If valid: update contact email, clear pending fields, redirect to profile with success.
 */
export async function load({ url }) {
	const token = url.searchParams.get('token')?.trim();
	if (!token) {
		throw redirect(302, '/myhub/profile?email_verify=missing');
	}

	try {
		const contactsRaw = await readCollection('contacts');
		const contact = contactsRaw.find(
			(c) =>
				c.pendingEmailVerificationToken === token &&
				c.pendingNewEmail &&
				c.pendingEmailVerificationExpires
		);
		if (!contact) {
			throw redirect(302, '/myhub/profile?email_verify=invalid');
		}
		const expiresAt = new Date(contact.pendingEmailVerificationExpires).getTime();
		if (Date.now() > expiresAt) {
			// Clear expired pending so they can request again
			const { pendingNewEmail, pendingEmailVerificationToken, pendingEmailVerificationExpires, ...rest } = contact;
			await update('contacts', contact.id, { ...rest, updatedAt: new Date().toISOString() });
			throw redirect(302, '/myhub/profile?email_verify=expired');
		}

		const newEmail = (contact.pendingNewEmail || '').trim().toLowerCase();
		if (!newEmail) {
			throw redirect(302, '/myhub/profile?email_verify=invalid');
		}

		// Apply the email change and clear pending fields
		const updated = { ...contact };
		updated.email = newEmail;
		updated.updatedAt = new Date().toISOString();
		delete updated.pendingNewEmail;
		delete updated.pendingEmailVerificationToken;
		delete updated.pendingEmailVerificationExpires;
		await update('contacts', contact.id, updated);

		throw redirect(302, '/myhub/profile?email_verified=1');
	} catch (e) {
		if (e?.status === 302) throw e;
		console.error('[myhub/verify-email]', e?.message || e);
		throw redirect(302, '/myhub/profile?email_verify=error');
	}
}
