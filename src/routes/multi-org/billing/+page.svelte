<script>
	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: billingList = data?.billingList ?? [];
</script>

<svelte:head>
	<title>Billing – OnNuma</title>
</svelte:head>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-slate-800">Billing</h1>
	<p class="mt-1 text-sm text-slate-500">
		Subscription and billing by organisation. Invoices, payment methods, and cancellations are managed in Paddle and Boathouse; this page is a summary view.
	</p>
</div>

{#if billingList.length === 0}
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
		<p class="text-slate-600 font-medium">No organisations</p>
		<p class="mt-1 text-sm text-slate-500">Billing will appear here once organisations exist.</p>
	</div>
{:else}
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<table class="min-w-full divide-y divide-slate-200">
			<thead>
				<tr class="bg-slate-50/80">
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Organisation</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Plan</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Next billing</th>
					<th class="px-5 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each billingList as row (row.id)}
					<tr class="hover:bg-slate-50/50 transition-colors {row.archivedAt ? 'bg-slate-50/80' : ''}">
						<td class="px-5 py-4 text-sm">
							<a href="{base}/organisations/{row.id}" class="font-medium text-[#c75a4a] hover:text-[#EB9486] hover:underline">{row.name}</a>
							{#if row.archivedAt}
								<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Archived</span>
							{/if}
						</td>
						<td class="px-5 py-4 text-sm font-medium text-slate-800 capitalize">{row.plan}</td>
						<td class="px-5 py-4 text-sm">
							{#if row.subscriptionStatus}
								<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
									{row.subscriptionStatus === 'active' ? 'bg-emerald-100 text-emerald-800' : ''}
									{row.subscriptionStatus === 'canceled' || row.subscriptionStatus === 'cancelled' ? 'bg-slate-100 text-slate-700' : ''}
									{row.subscriptionStatus === 'past_due' ? 'bg-amber-100 text-amber-800' : ''}
									{!['active','canceled','cancelled','past_due'].includes(row.subscriptionStatus) ? 'bg-slate-100 text-slate-700' : ''}
								">
									{row.subscriptionStatus}
								</span>
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td class="px-5 py-4 text-sm text-slate-600">
							{#if row.currentPeriodEnd}
								{new Date(row.currentPeriodEnd).toLocaleDateString()}
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
						<td class="px-5 py-4 text-sm text-slate-600">
							{#if row.cancelAtPeriodEnd}
								<span class="text-amber-700">Cancels at period end</span>
							{:else if row.hasPaddleCustomer}
								<span class="text-slate-500">Managed in Paddle/Boathouse</span>
							{:else}
								<span class="text-slate-400">—</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="mt-4 text-sm text-slate-500">
		To update payment methods, view invoices, or cancel a subscription, use the Hub for that organisation: open the organisation, then go to Billing in the Hub (or have the org’s super admin use Profile → Billing). Paddle and Boathouse host the actual billing portal.
	</p>
{/if}
