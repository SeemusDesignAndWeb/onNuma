<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: form = $page.form;
	$: hubPlanTiers = data?.hubPlanTiers || [];
	$: values = form?.values || {};
	$: errors = form?.errors || {};
</script>

<svelte:head>
	<title>New organisation – OnNuma</title>
</svelte:head>

<div class="max-w-2xl">
	<h1 class="text-2xl font-bold text-slate-800 mb-2">New organisation</h1>
	<p class="text-slate-500 mb-8">Add an organisation and select their plan (Free, Professional, Enterprise or Freebie for invite-only testing).</p>

	<form method="POST" action="?/create" use:enhance={() => {
		return async ({ result }) => {
			if (result.type === 'redirect') {
				notifications.success('Organisation created.');
			}
			if (result.type === 'failure' && result.data?.errors) {
				notifications.error(result.data?.errors?.name || result.data?.errors?.hubDomain || 'Please fix the errors and try again.');
			}
		};
	}}>
		<div class="space-y-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
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
					value={values.address ?? ''}
					class="block w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none sm:text-sm"
				></textarea>
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
				<p class="mt-1 text-xs text-slate-500">Optional. e.g. hub.egcc.co.uk — point this host at your app so this org has its own Hub login URL. Must be unique.</p>
				{#if errors.hubDomain}
					<p class="mt-1.5 text-sm text-red-600">{errors.hubDomain}</p>
				{/if}
			</div>
			<div role="group" aria-labelledby="plan-heading">
				<span id="plan-heading" class="block text-sm font-medium text-slate-700 mb-3">Plan</span>
				<div class="space-y-3">
					{#each hubPlanTiers as tier}
						<label class="flex items-start gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer {values.plan === tier.value ? 'border-[#EB9486] bg-[#EB9486]/5' : ''}">
							<input
								type="radio"
								name="plan"
								value={tier.value}
								checked={values.plan === tier.value || (!values.plan && tier.value === 'free')}
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
		<div class="mt-6 flex gap-3">
			<button
				type="submit"
				class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
			>
				Create organisation
			</button>
			<a
				href="{base}/organisations"
				class="inline-flex items-center px-5 py-2.5 rounded-xl font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
			>
				Back
			</a>
		</div>
	</form>
</div>
