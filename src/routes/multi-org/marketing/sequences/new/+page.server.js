import { redirect, fail } from '@sveltejs/kit';
import { createSequence } from '$lib/crm/server/marketing.js';
import { readCollection } from '$lib/crm/server/fileStore.js';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) throw redirect(302, '/multi-org/auth/login');
	const organisations = await readCollection('organisations');
	return { organisations: organisations.filter((o) => o && !o.archivedAt) };
}

export const actions = {
	default: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();

		const name = form.get('name')?.toString()?.trim();
		if (!name) return fail(400, { error: 'Name is required' });

		try {
			const seq = await createSequence({
				name,
				description: form.get('description')?.toString() || '',
				applies_to: form.get('applies_to')?.toString() || 'default',
				organisation_id: form.get('organisation_id')?.toString()?.trim() || null,
				org_group: form.get('org_group')?.toString()?.trim() || null,
				created_by: locals.multiOrgAdmin.id
			});
			throw redirect(302, `/multi-org/marketing/sequences/${seq.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(500, { error: e.message });
		}
	}
};
