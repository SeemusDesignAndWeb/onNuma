import { readCollection, findById } from '$lib/crm/server/fileStore.js';
import { getSendStats, getUserTimeline } from '$lib/crm/server/marketing.js';

export async function load({ locals, url }) {
	if (!locals.multiOrgAdmin) return { stats: null, logs: [], userTimeline: null };

	const stats = await getSendStats();

	// Recent send logs
	const logs = await readCollection('marketing_send_logs');
	logs.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));

	// Enrich with template/sequence names
	const templates = await readCollection('marketing_email_templates');
	const sequences = await readCollection('marketing_sequences');
	const templateMap = templates.reduce((m, t) => { m[t.id] = t.name; return m; }, {});
	const sequenceMap = sequences.reduce((m, s) => { m[s.id] = s.name; return m; }, {});

	const enrichedLogs = logs.slice(0, 100).map((l) => ({
		...l,
		template_name: templateMap[l.template_id] || l.template_id,
		sequence_name: sequenceMap[l.sequence_id] || l.sequence_id || '—'
	}));

	// Queue items
	const queue = await readCollection('marketing_send_queue');
	const pendingQueue = queue
		.filter((q) => q.status === 'pending' || q.status === 'sending')
		.sort((a, b) => new Date(a.send_at) - new Date(b.send_at))
		.slice(0, 50)
		.map((q) => ({
			...q,
			template_name: templateMap[q.template_id] || q.template_id
		}));

	// User timeline lookup
	const userId = url.searchParams.get('userId');
	let userTimeline = null;
	if (userId) {
		const contact = await findById('contacts', userId);
		userTimeline = {
			contact: contact ? { id: contact.id, name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(), email: contact.email } : null,
			timeline: await getUserTimeline(userId)
		};
	}

	// Per-template performance
	const templatePerf = Object.entries(stats.byTemplate).map(([id, s]) => ({
		id,
		name: templateMap[id] || id,
		...s
	}));

	// Per-sequence performance
	const sequencePerf = Object.entries(stats.bySequence).map(([id, s]) => ({
		id,
		name: sequenceMap[id] || id,
		...s
	}));

	return {
		stats,
		logs: enrichedLogs,
		pendingQueue,
		userTimeline,
		templatePerf,
		sequencePerf
	};
}
