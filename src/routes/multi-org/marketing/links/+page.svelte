<script>
	import { enhance } from '$app/forms';

	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: links = data?.links || [];
	$: organisations = data?.organisations || [];

	let showAdd = false;
	let editId = null;
	let newScope = 'global';
</script>

<svelte:head>
	<title>Links Library – Marketing – OnNuma</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold text-slate-800">Links Library</h1>
		<p class="mt-1 text-sm text-slate-500">Manage URLs referenced in emails via {'{{link:key}}'}. If a link changes, all emails update automatically.</p>
	</div>
	<button on:click={() => showAdd = !showAdd} class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-amber-500 hover:bg-amber-600 transition-all">
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
		Add Link
	</button>
</div>

{#if form?.success}
	<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">Saved.</div>
{/if}
{#if form?.error}
	<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>
{/if}

{#if showAdd}
	<div class="mb-6 bg-amber-50 rounded-2xl border border-amber-200 p-4">
		<h3 class="font-semibold text-sm text-amber-800 mb-3">Add New Link</h3>
		<form method="POST" action="?/create" use:enhance={() => { return async ({ update }) => { showAdd = false; await update(); }; }} class="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
			<div>
				<label class="block text-xs font-medium text-amber-700 mb-1">Key *</label>
				<input type="text" name="key" required class="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm font-mono" placeholder="help_centre" />
			</div>
			<div>
				<label class="block text-xs font-medium text-amber-700 mb-1">Name *</label>
				<input type="text" name="name" required class="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm" placeholder="Help Centre" />
			</div>
			<div>
				<label class="block text-xs font-medium text-amber-700 mb-1">URL *</label>
				<input type="url" name="url" required class="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm" placeholder="https://..." />
			</div>
			<div>
				<label class="block text-xs font-medium text-amber-700 mb-1">Scope</label>
				<select name="scope" bind:value={newScope} class="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm">
					<option value="global">Global</option>
					<option value="org">Org-specific</option>
				</select>
			</div>
			{#if newScope === 'org'}
				<div>
					<label class="block text-xs font-medium text-amber-700 mb-1">Organisation</label>
					<select name="organisationId" class="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm">
						<option value="">—</option>
						{#each organisations as org}
							<option value={org.id}>{org.name}</option>
						{/each}
					</select>
				</div>
			{/if}
			<div>
				<button type="submit" class="w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors">Add</button>
			</div>
		</form>
	</div>
{/if}

{#if links.length === 0}
	<div class="bg-white rounded-2xl border border-[#7E7F9A]/20 shadow-sm p-12 text-center">
		<p class="text-slate-600 font-medium">No links yet</p>
		<p class="mt-1 text-sm text-slate-500">Add commonly used URLs like help centre, getting started guide, etc.</p>
	</div>
{:else}
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="bg-slate-50/80">
					<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Key</th>
					<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
					<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">URL</th>
					<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Scope</th>
					<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
					<th class="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each links as link (link.id)}
					<tr class="hover:bg-slate-50/50">
						<td class="px-5 py-3 text-sm font-mono text-slate-700">{link.key}</td>
						<td class="px-5 py-3 text-sm text-slate-700">{link.name}</td>
						<td class="px-5 py-3 text-sm text-blue-600 truncate max-w-xs"><a href={link.url} target="_blank" rel="noopener">{link.url}</a></td>
						<td class="px-5 py-3 text-sm text-slate-500">{link.scope}{link.orgName ? ` (${link.orgName})` : ''}</td>
						<td class="px-5 py-3 text-sm">
							<span class="px-2 py-0.5 rounded text-xs font-medium {link.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">{link.status}</span>
						</td>
						<td class="px-5 py-3 text-right text-sm">
							<div class="inline-flex items-center gap-1">
								<form method="POST" action="?/toggleStatus" use:enhance class="inline">
									<input type="hidden" name="id" value={link.id} />
									<input type="hidden" name="current_status" value={link.status} />
									<button type="submit" class="p-1.5 rounded text-xs text-slate-500 hover:text-amber-600" title={link.status === 'active' ? 'Deactivate' : 'Activate'}>
										{link.status === 'active' ? 'Disable' : 'Enable'}
									</button>
								</form>
								<form method="POST" action="?/delete" use:enhance class="inline">
									<input type="hidden" name="id" value={link.id} />
									<button type="submit" class="p-1.5 rounded text-xs text-slate-500 hover:text-red-600">Delete</button>
								</form>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
