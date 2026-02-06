<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';

	export let data;
	$: form = $page.form;
	$: values = form?.values || {};
	$: errors = form?.errors || {};
	$: success = data.success ?? false;

	// After successful signup, invalidate organisations list so multi-org admin sees the new org when they visit
	onMount(() => {
		if (data.success) invalidate('app:organisations');
	});
</script>

<svelte:head>
	<title>Sign up – Free trial | OnNuma Hub</title>
</svelte:head>

<section class="relative min-h-screen flex flex-col overflow-hidden">
	<!-- Full-screen background image -->
	<div class="fixed inset-0 -z-10">
		<img
			src="/images/community-vibrant.png"
			alt=""
			class="w-full h-full object-cover"
			aria-hidden="true"
		/>
		<div class="absolute inset-0 bg-slate-900/60" aria-hidden="true"></div>
	</div>
	<div class="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-6 flex items-center justify-center min-h-[calc(100vh-5rem)]">
		{#if success}
			<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-md w-full">
				<div class="text-center mb-6">
					<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<h1 class="text-2xl font-bold text-slate-800">You're all set</h1>
					<p class="mt-2 text-slate-600 text-sm">
						Your free trial organisation has been created. Check your email to verify your account, then log in to your Hub.
					</p>
				</div>
				<div class="space-y-3">
					<a
						href="/hub/auth/login"
						class="block w-full py-3 px-4 rounded-xl font-medium text-center text-white bg-[#EB9486] hover:bg-[#e08070] transition-colors"
					>
						Log in to your Hub
					</a>
					<p class="text-center text-xs text-slate-500">
						If you set a hub domain, use that URL (e.g. https://hub.yourchurch.org) to access your Hub.
					</p>
				</div>
			</div>
		{:else}
			<div class="w-full max-w-4xl">
				<div class="mb-4">
					<h1 class="text-xl sm:text-2xl font-bold text-white drop-shadow-sm">Start your free trial</h1>
					<p class="mt-1 text-sm text-white/95">
						Create your OnNuma Hub organisation on the free plan.
					</p>
				</div>

				{#if errors._form}
					<div class="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
						{errors._form}
					</div>
				{/if}

				<form method="POST" action="?/create" use:enhance={() => async ({ update }) => await update()}>
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 lg:p-6 shadow-sm">
						<!-- Column 1: Organisation -->
						<div class="space-y-2.5 lg:space-y-3">
							<h2 class="text-base font-semibold text-slate-800 border-b border-slate-200 pb-1.5">Your organisation details</h2>
							<div>
								<label for="name" class="block text-xs font-medium text-slate-700 mb-0.5">Organisation name *</label>
								<input
									id="name"
									name="name"
									type="text"
									required
									value={values.name ?? ''}
									class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 text-sm focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none"
								/>
								{#if errors.name}
									<p class="mt-1 text-xs text-red-600">{errors.name}</p>
								{/if}
							</div>
							<div>
								<label for="address" class="block text-xs font-medium text-slate-700 mb-0.5">Address *</label>
								<textarea
									id="address"
									name="address"
									rows="1"
									required
									value={values.address ?? ''}
									class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 text-sm focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none resize-none"
								></textarea>
								{#if errors.address}
									<p class="mt-1 text-xs text-red-600">{errors.address}</p>
								{/if}
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
								<div>
									<label for="telephone" class="block text-xs font-medium text-slate-700 mb-0.5">Telephone *</label>
									<input
										id="telephone"
										name="telephone"
										type="tel"
										required
										value={values.telephone ?? ''}
										class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 text-sm focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none"
									/>
									{#if errors.telephone}
										<p class="mt-1 text-xs text-red-600">{errors.telephone}</p>
									{/if}
								</div>
								<div>
									<label for="hubDomain" class="block text-xs font-medium text-slate-700 mb-0.5">Hub domain</label>
									<input
										id="hubDomain"
										name="hubDomain"
										type="text"
										placeholder="hub.yourchurch.org"
										value={values.hubDomain ?? ''}
										class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 text-sm focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none"
									/>
									{#if errors.hubDomain}
										<p class="mt-1 text-xs text-red-600">{errors.hubDomain}</p>
									{/if}
								</div>
							</div>
							<p class="text-[11px] text-slate-500">Hub domain optional; must be unique. One signup per domain.</p>
						</div>
						<!-- Column 2: Your details -->
						<div class="space-y-2.5 lg:space-y-3">
							<h2 class="text-base font-semibold text-slate-800 border-b border-slate-200 pb-1.5">Your details</h2>
							<div>
								<label for="contactName" class="block text-xs font-medium text-slate-700 mb-0.5">Your name *</label>
								<input
									id="contactName"
									name="contactName"
									type="text"
									required
									value={values.contactName ?? ''}
									class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 text-sm focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none"
								/>
								{#if errors.contactName}
									<p class="mt-1 text-xs text-red-600">{errors.contactName}</p>
								{/if}
							</div>
							<div>
								<label for="email" class="block text-xs font-medium text-slate-700 mb-0.5">Email address *</label>
								<input
									id="email"
									name="email"
									type="email"
									required
									value={values.email ?? ''}
									class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 text-sm focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none"
								/>
								{#if errors.email}
									<p class="mt-1 text-xs text-red-600">{errors.email}</p>
								{/if}
							</div>
							<div>
								<label for="password" class="block text-xs font-medium text-slate-700 mb-0.5">Password *</label>
								<input
									id="password"
									name="password"
									type="password"
									required
									autocomplete="new-password"
									class="block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 text-sm focus:border-[#EB9486] focus:ring-2 focus:ring-[#EB9486]/30 focus:outline-none"
								/>
								{#if errors.password}
									<p class="mt-1 text-xs text-red-600">{errors.password}</p>
								{/if}
								<p class="text-[11px] text-slate-500 mt-0.5">12+ chars, upper, lower, number, special.</p>
							</div>
						</div>
					</div>
					<div class="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
						<label class="flex items-start gap-3 cursor-pointer">
							<input
								type="checkbox"
								name="marketingConsent"
								value="on"
								checked={values.marketingConsent ?? false}
								class="mt-1 rounded border-slate-300 text-[#EB9486] focus:ring-[#EB9486]"
							/>
							<span class="text-xs text-slate-700">
								I agree to receive marketing information, offers and other relevant information from OnNuma. I can unsubscribe at any time.
							</span>
						</label>
					</div>
					<div class="mt-4 flex flex-wrap gap-2 sm:gap-3">
						<button
							type="submit"
							class="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
						>
							Start free trial
						</button>
						<a
							href="/hub/auth/login"
							class="inline-flex items-center px-4 py-2 rounded-xl font-medium text-sm text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
						>
							Already have an account? Log in
						</a>
					</div>
				</form>
			</div>
		{/if}
	</div>
</section>
