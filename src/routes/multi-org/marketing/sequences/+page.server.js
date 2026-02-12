import { readCollection, update } from '$lib/crm/server/fileStore.js';
import { duplicateSequence } from '$lib/crm/server/marketing.js';
import { fail, redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { sequences: [] };

	const sequences = await readCollection('marketing_sequences');
	sequences.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

	const steps = await readCollection('marketing_sequence_steps');
	const stepCountBySeq = steps.reduce((acc, s) => {
		acc[s.sequence_id] = (acc[s.sequence_id] || 0) + 1;
		return acc;
	}, {});

	const organisations = await readCollection('organisations');
	const orgMap = organisations.reduce((m, o) => { if (o?.id) m[o.id] = o.name || o.id; return m; }, {});

	return {
		sequences: sequences.map((s) => ({
			...s,
			stepCount: stepCountBySeq[s.id] || 0,
			orgName: s.organisation_id ? orgMap[s.organisation_id] || s.organisation_id : null
		}))
	};
}

export const actions = {
	duplicate: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'Sequence ID required' });

		try {
			const copy = await duplicateSequence(id, locals.multiOrgAdmin.id);
			throw redirect(302, `/multi-org/marketing/sequences/${copy.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(500, { error: e.message });
		}
	},

	setStatus: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('id')?.toString()?.trim();
		const status = form.get('status')?.toString()?.trim();
		if (!id || !['draft', 'active', 'paused', 'archived'].includes(status)) {
			return fail(400, { error: 'Invalid input' });
		}

		await update('marketing_sequences', id, { status, updated_at: new Date().toISOString() });
		return { success: true };
	}
};
