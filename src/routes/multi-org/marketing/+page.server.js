import { readCollection, readCollectionCount } from '$lib/crm/server/fileStore.js';
import { getSendStats } from '$lib/crm/server/marketing.js';
import { seedMarketingContent } from '$lib/crm/server/marketingSeed.js';

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) {
		return { stats: null };
	}

	const [templates, sequences, blocks, links, queueItems] = await Promise.all([
		readCollection('marketing_email_templates'),
		readCollection('marketing_sequences'),
		readCollection('marketing_content_blocks'),
		readCollection('marketing_links'),
		readCollection('marketing_send_queue')
	]);

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
			queue: {
				pending: queueItems.filter((q) => q.status === 'pending').length,
				sent: queueItems.filter((q) => q.status === 'sent').length,
				failed: queueItems.filter((q) => q.status === 'failed').length
			},
			sends: sendStats
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
