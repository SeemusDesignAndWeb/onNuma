import { readCollection, create, update, findMany } from '$lib/crm/server/fileStore.js';
import { fail } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { organisations: [], brandingEntries: [] };

	const organisations = await readCollection('organisations');
	const brandingEntries = await readCollection('marketing_org_branding');

	const orgMap = organisations.reduce((m, o) => { if (o?.id) m[o.id] = o.name || o.id; return m; }, {});

	return {
		organisations: organisations.filter((o) => o && !o.archivedAt),
		brandingEntries: brandingEntries.map((b) => ({ ...b, orgName: orgMap[b.organisation_id] || b.organisation_id }))
	};
}

export const actions = {
	save: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const orgId = form.get('organisation_id')?.toString()?.trim();
		if (!orgId) return fail(400, { error: 'Organisation is required' });

		const now = new Date().toISOString();
		const data = {
			sender_name: form.get('sender_name')?.toString()?.trim() || '',
			sender_email: form.get('sender_email')?.toString()?.trim() || '',
			reply_to: form.get('reply_to')?.toString()?.trim() || '',
			footer_content: form.get('footer_content')?.toString() || '',
			logo_url: form.get('logo_url')?.toString()?.trim() || '',
			header_style: form.get('header_style')?.toString() || '',
			updated_at: now
		};

		// Check if branding already exists for this org
		const existing = await findMany('marketing_org_branding', (b) => b.organisation_id === orgId);
		if (existing.length > 0) {
			await update('marketing_org_branding', existing[0].id, data);
		} else {
			await create('marketing_org_branding', {
				id: randomUUID(),
				organisation_id: orgId,
				...data,
				created_at: now
			});
		}
		return { success: true };
	}
};
