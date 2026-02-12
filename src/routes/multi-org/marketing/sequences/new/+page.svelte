<script>
	import { enhance } from '$app/forms';

	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: organisations = data?.organisations || [];

	let appliesTo = 'default';
</script>

<svelte:head>
	<title>New Sequence – Marketing – OnNuma</title>
</svelte:head>

<div class="max-w-3xl">
	<div class="mb-6">
		<a href="{base}/marketing/sequences" class="text-sm text-slate-500 hover:text-slate-700">&larr; Back to sequences</a>
		<h1 class="text-2xl font-bold text-slate-800 mt-2">New Sequence</h1>
	</div>

	{#if form?.error}
		<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">{form.error}</div>
	{/if}

	<form method="POST" use:enhance class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
		<div>
			<label for="name" class="block text-sm font-medium text-slate-700 mb-1">Name *</label>
			<input type="text" name="name" id="name" required class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400" placeholder="e.g. Default Onboarding" />
		</div>

		<div>
			<label for="description" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
			<textarea name="description" id="description" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400" placeholder="What this sequence does"></textarea>
		</div>

		<div>
			<label for="applies_to" class="block text-sm font-medium text-slate-700 mb-1">Applies To</label>
			<select name="applies_to" id="applies_to" bind:value={appliesTo} class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400">
				<option value="default">Default sequence (all orgs)</option>
				<option value="organisation">Specific organisation</option>
				<option value="org_group">Organisation group</option>
			</select>
		</div>

		{#if appliesTo === 'organisation'}
			<div>
				<label for="organisation_id" class="block text-sm font-medium text-slate-700 mb-1">Organisation</label>
				<select name="organisation_id" id="organisation_id" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400">
					<option value="">— Select —</option>
					{#each organisations as org}
						<option value={org.id}>{org.name}</option>
					{/each}
				</select>
			</div>
		{/if}

		{#if appliesTo === 'org_group'}
			<div>
				<label for="org_group" class="block text-sm font-medium text-slate-700 mb-1">Group Name</label>
				<input type="text" name="org_group" id="org_group" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400" placeholder="e.g. tier-1" />
			</div>
		{/if}

		<div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
			<a href="{base}/marketing/sequences" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">Cancel</a>
			<button type="submit" class="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all">Create Sequence</button>
		</div>
	</form>
</div>
