import { readCollection } from '$lib/crm/server/fileStore.js';
import { duplicateEmailTemplate } from '$lib/crm/server/marketing.js';
import { update } from '$lib/crm/server/fileStore.js';
import { fail, redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { templates: [] };

	const templates = await readCollection('marketing_email_templates');
	templates.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

	return { templates };
}

export const actions = {
	duplicate: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'Template ID required' });

		try {
			const copy = await duplicateEmailTemplate(id, locals.multiOrgAdmin.id);
			throw redirect(302, `/multi-org/marketing/templates/${copy.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(500, { error: e.message });
		}
	},

	archive: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'Template ID required' });

		await update('marketing_email_templates', id, {
			status: 'archived',
			updated_at: new Date().toISOString()
		});
		return { success: true };
	},

	unarchive: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'Template ID required' });

		await update('marketing_email_templates', id, {
			status: 'draft',
			updated_at: new Date().toISOString()
		});
		return { success: true };
	}
};
