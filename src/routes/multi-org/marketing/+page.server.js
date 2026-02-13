import { readCollection } from '$lib/crm/server/fileStore.js';
import { getSendStats } from '$lib/crm/server/marketing.js';
import { seedMarketingContent } from '$lib/crm/server/marketingSeed.js';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) {
		return { stats: null };
	}

	const [templates, sequences, blocks, links, queueItems, contacts, prefs, mailshots] = await Promise.all([
		readCollection('marketing_email_templates'),
		readCollection('marketing_sequences'),
		readCollection('marketing_content_blocks'),
		readCollection('marketing_links'),
		readCollection('marketing_send_queue'),
		readCollection('contacts'),
		readCollection('marketing_user_preferences'),
		readCollection('marketing_mailshots')
	]);

	const optedOutIds = new Set(
		prefs
			.filter((p) => p?.user_id && p.opted_out_non_essential)
			.map((p) => p.user_id)
	);
	const subscriberCount = contacts.filter(
		(c) => c?.email && c.subscribed !== false && !optedOutIds.has(c.id)
	).length;

	const sendStats = await getSendStats();

	return {
		stats: {
			templates: {
				total: templates.length,
				active: templates.filter((t) => t.status === 'active').length,
				draft: templates.filter((t) => t.status === 'draft').length
			},
			sequences: {
				total: sequences.length,
				active: sequences.filter((s) => s.status === 'active').length,
				draft: sequences.filter((s) => s.status === 'draft').length
			},
			blocks: blocks.length,
			links: links.length,
			mailshots: {
				total: mailshots.length,
				active: mailshots.filter((m) => m.status === 'active').length,
				draft: mailshots.filter((m) => m.status === 'draft').length
			},
			queue: {
				pending: queueItems.filter((q) => q.status === 'pending').length,
				sent: queueItems.filter((q) => q.status === 'sent').length,
				failed: queueItems.filter((q) => q.status === 'failed').length
			},
			sends: sendStats,
			subscribers: subscriberCount
		}
	};
}

export const actions = {
	seedContent: async ({ locals }) => {
		if (!locals.multiOrgAdmin) {
			return { error: 'Unauthorised' };
		}
		try {
			const counts = await seedMarketingContent(locals.multiOrgAdmin.id);
			return { seeded: true, counts };
		} catch (err) {
			console.error('Seed marketing content error:', err);
			return { error: err.message };
		}
	}
};
