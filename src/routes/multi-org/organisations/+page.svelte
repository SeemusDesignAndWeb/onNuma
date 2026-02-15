<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: organisations = data?.organisations || [];
	$: multiOrgAdmin = data?.multiOrgAdmin || null;
	$: currentHubOrganisationId = data?.currentHubOrganisationId ?? null;
	$: hubSet = typeof $page !== 'undefined' && $page.url?.searchParams?.get('hub_set') === '1';

	// Toast when returning from "Set as Hub" (once on load)
	onMount(() => {
		if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('hub_set') === '1') {
			notifications.success('Hub organisation updated. The Hub will show this organisation\'s data.');
		}
	});
</script>

<svelte:head>
	<title>Organisations – OnNuma</title>
</svelte:head>

{#if hubSet}
	<div class="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm">
		Hub organisation updated. The Hub will show this organisation’s data when you open it.
	</div>
{/if}
<div class="flex items-center justify-between mb-8">
	<div>
		<h1 class="text-2xl font-bold text-slate-800">Organisations</h1>
		<p class="mt-1 text-sm text-slate-500">Create and manage organisations and their Hub access.</p>
	</div>
	<a
		href="{base}/organisations/new"
		class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
		Add organisation
	</a>
</div>

{#if organisations.length === 0}
	<div class="bg-white rounded-2xl border border-[#7E7F9A]/20 shadow-sm p-12 text-center">
		<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7E7F9A]/10 text-[#7E7F9A] mb-4">
			<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
		</div>
		<p class="text-slate-600 font-medium">No organisations yet</p>
		<p class="mt-1 text-sm text-slate-500">Create your first organisation to get started.</p>
		<a href="{base}/organisations/new" class="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-[#c75a4a] bg-[#EB9486]/10 hover:bg-[#EB9486]/20 transition-colors">
			Create organisation
		</a>
	</div>
{:else}
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="bg-slate-50/80">
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
					<th class="px-5 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider" title="Hub super admin email verified">Email verified</th>
					<th class="px-5 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Contacts</th>
					<th class="px-5 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each organisations.filter(Boolean) as org (org?.id ?? org?.name)}
					<tr class="hover:bg-slate-50/50 transition-colors {org.archivedAt ? 'bg-slate-50/80' : ''}">
						<td class="px-5 py-4 text-sm font-medium text-slate-900">
							<span class="inline-flex items-center gap-2 flex-wrap">
								{#if currentHubOrganisationId === org.id}
									<svg class="w-4 h-4 text-[#EB9486] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" title="Current Hub">
										<path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
									</svg>
								{/if}
								<a href="{base}/organisations/{org.id}" class="text-[#c75a4a] hover:text-[#EB9486] hover:underline">{org.name || '—'}</a>
								{#if org.archivedAt}
									<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Archived</span>
								{/if}
							</span>
						</td>
						<td class="px-5 py-4 text-sm text-slate-600">{org.contactName || '—'}</td>
						<td class="px-5 py-4 text-sm text-slate-600">{org.plan ? org.plan.charAt(0).toUpperCase() + org.plan.slice(1) : '—'}</td>
						<td class="px-5 py-4 text-center text-sm">
							{#if org.superAdminEmailVerified === true}
								<span class="inline-flex items-center gap-1 text-emerald-600" title="Hub super admin has verified their email">
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>
									Yes
								</span>
							{:else if org.superAdminEmailVerified === false}
								<span class="inline-flex items-center gap-1 text-amber-600" title="Hub super admin has not verified their email">
									<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
									No
								</span>
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td class="px-5 py-4 text-right text-sm text-slate-600">{org.contactCount ?? 0}</td>
						<td class="px-5 py-4 text-right text-sm">
							<div class="inline-flex items-center gap-1">
								{#if !org.archivedAt}
									<form method="POST" action="?/setAsHub" class="inline-block">
										<input type="hidden" name="organisationId" value={org.id} />
										<button type="submit" class="p-2 rounded-lg text-slate-500 hover:text-[#EB9486] hover:bg-[#EB9486]/10 transition-colors" title="Set as Hub">
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
										</button>
									</form>
								{/if}
								<a href="{base}/organisations/{org.id}" class="p-2 rounded-lg text-slate-500 hover:text-[#EB9486] hover:bg-[#EB9486]/10 transition-colors" title="Edit">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
								</a>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
