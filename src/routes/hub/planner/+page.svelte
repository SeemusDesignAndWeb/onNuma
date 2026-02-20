<script>
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { terminology } from '$lib/crm/stores/terminology.js';
	import { notifications, dialog } from '$lib/crm/stores/notifications.js';
	import { formatDateShortUK, formatWeekdayUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: events = data.events || [];
	$: selectedEvent = data.selectedEvent || null;
	$: occurrences = data.occurrences || [];
	$: teamRows = data.teamRows || [];
	$: unlinkedRows = data.unlinkedRows || [];
	$: lists = data.lists || [];
	$: hasRows = teamRows.length > 0 || unlinkedRows.length > 0;
	$: canEdit = data.canEdit ?? true;
	$: csrfToken = data.csrfToken || '';
	$: plannerNotes = data.plannerNotes || '';
	$: availableContacts = data.availableContacts || [];

	let notesDraft = '';
	let notesSaving = false;
	let notesSaved = false;
	$: notesDraft = plannerNotes;

	// Add Assignees modal state
	let showAddAssignees = false;
	let addRotaId = '';
	let addOccurrenceId = '';
	let searchTerm = '';
	let selectedContactIds = new Set();
	let selectedListId = '';
	let guestName = '';

	function sortContacts(arr) {
		return arr.sort((a, b) => {
			const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
			const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
			return aName.localeCompare(bName) || (a.email || '').localeCompare(b.email || '');
		});
	}

	$: contactsFilteredByList = selectedListId
		? (() => {
			const selectedList = lists.find((l) => l.id === selectedListId);
			if (!selectedList || !selectedList.contactIds) return availableContacts;
			return availableContacts.filter((c) => selectedList.contactIds.includes(c.id));
		})()
		: availableContacts;

	$: filteredAvailableContacts = (() => {
		const filtered = searchTerm
			? contactsFilteredByList.filter(
					(c) =>
						`${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
						(c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
				)
			: contactsFilteredByList;
		return sortContacts([...filtered]);
	})();

	function toggleContactSelection(contactId) {
		if (selectedContactIds.has(contactId)) {
			selectedContactIds.delete(contactId);
		} else {
			selectedContactIds.add(contactId);
		}
		selectedContactIds = selectedContactIds;
	}

	function selectAllContacts() {
		filteredAvailableContacts.forEach((c) => selectedContactIds.add(c.id));
		selectedContactIds = selectedContactIds;
	}

	function deselectAllContacts() {
		filteredAvailableContacts.forEach((c) => selectedContactIds.delete(c.id));
		selectedContactIds = selectedContactIds;
	}

	async function handleAddAssignees() {
		if (selectedContactIds.size === 0) {
			await dialog.alert('Please select at least one contact to assign', 'No Contacts Selected');
			return;
		}
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/addAssignee';
		const csrfInput = document.createElement('input');
		csrfInput.type = 'hidden';
		csrfInput.name = '_csrf';
		csrfInput.value = csrfToken;
		form.appendChild(csrfInput);
		const rotaInput = document.createElement('input');
		rotaInput.type = 'hidden';
		rotaInput.name = 'rotaId';
		rotaInput.value = addRotaId;
		form.appendChild(rotaInput);
		const occInput = document.createElement('input');
		occInput.type = 'hidden';
		occInput.name = 'occurrenceId';
		occInput.value = addOccurrenceId;
		form.appendChild(occInput);
		const contactIdsInput = document.createElement('input');
		contactIdsInput.type = 'hidden';
		contactIdsInput.name = 'contactIds';
		contactIdsInput.value = JSON.stringify(Array.from(selectedContactIds));
		form.appendChild(contactIdsInput);
		document.body.appendChild(form);
		form.submit();
	}

	async function handleAddGuest() {
		if (!guestName) {
			await dialog.alert('Please enter a guest name', 'Missing Name');
			return;
		}
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/addAssignee';
		const csrfInput = document.createElement('input');
		csrfInput.type = 'hidden';
		csrfInput.name = '_csrf';
		csrfInput.value = csrfToken;
		form.appendChild(csrfInput);
		const rotaInput = document.createElement('input');
		rotaInput.type = 'hidden';
		rotaInput.name = 'rotaId';
		rotaInput.value = addRotaId;
		form.appendChild(rotaInput);
		const occInput = document.createElement('input');
		occInput.type = 'hidden';
		occInput.name = 'occurrenceId';
		occInput.value = addOccurrenceId;
		form.appendChild(occInput);
		const contactIdsInput = document.createElement('input');
		contactIdsInput.type = 'hidden';
		contactIdsInput.name = 'contactIds';
		contactIdsInput.value = '[]';
		form.appendChild(contactIdsInput);
		const guestInput = document.createElement('input');
		guestInput.type = 'hidden';
		guestInput.name = 'guest';
		guestInput.value = JSON.stringify({ name: guestName });
		form.appendChild(guestInput);
		document.body.appendChild(form);
		form.submit();
	}

	// MyHUB invite modal state
	let showInviteModal = false;
	let inviteRotaId = '';
	let inviteOccurrenceId = '';
	let inviteSearchTerm = '';
	let inviteContactId = '';
	let inviteSending = false;
	let inviteError = null;

	$: inviteFilteredContacts = inviteSearchTerm
		? availableContacts.filter(c =>
				`${c.firstName || ''} ${c.lastName || ''}`.toLowerCase().includes(inviteSearchTerm.toLowerCase()) ||
				(c.email || '').toLowerCase().includes(inviteSearchTerm.toLowerCase())
			)
		: availableContacts;

	$: formResult = $page.form;
	$: if (formResult?.type === 'inviteToMyhub') {
		if (formResult?.message) {
			notifications.success(formResult.message);
			showInviteModal = false;
			inviteContactId = '';
			inviteSearchTerm = '';
			inviteError = null;
			invalidateAll();
		} else if (formResult?.error) {
			inviteError = formResult.error;
		}
	}
	$: if (formResult?.type === 'addAssignee') {
		if (formResult?.message) {
			notifications.success(formResult.message);
			showAddAssignees = false;
			searchTerm = '';
			guestName = '';
			selectedContactIds = new Set();
			selectedListId = '';
			invalidateAll();
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

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

	/** Returns a consistent class for date differentiation (same calendar day = same colour). */
	function slotDateClass(startsAt) {
		if (!startsAt) return 'planner-slot-date-0';
		const d = new Date(startsAt);
		const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
		let h = 0;
		for (let i = 0; i < key.length; i++) h = ((h << 5) - h) + key.charCodeAt(i) | 0;
		const idx = Math.abs(h) % 4;
		return `planner-slot-date-${idx}`;
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
			<!-- Card layout: one card per role, multiple date slots inside with date differentiation -->
			<div class="space-y-6 no-print">
				{#each teamRows as team (team.teamId)}
					<div class="bg-white shadow rounded-lg p-6">
						<div class="flex justify-between items-center mb-4">
							<h3 class="text-xl font-bold text-gray-900" style="color: var(--color-panel-head-1, #0284c7);">{team.teamName}</h3>
						</div>
						<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
							{#each team.roles as role (role.rotaId)}
								<div class="border border-gray-200 rounded-lg p-3 min-w-0 flex flex-col">
									<div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
										<p class="text-xs text-gray-500 font-medium">{role.roleName} ×{role.capacity}</p>
										<a href="/hub/schedules/{role.rotaId}" class="text-xs text-theme-button-1 hover:underline">{$terminology.rota} →</a>
									</div>
									<div class="space-y-3 flex-1">
										{#each occurrences as occ (occ.id)}
											{@const assignees = role.occurrences[occ.id] || []}
											{@const count = assignees.length}
											{@const isFull = role.capacity > 0 && count >= role.capacity}
											<div class="planner-role-slot rounded-md border-l-4 p-2.5 {slotDateClass(occ.startsAt)}">
												<div class="flex justify-between items-center mb-1.5">
													<h4 class="text-sm font-semibold text-gray-900">{formatDateTimeUK(occ.startsAt)}</h4>
													<div class="flex items-center gap-2">
														<span class="text-xs font-medium {isFull ? 'text-hub-red-600' : 'text-gray-700'} w-12">{count}/{role.capacity}</span>
														{#if isFull}
															<span class="text-xs text-hub-red-600 font-medium">Full</span>
														{:else if canEdit}
															<div class="flex items-center gap-1">
																<button
																	type="button"
																	class="bg-theme-button-2 text-white px-2 py-1 rounded text-xs hover:opacity-90 border-0 cursor-pointer"
																	title="Add assignees"
																	on:click={() => { addRotaId = role.rotaId; addOccurrenceId = occ.id; searchTerm = ''; selectedContactIds = new Set(); selectedListId = ''; guestName = ''; showAddAssignees = true; }}
																>
																	+ Add
																</button>
																<button
																	type="button"
																	class="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700 border-0 cursor-pointer"
																	title="Send invitation"
																	on:click={() => { inviteRotaId = role.rotaId; inviteOccurrenceId = occ.id; inviteSearchTerm = ''; inviteContactId = ''; inviteError = null; showInviteModal = true; }}
																>
																	✉ Invite
																</button>
															</div>
														{/if}
													</div>
												</div>
												{#if assignees.length > 0}
													<div class="space-y-1 max-h-32 overflow-y-auto">
														{#each assignees as name}
															<div class="flex items-center justify-between p-1.5 bg-white/60 rounded text-sm">
																<span class="font-medium truncate block text-gray-900" title={name}>{shortName(name)}</span>
															</div>
														{/each}
													</div>
												{:else}
													<p class="text-xs text-gray-400 italic py-1">No assignees</p>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
				{#if unlinkedRows.length > 0}
					<div class="bg-white shadow rounded-lg p-6">
						<div class="flex justify-between items-center mb-4">
							<h3 class="text-xl font-bold text-gray-900" style="color: var(--color-panel-head-1, #0284c7);">Other {$terminology.rota}s</h3>
						</div>
						<div class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
							{#each unlinkedRows as row (row.rotaId)}
								<div class="border border-gray-200 rounded-lg p-3 min-w-0 flex flex-col">
									<div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-100">
										<p class="text-xs text-gray-500 font-medium">{row.roleName} ×{row.capacity}</p>
										<a href="/hub/schedules/{row.rotaId}" class="text-xs text-theme-button-1 hover:underline">{$terminology.rota} →</a>
									</div>
									<div class="space-y-3 flex-1">
										{#each occurrences as occ (occ.id)}
											{@const assignees = row.occurrences[occ.id] || []}
											{@const count = assignees.length}
											{@const isFull = row.capacity > 0 && count >= row.capacity}
											<div class="planner-role-slot rounded-md border-l-4 p-2.5 {slotDateClass(occ.startsAt)}">
												<div class="flex justify-between items-center mb-1.5">
													<h4 class="text-sm font-semibold text-gray-900">{formatDateTimeUK(occ.startsAt)}</h4>
													<div class="flex items-center gap-2">
														<span class="text-xs font-medium {isFull ? 'text-hub-red-600' : 'text-gray-700'} w-12">{count}/{row.capacity}</span>
														{#if isFull}
															<span class="text-xs text-hub-red-600 font-medium">Full</span>
														{:else if canEdit}
															<div class="flex items-center gap-1">
																<button
																	type="button"
																	class="bg-theme-button-2 text-white px-2 py-1 rounded text-xs hover:opacity-90 border-0 cursor-pointer"
																	title="Add assignees"
																	on:click={() => { addRotaId = row.rotaId; addOccurrenceId = occ.id; searchTerm = ''; selectedContactIds = new Set(); selectedListId = ''; guestName = ''; showAddAssignees = true; }}
																>
																	+ Add
																</button>
																<button
																	type="button"
																	class="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700 border-0 cursor-pointer"
																	title="Send invitation"
																	on:click={() => { inviteRotaId = row.rotaId; inviteOccurrenceId = occ.id; inviteSearchTerm = ''; inviteContactId = ''; inviteError = null; showInviteModal = true; }}
																>
																	✉ Invite
																</button>
															</div>
														{/if}
													</div>
												</div>
												{#if assignees.length > 0}
													<div class="space-y-1 max-h-32 overflow-y-auto">
														{#each assignees as name}
															<div class="flex items-center justify-between p-1.5 bg-white/60 rounded text-sm">
																<span class="font-medium truncate block text-gray-900" title={name}>{shortName(name)}</span>
															</div>
														{/each}
													</div>
												{:else}
													<p class="text-xs text-gray-400 italic py-1">No assignees</p>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Print-only: keep table for PDF/print -->
			<div class="print-only overflow-x-auto">
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
											</div>
										</td>
									{/each}
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
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

<!-- Add Assignees Modal -->
{#if showAddAssignees}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 no-print"
		role="button"
		tabindex="0"
		on:click={() => { showAddAssignees = false; searchTerm = ''; guestName = ''; selectedContactIds = new Set(); selectedListId = ''; }}
		on:keydown={(e) => e.key === 'Escape' && (showAddAssignees = false)}
		aria-label="Close modal"
	>
		<div class="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col" on:click|stopPropagation role="dialog" aria-modal="true">
			<div class="p-6 border-b border-gray-200">
				<h3 class="text-xl font-bold text-gray-900 mb-4">Add Assignees</h3>
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-2">Add Guest (not in contacts)</label>
					<div class="flex flex-col sm:flex-row gap-2">
						<input
							type="text"
							bind:value={guestName}
							placeholder="Guest Name *"
							class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
						/>
						<button
							type="button"
							on:click={handleAddGuest}
							disabled={!guestName}
							class="bg-theme-button-1 text-white px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50 text-sm whitespace-nowrap"
						>
							Add Guest
						</button>
					</div>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-4 border-t border-gray-200">
					<div>
						<label for="planner-list-filter" class="block text-sm font-medium text-gray-700 mb-1 text-xs">Filter by List</label>
						<select id="planner-list-filter" bind:value={selectedListId} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm">
							<option value="">All Contacts</option>
							{#each lists as list}
								<option value={list.id}>{list.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="planner-contact-search" class="block text-sm font-medium text-gray-700 mb-1 text-xs">Search Contacts</label>
						<input
							id="planner-contact-search"
							type="text"
							bind:value={searchTerm}
							placeholder="Search contacts..."
							class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-4 text-sm"
						/>
					</div>
				</div>
			</div>
			<div class="flex-1 overflow-y-auto p-6">
				{#if filteredAvailableContacts.length > 0}
					<div class="mb-3 flex justify-between items-center">
						<span class="text-sm text-gray-600">
							Showing {filteredAvailableContacts.length} contact{filteredAvailableContacts.length !== 1 ? 's' : ''}
						</span>
						<div class="flex gap-2">
							<button type="button" on:click={selectAllContacts} class="text-sm text-hub-green-600 hover:text-hub-green-800 underline">
								Select All
							</button>
							<button type="button" on:click={deselectAllContacts} class="text-sm text-gray-600 hover:text-gray-800 underline">
								Deselect All
							</button>
						</div>
					</div>
					<div class="space-y-2">
						{#each filteredAvailableContacts as contact}
							<label class="flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer">
								<input
									type="checkbox"
									checked={selectedContactIds.has(contact.id)}
									on:change={() => toggleContactSelection(contact.id)}
									class="mr-3"
								/>
								<div class="flex-1">
									<div class="font-medium">
										{`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}
									</div>
								</div>
							</label>
						{/each}
					</div>
				{:else}
					<p class="text-gray-500">No available contacts to assign.</p>
				{/if}
			</div>
			<div class="p-6 border-t border-gray-200 flex gap-2 justify-end">
				<button
					type="button"
					on:click={() => { showAddAssignees = false; searchTerm = ''; guestName = ''; selectedContactIds = new Set(); selectedListId = ''; }}
					class="hub-btn bg-theme-button-3 text-white"
				>
					Back
				</button>
				<button
					type="button"
					on:click={handleAddAssignees}
					disabled={selectedContactIds.size === 0}
					class="hub-btn bg-theme-button-2 text-white disabled:opacity-50"
				>
					Add Selected ({selectedContactIds.size})
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- MyHUB Invite Modal (same as Schedules page) -->
{#if showInviteModal}
	<div
		class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 no-print"
		role="dialog"
		aria-modal="true"
		aria-labelledby="invite-modal-title"
	>
		<div class="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
			<h3 id="invite-modal-title" class="text-lg font-bold text-gray-900 mb-2">Invite to MyHub</h3>
			<p class="text-sm text-gray-600 mb-4">
				Send a personal invitation — the volunteer will get an email with a link to respond from their MyHub dashboard.
			</p>
			<form method="POST" action="?/inviteToMyhub" use:enhance={() => {
				inviteSending = true;
				inviteError = null;
				return async ({ update }) => {
					inviteSending = false;
					await update();
				};
			}}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="rotaId" value={inviteRotaId} />
				<input type="hidden" name="occurrenceId" value={inviteOccurrenceId} />

				<div class="mb-3">
					<label for="invite-search" class="block text-sm font-medium text-gray-700 mb-1">Search volunteer</label>
					<input
						id="invite-search"
						type="text"
						placeholder="Name or email…"
						bind:value={inviteSearchTerm}
						class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
					/>
				</div>

				<div class="mb-4 max-h-48 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
					{#each inviteFilteredContacts.slice(0, 50) as contact (contact.id)}
						<label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer {inviteContactId === contact.id ? 'bg-purple-50' : ''}">
							<input type="radio" name="contactId" value={contact.id} bind:group={inviteContactId} class="h-4 w-4 text-purple-600" />
							<span class="text-sm flex-1 min-w-0">
								<span class="font-medium">{contact.firstName || ''} {contact.lastName || ''}</span>
								{#if contact.email}
									<span class="text-gray-400 ml-1 truncate">{contact.email}</span>
								{/if}
							</span>
						</label>
					{/each}
					{#if inviteFilteredContacts.length === 0}
						<p class="text-sm text-gray-500 px-3 py-3 italic">No contacts found</p>
					{/if}
					{#if inviteFilteredContacts.length > 50}
						<p class="text-xs text-gray-400 px-3 py-2">Showing first 50 — type to narrow down</p>
					{/if}
				</div>

				{#if inviteError}
					<p class="text-red-600 text-sm mb-3">{inviteError}</p>
				{/if}

				<div class="flex justify-end gap-3">
					<button
						type="button"
						on:click={() => { showInviteModal = false; inviteError = null; }}
						class="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={!inviteContactId || inviteSending}
						class="px-4 py-2 text-sm text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if inviteSending}Sending…{:else}Send invitation{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	/* Role card slots: date differentiation (same calendar day = same colour) */
	.planner-role-slot { background: #fafafa; }
	.planner-slot-date-0 { border-left-color: #93c5fd; background: #eff6ff; }
	.planner-slot-date-1 { border-left-color: #86efac; background: #f0fdf4; }
	.planner-slot-date-2 { border-left-color: #fcd34d; background: #fffbeb; }
	.planner-slot-date-3 { border-left-color: #f9a8d4; background: #fdf2f8; }

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
