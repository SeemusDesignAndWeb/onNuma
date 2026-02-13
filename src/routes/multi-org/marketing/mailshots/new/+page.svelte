<script>
	import { enhance } from '$app/forms';
	import HtmlEditor from '$lib/components/HtmlEditor.svelte';

	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: blocks = data?.blocks || [];
	$: links = data?.links || [];

	let bodyText = '';
</script>

<svelte:head>
	<title>New Mailshot – Marketing – OnNuma</title>
</svelte:head>

<div class="max-w-6xl">
	<div class="mb-6">
		<a href="{base}/marketing/mailshots" class="text-sm text-slate-500 hover:text-slate-700">&larr; Back to mailshots</a>
		<h1 class="text-2xl font-bold text-slate-800 mt-2">New Mailshot</h1>
	</div>

	{#if form?.error}
		<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>
	{/if}

	<form method="POST" use:enhance class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label for="name" class="block text-sm font-medium text-slate-700 mb-1">Name *</label>
				<input type="text" name="name" id="name" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Monthly update" />
			</div>
			<div>
				<label for="tags" class="block text-sm font-medium text-slate-700 mb-1">Tags</label>
				<input type="text" name="tags" id="tags" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="news, events" />
			</div>
		</div>

		<div>
			<label for="internal_notes" class="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
			<textarea name="internal_notes" id="internal_notes" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"></textarea>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label for="subject" class="block text-sm font-medium text-slate-700 mb-1">Subject Line *</label>
				<input type="text" name="subject" id="subject" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Hello {'{{first_name}}'}" />
			</div>
			<div>
				<label for="preview_text" class="block text-sm font-medium text-slate-700 mb-1">Preview Text</label>
				<input type="text" name="preview_text" id="preview_text" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</div>
		</div>

		<div>
			<p class="block text-sm font-medium text-slate-700 mb-1">Body (HTML)</p>
			<HtmlEditor value="" name="body_html" {blocks} {links} rows={18} />
		</div>

		<div>
			<label for="body_text" class="block text-sm font-medium text-slate-700 mb-1">Body (Plain Text Fallback)</label>
			<textarea name="body_text" id="body_text" rows="6" bind:value={bodyText} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"></textarea>
		</div>

		<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
			<a href="{base}/marketing/mailshots" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</a>
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-all">Create Mailshot</button>
		</div>
	</form>
</div>
