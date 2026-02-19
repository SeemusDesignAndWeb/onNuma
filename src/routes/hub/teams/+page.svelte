<script>
	import { page } from '$app/stores';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { terminology } from '$lib/crm/stores/terminology.js';

	$: data = $page.data || {};
	$: teams = data.teams || [];
	$: templates = data.templates || [];
	$: canManage = data.canManage ?? false;
	$: csrfToken = data.csrfToken || '';

	$: templatesByCategory = templates.reduce((acc, t) => {
		if (!acc[t.category]) acc[t.category] = [];
		acc[t.category].push(t);
		return acc;
	}, {});

	let showCreateForm = false;
	let newName = '';
	let newDescription = '';
	let selectedTemplate = null;
	let rolesJson = '';

	const TEAMS_HELP_STORAGE_KEY = 'hub_teams_list_help_dismissed';
	let teamsHelpDismissed = false;
	$: if (typeof window !== 'undefined') {
		teamsHelpDismissed = localStorage.getItem(TEAMS_HELP_STORAGE_KEY) === '1';
	}
	function dismissTeamsHelp() {
		if (typeof window !== 'undefined') {
			localStorage.setItem(TEAMS_HELP_STORAGE_KEY, '1');
		}
		teamsHelpDismissed = true;
	}

	function selectTemplate(tmpl) {
		selectedTemplate = tmpl;
		newName = tmpl.name;
		newDescription = tmpl.description;
		rolesJson = JSON.stringify(tmpl.roles);
		showCreateForm = true;
	}

	function openBlankForm() {
		selectedTemplate = null;
		newName = '';
		newDescription = '';
		rolesJson = '';
		showCreateForm = true;
	}

	function cancelCreate() {
		showCreateForm = false;
		selectedTemplate = null;
		newName = '';
		newDescription = '';
		rolesJson = '';
	}

	async function confirmDelete(team) {
		const confirmed = await dialog.confirm(
			`Delete team "${team.name}"? This will remove all team leader assignments and unlink any associated schedules. This cannot be undone.`,
			'Delete Team',
			{ confirmText: 'Delete', cancelText: 'Cancel' }
		);
		if (!confirmed) return;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/delete';
		const addInput = (n, v) => {
			const el = document.createElement('input');
			el.type = 'hidden'; el.name = n; el.value = v;
			form.appendChild(el);
		};
		addInput('_csrf', csrfToken);
		addInput('teamId', team.id);
		document.body.appendChild(form);
		form.submit();
	}
</script>

<div class="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold">{$terminology.team}s</h2>
	{#if canManage && !showCreateForm}
		<button
			type="button"
			class="btn-theme-2 px-2.5 py-1.5 rounded-md text-xs self-start sm:self-auto"
			on:click={openBlankForm}
		>
			+ New {$terminology.team}
		</button>
	{/if}
</div>

{#if !teamsHelpDismissed}
	<div class="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 relative">
		<button
			type="button"
			on:click={dismissTeamsHelp}
			class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded text-blue-600 hover:text-blue-800 hover:bg-blue-100 transition-colors text-lg font-bold leading-none"
			aria-label="Close"
		>
			×
		</button>
		<p class="text-sm text-blue-800 pr-24">
			{$terminology.team}s group related roles together for an event — for example, a <strong>Welcome {$terminology.team}</strong> might
			include a Leader, Greeters and a Door Steward. Each role is linked to a {$terminology.rota.toLowerCase()}, and the team page shows you
			who is serving at each upcoming date at a glance.
		</p>
		{#if canManage}
			<p class="text-sm text-blue-700 mt-2 pr-24">
				To get started: create a team, add the roles you need, then link each role to an existing {$terminology.rota.toLowerCase()}.
				You can use a template to pre-fill common roles, or start from scratch.
			</p>
		{/if}
	</div>
{/if}

{#if canManage && showCreateForm}
	<div class="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
		<div class="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
			<h3 class="text-base font-semibold text-gray-900">New {$terminology.team}</h3>
			<button type="button" class="text-sm text-gray-400 hover:text-gray-600" on:click={cancelCreate}>✕</button>
		</div>

		{#if !selectedTemplate}
			<div class="px-5 pt-4 pb-2">
				<p class="text-sm text-gray-500 mb-3">Start from a template, or fill in the form below.</p>
				{#each Object.entries(templatesByCategory) as [category, catTemplates]}
					<div class="mb-4">
						<p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{category}</p>
						<div class="flex flex-wrap gap-2">
							{#each catTemplates as tmpl}
								<button
									type="button"
									class="px-3 py-1.5 text-xs rounded-md border border-gray-300 bg-gray-50 hover:bg-theme-button-1 hover:text-white hover:border-theme-button-1 transition-colors text-gray-700"
									on:click={() => selectTemplate(tmpl)}
								>{tmpl.name}</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<div class="border-t border-gray-100 mx-5 mb-4"></div>
		{:else}
			<div class="px-5 pt-4 pb-2 flex items-center gap-2 text-sm flex-wrap">
				<span class="text-gray-500">Template:</span>
				<strong class="text-gray-800">{selectedTemplate.name}</strong>
				<span class="text-gray-300">·</span>
				<span class="text-xs text-gray-500">{selectedTemplate.roles?.length ?? 0} {$terminology.role.toLowerCase()}s pre-loaded</span>
				<button
					type="button"
					class="ml-auto text-xs text-theme-button-1 underline"
					on:click={() => { selectedTemplate = null; rolesJson = ''; }}
				>Change template</button>
			</div>
		{/if}

		<form method="POST" action="?/create" class="px-5 pb-5 pt-2 space-y-3">
			<input type="hidden" name="_csrf" value={csrfToken} />
			{#if rolesJson}
				<input type="hidden" name="roles" value={rolesJson} />
			{/if}
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="newTeamName">Name</label>
				<input
					id="newTeamName"
					type="text"
					name="name"
					bind:value={newName}
					required
					placeholder="{$terminology.team} name"
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-[18px] py-2.5 text-sm"
				/>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1" for="newTeamDesc">
					Description <span class="font-normal text-gray-400">(optional)</span>
				</label>
				<input
					id="newTeamDesc"
					type="text"
					name="description"
					bind:value={newDescription}
					placeholder="Brief description of this team's purpose"
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-[18px] py-2.5 text-sm"
				/>
			</div>
			<div class="flex gap-2 pt-1">
				<button type="submit" class="btn-theme-2 px-3 py-1.5 rounded-md text-sm">
					Create {$terminology.team}
				</button>
				<button type="button" class="btn-theme-3 px-3 py-1.5 rounded-md text-sm" on:click={cancelCreate}>
					Cancel
				</button>
			</div>
		</form>
	</div>
{/if}

{#if teams.length === 0}
	<div class="text-center py-14 text-gray-400">
		<svg class="mx-auto mb-3 w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
		<p class="text-base font-medium text-gray-500">No {$terminology.team.toLowerCase()}s yet</p>
		{#if canManage}
			<p class="text-sm mt-1">Click "New {$terminology.team}" above to create your first team.</p>
		{/if}
	</div>
{:else}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each teams as team (team.id)}
			<div class="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative group">
				<a href="/hub/teams/{team.id}" class="block">
					<h3 class="text-base font-semibold text-gray-900 mb-1 pr-8">{team.name}</h3>
					{#if team.description}
						<p class="text-sm text-gray-500 mb-3 overflow-hidden max-h-10">{team.description}</p>
					{/if}
					<div class="flex flex-wrap gap-3 text-xs text-gray-400 mt-2">
						<span>
							{(team.roles || []).length}
							{$terminology.role.toLowerCase()}{(team.roles || []).length !== 1 ? 's' : ''}
						</span>
						{#if (team.teamLeaderIds || []).length > 0}
							<span>
								{team.teamLeaderIds.length}
								{$terminology.team_leader.toLowerCase()}{team.teamLeaderIds.length !== 1 ? 's' : ''}
							</span>
						{/if}
					</div>
				</a>
				{#if canManage}
					<button
						type="button"
						title="Delete {$terminology.team.toLowerCase()}"
						class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all font-bold text-lg"
						on:click|preventDefault|stopPropagation={() => confirmDelete(team)}
					>×</button>
				{/if}
			</div>
		{/each}
	</div>
{/if}
