<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: form = $page.form;
	$: organisation = data?.organisation;
	$: hubPlanTiers = data?.hubPlanTiers || [];
	$: currentPlan = data?.currentPlan ?? 'free';
	$: values = form?.values ?? (organisation ? {
		name: organisation.name,
		address: organisation.address ?? '',
		telephone: organisation.telephone ?? '',
		email: organisation.email ?? '',
		contactName: organisation.contactName ?? '',
		hubDomain: organisation.hubDomain ?? '',
		isHubOrganisation: organisation.isHubOrganisation ?? false,
		plan: currentPlan
	} : {});
	$: errors = form?.errors || {};
	$: multiOrgAdmin = data?.multiOrgAdmin || null;
	$: canSetSuperAdmin = multiOrgAdmin?.role === 'super_admin';
	$: anonymisedCreated = data?.anonymisedCreated ?? null;
	$: anonymisedError = form?.anonymisedError ?? null;
	$: anonymisedCount = form?.anonymisedCount ?? '';

	function handleCreateAnonymisedContactsClick(e) {
		const formEl = e.currentTarget.form;
		if (!formEl) return;
		const countInput = formEl.querySelector('input[name="count"]');
		const count = countInput?.value?.trim() || '?';
		const message = `This will permanently remove all existing contacts for this organisation and create ${count} anonymised contacts. Assignments will be removed from rotas. This cannot be undone.\n\nContinue?`;
		if (confirm(message)) {
			formEl.requestSubmit();
		}
	}
</script>

<svelte:head>
	<title>{organisation?.name ?? 'Organisation'} – OnNuma</title>
</svelte:head>

<div class="max-w-5xl">
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<h1 class="text-2xl font-bold text-slate-800">{organisation?.name ?? 'Organisation'}</h1>
		{#if organisation?.archivedAt}
			<span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">Archived</span>
		{/if}
		<div class="ml-auto flex gap-2">
			{#if organisation?.archivedAt}
				<form method="POST" action="?/unarchive" class="inline-block">
					<button type="submit" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors">
						Unarchive
					</button>
				</form>
			{:else}
				<form method="POST" action="?/archive" class="inline-block">
					<button type="submit" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
						Archive
					</button>
				</form>
			{/if}
		</div>
	</div>

	<form method="POST" action="?/save" use:enhance={() => {
		return async ({ result }) => {
			if (result.type === 'redirect') {
				notifications.success('Organisation saved.');
			}
			if (result.type === 'failure' && result.data?.errors) {
				notifications.error('Please fix the errors and try again.');
			}
		};
	}}>
		<!-- Buttons at top -->
		<div class="mb-6 flex gap-3">
			<button
				type="submit"
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
			>
				Save changes
			</button>
			<a
				href="{base}/organisations"
				class="inline-flex items-center px-5 py-2.5 rounded-xl font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
			>
				Back
			</a>
		</div>

		<!-- Responsive columns: 1 → 2 → 3 as width allows -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		<!-- Panel 1: Organisation details -->
		<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
			<h2 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Organisation details</h2>
			<div>
				<label for="name" class="block text-sm font-medium text-slate-700 mb-1">Organisation name *</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					value={values.name ?? ''}
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				/>
				{#if errors.name}
					<p class="mt-1.5 text-sm text-red-600">{errors.name}</p>
				{/if}
			</div>
			<div>
				<label for="address" class="block text-sm font-medium text-slate-700 mb-1">Address</label>
				<textarea
					id="address"
					name="address"
					rows="2"
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				>{values.address ?? ''}</textarea>
			</div>
			<div>
				<label for="telephone" class="block text-sm font-medium text-slate-700 mb-1">Telephone</label>
				<input
					id="telephone"
					name="telephone"
					type="tel"
					value={values.telephone ?? ''}
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				/>
			</div>
			<div>
				<label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email address</label>
				<input
					id="email"
					name="email"
					type="email"
					value={values.email ?? ''}
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				/>
				{#if errors.email}
					<p class="mt-1.5 text-sm text-red-600">{errors.email}</p>
				{/if}
			</div>
			<div>
				<label for="contactName" class="block text-sm font-medium text-slate-700 mb-1">Contact name</label>
				<input
					id="contactName"
					name="contactName"
					type="text"
					value={values.contactName ?? ''}
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				/>
			</div>
		</div>

		<!-- Panel 2: Hub domain + Set Hub super admin -->
		<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
			<h2 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Hub & domain</h2>
			<div>
				<label for="hubDomain" class="block text-sm font-medium text-slate-700 mb-1">Hub domain</label>
				<input
					id="hubDomain"
					name="hubDomain"
					type="text"
					placeholder="hub.yourchurch.org"
					value={values.hubDomain ?? ''}
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				/>
				<p class="mt-1 text-xs text-slate-500">Optional. e.g. hub.egcc.co.uk — point this host at your app (e.g. on Railway) so this org has its own Hub login URL. Must be unique.</p>
				{#if errors.hubDomain}
					<p class="mt-1.5 text-sm text-red-600">{errors.hubDomain}</p>
				{/if}
			</div>
			{#if canSetSuperAdmin}
				<div>
					<a
						href="{base}/organisations/{organisation?.id}/super-admin"
						class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
					>
						Set Hub super admin
					</a>
					<p class="mt-1 text-xs text-slate-500">Assign the user who has full access to this organisation’s Hub.</p>
				</div>
			{/if}
		</div>

		<!-- Panel 3: Plan (Free, Professional, Enterprise) -->
		<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm" role="group" aria-labelledby="plan-panel-heading">
			<h2 id="plan-panel-heading" class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Plan</h2>
			<div class="space-y-3">
				{#each hubPlanTiers as tier}
					<label class="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer {(values.plan || currentPlan) === tier.value ? 'border-[#EB9486] bg-[#EB9486]/5' : ''}">
						<input
							type="radio"
							name="plan"
							value={tier.value}
							checked={(values.plan ?? currentPlan) === tier.value}
							class="mt-1 rounded-full border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
						/>
						<div>
							<span class="font-medium text-slate-800">{tier.label}</span>
							<p class="text-sm text-slate-500 mt-0.5">{tier.description}</p>
						</div>
					</label>
				{/each}
			</div>
			{#if errors.plan}
				<p class="mt-1.5 text-sm text-red-600">{errors.plan}</p>
			{/if}
		</div>
		</div>
	</form>

	<!-- Settings: Create anonymised contacts -->
	<div class="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
		<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
			<h2 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Settings</h2>
			<p class="text-sm text-slate-600">Replace all contacts for this organisation with anonymised demo contacts (e.g. for testing or demos).</p>
			{#if anonymisedCreated !== null && anonymisedCreated > 0}
				<p class="text-sm font-medium text-green-700">Created {anonymisedCreated} anonymised contact{anonymisedCreated === 1 ? '' : 's'}.</p>
			{/if}
			{#if anonymisedError}
				<p class="text-sm text-red-600">{anonymisedError}</p>
			{/if}
			<form
				id="anonymised-contacts-form-org"
				method="POST"
				action="?/createAnonymisedContacts"
				class="flex flex-wrap items-end gap-3"
			>
				<div>
					<label for="anonymised-count" class="block text-sm font-medium text-slate-700 mb-1">Number of contacts</label>
					<input
						id="anonymised-count"
						name="count"
						type="number"
						min="1"
						max="1000"
						value={anonymisedCount || (anonymisedCreated ?? '')}
						placeholder="e.g. 30"
						class="block w-32 rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
					/>
				</div>
				<button
					type="button"
					class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
					on:click={handleCreateAnonymisedContactsClick}
				>
					Create anonymised contacts
				</button>
			</form>
			<p class="text-xs text-slate-500">This removes all existing contacts for this organisation and creates the given number of contacts with anonymised names, emails, phone numbers, addresses and other details.</p>
		</div>
	</div>
</div>
