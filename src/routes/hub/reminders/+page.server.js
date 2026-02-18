import { readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';

const PAGE_SIZE = 50;

export async function load({ url }) {
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const statusFilter = url.searchParams.get('status') || 'all';

	try {
		const organisationId = await getCurrentOrganisationId();

		let logs = await readCollection('rota_reminder_log').catch(() => []);
		if (organisationId) {
			logs = filterByOrganisation(logs, organisationId);
		}

		// Apply status filter
		if (statusFilter !== 'all') {
			logs = logs.filter((l) => l.status === statusFilter);
		}

		// Sort newest first
		logs.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

		const total = logs.length;
		const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
		const offset = (page - 1) * PAGE_SIZE;
		const entries = logs.slice(offset, offset + PAGE_SIZE);

		// Summary counts (unfiltered)
		const allLogs = await readCollection('rota_reminder_log').catch(() => []);
		const filteredAll = organisationId ? filterByOrganisation(allLogs, organisationId) : allLogs;
		const totalSent = filteredAll.filter((l) => l.status === 'sent').length;
		const totalFailed = filteredAll.filter((l) => l.status === 'failed').length;

		return {
			entries,
			total,
			totalPages,
			page,
			statusFilter,
			summary: { totalSent, totalFailed, total: filteredAll.length }
		};
	} catch (err) {
		console.error('[hub/reminders] load error:', err?.message || err);
		return {
			entries: [],
			total: 0,
			totalPages: 1,
			page: 1,
			statusFilter,
			summary: { totalSent: 0, totalFailed: 0, total: 0 }
		};
	}
}
