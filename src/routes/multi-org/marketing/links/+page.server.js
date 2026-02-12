import { readCollection, create, update, remove } from '$lib/crm/server/fileStore.js';
import { fail } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { links: [], organisations: [] };
	const links = await readCollection('marketing_links');
	links.sort((a, b) => (a.key || '').localeCompare(b.key || ''));

	const organisations = await readCollection('organisations');
	const orgMap = organisations.reduce((m, o) => { if (o?.id) m[o.id] = o.name || o.id; return m; }, {});

	return {
		links: links.map((l) => ({ ...l, orgName: l.organisationId ? orgMap[l.organisationId] || l.organisationId : null })),
		organisations: organisations.filter((o) => o && !o.archivedAt)
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();

		const key = form.get('key')?.toString()?.trim()?.replace(/[^a-zA-Z0-9_-]/g, '_');
		const name = form.get('name')?.toString()?.trim();
		const url = form.get('url')?.toString()?.trim();
		if (!key || !name || !url) return fail(400, { error: 'Key, name, and URL are required' });

		const now = new Date().toISOString();
		await create('marketing_links', {
			id: randomUUID(),
			key,
			name,
			url,
			scope: form.get('scope')?.toString() || 'global',
			organisationId: form.get('organisationId')?.toString()?.trim() || null,
			status: 'active',
			created_at: now,
			updated_at: now,
			created_by: locals.multiOrgAdmin.id
		});
		return { success: true };
	},

	update: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'ID required' });

		await update('marketing_links', id, {
			name: form.get('name')?.toString()?.trim() || '',
			url: form.get('url')?.toString()?.trim() || '',
			scope: form.get('scope')?.toString() || 'global',
			organisationId: form.get('organisationId')?.toString()?.trim() || null,
			updated_at: new Date().toISOString()
		});
		return { success: true };
	},

	toggleStatus: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		const currentStatus = form.get('current_status')?.toString()?.trim();
		if (!id) return fail(400, { error: 'ID required' });
		await update('marketing_links', id, {
			status: currentStatus === 'active' ? 'inactive' : 'active',
			updated_at: new Date().toISOString()
		});
		return { success: true };
	},

	delete: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'ID required' });
		await remove('marketing_links', id);
		return { success: true };
	}
};
