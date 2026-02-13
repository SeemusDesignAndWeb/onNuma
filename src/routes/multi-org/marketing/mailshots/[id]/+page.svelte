<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import HtmlEditor from '$lib/components/HtmlEditor.svelte';

	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: mailshot = data?.mailshot || {};
	$: blocks = data?.blocks || [];
	$: links = data?.links || [];
	let testEmails = '';
</script>

<svelte:head>
	<title>{mailshot.name || 'Edit Mailshot'} – Marketing – OnNuma</title>
</svelte:head>

<div class="max-w-6xl">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<a href="{base}/marketing/mailshots" class="text-sm text-slate-500 hover:text-slate-700">&larr; Back to mailshots</a>
			<h1 class="text-2xl font-bold text-slate-800 mt-2">{mailshot.name || 'Edit Mailshot'}</h1>
		</div>
		<form method="POST" action="?/duplicate" use:enhance>
			<button type="submit" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Duplicate</button>
		</form>
	</div>

	{#if form?.success}
		<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">Mailshot saved.</div>
	{/if}
	{#if form?.sent}
		<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">
			Mailshot sent. Sent: {form.broadcast?.sent ?? 0}, Failed: {form.broadcast?.failed ?? 0}, Skipped: {form.broadcast?.skipped ?? 0}.
		</div>
	{/if}
	{#if form?.testSent}
		<div class="mb-4 p-3 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-sm">
			Test emails sent. Sent: {form.testResult?.sent ?? 0}, Failed: {form.testResult?.failed ?? 0}.
		</div>
	{/if}
	{#if form?.error}
		<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>
	{/if}

	<div class="mb-4 flex items-center gap-2 flex-wrap">
		<form method="POST" action="?/sendNow" use:enhance={() => async ({ update }) => { await update(); invalidateAll(); }}>
			<button type="submit" class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors">Send to All Subscribers</button>
		</form>
		<span class="text-xs text-slate-500">Personalisation tokens are applied for each recipient.</span>
	</div>

	<div class="mb-6 bg-blue-50 rounded-2xl border border-blue-200 p-4">
		<h3 class="font-semibold text-sm text-blue-800 mb-3">Test Send</h3>
		<form method="POST" action="?/testSend" use:enhance class="space-y-3">
			<div>
				<label for="test_emails" class="block text-xs font-medium text-blue-700 mb-1">
					Test recipient email(s)
				</label>
				<textarea
					name="test_emails"
					id="test_emails"
					rows="3"
					bind:value={testEmails}
					class="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm"
					placeholder="admin@example.com, second@example.com"
				></textarea>
				<p class="mt-1 text-xs text-blue-600">Use comma, semicolon, or new line to add multiple addresses.</p>
			</div>
			<div>
				<button type="submit" class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
					Send Test Email
				</button>
			</div>
		</form>
	</div>

	<form method="POST" action="?/save" use:enhance={() => async ({ update }) => { await update(); invalidateAll(); }} class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label for="name" class="block text-sm font-medium text-slate-700 mb-1">Name *</label>
				<input type="text" name="name" id="name" required value={mailshot.name || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</div>
			<div>
				<label for="status" class="block text-sm font-medium text-slate-700 mb-1">Status</label>
				<select name="status" id="status" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
					<option value="draft" selected={mailshot.status === 'draft'}>Draft</option>
					<option value="active" selected={mailshot.status === 'active'}>Active</option>
					<option value="archived" selected={mailshot.status === 'archived'}>Archived</option>
				</select>
			</div>
		</div>

		<div>
			<label for="internal_notes" class="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
			<textarea name="internal_notes" id="internal_notes" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{mailshot.internal_notes || ''}</textarea>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label for="subject" class="block text-sm font-medium text-slate-700 mb-1">Subject Line *</label>
				<input type="text" name="subject" id="subject" required value={mailshot.subject || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</div>
			<div>
				<label for="preview_text" class="block text-sm font-medium text-slate-700 mb-1">Preview Text</label>
				<input type="text" name="preview_text" id="preview_text" value={mailshot.preview_text || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
			</div>
		</div>

		<div>
			<p class="block text-sm font-medium text-slate-700 mb-1">Body (HTML)</p>
			<HtmlEditor value={mailshot.body_html || ''} name="body_html" {blocks} {links} rows={18} />
		</div>

		<div>
			<label for="body_text" class="block text-sm font-medium text-slate-700 mb-1">Body (Plain Text Fallback)</label>
			<textarea name="body_text" id="body_text" rows="6" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono">{mailshot.body_text || ''}</textarea>
		</div>

		<div>
			<label for="tags" class="block text-sm font-medium text-slate-700 mb-1">Tags</label>
			<input type="text" name="tags" id="tags" value={(mailshot.tags || []).join(', ')} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
		</div>

		<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
			<a href="{base}/marketing/mailshots" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Back</a>
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-all">Save Mailshot</button>
		</div>
	</form>
</div>
