import { fail, redirect } from '@sveltejs/kit';
import { readCollection, update } from '$lib/crm/server/fileStore.js';
import { duplicateMailshot } from '$lib/crm/server/marketing.js';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { mailshots: [] };

	const mailshots = await readCollection('marketing_mailshots');
	mailshots.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
	return { mailshots };
}

export const actions = {
	duplicate: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'Mailshot ID required' });

		try {
			const copy = await duplicateMailshot(id, locals.multiOrgAdmin.id);
			throw redirect(302, `/multi-org/marketing/mailshots/${copy.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(500, { error: e.message });
		}
	},
	archive: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'Mailshot ID required' });
		await update('marketing_mailshots', id, {
			status: 'archived',
			updated_at: new Date().toISOString()
		});
		return { success: true };
	},
	unarchive: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'Mailshot ID required' });
		await update('marketing_mailshots', id, {
			status: 'draft',
			updated_at: new Date().toISOString()
		});
		return { success: true };
	}
};
