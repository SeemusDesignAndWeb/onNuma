import { readCollection, create, update, remove } from '$lib/crm/server/fileStore.js';
import { SUPPORTED_PLACEHOLDERS } from '$lib/crm/server/marketing.js';
import { fail } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { builtIn: [], custom: [] };

	const custom = await readCollection('marketing_template_variables');
	custom.sort((a, b) => (a.key || '').localeCompare(b.key || ''));

	return {
		builtIn: SUPPORTED_PLACEHOLDERS,
		custom
	};
}

export const actions = {
	addCustom: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const key = form.get('key')?.toString()?.trim()?.replace(/[^a-zA-Z0-9_]/g, '_');
		const description = form.get('description')?.toString()?.trim() || '';
		const defaultValue = form.get('default_value')?.toString() || '';
		if (!key) return fail(400, { error: 'Key is required' });

		const now = new Date().toISOString();
		await create('marketing_template_variables', {
			id: randomUUID(),
			key,
			description,
			default_value: defaultValue,
			created_at: now,
			updated_at: now
		});
		return { success: true };
	},

	deleteCustom: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'ID required' });
		await remove('marketing_template_variables', id);
		return { success: true };
	}
};
