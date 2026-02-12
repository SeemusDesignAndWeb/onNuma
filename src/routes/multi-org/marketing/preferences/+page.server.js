import { readCollection, update, findMany } from '$lib/crm/server/fileStore.js';
import { fail } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { preferences: [] };

	const preferences = await readCollection('marketing_user_preferences');
	preferences.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

	// Enrich with contact info
	const contacts = await readCollection('contacts');
	const contactMap = contacts.reduce((m, c) => {
		if (c?.id) m[c.id] = { name: `${c.firstName || ''} ${c.lastName || ''}`.trim(), email: c.email };
		return m;
	}, {});

	return {
		preferences: preferences.slice(0, 100).map((p) => ({
			...p,
			contact: contactMap[p.user_id] || { name: '—', email: '—' }
		}))
	};
}
