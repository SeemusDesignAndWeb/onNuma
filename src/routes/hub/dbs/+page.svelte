<script>
	import { page } from '$app/stores';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: rows = data.rows || [];
	$: teams = data.teams || [];
	$: filterTeamId = data.filterTeamId || '';

	function printOrPdf() {
		const win = window.open('', '_blank');
		if (!win) return;
		const rowsHtml = rows
			.map(
				(r) =>
					`<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.email)}</td><td>${escapeHtml((r.teamNames || []).join(', '))}</td><td>${escapeHtml((r.roleNames || []).join(', '))}</td><td>${r.label}</td><td>${r.renewalDueDate || '—'}</td><td>${r.dbs?.level ? r.dbs.level.replace(/_/g, ' ') : '—'}</td><td>${r.dbs?.updateServiceRegistered ? 'Yes' : 'No'}</td></tr>`
			)
			.join('');
		win.document.write(`
<!DOCTYPE html>
<html><head><title>DBS Compliance</title>
<style>body{font-family:sans-serif;padding:1rem;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background:#f5f5f5;}</style>
</head><body>
<h1>DBS Compliance</h1>
<p>Generated ${new Date().toLocaleString('en-GB')}. Record-keeping only.</p>
<table>
<thead><tr><th>Name</th><th>Email</th><th>Teams</th><th>Roles</th><th>Status</th><th>Renewal due</th><th>DBS level</th><th>Update Service</th></tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
</body></html>`);
		win.document.close();
		win.focus();
		setTimeout(() => { win.print(); win.close(); }, 250);
	}
	function escapeHtml(s) {
		if (s == null) return '';
		return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
	function exportCsv() {
		const headers = ['Name', 'Email', 'Teams', 'Roles', 'DBS Status', 'Renewal due', 'DBS level', 'Update Service'];
		const lines = [
			headers.join(','),
			...rows.map((r) => [
				`"${(r.name || '').replace(/"/g, '""')}"`,
				`"${(r.email || '').replace(/"/g, '""')}"`,
				`"${(r.teamNames || []).join('; ').replace(/"/g, '""')}"`,
				`"${(r.roleNames || []).join('; ').replace(/"/g, '""')}"`,
				r.label || r.status,
				r.renewalDueDate || '',
				(r.dbs && r.dbs.level) ? r.dbs.level.replace(/_/g, ' ') : '',
				r.dbs?.updateServiceRegistered ? 'Yes' : 'No'
			].join(','))
		];
		const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'dbs-compliance.csv';
		a.click();
		URL.revokeObjectURL(a.href);
	}

	function statusColor(status) {
		if (status === 'green') return 'bg-green-100 text-green-800';
		if (status === 'amber') return 'bg-amber-100 text-amber-800';
		return 'bg-red-100 text-red-800';
	}

	function statusDot(status) {
		if (status === 'green') return 'bg-green-500';
		if (status === 'amber') return 'bg-amber-500';
		return 'bg-red-500';
	}
</script>

<svelte:head>
	<title>DBS Compliance | Hub</title>
</svelte:head>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<div>
		<h2 class="text-xl sm:text-2xl font-bold">DBS Compliance</h2>
		<p class="text-gray-600 text-sm mt-1">Volunteers in DBS-required roles. Record-keeping only.</p>
	</div>
	<div class="flex flex-wrap gap-2">
		<button type="button" on:click={exportCsv} class="bg-theme-button-1 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Export CSV
		</button>
		<button type="button" on:click={printOrPdf} class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Print / Save as PDF
		</button>
	</div>
</div>

<div class="mb-4 flex flex-wrap items-end gap-2">
	<label for="filter-team" class="text-sm font-medium text-gray-700">Filter by team</label>
	<select
		id="filter-team"
		class="rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-[18px] py-2 text-sm"
		value={filterTeamId}
		on:change={(e) => {
			const v = e.currentTarget.value;
			window.location.href = v ? `/hub/dbs?team=${encodeURIComponent(v)}` : '/hub/dbs';
		}}
	>
		<option value="">All teams</option>
		{#each teams as team}
			<option value={team.id}>{team.name || 'Unnamed'}</option>
		{/each}
	</select>
</div>

<div class="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
	<div class="overflow-x-auto">
		<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volunteer</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teams / Roles</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Renewal due</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DBS level</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Update Service</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each rows as row}
						<tr class="hover:bg-gray-50">
							<td class="px-4 py-4 whitespace-nowrap">
								<a href="/hub/contacts/{row.contactId}" class="text-theme-button-1 font-medium hover:underline">{row.name}</a>
								{#if row.email}
									<div class="text-xs text-gray-500">{row.email}</div>
								{/if}
							</td>
							<td class="px-4 py-4 text-sm text-gray-700">
								<div>{row.teamNames.join(', ') || '—'}</div>
								<div class="text-xs text-gray-500">{row.roleNames.join(', ') || '—'}</div>
							</td>
							<td class="px-4 py-4 whitespace-nowrap">
								<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium {statusColor(row.status)}">
									<span class="w-2 h-2 rounded-full {statusDot(row.status)}"></span>
									{row.label}
								</span>
							</td>
							<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
								{row.renewalDueDate ? formatDateUK(row.renewalDueDate) : '—'}
							</td>
							<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
								{row.dbs?.level ? row.dbs.level.replace(/_/g, ' ') : '—'}
							</td>
							<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
								{row.dbs?.updateServiceRegistered ? 'Yes' : 'No'}
							</td>
							<td class="px-4 py-4 whitespace-nowrap">
								<a href="/hub/contacts/{row.contactId}" class="text-sm text-theme-button-1 hover:underline">View profile</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
	</div>
	{#if rows.length === 0}
		<div class="px-6 py-12 text-center text-gray-500">
			<p>No volunteers in DBS-required roles yet.</p>
			<p class="text-sm mt-1">Flag roles as &quot;DBS required&quot; in Team settings, then assign volunteers to those roles.</p>
		</div>
	{/if}
</div>
