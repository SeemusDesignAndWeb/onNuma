<script>
	import { enhance } from '$app/forms';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: templates = data?.templates || [];

	let showArchived = false;
	$: filtered = showArchived ? templates : templates.filter((t) => t.status !== 'archived');

	const statusColors = {
		draft: 'bg-amber-100 text-amber-800',
		active: 'bg-emerald-100 text-emerald-800',
		archived: 'bg-slate-100 text-slate-600'
	};

	function formatDate(d) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Email Templates – Marketing – OnNuma</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold text-slate-800">Email Templates</h1>
		<p class="mt-1 text-sm text-slate-500">Create and manage onboarding email templates.</p>
	</div>
	<div class="flex items-center gap-3">
		<label class="inline-flex items-center gap-2 text-sm text-slate-600">
			<input type="checkbox" bind:checked={showArchived} class="rounded border-slate-300" />
			Show archived
		</label>
		<a href="{base}/marketing/templates/new" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
			New Template
		</a>
	</div>
</div>

{#if filtered.length === 0}
	<div class="bg-white rounded-2xl border border-[#7E7F9A]/20 shadow-sm p-12 text-center">
		<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7E7F9A]/10 text-[#7E7F9A] mb-4">
			<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
		</div>
		<p class="text-slate-600 font-medium">No templates yet</p>
		<p class="mt-1 text-sm text-slate-500">Create your first email template to get started.</p>
		<a href="{base}/marketing/templates/new" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-[#c75a4a] bg-[#EB9486]/10 hover:bg-[#EB9486]/20 transition-colors">
			Create template
		</a>
	</div>
{:else}
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="bg-slate-50/80">
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tags</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Updated</th>
					<th class="px-5 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each filtered as tmpl (tmpl.id)}
					<tr class="hover:bg-slate-50/50 transition-colors">
						<td class="px-5 py-4 text-sm font-medium">
							<a href="{base}/marketing/templates/{tmpl.id}" class="text-[#c75a4a] hover:underline">{tmpl.name || '—'}</a>
						</td>
						<td class="px-5 py-4 text-sm text-slate-600 max-w-xs truncate">{tmpl.subject || '—'}</td>
						<td class="px-5 py-4 text-sm">
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {statusColors[tmpl.status] || 'bg-slate-100 text-slate-600'}">{tmpl.status}</span>
						</td>
						<td class="px-5 py-4 text-sm text-slate-500">
							{#if tmpl.tags?.length}
								{#each tmpl.tags.slice(0, 3) as tag}
									<span class="inline-block px-2 py-0.5 rounded bg-slate-100 text-xs mr-1">{tag}</span>
								{/each}
								{#if tmpl.tags.length > 3}
									<span class="text-xs text-slate-400">+{tmpl.tags.length - 3}</span>
								{/if}
							{:else}
								—
							{/if}
						</td>
						<td class="px-5 py-4 text-sm text-slate-500">{formatDate(tmpl.updated_at)}</td>
						<td class="px-5 py-4 text-right text-sm">
							<div class="inline-flex items-center gap-1">
								<a href="{base}/marketing/templates/{tmpl.id}" class="p-2 rounded-lg text-slate-500 hover:text-[#EB9486] hover:bg-[#EB9486]/10 transition-colors" title="Edit">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
								</a>
								<form method="POST" action="?/duplicate" use:enhance class="inline">
									<input type="hidden" name="id" value={tmpl.id} />
									<button type="submit" class="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Duplicate">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
									</button>
								</form>
								{#if tmpl.status !== 'archived'}
									<form method="POST" action="?/archive" use:enhance class="inline">
										<input type="hidden" name="id" value={tmpl.id} />
										<button type="submit" class="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Archive">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
										</button>
									</form>
								{:else}
									<form method="POST" action="?/unarchive" use:enhance class="inline">
										<input type="hidden" name="id" value={tmpl.id} />
										<button type="submit" class="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Unarchive">
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
										</button>
									</form>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
