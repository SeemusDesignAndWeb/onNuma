<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: builtIn = data?.builtIn || [];
	$: custom = data?.custom || [];

	let showAdd = false;
</script>

<svelte:head><title>Template Variables – Marketing – OnNuma</title></svelte:head>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-slate-800">Template Variables</h1>
		<p class="mt-1 text-sm text-slate-500">First-class supported placeholders and custom variables for email templates.</p>
	</div>

	{#if form?.success}<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">Saved.</div>{/if}
	{#if form?.error}<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>{/if}

	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
		<h2 class="text-lg font-semibold text-slate-800 mb-4">Built-in Placeholders</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
			{#each builtIn as p}
				<div class="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
					<code class="text-xs font-mono text-[#c75a4a] bg-[#EB9486]/10 px-2 py-0.5 rounded flex-shrink-0">{'{{' + p.key + '}}'}</code>
					<span class="text-sm text-slate-600">{p.description}</span>
				</div>
			{/each}
		</div>
		<div class="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
			<strong>Link variables:</strong> Use <code class="font-mono bg-blue-100 px-1 rounded">{'{{link:key}}'}</code> to reference links from the Links Library. If the URL changes, all emails update automatically.
		</div>
		<div class="mt-2 p-3 bg-purple-50 rounded-lg text-sm text-purple-700">
			<strong>Content blocks:</strong> Use <code class="font-mono bg-purple-100 px-1 rounded">{'{{block:key}}'}</code> to insert reusable content blocks into templates.
		</div>
	</div>

	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-semibold text-slate-800">Custom Variables</h2>
			<button on:click={() => showAdd = !showAdd} class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 transition-colors">Add Variable</button>
		</div>

		{#if showAdd}
			<div class="mb-4 bg-slate-50 rounded-xl border border-slate-200 p-4">
				<form method="POST" action="?/addCustom" use:enhance={() => { return async ({ update }) => { showAdd = false; await update(); }; }} class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
					<div>
						<label class="block text-xs font-medium text-slate-600 mb-1">Key *</label>
						<input type="text" name="key" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="custom_field" />
					</div>
					<div>
						<label class="block text-xs font-medium text-slate-600 mb-1">Description</label>
						<input type="text" name="description" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="What this variable is for" />
					</div>
					<div>
						<label class="block text-xs font-medium text-slate-600 mb-1">Default Value</label>
						<input type="text" name="default_value" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
					</div>
					<div class="sm:col-span-3 flex gap-2">
						<button type="submit" class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-600 hover:bg-slate-700">Add</button>
						<button type="button" on:click={() => showAdd = false} class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
					</div>
				</form>
			</div>
		{/if}

		{#if custom.length === 0}
			<p class="text-sm text-slate-400">No custom variables defined. The built-in placeholders above should cover most use cases.</p>
		{:else}
			<div class="space-y-2">
				{#each custom as v (v.id)}
					<div class="flex items-center justify-between p-3 rounded-lg bg-slate-50">
						<div class="flex items-center gap-3">
							<code class="text-xs font-mono text-slate-700 bg-slate-200 px-2 py-0.5 rounded">{'{{' + v.key + '}}'}</code>
							<span class="text-sm text-slate-600">{v.description || '—'}</span>
							{#if v.default_value}
								<span class="text-xs text-slate-400">Default: {v.default_value}</span>
							{/if}
						</div>
						<form method="POST" action="?/deleteCustom" use:enhance class="inline">
							<input type="hidden" name="id" value={v.id} />
							<button type="submit" class="text-xs text-slate-400 hover:text-red-500">Remove</button>
						</form>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
