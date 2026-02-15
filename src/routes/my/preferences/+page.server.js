import { fail } from '@sveltejs/kit';
import { findById, update } from '$lib/crm/server/fileStore.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';

export async function load({ cookies }) {
	const contactId = getMemberContactIdFromCookie(cookies);
	if (!contactId) return { preferences: null };
	try {
		const contact = await findById('contacts', contactId);
		if (!contact) return { preferences: null };
		return {
			preferences: {
				subscribed: contact.subscribed !== false,
				email: contact.email || ''
			}
		};
	} catch (err) {
		console.error('[my/preferences] load failed:', err?.message || err);
		return { preferences: null };
	}
}

export const actions = {
	update: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.' });
		}
		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in to change preferences.' });
		}
		try {
			const contact = await findById('contacts', contactId);
			if (!contact) return fail(404, { error: 'Contact not found.' });

			// Newsletter subscription toggle
			const subscribed = data.get('subscribed') === 'on' || data.get('subscribed') === 'true';

			const updated = {
				...contact,
				subscribed,
				updatedAt: new Date().toISOString()
			};

			await update('contacts', contactId, updated);

			return {
				success: true,
				message: subscribed
					? 'You will receive newsletters and updates.'
					: 'You have been unsubscribed from newsletters.',
				preferences: {
					subscribed: updated.subscribed,
					email: updated.email || ''
				}
			};
		} catch (err) {
			console.error('[my/preferences] update failed:', err?.message || err);
			return fail(500, { error: err?.message || 'Something went wrong. Please try again.' });
		}
	}
};
