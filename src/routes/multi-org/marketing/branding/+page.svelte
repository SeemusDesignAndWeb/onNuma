<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: organisations = data?.organisations || [];
	$: brandingEntries = data?.brandingEntries || [];

	let selectedOrgId = '';
	$: selectedBranding = brandingEntries.find((b) => b.organisation_id === selectedOrgId) || {};
</script>

<svelte:head><title>Branding – Marketing – OnNuma</title></svelte:head>

<div class="max-w-3xl">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-slate-800">Branding Defaults</h1>
		<p class="mt-1 text-sm text-slate-500">Configure per-org sender name, email, reply-to, logo, and footer for marketing emails.</p>
	</div>

	{#if form?.success}<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">Saved.</div>{/if}
	{#if form?.error}<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>{/if}

	<!-- Existing branding entries -->
	{#if brandingEntries.length > 0}
		<div class="mb-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
			<h2 class="text-sm font-semibold text-slate-700 mb-3">Configured Organisations</h2>
			<div class="space-y-2">
				{#each brandingEntries as b}
					<button on:click={() => selectedOrgId = b.organisation_id} class="w-full text-left p-3 rounded-lg hover:bg-slate-50 transition-colors {selectedOrgId === b.organisation_id ? 'bg-[#EB9486]/10 border border-[#EB9486]/30' : 'bg-slate-50'}">
						<span class="text-sm font-medium text-slate-700">{b.orgName}</span>
						<span class="text-xs text-slate-400 ml-2">{b.sender_email || 'No sender email'}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<form method="POST" action="?/save" use:enhance class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
		<div>
			<label for="organisation_id" class="block text-sm font-medium text-slate-700 mb-1">Organisation *</label>
			<select name="organisation_id" id="organisation_id" bind:value={selectedOrgId} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
				<option value="">— Select organisation —</option>
				{#each organisations as org}
					<option value={org.id}>{org.name}</option>
				{/each}
			</select>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
			<div>
				<label for="sender_name" class="block text-sm font-medium text-slate-700 mb-1">Sender Name</label>
				<input type="text" name="sender_name" id="sender_name" value={selectedBranding.sender_name || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. EGCC" />
			</div>
			<div>
				<label for="sender_email" class="block text-sm font-medium text-slate-700 mb-1">Sender Email</label>
				<input type="email" name="sender_email" id="sender_email" value={selectedBranding.sender_email || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="noreply@..." />
			</div>
		</div>

		<div>
			<label for="reply_to" class="block text-sm font-medium text-slate-700 mb-1">Reply-To</label>
			<input type="email" name="reply_to" id="reply_to" value={selectedBranding.reply_to || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="replies@..." />
		</div>

		<div>
			<label for="logo_url" class="block text-sm font-medium text-slate-700 mb-1">Logo URL</label>
			<input type="url" name="logo_url" id="logo_url" value={selectedBranding.logo_url || ''} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="https://..." />
		</div>

		<div>
			<label for="footer_content" class="block text-sm font-medium text-slate-700 mb-1">Default Footer (HTML)</label>
			<textarea name="footer_content" id="footer_content" rows="4" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono">{selectedBranding.footer_content || ''}</textarea>
		</div>

		<div>
			<label for="header_style" class="block text-sm font-medium text-slate-700 mb-1">Header Style (optional CSS)</label>
			<textarea name="header_style" id="header_style" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" placeholder="background: #2d7a32; color: white;">{selectedBranding.header_style || ''}</textarea>
		</div>

		<!-- Preview -->
		<div class="p-4 bg-slate-50 rounded-lg">
			<p class="text-xs font-semibold text-slate-500 mb-2">Preview</p>
			<div class="text-sm text-slate-700">
				<p><strong>From:</strong> {selectedBranding.sender_name || 'OnNuma'} &lt;{selectedBranding.sender_email || 'noreply@...'}&gt;</p>
				<p><strong>Reply-To:</strong> {selectedBranding.reply_to || '(not set)'}</p>
			</div>
		</div>

		<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all">Save Branding</button>
		</div>
	</form>
</div>
