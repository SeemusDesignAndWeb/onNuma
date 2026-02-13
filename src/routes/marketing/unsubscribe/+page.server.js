import { findById, findMany, create, update } from '$lib/crm/server/fileStore.js';
import { getUnsubscribeTokenByToken } from '$lib/crm/server/tokens.js';
import { randomUUID } from 'crypto';

async function resolveContact({ tokenValue, userId }) {
	if (tokenValue) {
		const token = await getUnsubscribeTokenByToken(tokenValue);
		if (!token) return null;
		if (token.contactId) {
			return findById('contacts', token.contactId);
		}
		if (token.email) {
			const matches = await findMany(
				'contacts',
				(c) => String(c.email || '').toLowerCase().trim() === String(token.email || '').toLowerCase().trim()
			);
			return matches[0] || null;
		}
		return null;
	}

	if (userId && userId !== 'test') {
		return findById('contacts', userId);
	}

	return null;
}

export async function load({ url }) {
	const tokenValue = url.searchParams.get('token')?.trim() || '';
	const userId = url.searchParams.get('uid')?.trim() || '';
	const contact = await resolveContact({ tokenValue, userId });

	if (!contact) {
		return { contact: null, error: 'Invalid or expired unsubscribe link.' };
	}

	return {
		contact: {
			id: contact.id,
			firstName: contact.firstName || '',
			lastName: contact.lastName || '',
			email: contact.email || '',
			subscribed: contact.subscribed !== false
		},
		token: tokenValue
	};
}

export const actions = {
	unsubscribe: async ({ request }) => {
		const form = await request.formData();
		const tokenValue = form.get('token')?.toString()?.trim() || '';
		const userId = form.get('user_id')?.toString()?.trim() || '';

		const contact = await resolveContact({ tokenValue, userId });
		if (!contact) {
			return { success: false, error: 'Invalid unsubscribe request.' };
		}

		const now = new Date().toISOString();
		await update('contacts', contact.id, {
			...contact,
			subscribed: false
		});

		const existing = await findMany('marketing_user_preferences', (p) => p.user_id === contact.id);
		if (existing.length > 0) {
			await update('marketing_user_preferences', existing[0].id, {
				...existing[0],
				opted_out_non_essential: true,
				updated_at: now
			});
		} else {
			await create('marketing_user_preferences', {
				id: randomUUID(),
				user_id: contact.id,
				opted_out_non_essential: true,
				created_at: now,
				updated_at: now
			});
		}

		return { success: true, message: 'You have been unsubscribed from marketing emails.' };
	}
};
