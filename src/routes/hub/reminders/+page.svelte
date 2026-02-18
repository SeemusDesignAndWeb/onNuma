<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	$: data = $page.data || {};
	$: entries = data.entries ?? [];
	$: summary = data.summary ?? { totalSent: 0, totalFailed: 0, total: 0 };
	$: totalPages = data.totalPages ?? 1;
	$: currentPage = data.page ?? 1;
	$: statusFilter = data.statusFilter ?? 'all';

	function fmtDate(iso) {
		if (!iso) return '—';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		}) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
	}

	function daysLabel(n) {
		if (n === 1) return '1 day before';
		if (n === 2) return '2 days before';
		if (n === 7) return '1 week before';
		return `${n} days before`;
	}

	function setFilter(val) {
		const u = new URL($page.url);
		u.searchParams.set('status', val);
		u.searchParams.set('page', '1');
		goto(u.toString());
	}

	function goPage(p) {
		const u = new URL($page.url);
		u.searchParams.set('page', String(p));
		goto(u.toString());
	}
</script>

<svelte:head>
	<title>Reminders sent — Hub</title>
</svelte:head>

<div class="rem-page">
	<div class="rem-header">
		<h1 class="rem-title">Reminders sent</h1>
		<p class="rem-sub">A log of every shift reminder email sent through the automated cron job.</p>
	</div>

	<!-- Summary cards -->
	<div class="rem-stats">
		<div class="rem-stat-card">
			<p class="rem-stat-num">{summary.totalSent}</p>
			<p class="rem-stat-label">Sent successfully</p>
		</div>
		<div class="rem-stat-card rem-stat-fail">
			<p class="rem-stat-num">{summary.totalFailed}</p>
			<p class="rem-stat-label">Failed to send</p>
		</div>
		<div class="rem-stat-card rem-stat-total">
			<p class="rem-stat-num">{summary.total}</p>
			<p class="rem-stat-label">Total attempts</p>
		</div>
	</div>

	<!-- Filter tabs -->
	<div class="rem-filters" role="tablist">
		<button
			role="tab"
			class="rem-filter-btn"
			class:active={statusFilter === 'all'}
			on:click={() => setFilter('all')}
		>All</button>
		<button
			role="tab"
			class="rem-filter-btn"
			class:active={statusFilter === 'sent'}
			on:click={() => setFilter('sent')}
		>Sent</button>
		<button
			role="tab"
			class="rem-filter-btn rem-filter-fail"
			class:active={statusFilter === 'failed'}
			on:click={() => setFilter('failed')}
		>Failed</button>
	</div>

	<!-- Log table -->
	{#if entries.length === 0}
		<div class="rem-empty">
			<p>No reminder log entries yet — they'll appear here after the cron job runs.</p>
		</div>
	{:else}
		<div class="rem-table-wrap">
			<table class="rem-table">
				<thead>
					<tr>
						<th>Sent at</th>
						<th>Volunteer</th>
						<th>Event</th>
						<th>Role</th>
						<th>Timing</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{#each entries as entry}
						<tr class:rem-row-fail={entry.status === 'failed'}>
							<td class="rem-cell-date">{fmtDate(entry.sentAt)}</td>
							<td class="rem-cell-email">{entry.contactEmail || '—'}</td>
							<td class="rem-cell-event">{entry.eventTitle || '—'}</td>
							<td class="rem-cell-role">{entry.role || '—'}</td>
							<td class="rem-cell-timing">{daysLabel(entry.daysAhead)}</td>
							<td class="rem-cell-status">
								{#if entry.status === 'sent'}
									<span class="rem-badge rem-badge-sent">Sent</span>
								{:else}
									<span class="rem-badge rem-badge-fail" title={entry.error || ''}>Failed</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="rem-pager">
				<button
					class="rem-pager-btn"
					disabled={currentPage <= 1}
					on:click={() => goPage(currentPage - 1)}
				>← Previous</button>
				<span class="rem-pager-info">Page {currentPage} of {totalPages}</span>
				<button
					class="rem-pager-btn"
					disabled={currentPage >= totalPages}
					on:click={() => goPage(currentPage + 1)}
				>Next →</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.rem-page {
		padding: 1.5rem 0;
		max-width: 960px;
	}

	.rem-header {
		margin-bottom: 1.5rem;
	}
	.rem-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #0f172a;
		margin: 0 0 0.25rem 0;
	}
	.rem-sub {
		font-size: 0.9375rem;
		color: #64748b;
		margin: 0;
	}

	/* Summary cards */
	.rem-stats {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
		flex-wrap: wrap;
	}
	.rem-stat-card {
		background: #f0fdf4;
		border: 1px solid #bbf7d0;
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
		min-width: 130px;
		flex: 1;
	}
	.rem-stat-fail {
		background: #fef2f2;
		border-color: #fca5a5;
	}
	.rem-stat-total {
		background: #f8fafc;
		border-color: #e2e8f0;
	}
	.rem-stat-num {
		font-size: 2rem;
		font-weight: 800;
		color: #0f172a;
		margin: 0 0 0.25rem 0;
		line-height: 1;
	}
	.rem-stat-label {
		font-size: 0.875rem;
		color: #64748b;
		margin: 0;
		font-weight: 500;
	}

	/* Filter tabs */
	.rem-filters {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}
	.rem-filter-btn {
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
		background: #fff;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}
	.rem-filter-btn:hover {
		background: #f1f5f9;
	}
	.rem-filter-btn.active {
		background: #0f172a;
		color: #fff;
		border-color: #0f172a;
	}
	.rem-filter-fail.active {
		background: #dc2626;
		border-color: #dc2626;
	}

	/* Empty state */
	.rem-empty {
		background: #f8fafc;
		border: 1px dashed #cbd5e1;
		border-radius: 0.75rem;
		padding: 2rem;
		text-align: center;
		color: #64748b;
		font-size: 0.9375rem;
	}

	/* Table */
	.rem-table-wrap {
		overflow-x: auto;
		border: 1px solid #e5e7eb;
		border-radius: 0.75rem;
	}
	.rem-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.9375rem;
	}
	.rem-table thead tr {
		background: #f9fafb;
		border-bottom: 1px solid #e5e7eb;
	}
	.rem-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-size: 0.8125rem;
		font-weight: 600;
		color: #6b7280;
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.rem-table td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f3f4f6;
		vertical-align: middle;
	}
	.rem-table tbody tr:last-child td {
		border-bottom: none;
	}
	.rem-table tbody tr:hover td {
		background: #f9fafb;
	}
	.rem-row-fail td {
		background: #fff5f5;
	}
	.rem-row-fail:hover td {
		background: #fee2e2;
	}
	.rem-cell-date {
		color: #6b7280;
		white-space: nowrap;
		font-size: 0.875rem;
	}
	.rem-cell-email {
		font-weight: 500;
		color: #111827;
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rem-cell-event {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rem-cell-role {
		color: #6b7280;
		white-space: nowrap;
	}
	.rem-cell-timing {
		color: #6b7280;
		white-space: nowrap;
		font-size: 0.875rem;
	}
	.rem-cell-status {
		white-space: nowrap;
	}
	.rem-badge {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		font-weight: 600;
		white-space: nowrap;
	}
	.rem-badge-sent {
		background: #dcfce7;
		color: #166534;
	}
	.rem-badge-fail {
		background: #fee2e2;
		color: #991b1b;
		cursor: help;
	}

	/* Pagination */
	.rem-pager {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		margin-top: 1.25rem;
	}
	.rem-pager-btn {
		padding: 0.5rem 1rem;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		background: #fff;
		font-size: 0.9375rem;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: background 0.15s;
	}
	.rem-pager-btn:hover:not(:disabled) {
		background: #f1f5f9;
	}
	.rem-pager-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.rem-pager-info {
		font-size: 0.9375rem;
		color: #64748b;
	}
</style>
