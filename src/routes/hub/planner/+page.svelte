<script>
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { terminology } from '$lib/crm/stores/terminology.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { formatDateShortUK, formatWeekdayUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: events = data.events || [];
	$: selectedEvent = data.selectedEvent || null;
	$: occurrences = data.occurrences || [];
	$: teamRows = data.teamRows || [];
	$: unlinkedRows = data.unlinkedRows || [];
	$: hasRows = teamRows.length > 0 || unlinkedRows.length > 0;
	$: canEdit = data.canEdit ?? true;
	$: csrfToken = data.csrfToken || '';
	$: plannerNotes = data.plannerNotes || '';

	let notesDraft = '';
	let notesSaving = false;
	let notesSaved = false;
	$: notesDraft = plannerNotes;

	function handleEventChange(e) {
		const id = e.currentTarget.value;
		goto(id ? `/hub/planner?eventId=${encodeURIComponent(id)}` : '/hub/planner');
	}

	function fillClass(count, capacity) {
		if (capacity > 0 && count >= capacity) return 'cell-full';
		if (count > 0) return 'cell-partial';
		return 'cell-empty';
	}

	function badgeClass(count, capacity) {
		if (capacity > 0 && count >= capacity) return 'badge-full';
		if (count > 0) return 'badge-partial';
		return 'badge-empty';
	}

	function shortName(fullName) {
		if (!fullName) return '';
		const parts = fullName.trim().split(/\s+/);
		if (parts.length === 1) return parts[0];
		return `${parts[0]} ${parts[parts.length - 1][0]}.`;
	}
</script>

<!-- Print-only header -->
<div class="print-only">
	<div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:0.5rem;">
		<h1 style="font-size:1.25rem; font-weight:700; margin:0;">{$terminology.meeting_planner}: {selectedEvent?.title || ''}</h1>
		<span style="font-size:0.75rem; color:#6b7280;">Printed {new Date().toLocaleDateString('en-GB')}</span>
	</div>
	{#if plannerNotes}
		<div style="font-size:0.8rem; color:#374151; background:#f9fafb; border:1px solid #e5e7eb; border-radius:4px; padding:0.5rem 0.75rem; margin-bottom:0.5rem; white-space:pre-wrap;">{plannerNotes}</div>
	{/if}
	<hr style="margin-bottom:0.75rem; border-color:#d1d5db;" />
</div>

<!-- Page header -->
<div class="no-print mb-4 flex items-center justify-between gap-4">
	<h2 class="text-xl sm:text-2xl font-bold">{$terminology.meeting_planner}</h2>
	{#if selectedEvent && occurrences.length > 0 && hasRows}
		<button type="button" class="hub-btn btn-theme-1 px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5" on:click={() => window.print()}>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
			Print / PDF
		</button>
	{/if}
</div>

<!-- Event selector -->
<div class="no-print mb-4 hub-top-panel px-4 py-3 flex flex-wrap items-center gap-2">
	<label for="eventSelect" class="text-sm font-medium text-gray-700">Select {$terminology.event}</label>
	<select id="eventSelect" class="rounded-md border-gray-300 shadow-sm text-sm py-1.5 pl-3 pr-8 focus:border-theme-button-2 focus:ring-theme-button-2 min-w-[200px]" value={selectedEvent?.id || ''} on:change={handleEventChange}>
		<option value="">— Choose an {$terminology.event.toLowerCase()} —</option>
		{#each events as ev}
			<option value={ev.id}>{ev.title}</option>
		{/each}
	</select>
</div>

{#if !selectedEvent}
	<div class="hub-top-panel p-10 text-center text-gray-400">
		<svg class="mx-auto mb-3 w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
		</svg>
		<p class="text-sm">Select an {$terminology.event.toLowerCase()} above to view the planner.</p>
	</div>
{:else}
	{#if occurrences.length === 0}
			<div class="hub-top-panel p-8 text-center text-gray-400">
				<p class="text-sm">No upcoming occurrences for "<strong class="text-gray-600">{selectedEvent.title}</strong>".</p>
			</div>
		{:else if !hasRows}
			<div class="hub-top-panel p-8 text-center">
				<p class="text-gray-500 text-sm mb-1">No {$terminology.team.toLowerCase()} roles are linked to {$terminology.rota.toLowerCase()}s for this {$terminology.event.toLowerCase()}.</p>
				<p class="text-xs text-gray-400">Go to <a href="/hub/teams" class="text-theme-button-1 hover:underline">{$terminology.team}s</a> and link {$terminology.role.toLowerCase()}s to their {$terminology.rota.toLowerCase()}s.</p>
			</div>
		{:else}
			<div class="hub-top-panel overflow-x-auto">
				<table class="planner-table">
					<thead>
						<tr>
							<th class="planner-th planner-th-role" aria-label="Role"></th>
							{#each occurrences as occ}
								<th class="planner-th planner-th-date">
									<span class="planner-date-weekday">{formatWeekdayUK(occ.startsAt)}</span>
									<span class="planner-date-day">{formatDateShortUK(occ.startsAt)}</span>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each teamRows as team (team.teamId)}
							<tr><td colspan={occurrences.length + 1} class="planner-team-row">{team.teamName}</td></tr>
							{#each team.roles as role (role.rotaId)}
								<tr class="planner-data-row">
									<td class="planner-role-cell">
										<span class="planner-role-name">{role.roleName}</span>
										<span class="planner-capacity">×{role.capacity}</span>
									</td>
									{#each occurrences as occ (occ.id)}
										{@const assignees = role.occurrences[occ.id] || []}
										{@const count = assignees.length}
										<td class="planner-occ-cell {fillClass(count, role.capacity)}">
											<div class="planner-occ-inner">
												{#if assignees.length > 0}
													<span class="planner-assignees" title={assignees.join(', ')}>{assignees.map(shortName).join(', ')}</span>
												{/if}
												<span class="planner-badge {badgeClass(count, role.capacity)}">{count}/{role.capacity}</span>
												{#if count < role.capacity && canEdit}
													<a href="/hub/teams/{team.teamId}" class="planner-assign-link no-print">+ Assign</a>
												{/if}
											</div>
										</td>
									{/each}
								</tr>
							{/each}
						{/each}
						{#if unlinkedRows.length > 0}
							<tr><td colspan={occurrences.length + 1} class="planner-team-row planner-team-row-other">Other {$terminology.rota}s</td></tr>
							{#each unlinkedRows as row (row.rotaId)}
								<tr class="planner-data-row">
									<td class="planner-role-cell">
										<span class="planner-role-name">{row.roleName}</span>
										<span class="planner-capacity">×{row.capacity}</span>
									</td>
									{#each occurrences as occ (occ.id)}
										{@const assignees = row.occurrences[occ.id] || []}
										{@const count = assignees.length}
										<td class="planner-occ-cell {fillClass(count, row.capacity)}">
											<div class="planner-occ-inner">
												{#if assignees.length > 0}
													<span class="planner-assignees" title={assignees.join(', ')}>{assignees.map(shortName).join(', ')}</span>
												{/if}
												<span class="planner-badge {badgeClass(count, row.capacity)}">{count}/{row.capacity}</span>
												{#if count < row.capacity && canEdit}
													<a href="/hub/schedules/{row.rotaId}" class="planner-assign-link no-print">+ Assign</a>
												{/if}
											</div>
										</td>
									{/each}
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>

			<div class="no-print mt-3 flex gap-4 text-xs text-gray-500 flex-wrap">
				<span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-300"></span> Fully staffed</span>
				<span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300"></span> Partially filled</span>
				<span class="flex items-center gap-1.5"><span class="inline-block w-3 h-3 rounded-sm bg-red-50 border border-red-200"></span> Unfilled</span>
				<span class="ml-auto text-gray-400">Click on a {$terminology.team.toLowerCase()} to assign people</span>
			</div>

			<div class="mt-5">
				<div class="flex items-center justify-between mb-2">
					<h3 class="text-sm font-semibold text-gray-700">Notes</h3>
					{#if notesSaved}<span class="text-xs text-theme-button-2">Saved</span>{/if}
				</div>
				{#if canEdit}
					<form method="POST" action="?/saveNotes" use:enhance={() => { notesSaving = true; notesSaved = false; return async ({ update }) => { await update({ reset: false }); notesSaving = false; notesSaved = true; setTimeout(() => { notesSaved = false; }, 3000); }; }} class="flex flex-col gap-2">
						<input type="hidden" name="_csrf" value={csrfToken} />
						<input type="hidden" name="eventId" value={selectedEvent?.id || ''} />
						<textarea name="plannerNotes" bind:value={notesDraft} rows="4" maxlength="5000" placeholder="Guest speakers, large attendance flags, accessibility needs, setup instructions…" class="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-theme-button-2 focus:ring-theme-button-2 resize-y px-4 py-3"></textarea>
						<div class="flex items-center justify-between">
							<span class="text-xs text-gray-400">{notesDraft.length}/5000</span>
							<button type="submit" disabled={notesSaving} class="hub-btn btn-theme-1 px-3 py-1.5 rounded-md text-xs disabled:opacity-50">{notesSaving ? 'Saving…' : 'Save Notes'}</button>
						</div>
					</form>
				{:else if plannerNotes}
					<div class="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{plannerNotes}</div>
				{:else}
					<p class="text-sm text-gray-400 italic">No notes for this event.</p>
				{/if}
			</div>
	{/if}
{/if}

<style>
	/* Minimal table: all text same size, content on one line per cell */
	.planner-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; background: white; }
	.planner-th { padding: 0.5rem 0.75rem; text-align: left; font-weight: 500; color: #6b7280; background: #f9fafb; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
	.planner-th-role { min-width: 140px; max-width: 180px; position: sticky; left: 0; z-index: 10; }
	.planner-th-date { text-align: center; min-width: 100px; }
	.planner-date-weekday { color: #9ca3af; }
	.planner-date-day { font-weight: 600; color: #374151; }
	.planner-team-row { padding: 1rem 0.75rem; font-size: 1rem; font-weight: 600; color: var(--color-button-1, #0284c7); background: var(--color-panel-bg, #f1f5f9); border: none; border-bottom: none; }
	.planner-team-row-other { background: var(--color-panel-bg, #f1f5f9); color: var(--color-button-1, #0284c7); }
	.planner-data-row:hover .planner-role-cell { background: #fafafa; }
	.planner-role-cell { padding: 0.5rem 0.75rem; background: white; border-bottom: 1px solid #f3f4f6; vertical-align: middle; white-space: nowrap; position: sticky; left: 0; z-index: 5; }
	.planner-data-row:nth-child(even) .planner-role-cell { background: #fafafa; }
	.planner-data-row:nth-child(even):hover .planner-role-cell { background: #f3f4f6; }
	.planner-role-name { font-weight: 500; color: #111827; }
	.planner-capacity { color: #9ca3af; margin-left: 0.25rem; }
	.planner-occ-cell { padding: 0.4rem 0.5rem; vertical-align: middle; border-bottom: 1px solid #f3f4f6; border-left: 1px solid #f3f4f6; }
	.planner-occ-inner { display: flex; align-items: center; justify-content: center; flex-wrap: nowrap; gap: 0.35rem; line-height: 1.3; min-height: 1.5em; }
	.planner-assignees { color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
	.planner-badge { flex-shrink: 0; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: 9999px; }
	.planner-badge.badge-full { background: #bbf7d0; color: #166534; }
	.planner-badge.badge-partial { background: #fde68a; color: #92400e; }
	.planner-badge.badge-empty { background: #fecaca; color: #991b1b; }
	.planner-assign-link { flex-shrink: 0; font-weight: 500; color: var(--color-button-1, #0284c7); text-decoration: none; }
	.planner-assign-link:hover { text-decoration: underline; }
	/* Minimal status: very light tint only */
	.planner-occ-cell.cell-full { background: #f0fdf4; }
	.planner-data-row:nth-child(even) .planner-occ-cell.cell-full { background: #ecfdf5; }
	.planner-occ-cell.cell-partial { background: #fffbeb; }
	.planner-data-row:nth-child(even) .planner-occ-cell.cell-partial { background: #fef9c3; }
	.planner-occ-cell.cell-empty { background: #fef2f2; }
	.planner-data-row:nth-child(even) .planner-occ-cell.cell-empty { background: #fee2e2; }
	.print-only { display: none; }
	@media print {
		.no-print { display: none !important; }
		.print-only { display: block !important; }
		.planner-table { font-size: 0.7rem; }
		.planner-th { background: #f3f4f6 !important; color: #374151 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		.planner-team-row, .planner-team-row-other { background: #f1f5f9 !important; color: #0284c7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		.planner-occ-cell.cell-full { background: #dcfce7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		.planner-occ-cell.cell-partial { background: #fef9c3 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		.planner-occ-cell.cell-empty { background: #fee2e2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
		.planner-th-role, .planner-role-cell { position: static !important; }
	}
	@page { size: A4 landscape; margin: 1.2cm; }
</style>
