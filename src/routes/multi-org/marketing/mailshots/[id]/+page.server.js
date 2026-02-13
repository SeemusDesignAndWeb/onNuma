import { error, fail, redirect } from '@sveltejs/kit';
import { findById, readCollection, update } from '$lib/crm/server/fileStore.js';
import {
	detectPlaceholders,
	duplicateMailshot,
	sendMarketingBroadcast,
	sendTestMailshot
} from '$lib/crm/server/marketing.js';

export async function load({ params, locals }) {
	if (!locals.multiOrgAdmin) throw redirect(302, '/multi-org/auth/login');

	const mailshot = await findById('marketing_mailshots', params.id);
	if (!mailshot) throw error(404, 'Mailshot not found');

	const [blocks, links] = await Promise.all([
		readCollection('marketing_content_blocks'),
		readCollection('marketing_links')
	]);

	return {
		mailshot,
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
		const subject = form.get('subject')?.toString() || '';
		const body_html = form.get('body_html')?.toString() || '';
		const body_text = form.get('body_text')?.toString() || '';

		await update('marketing_mailshots', params.id, {
			name,
			internal_notes: form.get('internal_notes')?.toString() || '',
			subject,
			preview_text: form.get('preview_text')?.toString() || '',
			body_html,
			body_text,
			tags,
			placeholders: detectPlaceholders(`${subject} ${body_html} ${body_text}`),
			status: form.get('status')?.toString() || 'draft',
			updated_at: new Date().toISOString()
		});

		return { success: true };
	},
	duplicate: async ({ params, locals }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		try {
			const copy = await duplicateMailshot(params.id, locals.multiOrgAdmin.id);
			throw redirect(302, `/multi-org/marketing/mailshots/${copy.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(500, { error: e.message });
		}
	},
	sendNow: async ({ params, locals, url }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });
		const mailshot = await findById('marketing_mailshots', params.id);
		if (!mailshot) return fail(404, { error: 'Mailshot not found' });
		if (!mailshot.subject?.trim()) return fail(400, { error: 'Subject is required before sending.' });
		if (!mailshot.body_html?.trim() && !mailshot.body_text?.trim()) {
			return fail(400, { error: 'Mailshot body cannot be empty.' });
		}

		try {
			const result = await sendMarketingBroadcast({
				subject: mailshot.subject,
				previewText: mailshot.preview_text || '',
				bodyHtml: mailshot.body_html || '',
				bodyText: mailshot.body_text || '',
				baseUrl: url.origin
			});

			await update('marketing_mailshots', params.id, {
				last_sent_at: new Date().toISOString(),
				send_count: (mailshot.send_count || 0) + 1,
				status: 'active',
				updated_at: new Date().toISOString()
			});

			return { sent: true, broadcast: result };
		} catch (e) {
			return fail(500, { error: e.message || 'Failed to send mailshot.' });
		}
	},
	testSend: async ({ params, request, locals, url }) => {
		if (!locals.multiOrgAdmin) return fail(401, { error: 'Not authorised' });

		const mailshot = await findById('marketing_mailshots', params.id);
		if (!mailshot) return fail(404, { error: 'Mailshot not found' });

		const form = await request.formData();
		const rawEmails = form.get('test_emails')?.toString() || '';
		const toEmails = rawEmails
			.split(/[\n,;]+/)
			.map((e) => e.trim().toLowerCase())
			.filter(Boolean);

		if (toEmails.length === 0) return fail(400, { error: 'Please provide at least one test email.' });

		const invalid = toEmails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
		if (invalid.length > 0) {
			return fail(400, { error: `Invalid email address(es): ${invalid.join(', ')}` });
		}

		try {
			const result = await sendTestMailshot({
				mailshot,
				toEmails: [...new Set(toEmails)],
				organisationId: null,
				baseUrl: url.origin
			});
			return { testSent: true, testResult: result };
		} catch (e) {
			return fail(500, { error: e.message || 'Failed to send test email.' });
		}
	}
};
