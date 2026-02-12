<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import HtmlEditor from '$lib/components/HtmlEditor.svelte';

	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: template = data?.template || {};
	$: versions = data?.versions || [];
	$: organisations = data?.organisations || [];
	$: validation = data?.validation || {};
	$: blocks = data?.blocks || [];
	$: links = data?.links || [];

	let showVersions = false;
	let showTestSend = false;
	let testEmail = '';
	let testOrgId = '';

	const statusColors = { draft: 'bg-amber-100 text-amber-800', active: 'bg-emerald-100 text-emerald-800', archived: 'bg-slate-100 text-slate-600' };

	function formatDate(d) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
	}
</script>

<svelte:head>
	<title>{template.name || 'Edit Template'} – Marketing – OnNuma</title>
</svelte:head>

<div class="max-w-6xl">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<a href="{base}/marketing/templates" class="text-sm text-slate-500 hover:text-slate-700">&larr; Back to templates</a>
			<h1 class="text-2xl font-bold text-slate-800 mt-2">{template.name || 'Edit Template'}</h1>
			<div class="flex items-center gap-2 mt-1">
				<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {statusColors[template.status] || 'bg-slate-100 text-slate-600'}">{template.status}</span>
				<span class="text-xs text-slate-400">Updated {formatDate(template.updated_at)}</span>
			</div>
		</div>
		<div class="flex items-center gap-2">
			<form method="POST" action="?/duplicate" use:enhance>
				<button type="submit" class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Duplicate</button>
			</form>
			<button on:click={() => showTestSend = !showTestSend} class="px-3 py-2 rounded-lg text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">Test Send</button>
			<button on:click={() => showVersions = !showVersions} class="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">History</button>
		</div>
	</div>

	{#if form?.success}
		<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">Template saved successfully.</div>
	{/if}
	{#if form?.testSent}
		<div class="mb-4 p-3 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-sm">Test email sent to {form.testEmail}.</div>
	{/if}
	{#if form?.statusUpdated}
		<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">Status changed to {form.statusUpdated}.</div>
	{/if}
	{#if form?.error}
		<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>
	{/if}

	{#if validation?.unknown?.length}
		<div class="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm">
			Unknown placeholders: {validation.unknown.join(', ')}
		</div>
	{/if}

	<!-- Test send panel -->
	{#if showTestSend}
		<div class="mb-4 bg-blue-50 rounded-2xl border border-blue-200 p-4">
			<h3 class="font-semibold text-sm text-blue-800 mb-3">Send Test Email</h3>
			<form method="POST" action="?/testSend" use:enhance class="flex items-end gap-3">
				<div class="flex-1">
					<label for="to_email" class="block text-xs font-medium text-blue-700 mb-1">To Email</label>
					<input type="email" name="to_email" id="to_email" bind:value={testEmail} required class="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm" placeholder="admin@example.com" />
				</div>
				<div class="w-48">
					<label for="test_org" class="block text-xs font-medium text-blue-700 mb-1">Preview as Org</label>
					<select name="organisation_id" id="test_org" bind:value={testOrgId} class="w-full rounded-lg border border-blue-300 px-3 py-2 text-sm">
						<option value="">— No org —</option>
						{#each organisations as org}
							<option value={org.id}>{org.name}</option>
						{/each}
					</select>
				</div>
				<button type="submit" class="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">Send Test</button>
			</form>
		</div>
	{/if}

	<!-- Version history panel -->
	{#if showVersions}
		<div class="mb-4 bg-slate-50 rounded-2xl border border-slate-200 p-4">
			<h3 class="font-semibold text-sm text-slate-700 mb-3">Version History</h3>
			{#if versions.length === 0}
				<p class="text-sm text-slate-500">No version history yet.</p>
			{:else}
				<div class="space-y-2 max-h-64 overflow-y-auto">
					{#each versions as v}
						<div class="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-white">
							<span class="text-slate-400 text-xs w-36 flex-shrink-0">{formatDate(v.updated_at)}</span>
							<span class="text-slate-600 flex-1">{v.change_summary || '—'}</span>
							<span class="text-xs text-slate-400">{v.updated_by || '—'}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Status actions -->
	<div class="mb-4 flex items-center gap-2">
		{#if template.status === 'draft'}
			<form method="POST" action="?/setStatus" use:enhance>
				<input type="hidden" name="status" value="active" />
				<button type="submit" class="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-colors">Activate</button>
			</form>
		{/if}
		{#if template.status === 'active'}
			<form method="POST" action="?/setStatus" use:enhance>
				<input type="hidden" name="status" value="draft" />
				<button type="submit" class="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 transition-colors">Revert to Draft</button>
			</form>
		{/if}
		{#if template.status !== 'archived'}
			<form method="POST" action="?/setStatus" use:enhance>
				<input type="hidden" name="status" value="archived" />
				<button type="submit" class="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Archive</button>
			</form>
		{:else}
			<form method="POST" action="?/setStatus" use:enhance>
				<input type="hidden" name="status" value="draft" />
				<button type="submit" class="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 transition-colors">Unarchive</button>
			</form>
		{/if}
	</div>

	<!-- Edit form -->
	<form method="POST" action="?/save" use:enhance={() => { return async ({ update }) => { await update(); invalidateAll(); }; }} class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
		<div>
			<label for="name" class="block text-sm font-medium text-slate-700 mb-1">Name *</label>
			<input type="text" name="name" id="name" required value={template.name || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#EB9486]/40 focus:border-[#EB9486]" />
		</div>

		<div>
			<label for="internal_notes" class="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
			<textarea name="internal_notes" id="internal_notes" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#EB9486]/40 focus:border-[#EB9486]">{template.internal_notes || ''}</textarea>
		</div>

		<div>
			<label for="subject" class="block text-sm font-medium text-slate-700 mb-1">Subject Line</label>
			<input type="text" name="subject" id="subject" value={template.subject || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#EB9486]/40 focus:border-[#EB9486]" />
		</div>

		<div>
			<label for="preview_text" class="block text-sm font-medium text-slate-700 mb-1">Preview Text</label>
			<input type="text" name="preview_text" id="preview_text" value={template.preview_text || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#EB9486]/40 focus:border-[#EB9486]" />
		</div>

		<div>
			<p class="block text-sm font-medium text-slate-700 mb-1">Body (HTML)</p>
			<HtmlEditor
				value={template.body_html || ''}
				name="body_html"
				{blocks}
				{links}
				rows={20}
			/>
		</div>

		<div>
			<label for="body_text" class="block text-sm font-medium text-slate-700 mb-1">Body (Plain Text Fallback)</label>
			<textarea name="body_text" id="body_text" rows="6" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-[#EB9486]/40 focus:border-[#EB9486]">{template.body_text || ''}</textarea>
		</div>

		<div>
			<label for="tags" class="block text-sm font-medium text-slate-700 mb-1">Tags</label>
			<input type="text" name="tags" id="tags" value={(template.tags || []).join(', ')} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#EB9486]/40 focus:border-[#EB9486]" placeholder="onboarding, welcome" />
		</div>

		<div>
			<label for="change_summary" class="block text-sm font-medium text-slate-700 mb-1">Change Summary</label>
			<input type="text" name="change_summary" id="change_summary" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#EB9486]/40 focus:border-[#EB9486]" placeholder="What changed?" />
		</div>

		<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
			<a href="{base}/marketing/templates" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</a>
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all">Save Template</button>
		</div>
	</form>
</div>
