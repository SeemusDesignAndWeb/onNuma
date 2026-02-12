import { findById, findMany, create, update } from '$lib/crm/server/fileStore.js';
import { fail } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export async function load({ url }) {
	const userId = url.searchParams.get('uid') || '';
	const orgId = url.searchParams.get('org') || '';

	if (!userId || userId === 'test') {
		return { contact: null, preferences: null, orgId };
	}

	const contact = await findById('contacts', userId);
	const prefs = await findMany('marketing_user_preferences', (p) => p.user_id === userId);

	return {
		contact: contact ? { id: contact.id, firstName: contact.firstName, email: contact.email } : null,
		preferences: prefs[0] || null,
		orgId
	};
}

export const actions = {
	updatePreferences: async ({ request, url }) => {
		const form = await request.formData();
		const userId = form.get('user_id')?.toString()?.trim();
		if (!userId) return fail(400, { error: 'Missing user ID' });

		const optedOutNonEssential = form.get('opted_out_non_essential') === 'on';
		const now = new Date().toISOString();

		const existing = await findMany('marketing_user_preferences', (p) => p.user_id === userId);
		if (existing.length > 0) {
			await update('marketing_user_preferences', existing[0].id, {
				opted_out_non_essential: optedOutNonEssential,
				updated_at: now
			});
		} else {
			await create('marketing_user_preferences', {
				id: randomUUID(),
				user_id: userId,
				opted_out_non_essential: optedOutNonEssential,
				created_at: now,
				updated_at: now
			});
		}

		return { success: true };
	}
};
