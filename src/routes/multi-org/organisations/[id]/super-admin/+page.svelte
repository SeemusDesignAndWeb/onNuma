<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: organisation = data?.organisation;
	$: currentEmail = data?.currentHubSuperAdminEmail;
	$: currentName = data?.currentHubSuperAdminName;
	$: error = $page.form?.error;
	$: success = $page.url.searchParams.get('super_admin') === 'set';
	let submitting = false;

	// Toast on form error (reactive backup)
	$: if (error) {
		notifications.error(error);
	}
</script>

<svelte:head>
	<title>Hub super admin – {organisation?.name ?? 'Organisation'}</title>
</svelte:head>

<div class="max-w-xl">
	<a href="{base}/organisations/{organisation?.id}" class="text-sm font-medium text-[#c75a4a] hover:text-[#EB9486] mb-4 inline-flex items-center gap-1">← Back to organisation</a>
	<h1 class="text-2xl font-bold text-slate-800 mb-2">Hub super admin</h1>
	<p class="text-slate-500 mb-8">
		Set the super admin for the Hub organisation. This user will have full access to the Hub (all areas and user management).
	</p>

	{#if success}
		<div class="mb-6 p-5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200">
			Hub super admin has been set successfully. They can now sign in to the Hub with full access.
		</div>
	{/if}

	{#if error}
		<div class="mb-6 p-5 rounded-2xl bg-red-50 text-red-700 border border-red-100">
			{error}
		</div>
	{/if}

	<form method="POST" action="?/set" use:enhance={() => {
		submitting = true;
		return async ({ result }) => {
			submitting = false;
			if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Something went wrong. Please try again.');
			}
			if (result.type === 'redirect') {
				notifications.success('Hub super admin has been set successfully.');
			}
		};
	}}>
		<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
			<div>
				<label for="email" class="block text-sm font-medium text-slate-700 mb-1">Email address *</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					value={currentEmail ?? ''}
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				/>
				<p class="mt-1.5 text-xs text-slate-500">If this email already has a Hub account, they will be updated to super admin. Otherwise a new account is created.</p>
			</div>
			<div>
				<label for="name" class="block text-sm font-medium text-slate-700 mb-1">Name *</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					value={currentName ?? ''}
					placeholder="Display name"
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				/>
			</div>
			<div>
				<label for="password" class="block text-sm font-medium text-slate-700 mb-1">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="new-password"
					required={!currentEmail}
					placeholder={currentEmail ? 'Leave blank to keep current password' : 'Required for new account'}
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				/>
				<p class="mt-1.5 text-xs text-slate-500">At least 12 characters, with upper, lower, number and special character. Required when creating a new account.</p>
			</div>
		</div>
		<div class="mt-6 flex gap-3">
			<button
				type="submit"
				disabled={submitting}
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
			>
				{submitting ? 'Setting…' : 'Set Hub super admin'}
			</button>
			<a
				href="{base}/organisations/{organisation?.id}"
				class="inline-flex items-center px-5 py-2.5 rounded-xl font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
			>
				Back
			</a>
		</div>
	</form>
</div>
