<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { notifications } from '$lib/crm/stores/notifications.js';

	export let data;
	export let form;

	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: plans = data?.plans ?? [];
	$: planModules = data?.planModules ?? [];
	$: paddleMapping = data?.paddleMapping ?? null;
	$: formError = form?.error ?? null;
	$: formSuccess = form?.success ?? false;

	let editingPlanValue = null;

	function startEdit(value) {
		editingPlanValue = value;
	}
	function cancelEdit() {
		editingPlanValue = null;
	}

	// Only handle success when the saved plan matches the one we have open (so opening another plan doesn't reuse old success)
	$: if (formSuccess && editingPlanValue && form?.planValue === editingPlanValue) {
		notifications.success(form?.message || 'Plan updated.');
		editingPlanValue = null;
		invalidateAll();
	}
</script>

<svelte:head>
	<title>Plan setup – OnNuma</title>
</svelte:head>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-slate-800">Plan setup</h1>
	<p class="mt-1 text-sm text-slate-500">
		Hub plan tiers, limits, and modules. Billing and subscriptions are managed in Paddle and Boathouse.
	</p>
</div>

{#if formError}
	<div class="mb-4 p-3 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">
		{formError}
	</div>
{/if}

<div class="space-y-6">
	{#each plans as plan}
		<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
			<div class="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-slate-800 capitalize">{plan.label}</h2>
				{#if editingPlanValue === plan.value}
					<button
						type="button"
						on:click={cancelEdit}
						class="text-sm text-slate-500 hover:text-slate-700"
					>
						Cancel
					</button>
				{:else}
					<button
						type="button"
						on:click={() => startEdit(plan.value)}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-[#EB9486]/10 text-[#c75a4a] hover:bg-[#EB9486]/20 transition-colors"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
						Edit
					</button>
				{/if}
			</div>

			{#if editingPlanValue === plan.value}
				<form
					method="POST"
					action="?/updatePlan"
					use:enhance={() => async ({ result, update }) => {
						await update();
						if (result.type === 'success') await invalidateAll();
					}}
					class="px-6 py-5 space-y-4 border-b border-slate-100"
				>
					<input type="hidden" name="planValue" value={plan.value} />
					<div>
						<label for="plan-desc-{plan.value}" class="block text-sm font-medium text-slate-700 mb-1">Description</label>
						<textarea
							id="plan-desc-{plan.value}"
							name="description"
							rows="3"
							class="w-full rounded-lg border border-slate-300 shadow-sm focus:ring-[#EB9486] focus:border-[#c75a4a] py-2 px-3 text-sm"
							placeholder="Plan description shown to admins"
						>{plan.description}</textarea>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="plan-contacts-{plan.value}" class="block text-sm font-medium text-slate-700 mb-1">Contacts allowed</label>
							<input
								id="plan-contacts-{plan.value}"
								type="number"
								name="maxContacts"
								min="0"
								step="1"
								value={plan.maxContacts}
								class="w-full rounded-lg border border-slate-300 shadow-sm focus:ring-[#EB9486] focus:border-[#c75a4a] py-2 px-3 text-sm"
							/>
						</div>
						<div>
							<label for="plan-admins-{plan.value}" class="block text-sm font-medium text-slate-700 mb-1">Admins allowed</label>
							<input
								id="plan-admins-{plan.value}"
								type="number"
								name="maxAdmins"
								min="0"
								step="1"
								value={plan.maxAdmins}
								class="w-full rounded-lg border border-slate-300 shadow-sm focus:ring-[#EB9486] focus:border-[#c75a4a] py-2 px-3 text-sm"
							/>
						</div>
					</div>
					<div>
						<p class="block text-sm font-medium text-slate-700 mb-2">Modules</p>
						<p class="text-xs text-slate-500 mb-2">Hub areas included in this plan. Organisations on this plan will have access to the selected modules.</p>
						<div class="flex flex-wrap gap-x-6 gap-y-2">
							{#each planModules as mod}
								<label class="inline-flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										name="areaPermissions"
										value={mod.value}
										checked={plan.areaPermissions && plan.areaPermissions.includes(mod.value)}
										class="rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
									/>
									<span class="text-sm text-slate-700">{mod.label}</span>
								</label>
							{/each}
						</div>
					</div>
					<div class="flex gap-2">
						<button
							type="submit"
							class="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-colors"
						>
							Save changes
						</button>
						<button
							type="button"
							on:click={cancelEdit}
							class="px-4 py-2 rounded-xl font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<dl class="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
					<div class="sm:col-span-2 lg:col-span-3">
						<dt class="font-medium text-slate-500">Description</dt>
						<dd class="mt-0.5 text-slate-800">{plan.description}</dd>
					</div>
					<div class="sm:col-span-2 lg:col-span-3">
						<dt class="font-medium text-slate-500">Modules</dt>
						<dd class="mt-0.5 text-slate-800">
							{#if plan.areaPermissions && plan.areaPermissions.length > 0}
								{plan.areaPermissions
									.map((id) => planModules.find((m) => m.value === id)?.label || id)
									.filter(Boolean)
									.join(', ')}
							{:else}
								<span class="text-slate-400">None</span>
							{/if}
						</dd>
					</div>
					<div>
						<dt class="font-medium text-slate-500">Contacts allowed</dt>
						<dd class="mt-0.5 text-slate-800 font-mono">{plan.maxContacts.toLocaleString()}</dd>
					</div>
					<div>
						<dt class="font-medium text-slate-500">Admins allowed</dt>
						<dd class="mt-0.5 text-slate-800 font-mono">{plan.maxAdmins.toLocaleString()}</dd>
					</div>
				</dl>
			{/if}
		</div>
	{/each}
</div>

<p class="mt-6 text-sm text-slate-500">
	Edits are stored here and shown in the Hub. Billing and subscriptions remain managed in Paddle and Boathouse.
</p>

{#if paddleMapping}
	<div class="mt-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
		<div class="px-6 py-4 bg-slate-50/80 border-b border-slate-200">
			<h2 class="text-lg font-semibold text-slate-800">Paddle mapping</h2>
			<p class="mt-1 text-sm text-slate-500">
				Environment and price IDs currently configured on this deployment.
			</p>
		</div>
		<div class="px-6 py-5 space-y-5 text-sm">
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
				<div>
					<p class="font-medium text-slate-500">Environment</p>
					<p class="mt-0.5 text-slate-800 capitalize">{paddleMapping.environment}</p>
				</div>
				<div>
					<p class="font-medium text-slate-500">API key</p>
					<p class="mt-0.5 text-slate-800">{paddleMapping.apiConfigured ? 'Configured' : 'Missing'}</p>
				</div>
				<div>
					<p class="font-medium text-slate-500">Webhook secret</p>
					<p class="mt-0.5 text-slate-800">{paddleMapping.webhookConfigured ? 'Configured' : 'Missing'}</p>
				</div>
			</div>

			<div>
				<p class="font-medium text-slate-500 mb-2">Professional prices</p>
				<div class="space-y-2">
					{#each paddleMapping.professional as row}
						<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border border-slate-200 rounded-xl px-3 py-2">
							<span class="text-slate-700">{row.tier}</span>
							<code class="text-xs text-slate-600">{row.priceId || 'Not configured'}</code>
						</div>
					{/each}
				</div>
			</div>

			<div>
				<p class="font-medium text-slate-500 mb-2">Enterprise prices</p>
				<div class="space-y-2">
					{#each paddleMapping.enterprise as row}
						<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border border-slate-200 rounded-xl px-3 py-2">
							<span class="text-slate-700">{row.tier}</span>
							<code class="text-xs text-slate-600">{row.priceId || 'Not configured'}</code>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
