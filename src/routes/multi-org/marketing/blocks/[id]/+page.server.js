import { error, fail, redirect } from '@sveltejs/kit';
import { findById, update } from '$lib/crm/server/fileStore.js';

export async function load({ params, locals }) {
	if (!locals.multiOrgAdmin) throw redirect(302, '/multi-org/auth/login');
	const block = await findById('marketing_content_blocks', params.id);
	if (!block) throw error(404, 'Block not found');
	return { block };
}

export const actions = {
	save: async ({ params, request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const title = form.get('title')?.toString()?.trim();
		if (!title) return fail(400, { error: 'Title is required' });

		const tagsRaw = form.get('tags')?.toString()?.trim() || '';
		const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

		await update('marketing_content_blocks', params.id, {
			title,
			key: form.get('key')?.toString()?.trim()?.replace(/[^a-zA-Z0-9_-]/g, '_') || '',
			body_html: form.get('body_html')?.toString() || '',
			body_text: form.get('body_text')?.toString() || '',
			tags,
			updated_at: new Date().toISOString()
		});
		return { success: true };
	},

	setStatus: async ({ params, request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const status = form.get('status')?.toString()?.trim();
		if (!['active', 'draft', 'archived'].includes(status)) return fail(400, { error: 'Invalid status' });
		await update('marketing_content_blocks', params.id, { status, updated_at: new Date().toISOString() });
		return { success: true };
	}
};
