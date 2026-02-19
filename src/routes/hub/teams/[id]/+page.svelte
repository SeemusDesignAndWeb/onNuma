<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { dialog, notifications } from '$lib/crm/stores/notifications.js';
	import { terminology } from '$lib/crm/stores/terminology.js';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: team = data.team || {};
	$: roles = team.roles || [];
	$: rotaOptions = data.rotaOptions || [];
	$: teamLeaders = data.teamLeaders || [];
	$: adminOptions = data.adminOptions || [];
	$: canManage = data.canManage ?? false;
	$: csrfToken = data.csrfToken || '';
	$: schedule = data.schedule || [];
	$: contacts = data.contacts || [];
	$: lists = data.lists || [];
	$: dbsBoltOn = data.dbsBoltOn ?? false;

	$: roleColumns = schedule.length > 0 ? schedule[0].roles : [];

	let editingDetails = false;
	let editName = '';
	let editDescription = '';

	function startEditDetails() {
		editName = team.name || '';
		editDescription = team.description || '';
		editingDetails = true;
	}
	function cancelEditDetails() {
		editingDetails = false;
	}

	let addingRole = false;
	let newRoleName = '';
	let newRoleCapacity = 1;

	const SCHEDULE_HELP_STORAGE_KEY = 'hub_team_schedule_help_dismissed';
	let scheduleHelpDismissed = false;
	$: if (typeof window !== 'undefined' && team.id) {
		scheduleHelpDismissed = localStorage.getItem(SCHEDULE_HELP_STORAGE_KEY + '_' + team.id) === '1';
	}
	function dismissScheduleHelp() {
		if (team.id && typeof window !== 'undefined') {
			localStorage.setItem(SCHEDULE_HELP_STORAGE_KEY + '_' + team.id, '1');
		}
		scheduleHelpDismissed = true;
	}

	function submitAction(action, fields) {
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = action;
		const addInput = (n, v) => {
			const el = document.createElement('input');
			el.type = 'hidden'; el.name = n; el.value = v;
			form.appendChild(el);
		};
		addInput('_csrf', csrfToken);
		for (const [k, v] of Object.entries(fields)) addInput(k, String(v ?? ''));
		document.body.appendChild(form);
		form.submit();
	}

	async function fetchAction(action, fields) {
		const formData = new FormData();
		formData.append('_csrf', csrfToken);
		for (const [k, v] of Object.entries(fields)) formData.append(k, String(v ?? ''));
		try {
			const res = await fetch(action, { method: 'POST', body: formData });
			const result = await res.json();
			let parsed = result;
			if (result?.data) {
				try {
					const arr = JSON.parse(result.data);
					parsed = Array.isArray(arr) ? arr[0] : arr;
				} catch (_) { /* use result as-is */ }
			}
			if (parsed?.error) {
				notifications.error(parsed.error);
				return false;
			}
			await invalidateAll();
			return parsed || true;
		} catch (err) {
			notifications.error(err?.message || 'Something went wrong');
			return false;
		}
	}

	async function confirmDeleteRole(role) {
		const confirmed = await dialog.confirm(
			`Remove "${role.name}" from this team?`,
			`Remove ${$terminology.role}`,
			{ confirmText: 'Remove', cancelText: 'Cancel' }
		);
		if (confirmed) submitAction('?/deleteRole', { roleId: role.id });
	}

	async function confirmRemoveLeader(leader) {
		const confirmed = await dialog.confirm(
			`Remove ${leader.name} as a ${$terminology.team_leader.toLowerCase()} for this team?`,
			`Remove ${$terminology.team_leader}`,
			{ confirmText: 'Remove', cancelText: 'Cancel' }
		);
		if (confirmed) submitAction('?/removeTeamLeader', { adminId: leader.id });
	}

	async function handleRotaChange(roleId, rotaId) {
		await fetchAction('?/linkRota', { roleId, rotaId: rotaId || '' });
	}

	$: pastRoleMap = data.pastRoleMap || {};

	// --- Assign modal state (same pattern as rota page) ---
	let showAddAssignees = false;
	let assignContext = null; // { rotaId, occurrenceId, roleName, dateName }
	let searchTerm = '';
	let guestName = '';
	let selectedContactIds = new Set();
	let selectedListId = '';
	let assignSubmitting = false;
	let includePastRole = false;

	function sortContacts(arr) {
		return arr.sort((a, b) => {
			const aFirst = (a.firstName || '').toLowerCase();
			const bFirst = (b.firstName || '').toLowerCase();
			const aLast = (a.lastName || '').toLowerCase();
			const bLast = (b.lastName || '').toLowerCase();
			if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
			return aLast.localeCompare(bLast);
		});
	}

	$: contactsFilteredByList = selectedListId
		? (() => {
			const list = lists.find(l => l.id === selectedListId);
			if (!list || !list.contactIds) return contacts;
			return contacts.filter(c => list.contactIds.includes(c.id));
		})()
		: contacts;

	$: currentPastRoleIds = assignContext?.rotaId ? (pastRoleMap[assignContext.rotaId] || []) : [];
	$: currentPastRoleIdSet = new Set(currentPastRoleIds);

	$: filteredAvailableContacts = (() => {
		let base = contactsFilteredByList;
		if (includePastRole && currentPastRoleIds.length > 0) {
			base = base.filter(c => currentPastRoleIdSet.has(c.id));
		}
		const filtered = searchTerm
			? base.filter(c =>
				(c.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
				(c.lastName || '').toLowerCase().includes(searchTerm.toLowerCase())
			)
			: base;
		return sortContacts([...filtered]);
	})();

	function openAssignModal(rotaId, occurrenceId, roleName, dateName) {
		assignContext = { rotaId, occurrenceId, roleName, dateName };
		searchTerm = '';
		guestName = '';
		selectedListId = '';
		selectedContactIds = new Set();
		includePastRole = false;
		showAddAssignees = true;
	}

	function closeAssignModal() {
		showAddAssignees = false;
		assignContext = null;
		searchTerm = '';
		guestName = '';
		selectedContactIds = new Set();
		selectedListId = '';
	}

	function toggleContactSelection(contactId) {
		if (selectedContactIds.has(contactId)) {
			selectedContactIds.delete(contactId);
		} else {
			selectedContactIds.add(contactId);
		}
		selectedContactIds = selectedContactIds;
	}

	function selectAllContacts() {
		filteredAvailableContacts.forEach(c => selectedContactIds.add(c.id));
		selectedContactIds = selectedContactIds;
	}

	function deselectAllContacts() {
		filteredAvailableContacts.forEach(c => selectedContactIds.delete(c.id));
		selectedContactIds = selectedContactIds;
	}

	async function handleAddAssignees() {
		if (!assignContext || selectedContactIds.size === 0) return;
		assignSubmitting = true;
		let successCount = 0;
		for (const contactId of selectedContactIds) {
			const result = await fetchAction('?/addAssignee', {
				rotaId: assignContext.rotaId,
				occurrenceId: assignContext.occurrenceId,
				contactId
			});
			if (result) {
				successCount++;
				if (result.warning) notifications.warning(result.warning);
			}
		}
		assignSubmitting = false;
		if (successCount > 0) {
			notifications.success(`${successCount} person${successCount !== 1 ? 's' : ''} assigned`);
		}
		closeAssignModal();
	}

	async function handleAddGuest() {
		if (!guestName) {
			await dialog.alert('Please enter a guest name', 'Missing Name');
			return;
		}
		if (!assignContext) return;
		assignSubmitting = true;
		const result = await fetchAction('?/addAssignee', {
			rotaId: assignContext.rotaId,
			occurrenceId: assignContext.occurrenceId,
			contactId: '',
			guestName
		});
		assignSubmitting = false;
		if (result) {
			notifications.success('Guest added');
			if (result.warning) notifications.warning(result.warning);
			guestName = '';
		}
	}

	async function confirmRemoveAssignee(assignee, roleName, rotaId, occurrenceId) {
		const confirmed = await dialog.confirm(
			`Remove ${assignee.name} from ${roleName}?`,
			'Remove assignee',
			{ confirmText: 'Remove', cancelText: 'Cancel' }
		);
		if (confirmed) {
			const ok = await fetchAction('?/removeAssignee', { rotaId, occurrenceId, contactId: assignee.contactId });
			if (ok) notifications.success('Person removed successfully');
		}
	}

	function statusClass(role) {
		if (role.filledCount === 0) return 'bg-red-100 text-red-700';
		if (role.isFull) return 'bg-green-100 text-green-700';
		return 'bg-amber-100 text-amber-700';
	}

	function statusLabel(role) {
		if (role.filledCount === 0) return 'Empty';
		if (role.isFull) return 'Full';
		return `${role.filledCount}/${role.capacity}`;
	}

	function getRoleForOccurrence(occurrenceId, roleId) {
		const entry = schedule.find(s => s.occurrence.id === occurrenceId);
		if (!entry) return null;
		return entry.roles.find(r => r.roleId === roleId) || null;
	}

	function formatShortDate(dateStr) {
		const d = new Date(dateStr);
		return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
	}

	// Date pagination: show 3 dates at a time
	const DATES_PER_PAGE = 3;
	let datePage = 0;
	$: totalDatePages = schedule.length > 0 ? Math.max(1, Math.ceil(schedule.length / DATES_PER_PAGE)) : 0;
	$: visibleSchedule = schedule.length > 0
		? schedule.slice(datePage * DATES_PER_PAGE, datePage * DATES_PER_PAGE + DATES_PER_PAGE)
		: [];
	function prevDates() {
		if (datePage > 0) datePage -= 1;
	}
	function nextDates() {
		if (datePage < totalDatePages - 1) datePage += 1;
	}
</script>

<div class="mb-5">
	<a href="/hub/teams" class="text-sm text-theme-button-1 hover:underline">
		← {$terminology.team}s
	</a>
</div>

<!-- Team name header -->
<div class="mb-4">
	<h1 class="text-xl font-bold">{team.name}</h1>
	{#if team.description}
		<p class="text-sm text-gray-500 mt-1">{team.description}</p>
	{/if}
</div>

<!-- Instructional text (dismissible, state remembered per team) -->
{#if !scheduleHelpDismissed}
	<div class="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 relative">
		<button
			type="button"
			on:click={dismissScheduleHelp}
			class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded text-blue-600 hover:text-blue-800 hover:bg-blue-100 transition-colors text-lg font-bold leading-none"
			aria-label="Close"
		>
			×
		</button>
		{#if schedule.length > 0}
			<p class="text-sm text-blue-800 pr-24">
				This is the schedule for <strong>{team.name}</strong>. Each column shows a role and who is assigned at each date.
				{#if canManage}
					Click <strong>+ Assign</strong> on any empty slot to add someone, or click the <strong>×</strong> to remove them.
				{/if}
			</p>
			<p class="text-xs text-blue-600 mt-1.5">
				Green = fully staffed. Amber = partially filled. Red = no one assigned yet.
			</p>
		{:else if roles.some(r => r.rotaId)}
			<p class="text-sm text-blue-800 pr-24">
				There are no upcoming dates for this team's linked {$terminology.rota.toLowerCase()}s. Once the event has future occurrences, the schedule will appear here automatically.
			</p>
		{:else}
			<p class="text-sm text-blue-800 pr-24">
				This team doesn't have any roles linked to {$terminology.rota.toLowerCase()}s yet.
				{#if canManage}
					Open the <strong>{$terminology.team} Configuration</strong> section below to add roles and link them to existing {$terminology.rota.toLowerCase()}s.
				{/if}
			</p>
		{/if}
	</div>
{/if}

<!-- ============================================================ -->
<!-- SECTION 1: SCHEDULE — Column per role, wrapping grid          -->
<!-- ============================================================ -->
{#if schedule.length > 0 && roleColumns.length > 0}
	<!-- Date pagination: show 3 dates at a time -->
	{#if totalDatePages > 1}
		<div class="mb-3 flex items-center justify-between gap-2">
			<button
				type="button"
				on:click={prevDates}
				disabled={datePage === 0}
				class="hub-btn btn-theme-light-3 px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
			>
				← Previous dates
			</button>
			<span class="text-sm text-gray-600">
				Dates {datePage * DATES_PER_PAGE + 1}–{Math.min((datePage + 1) * DATES_PER_PAGE, schedule.length)} of {schedule.length}
			</span>
			<button
				type="button"
				on:click={nextDates}
				disabled={datePage >= totalDatePages - 1}
				class="hub-btn btn-theme-light-3 px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
			>
				Next dates →
			</button>
		</div>
	{/if}
	<div class="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
		{#each roleColumns as col (col.roleId)}
			<div class="hub-top-panel overflow-hidden flex flex-col">
				<!-- Column header: role name (theme panel head) -->
				<div class="px-4 py-3 bg-theme-panel-head-1 flex items-center gap-2">
					<span class="font-semibold text-white text-sm truncate">{col.roleName}</span>
					<span class="text-xs text-white/80 bg-white/20 px-1.5 py-0.5 rounded">×{col.capacity}</span>
					{#if col.rotaId}
						<a href="/hub/schedules/{col.rotaId}" class="ml-auto text-xs text-white/90 hover:text-white hover:underline flex-shrink-0">
							{$terminology.rota} →
						</a>
					{/if}
				</div>

				{#if !col.rotaId}
					<div class="px-4 py-6 text-xs text-gray-400 italic text-center">
						No {$terminology.rota.toLowerCase()} linked — <a href="#config" class="underline text-theme-button-1">configure below</a>
					</div>
				{:else}
					<!-- One section per occurrence date (visible page only) -->
					<div class="flex-1 divide-y divide-gray-100">
						{#each visibleSchedule as entry (entry.occurrence.id)}
							{@const role = getRoleForOccurrence(entry.occurrence.id, col.roleId)}
							<div class="px-4 py-3">
								<div class="flex items-center justify-between mb-1.5">
									<span class="text-xs font-medium text-gray-500">{formatShortDate(entry.occurrence.startsAt)}</span>
									{#if role}
										<span class="text-[10px] px-1.5 py-0.5 rounded font-medium {statusClass(role)}">
											{statusLabel(role)}
										</span>
									{/if}
								</div>

								{#if role}
									<div class="space-y-0.5">
										{#each role.assignees as assignee}
											<div class="flex items-center gap-1.5 group">
												<span class="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
												<span class="text-sm text-gray-700 flex-1 truncate">{assignee.name}</span>
												{#if canManage}
													<button
														type="button"
														class="text-xs text-gray-300 hover:text-red-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
														title="Remove"
														on:click={() => confirmRemoveAssignee(assignee, col.roleName, col.rotaId, entry.occurrence.id)}
													>×</button>
												{/if}
											</div>
										{/each}

										{#each Array(Math.max(0, role.capacity - role.filledCount)) as _, i}
											<div class="flex items-center gap-1.5">
												<span class="w-1.5 h-1.5 rounded-full bg-gray-200 flex-shrink-0"></span>
												<span class="text-xs text-gray-300 italic flex-1">Unassigned</span>
											</div>
										{/each}
									</div>

									{#if canManage && !role.isFull}
										<button
											type="button"
											class="mt-1.5 text-xs font-medium text-theme-button-1 hover:underline"
											on:click={() => openAssignModal(col.rotaId, entry.occurrence.id, col.roleName, formatShortDate(entry.occurrence.startsAt))}
										>+ Assign</button>
									{/if}
								{:else}
									<p class="text-xs text-gray-300 italic">—</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{:else if roles.some(r => r.rotaId)}
	<div class="hub-top-panel p-6 mb-8 text-center">
		<p class="text-sm text-gray-400">No upcoming occurrences found for the linked {$terminology.rota.toLowerCase()}s.</p>
	</div>
{:else}
	<div class="hub-top-panel p-6 mb-8 text-center">
		<p class="text-sm text-gray-400">
			No {$terminology.role.toLowerCase()}s have linked {$terminology.rota.toLowerCase()}s yet.
			Link {$terminology.rota.toLowerCase()}s in the configuration below to see the schedule.
		</p>
	</div>
{/if}

<!-- ============================================================ -->
<!-- ASSIGN MODAL (identical to rota page)                         -->
<!-- ============================================================ -->
{#if showAddAssignees}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="button" tabindex="0" on:click={() => { showAddAssignees = false; searchTerm = ''; guestName = ''; selectedContactIds = new Set(); selectedListId = ''; }} on:keydown={(e) => e.key === 'Escape' && (showAddAssignees = false)} aria-label="Close modal">
		<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions a11y-no-noninteractive-element-interactions -->
		<div class="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col" on:click|stopPropagation role="dialog" aria-modal="true">
			<!-- Header (fixed) -->
			<div class="p-6 border-b border-gray-200">
				<h3 class="text-xl font-bold mb-4">Add Assignees{#if assignContext?.roleName} – {assignContext.roleName}{#if assignContext?.dateName} ({assignContext.dateName}){/if}{/if}</h3>

				<!-- Guest option first (Hub only) -->
				<div class="mb-4">
					<!-- svelte-ignore a11y-label-has-associated-control -->
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
							disabled={!guestName || assignSubmitting}
							class="hub-btn btn-theme-1 px-4 py-2 rounded-md text-sm whitespace-nowrap disabled:opacity-50"
						>
							Add Guest
						</button>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end pt-4 border-t border-gray-200">
					<div>
						<label for="list-filter" class="block text-sm font-medium text-gray-700 mb-1 text-xs">Filter by List</label>
						<select id="list-filter" bind:value={selectedListId} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm">
							<option value="">All Contacts</option>
							{#each lists as list}
								<option value={list.id}>{list.name}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="contact-search" class="block text-sm font-medium text-gray-700 mb-1 text-xs">Search Contacts</label>
						<input
							id="contact-search"
							type="text"
							bind:value={searchTerm}
							placeholder="Search contacts..."
							class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-4 text-sm"
						/>
					</div>
				</div>
				{#if currentPastRoleIds.length > 0}
					<label class="flex items-center gap-2 mt-3 text-sm text-gray-600 cursor-pointer">
						<input type="checkbox" bind:checked={includePastRole} class="rounded border-gray-300 text-theme-button-1 focus:ring-theme-button-1" />
						Include people who've served in this role elsewhere ({currentPastRoleIds.length})
					</label>
				{/if}
			</div>

			<!-- Scrollable content area -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if filteredAvailableContacts.length > 0}
					<div class="mb-3 flex justify-between items-center">
						<span class="text-sm text-gray-600">
							Showing {filteredAvailableContacts.length} contact{filteredAvailableContacts.length !== 1 ? 's' : ''}
						</span>
						<div class="flex gap-2">
							<button
								on:click={selectAllContacts}
								class="text-sm text-theme-button-2 hover:opacity-80 underline"
							>
								Select All
							</button>
							<button
								on:click={deselectAllContacts}
								class="text-sm text-gray-600 hover:text-gray-800 underline"
							>
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
										{`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || contact.name}
									</div>
								</div>
							</label>
						{/each}
					</div>
				{:else}
					<p class="text-gray-500">No available contacts to assign.</p>
				{/if}
			</div>

			<!-- Footer with buttons (fixed at bottom) -->
			<div class="p-6 border-t border-gray-200 flex gap-2 justify-end">
				<button
					on:click={() => {
						showAddAssignees = false;
						searchTerm = '';
						guestName = '';
						selectedContactIds = new Set();
						selectedListId = '';
					}}
					class="hub-btn bg-theme-button-3 text-white"
				>
					Back
				</button>
				<button
					on:click={handleAddAssignees}
					disabled={selectedContactIds.size === 0 || assignSubmitting}
					class="hub-btn bg-theme-button-2 text-white disabled:opacity-50"
				>
					{#if assignSubmitting}
						Assigning…
					{:else}
						Add Selected ({selectedContactIds.size})
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ============================================================ -->
<!-- SECTION 2: CONFIGURATION (collapsible)                        -->
<!-- ============================================================ -->
<details id="config">
	<summary class="cursor-pointer select-none mb-4">
		<span class="text-base font-semibold text-theme-panel-head-1 hover:opacity-80">
			{$terminology.team} Configuration
		</span>
		<span class="text-xs text-gray-400 ml-2">(click to expand)</span>
	</summary>

	<p class="text-sm text-gray-500 mb-4">
		Edit the team name, add or remove roles, link roles to {$terminology.rota.toLowerCase()}s, and manage {$terminology.team_leader.toLowerCase()}s.
		Changes here affect which {$terminology.rota.toLowerCase()}s appear in the schedule above.
	</p>

	<!-- Row 1: Team details only, no header, compact -->
	<div class="hub-top-panel overflow-hidden mb-4">
		{#if editingDetails}
			<form method="POST" action="?/updateDetails" class="px-4 py-3 flex flex-col sm:flex-row sm:items-end gap-3">
				<input type="hidden" name="_csrf" value={csrfToken} />
				<div class="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<label class="block text-xs font-medium text-gray-500 mb-0.5" for="editTeamName">Name</label>
						<input
							id="editTeamName"
							type="text"
							name="name"
							bind:value={editName}
							required
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-3 py-1.5 text-sm"
						/>
					</div>
					<div>
						<label class="block text-xs font-medium text-gray-500 mb-0.5" for="editTeamDesc">Description</label>
						<input
							id="editTeamDesc"
							type="text"
							name="description"
							bind:value={editDescription}
							placeholder="Optional"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-3 py-1.5 text-sm"
						/>
					</div>
				</div>
				<div class="flex gap-2 flex-shrink-0">
					<button type="submit" class="btn-theme-2 px-3 py-1.5 rounded-md text-sm">Save</button>
					<button type="button" class="btn-theme-3 px-3 py-1.5 rounded-md text-sm" on:click={cancelEditDetails}>Cancel</button>
				</div>
			</form>
		{:else}
			<div class="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-2">
				<div class="min-w-0">
					<span class="font-semibold text-gray-900">{team.name}</span>
					{#if team.description}
						<span class="text-gray-500 text-sm ml-2">— {team.description}</span>
					{:else if canManage}
						<span class="text-gray-400 text-sm italic ml-2">No description. <button type="button" class="underline text-theme-button-1 not-italic" on:click={startEditDetails}>Add one</button></span>
					{/if}
				</div>
				{#if canManage}
					<button type="button" class="text-sm text-theme-button-1 hover:underline flex-shrink-0" on:click={startEditDetails}>Edit</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Row 2: Roles 2/3, Team Leaders 1/3 -->
	<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
		<!-- Roles section (2/3 when Leaders shown, full width otherwise) -->
		<div class="hub-top-panel overflow-hidden flex flex-col min-h-0 {canManage || teamLeaders.length > 0 ? 'lg:col-span-2' : ''}">
		<div class="px-5 py-3 bg-theme-panel-head-1 rounded-t-lg flex items-center justify-between">
			<h2 class="config-panel-heading text-base font-semibold text-white">{$terminology.role}s</h2>
			{#if canManage}
				<button
					type="button"
					class="text-xs text-white hover:opacity-90 underline"
					on:click={() => (addingRole = !addingRole)}
				>
					{addingRole ? 'Cancel' : `+ Add ${$terminology.role}`}
				</button>
			{/if}
		</div>

		{#if roles.length === 0 && !addingRole}
			<div class="px-5 py-6 text-sm text-gray-400 text-center">
				No {$terminology.role.toLowerCase()}s yet.
				{#if canManage}
					<button type="button" class="underline text-theme-button-1" on:click={() => (addingRole = true)}>
						Add the first one
					</button>
				{/if}
			</div>
		{:else}
			<div class="divide-y divide-gray-100 overflow-y-auto max-h-96 flex-1 min-h-0">
				{#each roles as role (role.id)}
					<div class="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
						<div class="flex-1 min-w-0">
							<span class="font-medium text-gray-900 text-sm">{role.name}</span>
							<span class="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
								×{role.capacity}
							</span>
						</div>
						{#if dbsBoltOn && canManage}
							<form method="POST" action="?/setRoleDbsRequired" use:enhance class="flex items-center gap-1.5 flex-shrink-0">
								<input type="hidden" name="_csrf" value={csrfToken} />
								<input type="hidden" name="roleId" value={role.id} />
								<label class="flex items-center gap-1.5 cursor-pointer text-xs text-gray-600">
									<input type="checkbox" name="dbsRequired" checked={role.dbsRequired} on:change={(e) => e.currentTarget.form?.submit()} class="rounded border-gray-300 text-theme-button-2 focus:ring-theme-button-2" />
									<span>DBS required</span>
								</label>
							</form>
						{:else if dbsBoltOn && role.dbsRequired}
							<span class="text-xs text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">DBS required</span>
						{/if}
						<div class="flex items-center gap-2 sm:w-72 flex-shrink-0">
							{#if canManage}
								<select
									class="flex-1 rounded-md border-gray-300 text-sm py-1.5 pl-2 pr-8 focus:border-theme-button-2 focus:ring-theme-button-2 text-gray-600"
									title="Link to a {$terminology.rota.toLowerCase()}"
									on:change={(e) => handleRotaChange(role.id, e.currentTarget.value)}
								>
									<option value="">— No linked {$terminology.rota.toLowerCase()} —</option>
									{#each rotaOptions as rota}
										<option value={rota.id} selected={role.rotaId === rota.id}>{rota.label}</option>
									{/each}
								</select>
							{:else if role.rotaId}
								<span class="text-xs text-gray-500">
									{rotaOptions.find(r => r.id === role.rotaId)?.label || 'Linked ' + $terminology.rota.toLowerCase()}
								</span>
							{:else}
								<span class="text-xs text-gray-400">No linked {$terminology.rota.toLowerCase()}</span>
							{/if}
							{#if canManage}
								<button
									type="button"
									class="w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-600 hover:bg-red-50 font-bold text-lg flex-shrink-0"
									title="Remove {$terminology.role.toLowerCase()}"
									on:click={() => confirmDeleteRole(role)}
								>×</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if canManage && addingRole}
			<form
				method="POST"
				action="?/addRole"
				class="px-5 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2 items-end"
			>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<div class="flex-1">
					<label class="block text-xs font-medium text-gray-600 mb-1" for="newRoleName">
						{$terminology.role} name
					</label>
					<input
						id="newRoleName"
						type="text"
						name="roleName"
						bind:value={newRoleName}
						required
						placeholder="e.g. Greeter"
						class="w-full rounded-md border-gray-300 shadow-sm text-sm px-[18px] py-2 focus:border-theme-button-2 focus:ring-theme-button-2"
					/>
				</div>
				<div class="w-24 flex-shrink-0">
					<label class="block text-xs font-medium text-gray-600 mb-1" for="newRoleCapacity">Capacity</label>
					<input
						id="newRoleCapacity"
						type="number"
						name="capacity"
						bind:value={newRoleCapacity}
						min="1"
						max="99"
						class="w-full rounded-md border-gray-300 shadow-sm text-sm px-[18px] py-2 focus:border-theme-button-2 focus:ring-theme-button-2"
					/>
				</div>
				{#if dbsBoltOn}
					<label class="flex items-center gap-2 text-xs text-gray-600 flex-shrink-0">
						<input type="checkbox" name="dbsRequired" class="rounded border-gray-300 text-theme-button-2 focus:ring-theme-button-2" />
						<span>DBS required</span>
					</label>
				{/if}
				<button type="submit" class="btn-theme-2 px-3 py-2 rounded-md text-sm flex-shrink-0">
					Add {$terminology.role}
				</button>
			</form>
		{/if}
		</div>

		<!-- Team Leaders section (1/3) -->
		{#if canManage || teamLeaders.length > 0}
		<div class="hub-top-panel overflow-hidden flex flex-col min-h-0 lg:col-span-1">
			<div class="px-5 py-3 bg-theme-panel-head-2 rounded-t-lg">
				<h2 class="config-panel-heading text-base font-semibold text-white">{$terminology.team_leader}s</h2>
			</div>

			{#if teamLeaders.length === 0}
				<div class="px-5 py-4 text-sm text-gray-400">
					No {$terminology.team_leader.toLowerCase()}s assigned yet.
				</div>
			{:else}
				<ul class="divide-y divide-gray-100">
					{#each teamLeaders as leader (leader.id)}
						<li class="px-5 py-3 flex items-center justify-between gap-4">
							<div class="min-w-0">
								<span class="text-sm font-medium text-gray-900">{leader.name}</span>
								{#if leader.name !== leader.email}
									<span class="text-xs text-gray-400 ml-2">{leader.email}</span>
								{/if}
							</div>
							{#if canManage}
								<button
									type="button"
									class="text-xs text-red-500 hover:text-red-700 hover:underline flex-shrink-0"
									on:click={() => confirmRemoveLeader(leader)}
								>Remove</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			{#if canManage && adminOptions.length > 0}
				<form
					method="POST"
					action="?/addTeamLeader"
					class="px-5 py-4 border-t border-gray-100 flex gap-2 items-end"
				>
					<input type="hidden" name="_csrf" value={csrfToken} />
					<div class="flex-1">
						<label class="block text-xs font-medium text-gray-600 mb-1" for="addLeaderSelect">
							Assign {$terminology.team_leader}
						</label>
						<select
							id="addLeaderSelect"
							name="adminId"
							required
							class="w-full rounded-md border-gray-300 shadow-sm text-sm py-2 pl-2 pr-8 focus:border-theme-button-2 focus:ring-theme-button-2"
						>
							<option value="">Select an admin…</option>
							{#each adminOptions as opt}
								<option value={opt.id}>{opt.name}</option>
							{/each}
						</select>
					</div>
					<button type="submit" class="btn-theme-1 px-3 py-2 rounded-md text-sm flex-shrink-0">Assign</button>
				</form>
			{:else if canManage && adminOptions.length === 0 && teamLeaders.length > 0}
				<p class="px-5 pb-4 text-xs text-gray-400">
					All available admins are already assigned as {$terminology.team_leader.toLowerCase()}s.
				</p>
			{/if}
		</div>
	{/if}
	</div>
</details>

<style>
	/* Override hub.css .crm-shell-main h2 so panel header titles stay white on blue background */
	.config-panel-heading {
		color: white !important;
	}
</style>
