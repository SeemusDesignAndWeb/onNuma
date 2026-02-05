<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: form = $page.form;
	$: organisation = data?.organisation;
	$: hubAreas = data?.hubAreas || [];
	$: values = form?.values ?? (organisation ? {
		name: organisation.name,
		address: organisation.address ?? '',
		telephone: organisation.telephone ?? '',
		email: organisation.email ?? '',
		contactName: organisation.contactName ?? '',
		hubDomain: organisation.hubDomain ?? '',
		isHubOrganisation: organisation.isHubOrganisation ?? false,
		areaPermissions: organisation.areaPermissions ?? []
	} : {});
	$: errors = form?.errors || {};
	$: multiOrgAdmin = data?.multiOrgAdmin || null;
	$: canSetSuperAdmin = multiOrgAdmin?.role === 'super_admin';
</script>

<svelte:head>
	<title>{organisation?.name ?? 'Organisation'} – OnNuma</title>
</svelte:head>

<div class="max-w-5xl">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-slate-800">{organisation?.name ?? 'Organisation'}</h1>
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

		<!-- Panel 3: Areas of the site -->
		<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
			<h2 class="text-lg font-semibold text-slate-800 border-b border-slate-200 pb-2">Areas of the site this organisation can access</h2>
			<div class="space-y-2.5">
				{#each hubAreas as area}
					<label class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
						<input
							type="checkbox"
							name="areaPermissions"
							value={area.value}
							checked={values.areaPermissions && values.areaPermissions.includes(area.value)}
							class="rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
						/>
						<span class="text-sm text-slate-700">{area.label}</span>
					</label>
				{/each}
			</div>
			{#if errors.areaPermissions}
				<p class="mt-1.5 text-sm text-red-600">{errors.areaPermissions}</p>
			{/if}
		</div>
		</div>
	</form>
</div>
