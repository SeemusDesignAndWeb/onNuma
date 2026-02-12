<script>
	import { enhance } from '$app/forms';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: blocks = data?.blocks || [];

	let showArchived = false;
	$: filtered = showArchived ? blocks : blocks.filter((b) => b.status !== 'archived');

	const statusColors = { active: 'bg-emerald-100 text-emerald-800', draft: 'bg-amber-100 text-amber-800', archived: 'bg-slate-100 text-slate-600' };
</script>

<svelte:head>
	<title>Content Blocks – Marketing – OnNuma</title>
</svelte:head>

<div class="flex items-center justify-between mb-6">
	<div>
		<h1 class="text-2xl font-bold text-slate-800">Content Blocks</h1>
		<p class="mt-1 text-sm text-slate-500">Reusable snippets you can insert into email templates via {'{{block:key}}'}.</p>
	</div>
	<div class="flex items-center gap-3">
		<label class="inline-flex items-center gap-2 text-sm text-slate-600">
			<input type="checkbox" bind:checked={showArchived} class="rounded border-slate-300" />
			Show archived
		</label>
		<a href="{base}/marketing/blocks/new" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-purple-500 hover:bg-purple-600 transition-all">
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
			New Block
		</a>
	</div>
</div>

{#if filtered.length === 0}
	<div class="bg-white rounded-2xl border border-[#7E7F9A]/20 shadow-sm p-12 text-center">
		<p class="text-slate-600 font-medium">No content blocks yet</p>
		<p class="mt-1 text-sm text-slate-500">Create reusable snippets like "How to sign up to a rota" or "Need help? Contact us".</p>
		<a href="{base}/marketing/blocks/new" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors">Create block</a>
	</div>
{:else}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each filtered as block (block.id)}
			<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col">
				<div class="flex items-start justify-between mb-3">
					<div>
						<a href="{base}/marketing/blocks/{block.id}" class="font-semibold text-sm text-[#c75a4a] hover:underline">{block.title || block.key || '—'}</a>
						{#if block.key}
							<p class="text-xs text-slate-400 mt-0.5 font-mono">{'{{block:' + block.key + '}}'}</p>
						{/if}
					</div>
					<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {statusColors[block.status] || 'bg-slate-100 text-slate-600'}">{block.status}</span>
				</div>
				{#if block.tags?.length}
					<div class="flex flex-wrap gap-1 mb-3">
						{#each block.tags as tag}
							<span class="px-2 py-0.5 rounded bg-slate-100 text-xs text-slate-600">{tag}</span>
						{/each}
					</div>
				{/if}
				<div class="flex items-center gap-2 mt-auto pt-3 border-t border-slate-100">
					<a href="{base}/marketing/blocks/{block.id}" class="text-xs text-slate-500 hover:text-slate-700">Edit</a>
					{#if block.status !== 'archived'}
						<form method="POST" action="?/archive" use:enhance class="inline">
							<input type="hidden" name="id" value={block.id} />
							<button type="submit" class="text-xs text-slate-500 hover:text-amber-700">Archive</button>
						</form>
					{:else}
						<form method="POST" action="?/unarchive" use:enhance class="inline">
							<input type="hidden" name="id" value={block.id} />
							<button type="submit" class="text-xs text-slate-500 hover:text-emerald-700">Unarchive</button>
						</form>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}
