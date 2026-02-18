import { fail } from '@sveltejs/kit';
import { findById, update } from '$lib/crm/server/fileStore.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { getSettings } from '$lib/crm/server/settings.js';

export async function load({ cookies }) {
	const contactId = getMemberContactIdFromCookie(cookies);
	if (!contactId) return { preferences: null, orgName: '' };
	try {
		const [contact, settings] = await Promise.all([
			findById('contacts', contactId),
			getSettings().catch(() => null)
		]);
		if (!contact) return { preferences: null, orgName: '' };

		const orgName = settings?.organisationName || settings?.name || '';

		return {
			preferences: {
				subscribed: contact.subscribed !== false,
				email: contact.email || '',
				phone: contact.phone || '',
				unavailability: contact.unavailability || {},
				reminderEmail: contact.reminderEmail !== false,
				reminderTiming: contact.reminderTiming || '1week',
				aboutMe: contact.aboutMe || ''
			},
			orgName
		};
	} catch (err) {
		console.error('[myhub/preferences] load failed:', err?.message || err);
		return { preferences: null, orgName: '' };
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

			// Newsletter subscription
			const subscribed = data.get('subscribed') === 'on';

			// Unavailability is managed on the Availability page; keep existing
			const unavailability = contact.unavailability || {};

			// Reminder preferences
			const reminderEmail = data.get('reminderEmail') === 'on';
			const reminderTiming = data.get('reminderTiming') || '1week';

			// About me
			const aboutMe = (data.get('aboutMe') || '').toString().trim().slice(0, 1000);

			const updated = {
				...contact,
				subscribed,
				unavailability,
				reminderEmail,
				reminderTiming,
				aboutMe,
				updatedAt: new Date().toISOString()
			};

			await update('contacts', contactId, updated);

			const settings = await getSettings().catch(() => null);
			const orgName = settings?.organisationName || settings?.name || '';
			const who = orgName || 'your coordinator';

			return {
				success: true,
				message: `Your preferences have been saved — ${who} can see these.`,
				preferences: {
					subscribed: updated.subscribed,
					email: updated.email || '',
					phone: updated.phone || '',
					unavailability: updated.unavailability,
					reminderEmail: updated.reminderEmail,
					reminderTiming: updated.reminderTiming,
					aboutMe: updated.aboutMe
				}
			};
		} catch (err) {
			console.error('[myhub/preferences] update failed:', err?.message || err);
			return fail(500, { error: err?.message || 'Something went wrong. Please try again.' });
		}
	}
};
