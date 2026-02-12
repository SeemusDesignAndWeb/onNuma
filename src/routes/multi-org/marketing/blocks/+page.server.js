import { readCollection, update, create, remove } from '$lib/crm/server/fileStore.js';
import { fail, redirect } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { blocks: [] };
	const blocks = await readCollection('marketing_content_blocks');
	blocks.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
	return { blocks };
}

export const actions = {
	archive: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'ID required' });
		await update('marketing_content_blocks', id, { status: 'archived', updated_at: new Date().toISOString() });
		return { success: true };
	},

	unarchive: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'ID required' });
		await update('marketing_content_blocks', id, { status: 'active', updated_at: new Date().toISOString() });
		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'ID required' });
		await remove('marketing_content_blocks', id);
		return { success: true };
	}
};
