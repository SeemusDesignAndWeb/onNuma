<script>
	export let data;
	$: preferences = data?.preferences || [];

	function formatDate(d) {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head><title>Consent & Preferences – Marketing – OnNuma</title></svelte:head>

<div>
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-slate-800">Consent & Preferences</h1>
		<p class="mt-1 text-sm text-slate-500">View user email preferences. Users can manage preferences via the unsubscribe link in emails.</p>
	</div>

	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 mb-6">
		<h2 class="text-sm font-semibold text-slate-700 mb-3">Email Categories</h2>
		<div class="space-y-2">
			<div class="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
				<div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
				</div>
				<div>
					<p class="text-sm font-medium text-slate-700">Essential Onboarding</p>
					<p class="text-xs text-slate-500">Core onboarding emails. Users cannot fully opt out (needed for account setup).</p>
				</div>
			</div>
			<div class="flex items-center gap-3 p-3 rounded-lg bg-slate-50">
				<div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
				</div>
				<div>
					<p class="text-sm font-medium text-slate-700">Non-Essential Product Tips</p>
					<p class="text-xs text-slate-500">Product education and tips. Users can opt out via preferences page.</p>
				</div>
			</div>
		</div>
	</div>

	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<div class="px-5 py-4 border-b border-slate-200">
			<h2 class="text-sm font-semibold text-slate-700">User Preferences (recent)</h2>
		</div>
		{#if preferences.length === 0}
			<div class="p-12 text-center text-slate-400">
				<p class="text-sm">No preference records yet. Preferences are created when users interact with the unsubscribe/preferences link.</p>
			</div>
		{:else}
			<table class="min-w-full divide-y divide-slate-200">
				<thead>
					<tr class="bg-slate-50/80">
						<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">User</th>
						<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
						<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Non-Essential</th>
						<th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Updated</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each preferences as pref (pref.id)}
						<tr class="hover:bg-slate-50/50 text-sm">
							<td class="px-5 py-3 text-slate-700">{pref.contact.name}</td>
							<td class="px-5 py-3 text-slate-500">{pref.contact.email}</td>
							<td class="px-5 py-3">
								{#if pref.opted_out_non_essential}
									<span class="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Opted Out</span>
								{:else}
									<span class="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">Subscribed</span>
								{/if}
							</td>
							<td class="px-5 py-3 text-slate-400 text-xs">{formatDate(pref.updated_at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</div>
