<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: templates = data?.templates || [];
	$: sequences = data?.sequences || [];
	$: organisations = data?.organisations || [];

	let importFormat = 'html';
</script>

<svelte:head><title>Import / Export – Marketing – OnNuma</title></svelte:head>

<div class="max-w-3xl">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-slate-800">Import / Export</h1>
		<p class="mt-1 text-sm text-slate-500">Import templates from HTML/JSON, export templates, and duplicate sequences across organisations.</p>
	</div>

	{#if form?.success}<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">{form.message || 'Done.'}</div>{/if}
	{#if form?.error}<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>{/if}

	<!-- Import -->
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
		<h2 class="text-lg font-semibold text-slate-800 mb-4">Import Template</h2>
		<form method="POST" action="?/importTemplate" use:enhance class="space-y-4">
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
				<div>
					<label for="name" class="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
					<input type="text" name="name" id="name" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Imported template" />
				</div>
				<div>
					<label for="format" class="block text-sm font-medium text-slate-700 mb-1">Format</label>
					<select name="format" id="format" bind:value={importFormat} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
						<option value="html">Paste HTML</option>
						<option value="text">Paste Plain Text</option>
						<option value="json">Paste JSON</option>
					</select>
				</div>
			</div>
			<div>
				<label for="content" class="block text-sm font-medium text-slate-700 mb-1">Content</label>
				<textarea name="content" id="content" rows="8" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" placeholder={importFormat === 'json' ? '{"name": "...", "subject": "...", "body_html": "..."}' : '<p>Paste your email content here...</p>'}></textarea>
			</div>
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all">Import Template</button>
		</form>
	</div>

	<!-- Export -->
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
		<h2 class="text-lg font-semibold text-slate-800 mb-4">Export Template</h2>
		<form method="POST" action="?/exportTemplate" use:enhance class="flex items-end gap-3">
			<div class="flex-1">
				<label for="template_id" class="block text-sm font-medium text-slate-700 mb-1">Template</label>
				<select name="template_id" id="template_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="">— Select —</option>
					{#each templates as tmpl}
						<option value={tmpl.id}>{tmpl.name}</option>
					{/each}
				</select>
			</div>
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-slate-600 hover:bg-slate-700 transition-all">Export JSON</button>
		</form>
		{#if form?.exportedJson}
			<div class="mt-4">
				<label class="block text-sm font-medium text-slate-700 mb-1">Exported: {form.exportedName}</label>
				<textarea readonly rows="8" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono bg-slate-50">{form.exportedJson}</textarea>
				<p class="mt-1 text-xs text-slate-400">Copy this JSON and paste it into Import (JSON format) on another instance.</p>
			</div>
		{/if}
	</div>

	<!-- Duplicate across orgs -->
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
		<h2 class="text-lg font-semibold text-slate-800 mb-4">Duplicate Sequence to Another Org</h2>
		<p class="text-sm text-slate-500 mb-4">Copy a sequence and all its steps into a different organisation.</p>
		<form method="POST" action="?/duplicateAcrossOrgs" use:enhance class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
			<div>
				<label class="block text-sm font-medium text-slate-700 mb-1">Source Sequence</label>
				<select name="sequence_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="">— Select —</option>
					{#each sequences as seq}
						<option value={seq.id}>{seq.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="block text-sm font-medium text-slate-700 mb-1">Target Organisation</label>
				<select name="target_org_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="">— Select —</option>
					{#each organisations as org}
						<option value={org.id}>{org.name}</option>
					{/each}
				</select>
			</div>
			<div>
				<button type="submit" class="w-full px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all">Duplicate</button>
			</div>
		</form>
	</div>
</div>
