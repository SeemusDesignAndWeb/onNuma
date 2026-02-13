import { fail, redirect } from '@sveltejs/kit';
import { createMailshot } from '$lib/crm/server/marketing.js';
import { readCollection } from '$lib/crm/server/fileStore.js';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) throw redirect(302, '/multi-org/auth/login');

	const [blocks, links] = await Promise.all([
		readCollection('marketing_content_blocks'),
		readCollection('marketing_links')
	]);

	return {
		blocks: blocks.filter((b) => b.status === 'active'),
		links: links.filter((l) => l.status === 'active')
	};
}

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();

		const name = form.get('name')?.toString()?.trim();
		if (!name) return fail(400, { error: 'Name is required' });

		const tagsRaw = form.get('tags')?.toString()?.trim() || '';
		const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

		try {
			const mailshot = await createMailshot({
				name,
				internal_notes: form.get('internal_notes')?.toString() || '',
				subject: form.get('subject')?.toString() || '',
				preview_text: form.get('preview_text')?.toString() || '',
				body_html: form.get('body_html')?.toString() || '',
				body_text: form.get('body_text')?.toString() || '',
				tags,
				created_by: locals.multiOrgAdmin.id
			});
			throw redirect(302, `/multi-org/marketing/mailshots/${mailshot.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(500, { error: e.message });
		}
	}
};
