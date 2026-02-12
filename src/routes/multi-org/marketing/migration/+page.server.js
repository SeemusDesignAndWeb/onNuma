import { readCollection, findById, create, findMany } from '$lib/crm/server/fileStore.js';
import { createEmailTemplate, duplicateSequence } from '$lib/crm/server/marketing.js';
import { fail } from '@sveltejs/kit';
import { randomUUID } from 'crypto';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) return { templates: [], sequences: [], organisations: [] };

	const templates = await readCollection('marketing_email_templates');
	const sequences = await readCollection('marketing_sequences');
	const organisations = await readCollection('organisations');

	return {
		templates: templates.filter((t) => t.status !== 'archived'),
		sequences: sequences.filter((s) => s.status !== 'archived'),
		organisations: organisations.filter((o) => o && !o.archivedAt)
	};
}

export const actions = {
	importTemplate: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();

		const format = form.get('format')?.toString() || 'html';
		const content = form.get('content')?.toString()?.trim();
		const name = form.get('name')?.toString()?.trim() || 'Imported template';

		if (!content) return fail(400, { error: 'Content is required' });

		try {
			if (format === 'json') {
				const parsed = JSON.parse(content);
				const template = await createEmailTemplate({
					name: parsed.name || name,
					internal_notes: parsed.internal_notes || '',
					subject: parsed.subject || '',
					preview_text: parsed.preview_text || '',
					body_html: parsed.body_html || '',
					body_text: parsed.body_text || '',
					tags: parsed.tags || [],
					created_by: locals.multiOrgAdmin.id
				});
				return { success: true, message: `Imported template: ${template.name}` };
			} else {
				// HTML/text import
				const template = await createEmailTemplate({
					name,
					subject: '',
					body_html: format === 'html' ? content : '',
					body_text: format === 'text' ? content : '',
					tags: ['imported'],
					created_by: locals.multiOrgAdmin.id
				});
				return { success: true, message: `Imported as: ${template.name}` };
			}
		} catch (e) {
			return fail(400, { error: `Import failed: ${e.message}` });
		}
	},

	exportTemplate: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const id = form.get('template_id')?.toString()?.trim();
		if (!id) return fail(400, { error: 'Template ID required' });

		const template = await findById('marketing_email_templates', id);
		if (!template) return fail(404, { error: 'Template not found' });

		const exported = {
			name: template.name,
			internal_notes: template.internal_notes,
			subject: template.subject,
			preview_text: template.preview_text,
			body_html: template.body_html,
			body_text: template.body_text,
			tags: template.tags
		};

		return { exportedJson: JSON.stringify(exported, null, 2), exportedName: template.name };
	},

	duplicateAcrossOrgs: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const sequenceId = form.get('sequence_id')?.toString()?.trim();
		const targetOrgId = form.get('target_org_id')?.toString()?.trim();

		if (!sequenceId || !targetOrgId) return fail(400, { error: 'Sequence and target org are required' });

		try {
			const copy = await duplicateSequence(sequenceId, locals.multiOrgAdmin.id);
			// Update the copy to point to the target org
			const { update } = await import('$lib/crm/server/fileStore.js');
			await update('marketing_sequences', copy.id, {
				organisation_id: targetOrgId,
				applies_to: 'organisation',
				name: `${copy.name.replace(' (copy)', '')} (${targetOrgId})`,
				updated_at: new Date().toISOString()
			});
			return { success: true, message: `Sequence duplicated to target org` };
		} catch (e) {
			return fail(500, { error: e.message });
		}
	}
};
