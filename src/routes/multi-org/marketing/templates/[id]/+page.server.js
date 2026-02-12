import { error, fail, redirect } from '@sveltejs/kit';
import { findById, update, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import {
	detectPlaceholders,
	validatePlaceholders,
	sendTestEmail,
	createTemplateVersion,
	duplicateEmailTemplate
} from '$lib/crm/server/marketing.js';

export async function load({ params, locals }) {
	if (!locals.multiOrgAdmin) throw redirect(302, '/multi-org/auth/login');

	const template = await findById('marketing_email_templates', params.id);
	if (!template) throw error(404, 'Template not found');

	// Load version history
	const versions = await findMany(
		'marketing_template_versions',
		(v) => v.template_id === params.id
	);
	versions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

	// Load orgs for test send dropdown
	const organisations = await readCollection('organisations');

	// Detect and validate placeholders
	const allText = `${template.subject || ''} ${template.body_html || ''} ${template.body_text || ''}`;
	const placeholders = detectPlaceholders(allText);
	const validation = validatePlaceholders(placeholders);

	// Load content blocks and links for pickers
	const [blocks, links] = await Promise.all([
		readCollection('marketing_content_blocks'),
		readCollection('marketing_links')
	]);

	return {
		template,
		versions: versions.slice(0, 20),
		organisations: organisations.filter((o) => o && !o.archivedAt),
		placeholders,
		validation,
		blocks: blocks.filter((b) => b.status === 'active'),
		links: links.filter((l) => l.status === 'active')
	};
}

export const actions = {
	save: async ({ params, request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();

		const name = form.get('name')?.toString()?.trim();
		if (!name) return fail(400, { error: 'Name is required' });

		const tagsRaw = form.get('tags')?.toString()?.trim() || '';
		const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

		const body_html = form.get('body_html')?.toString() || '';
		const body_text = form.get('body_text')?.toString() || '';
		const subject = form.get('subject')?.toString() || '';

		const updates = {
			name,
			internal_notes: form.get('internal_notes')?.toString() || '',
			subject,
			preview_text: form.get('preview_text')?.toString() || '',
			body_html,
			body_text,
			tags,
			placeholders: detectPlaceholders(`${subject} ${body_html} ${body_text}`),
			updated_at: new Date().toISOString()
		};

		await update('marketing_email_templates', params.id, updates);

		// Store version
		const updated = await findById('marketing_email_templates', params.id);
		await createTemplateVersion(
			updated,
			locals.multiOrgAdmin.id,
			form.get('change_summary')?.toString() || 'Updated'
		);

		return { success: true };
	},

	setStatus: async ({ params, request, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const status = form.get('status')?.toString()?.trim();

		if (!['draft', 'active', 'archived'].includes(status)) {
			return fail(400, { error: 'Invalid status' });
		}

		await update('marketing_email_templates', params.id, {
			status,
			updated_at: new Date().toISOString()
		});
		return { success: true, statusUpdated: status };
	},

	testSend: async ({ params, request, locals, url }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const form = await request.formData();
		const toEmail = form.get('to_email')?.toString()?.trim();
		const orgId = form.get('organisation_id')?.toString()?.trim() || null;

		if (!toEmail) return fail(400, { error: 'Email address required' });

		try {
			const baseUrl = url.origin;
			await sendTestEmail(params.id, toEmail, orgId, baseUrl);
			return { testSent: true, testEmail: toEmail };
		} catch (e) {
			return fail(500, { error: `Test send failed: ${e.message}` });
		}
	},

	duplicate: async ({ params, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		try {
			const copy = await duplicateEmailTemplate(params.id, locals.multiOrgAdmin.id);
			throw redirect(302, `/multi-org/marketing/templates/${copy.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(500, { error: e.message });
		}
	}
};
