<script>
	import { enhance } from '$app/forms';
	import HtmlEditor from '$lib/components/HtmlEditor.svelte';
	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
</script>

<svelte:head><title>New Content Block – Marketing – OnNuma</title></svelte:head>

<div class="max-w-5xl">
	<div class="mb-6">
		<a href="{base}/marketing/blocks" class="text-sm text-slate-500 hover:text-slate-700">&larr; Back to blocks</a>
		<h1 class="text-2xl font-bold text-slate-800 mt-2">New Content Block</h1>
	</div>

	{#if form?.error}
		<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>
	{/if}

	<form method="POST" use:enhance class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div>
				<label for="title" class="block text-sm font-medium text-slate-700 mb-1">Title *</label>
				<input type="text" name="title" id="title" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. How to sign up to a rota" />
			</div>
			<div>
				<label for="key" class="block text-sm font-medium text-slate-700 mb-1">Key * <span class="text-xs text-slate-400">(used in {'{{block:key}}'})</span></label>
				<input type="text" name="key" id="key" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="e.g. how_to_rota" />
			</div>
		</div>
		<div>
			<p class="block text-sm font-medium text-slate-700 mb-1">Body (HTML)</p>
			<HtmlEditor
				value=""
				name="body_html"
				rows={12}
			/>
		</div>
		<div>
			<label for="body_text" class="block text-sm font-medium text-slate-700 mb-1">Body (Plain Text)</label>
			<textarea name="body_text" id="body_text" rows="4" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="Here's how to..."></textarea>
		</div>
		<div>
			<label for="tags" class="block text-sm font-medium text-slate-700 mb-1">Tags</label>
			<input type="text" name="tags" id="tags" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="onboarding, help (comma-separated)" />
		</div>
		<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
			<a href="{base}/marketing/blocks" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</a>
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-purple-500 hover:bg-purple-600 transition-all">Create Block</button>
		</div>
	</form>
</div>
