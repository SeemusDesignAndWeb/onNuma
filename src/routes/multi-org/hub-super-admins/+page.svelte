<script>
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: orgsWithSuperAdmin = data?.orgsWithSuperAdmin ?? [];
	$: adminStatusList = data?.adminStatusList ?? [];
	$: orphanedAdmins = data?.orphanedAdmins ?? [];
	$: formSuccess = $page.form?.deleted;
	$: formError = $page.form?.error || '';

	function formatDate(iso) {
		if (!iso) return '—';
		try {
			const d = new Date(iso);
			return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
		} catch {
			return iso;
		}
	}
</script>

<svelte:head>
	<title>Hub super admins – OnNuma</title>
</svelte:head>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-slate-800">Hub super admins</h1>
	<p class="mt-1 text-sm text-slate-500">
		Each organisation has one Hub super admin (separate from multi-org login). Use this page to check that every org has a super admin and that there are no Hub logins not attached to an organisation.
	</p>
</div>

<!-- Section 1: Organisations and their super admin -->
<section class="mb-10">
	<h2 class="text-lg font-semibold text-slate-700 mb-4">Organisations and their super admin</h2>
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="bg-slate-50/80">
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Organisation</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Super admin email</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin name</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
					<th class="px-5 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each orgsWithSuperAdmin as row (row.id)}
					<tr class="hover:bg-slate-50/50 transition-colors {row.missing ? 'bg-amber-50/80' : ''}">
						<td class="px-5 py-4 text-sm font-medium text-slate-900">
							<a href="{base}/organisations/{row.id}" class="text-[#c75a4a] hover:text-[#EB9486] hover:underline">{row.name}</a>
						</td>
						<td class="px-5 py-4 text-sm text-slate-600">{row.hubSuperAdminEmail || '—'}</td>
						<td class="px-5 py-4 text-sm text-slate-600">{row.adminName || '—'}</td>
						<td class="px-5 py-4">
							{#if !row.hubSuperAdminEmail}
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">No super admin set</span>
							{:else if !row.adminExists}
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">No Hub admin with this email</span>
							{:else}
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">OK</span>
							{/if}
						</td>
						<td class="px-5 py-4 text-right">
							<a href="{base}/organisations/{row.id}/super-admin" class="text-sm font-medium text-[#c75a4a] hover:text-[#EB9486]">Set / change</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if orgsWithSuperAdmin.length === 0}
			<div class="px-5 py-8 text-center text-slate-500 text-sm">No organisations.</div>
		{/if}
	</div>
</section>

<!-- Section 2: Hub admins not shown above (not the super admin of any org) -->
<section>
	{#if formSuccess}
		<div class="mb-4 p-4 rounded-xl text-sm bg-green-50 border border-green-200 text-green-800">
			Hub admin removed.
		</div>
	{/if}
	{#if formError}
		<div class="mb-4 p-4 rounded-xl text-sm bg-red-50 border border-red-200 text-red-800">
			{formError}
		</div>
	{/if}
	<h2 class="text-lg font-semibold text-slate-700 mb-4">Hub admins not listed above</h2>
	<p class="text-sm text-slate-500 mb-4">
		These Hub admins are not the super admin of any organisation (they did not appear in the table above). They may be extra users on a hub or erroneous logins to review.
	</p>
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="bg-slate-50/80">
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
					<th class="px-5 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each orphanedAdmins as admin (admin.id)}
					<tr class="hover:bg-slate-50/50 transition-colors bg-red-50/80">
						<td class="px-5 py-4 text-sm font-medium text-slate-900">{admin.email || '—'}</td>
						<td class="px-5 py-4 text-sm text-slate-600">{admin.name || '—'}</td>
						<td class="px-5 py-4 text-sm text-slate-600">{formatDate(admin.createdAt)}</td>
						<td class="px-5 py-4">
							<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Not attached to any organisation</span>
						</td>
						<td class="px-5 py-4 text-right">
							<form
								method="POST"
								action="?/deleteOrphanedAdmin"
								class="inline"
								on:submit={(e) => {
									if (!confirm(`Remove Hub admin "${admin.email || admin.name}"? They will no longer be able to log in to the Hub.`)) {
										e.preventDefault();
									}
								}}
								use:enhance
							>
								<input type="hidden" name="adminId" value={admin.id} />
								<button type="submit" class="text-sm font-medium text-red-600 hover:text-red-800 hover:underline">
									Delete
								</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
		{#if orphanedAdmins.length === 0}
			<div class="px-5 py-8 text-center text-slate-500 text-sm">No Hub admins outside the list above. Every Hub admin is the super admin of an organisation.</div>
		{/if}
	</div>

	{#if orphanedAdmins.length > 0}
		<div class="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
			<strong>{orphanedAdmins.length}</strong> Hub admin(s) are not attached to any organisation. These logins can access the Hub but are not the super admin of any org. Consider removing them from the Hub admin list or assigning them as super admin to an organisation (via the organisation’s “Super admin” page).
		</div>
	{/if}
</section>
