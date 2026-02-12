import { error, fail, redirect } from '@sveltejs/kit';
import { findById, update, findMany, readCollection, remove, create } from '$lib/crm/server/fileStore.js';
import { addSequenceStep, duplicateSequence, computeSendTime } from '$lib/crm/server/marketing.js';
import { randomUUID } from 'crypto';

export async function load({ params, locals }) {
	if (!locals.multiOrgAdmin) throw redirect(302, '/multi-org/auth/login');

	const sequence = await findById('marketing_sequences', params.id);
	if (!sequence) throw error(404, 'Sequence not found');

	const steps = await findMany('marketing_sequence_steps', (s) => s.sequence_id === params.id);
	steps.sort((a, b) => (a.order || 0) - (b.order || 0));

	// Enrich steps with template names
	const templates = await readCollection('marketing_email_templates');
	const templateMap = templates.reduce((m, t) => { m[t.id] = t; return m; }, {});

	const enrichedSteps = steps.map((s) => ({
		...s,
		template: templateMap[s.email_template_id] || null
	}));

	const organisations = await readCollection('organisations');

	// Timeline preview: compute send times for a hypothetical join date (now)
	const previewJoinDate = new Date();
	const timeline = enrichedSteps.map((s) => ({
		...s,
		previewSendAt: computeSendTime(s, previewJoinDate, 'UTC', 9).toISOString()
	}));

	return {
		sequence,
		steps: enrichedSteps,
		templates: templates.filter((t) => t.status === 'active' || t.status === 'draft'),
		organisations: organisations.filter((o) => o && !o.archivedAt),
		timeline
	};
}

export const actions = {
	saveSequence: async ({ params, request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();

		const name = form.get('name')?.toString()?.trim();
		if (!name) return fail(400, { error: 'Name is required' });

		await update('marketing_sequences', params.id, {
			name,
			description: form.get('description')?.toString() || '',
			applies_to: form.get('applies_to')?.toString() || 'default',
			organisation_id: form.get('organisation_id')?.toString()?.trim() || null,
			org_group: form.get('org_group')?.toString()?.trim() || null,
			updated_at: new Date().toISOString()
		});
		return { success: true };
	},

	setStatus: async ({ params, request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const status = form.get('status')?.toString()?.trim();
		if (!['draft', 'active', 'paused', 'archived'].includes(status)) {
			return fail(400, { error: 'Invalid status' });
		}
		await update('marketing_sequences', params.id, { status, updated_at: new Date().toISOString() });
		return { success: true, statusUpdated: status };
	},

	addStep: async ({ params, request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();

		const step = await addSequenceStep({
			sequence_id: params.id,
			email_template_id: form.get('email_template_id')?.toString()?.trim() || null,
			delay_value: parseInt(form.get('delay_value') || '0', 10),
			delay_unit: form.get('delay_unit')?.toString() || 'days',
			conditions: parseConditions(form)
		});

		return { success: true, stepAdded: true };
	},

	updateStep: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const stepId = form.get('step_id')?.toString()?.trim();
		if (!stepId) return fail(400, { error: 'Step ID required' });

		await update('marketing_sequence_steps', stepId, {
			email_template_id: form.get('email_template_id')?.toString()?.trim() || null,
			delay_value: parseInt(form.get('delay_value') || '0', 10),
			delay_unit: form.get('delay_unit')?.toString() || 'days',
			conditions: parseConditions(form),
			updated_at: new Date().toISOString()
		});
		return { success: true };
	},

	removeStep: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const stepId = form.get('step_id')?.toString()?.trim();
		if (!stepId) return fail(400, { error: 'Step ID required' });
		await remove('marketing_sequence_steps', stepId);
		return { success: true };
	},

	reorderSteps: async ({ params, request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const orderJson = form.get('order')?.toString() || '[]';
		let order;
		try { order = JSON.parse(orderJson); } catch { return fail(400, { error: 'Invalid order data' }); }

		for (let i = 0; i < order.length; i++) {
			await update('marketing_sequence_steps', order[i], { order: i + 1, updated_at: new Date().toISOString() });
		}
		return { success: true };
	},

	duplicate: async ({ params, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		try {
			const copy = await duplicateSequence(params.id, locals.multiOrgAdmin.id);
			throw redirect(302, `/multi-org/marketing/sequences/${copy.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(500, { error: e.message });
		}
	}
};

function parseConditions(form) {
	const conditions = [];
	const condTypes = form.getAll('cond_type');
	const condValues = form.getAll('cond_value');
	for (let i = 0; i < condTypes.length; i++) {
		const type = condTypes[i]?.toString()?.trim();
		if (type) {
			conditions.push({ type, value: condValues[i]?.toString()?.trim() || '' });
		}
	}
	return conditions;
}
