import { redirect, fail } from '@sveltejs/kit';
import { create } from '$lib/crm/server/fileStore.js';
import { randomUUID } from 'crypto';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) throw redirect(302, '/multi-org/auth/login');
	return {};
}

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();

		const title = form.get('title')?.toString()?.trim();
		const key = form.get('key')?.toString()?.trim()?.replace(/[^a-zA-Z0-9_-]/g, '_');
		if (!title || !key) return fail(400, { error: 'Title and key are required' });

		const tagsRaw = form.get('tags')?.toString()?.trim() || '';
		const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

		const now = new Date().toISOString();
		const block = {
			id: randomUUID(),
			title,
			key,
			body_html: form.get('body_html')?.toString() || '',
			body_text: form.get('body_text')?.toString() || '',
			tags,
			status: 'active',
			created_at: now,
			updated_at: now,
			created_by: locals.multiOrgAdmin.id
		};

		await create('marketing_content_blocks', block);
		throw redirect(302, `/multi-org/marketing/blocks/${block.id}`);
	}
};
