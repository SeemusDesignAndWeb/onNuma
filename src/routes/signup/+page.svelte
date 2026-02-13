<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getProfessionalPriceForContactCount, getProfessionalContactTierCap } from '$lib/crm/permissions.js';

	export let data;
	$: form = $page.form;
	$: values = form?.values || {};
	$: errors = form?.errors || {};
	$: success = data.success ?? false;
	$: hubSubdomainRequired = data.hubSubdomainRequired ?? false;

	// Plan: prefer URL so /signup?plan=professional always shows Professional (and slider). Use form values when URL has no plan (e.g. after submit error).
	$: urlPlan = $page.url.searchParams.get('plan');
	$: plan = (urlPlan === 'professional' || urlPlan === 'free')
		? urlPlan
		: (values.plan === 'professional' || values.plan === 'free')
			? values.plan
			: 'free';
	$: isProfessionalPlan = plan === 'professional';
	$: planLabel = plan === 'professional' ? 'Professional' : 'Free';

	// Upsell benefits - show next tier benefits
	const professionalBenefits = [
		{ icon: '📝', title: 'Forms', description: 'Create custom forms for signups, feedback, and data collection' },
		{ icon: '✉️', title: 'Email campaigns', description: 'Send branded newsletters and email campaigns to your contacts' },
		{ icon: '🎨', title: 'Your branding', description: 'Customise with your logo and colours across all pages' },
		{ icon: '👥', title: 'Members', description: 'Track membership status, renewals, and member-specific information' },
		{ icon: '⚡', title: 'Priority support', description: 'Get faster responses and dedicated assistance' }
	];

	const enterpriseBenefits = [
		{ icon: '🏢', title: 'Multiple organisations', description: 'Manage multiple organisations from a single admin account' },
		{ icon: '🛠️', title: 'Bespoke functionality', description: 'We build bespoke functionality for your requirements' },
		{ icon: '🤝', title: 'Dedicated support', description: 'Personal account manager for your organisation' },
		{ icon: '🎓', title: 'Custom onboarding', description: 'Tailored setup and training for your team' }
	];

	$: upsellBenefits = plan === 'professional' ? enterpriseBenefits : professionalBenefits;
	$: upsellPlanName = plan === 'professional' ? 'Enterprise' : 'Professional';
	$: upsellDescription = plan === 'professional' 
		? 'Need more? Enterprise includes everything in Professional, plus:'
		: 'Unlock more with Professional:';

	// Number of contacts (Professional): slider 1–500, fixed tier pricing. Init from URL when coming from pricing page.
	let contactsLocal = 30;
	let initializedFromUrl = false;
	$: urlContacts = $page.url.searchParams.get('contacts');
	$: if (plan === 'professional' && urlContacts != null && !initializedFromUrl && !form?.errors) {
		contactsLocal = Math.min(500, Math.max(1, parseInt(urlContacts, 10) || 30));
		initializedFromUrl = true;
	}
	$: if (form?.errors && plan === 'professional' && values.numberOfContacts != null) {
		const v = Math.min(500, Math.max(1, Number(values.numberOfContacts) || 30));
		contactsLocal = v;
	}
	$: numberOfContacts = plan === 'professional' ? contactsLocal : 30;

	$: displayCost =
		plan === 'professional' ? getProfessionalPriceForContactCount(numberOfContacts) : null;

	// ── Paddle.js overlay checkout ──────────────────────────────────────
	let checkoutOpen = false;   // true while Paddle overlay is showing
	let checkoutDone = false;   // true after payment completed
	let paddleReady = false;    // true once Paddle.js is initialised
	let paddleLoadPromise = null;
	let checkoutError = '';

	async function ensurePaddleReady() {
		if (paddleReady) return true;
		if (typeof window === 'undefined') return false;
		const token = data.paddleClientToken;
		if (!token) {
			checkoutError = 'Billing is not configured: PUBLIC_PADDLE_CLIENT_TOKEN is missing.';
			console.error('[signup] PUBLIC_PADDLE_CLIENT_TOKEN not set — cannot open checkout');
			return false;
		}

		// Load Paddle.js if needed (handles race with script availability)
		if (!window.Paddle) {
			if (!paddleLoadPromise) {
				paddleLoadPromise = new Promise((resolve, reject) => {
					const existing = document.querySelector('script[data-paddle-js="1"]');
					if (existing) {
						existing.addEventListener('load', resolve, { once: true });
						existing.addEventListener('error', reject, { once: true });
						return;
					}
					const script = document.createElement('script');
					script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
					script.async = true;
					script.dataset.paddleJs = '1';
					script.onload = resolve;
					script.onerror = reject;
					document.head.appendChild(script);
				});
			}
			try {
				await paddleLoadPromise;
			} catch (e) {
				checkoutError = 'Could not load secure checkout. Please refresh and try again.';
				console.error('[signup] Failed to load Paddle.js:', e);
				return false;
			}
		}

		if (!window.Paddle) {
			checkoutError = 'Secure checkout failed to initialize. Please refresh and try again.';
			return false;
		}

		if (data.paddleEnvironment === 'sandbox') {
			window.Paddle.Environment.set('sandbox');
		}
		window.Paddle.Initialize({
			token,
			eventCallback: (ev) => {
				if (ev.name === 'checkout.completed') {
					checkoutOpen = false;
					checkoutDone = true;
					checkoutError = '';
				}
				if (ev.name === 'checkout.closed' && !checkoutDone) {
					checkoutOpen = false;
				}
			}
		});
		paddleReady = true;
		return true;
	}

	async function openCheckout(transactionId) {
		checkoutError = '';
		const ok = await ensurePaddleReady();
		if (!ok) return;
		checkoutOpen = true;
		try {
			window.Paddle.Checkout.open({ transactionId });
		} catch (e) {
			checkoutOpen = false;
			checkoutError = 'Could not open secure checkout. Please try again.';
			console.error('[signup] Paddle.Checkout.open failed:', e);
		}
	}

	// After successful signup, invalidate organisations list so multi-org admin sees the new org when they visit
	onMount(() => {
		if (data.success) invalidate('app:organisations');
		if (!isProfessionalPlan) return;
		// If we are on a Paddle payment-link URL, auto-open overlay for this transaction.
		const ptxn = $page.url.searchParams.get('_ptxn');
		if (ptxn) openCheckout(ptxn);
	});
</script>

<svelte:head>
	<title>Sign up – {planLabel} plan | OnNuma Hub</title>
</svelte:head>

<section class="relative min-h-screen flex flex-col overflow-hidden">
	<!-- Full-screen background image -->
	<div class="fixed inset-0 -z-10">
		<img
			src="/assets/community-vibrant.png"
			alt=""
			class="w-full h-full object-cover"
			aria-hidden="true"
		/>
		<div class="absolute inset-0 bg-slate-900/60" aria-hidden="true"></div>
	</div>
	<div class="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-6 flex items-center justify-center min-h-[calc(100vh-5rem)]">
		{#if hubSubdomainRequired}
			<div class="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-6 sm:p-8 max-w-md w-full">
				<div class="text-center mb-4">
					<h1 class="text-xl font-bold text-slate-800">Log in at your organisation's Hub</h1>
					<p class="mt-2 text-slate-600 text-sm">
						Hub login is only available at your organisation's URL (e.g. <strong>yourorg.onnuma.com</strong>). Use the link from your welcome email, or type your Hub address in the browser.
					</p>
				</div>
				<p class="text-center text-sm text-slate-500">Don't have an account? <a href="/signup" class="text-[#EB9486] hover:underline font-medium">Sign up</a></p>
			</div>
		{:else if checkoutDone}
			<!-- Paddle checkout completed — payment received -->
			<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-md w-full">
				<div class="text-center mb-6">
					<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<p class="text-slate-600 text-sm">
						Your Professional organisation is being created. Check your email to verify your account, and to see details on how to log into your new Hub.
					</p>
				</div>
			</div>
		{:else if success && plan !== 'professional'}
			<!-- Free plan signup completed -->
			<div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-md w-full">
				<div class="text-center mb-6">
					<div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-4">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<h1 class="text-2xl font-bold text-slate-800">You're all set</h1>
					<p class="mt-2 text-slate-600 text-sm">
						Your Free organisation has been created. Check your email to verify your account, then log in to your Hub.
					</p>
				</div>
				<div class="space-y-3">
					{#if data.hubLoginUrl}
						<a
							href={data.hubLoginUrl}
							class="block w-full py-3 px-4 rounded-xl font-medium text-center text-white bg-[#EB9486] hover:bg-[#e08070] transition-colors"
						>
							Log in to your Hub
						</a>
					{:else}
						<p class="text-slate-600 text-sm text-center">Check your email for the link to log in to your Hub.</p>
					{/if}
				</div>
			</div>
		{:else}
			<div class="w-full max-w-5xl">
				<div class="mb-4">
					<h1 class="text-xl sm:text-2xl font-bold text-white drop-shadow-sm">
						{#if plan === 'professional'}
							Start with Professional
						{:else}
							Start your free account
						{/if}
					</h1>
					<p class="mt-1 text-sm text-white/95">
						{#if plan === 'professional'}
							Create your OnNuma Hub organisation on the Professional plan.
						{:else}
							Create your OnNuma Hub organisation on the Free plan.
						{/if}
					</p>
				</div>

				{#if errors._form}
					<div class="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
						{errors._form}
					</div>
				{/if}
				{#if checkoutError}
					<div class="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
						{checkoutError}
					</div>
				{/if}

				<form method="POST" action="?/create" use:enhance={() => async ({ result, update }) => {
	// Professional plan: server returns transactionId → open Paddle.js overlay checkout
	if (isProfessionalPlan && result?.type === 'success' && result?.data?.transactionId) {
		openCheckout(result.data.transactionId);
		return; // don't call update() — form stays visible behind the overlay
	}
	await update();
}}>
					<input type="hidden" name="plan" value={plan} />
					<div class="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
					<!-- Form columns -->
					<div class="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 lg:p-6 shadow-sm">
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

						{#if plan === 'professional'}
							<div class="sm:col-span-2 space-y-2">
								<label for="numberOfContacts" class="block text-xs font-medium text-slate-700 mb-0.5">Number of contacts *</label>
								<input type="hidden" name="numberOfContacts" value={numberOfContacts} />
								<input type="hidden" name="numberOfUsers" value="1" />
								<input
									id="numberOfContacts"
									type="range"
									min="1"
									max="500"
									bind:value={contactsLocal}
									class="w-full min-w-0 h-3 cursor-pointer accent-[#EB9486] block"
									style="--track-h: 0.5rem;"
								/>
								<div class="flex items-baseline justify-between gap-2 mt-2">
									<span class="text-sm font-semibold text-slate-800 tabular-nums">Up to {getProfessionalContactTierCap(numberOfContacts)}</span>
									<p class="text-sm font-semibold text-slate-800">£{displayCost}<span class="text-slate-500 font-normal text-xs">/month</span></p>
								</div>
								{#if errors.numberOfContacts}
									<p class="mt-1 text-xs text-red-600">{errors.numberOfContacts}</p>
								{/if}
							</div>
						{/if}

						<!-- Marketing consent and submit - spans both columns -->
						<div class="sm:col-span-2 pt-3 border-t border-slate-200 mt-2">
							<div class="p-3 rounded-lg bg-slate-50 border border-slate-200 mb-4">
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
							<div class="flex flex-wrap gap-2 sm:gap-3">
								<button
									type="submit"
									class="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-white bg-[#EB9486] hover:bg-[#e08070] transition-all"
								>
									{#if plan === 'professional'}
										Start Professional
									{:else}
										Create free account
									{/if}
								</button>
								<a
									href="/signup?hub_subdomain_required=1"
									class="inline-flex items-center px-4 py-2 rounded-xl font-medium text-sm text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
								>
									Already have an account? Log in
								</a>
							</div>
						</div>
					</div>

					<!-- Upsell panel -->
					<div class="bg-brand-blue rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm">
						<p class="text-xs font-semibold tracking-widest uppercase mb-2 {plan === 'professional' ? 'text-brand-peach' : 'text-brand-green'}">
							{plan === 'professional' ? 'Go further' : 'Upgrade anytime'}
						</p>
						<h3 class="text-lg font-bold text-white mb-1">{upsellPlanName}</h3>
						<p class="text-sm text-white/90 mb-4">{upsellDescription}</p>
						<ul class="space-y-3">
							{#each upsellBenefits as benefit}
								<li class="flex items-start gap-3">
									<span class="text-lg flex-shrink-0 mt-0.5">{benefit.icon}</span>
									<div>
										<p class="font-semibold text-sm text-white">{benefit.title}</p>
										<p class="text-xs text-white/80">{benefit.description}</p>
									</div>
								</li>
							{/each}
						</ul>
						{#if plan === 'free'}
							<div class="mt-5 pt-4 border-t border-white/30">
								<a 
									href="/signup?plan=professional"
									class="block w-full py-2.5 px-4 rounded-lg font-semibold text-sm text-center bg-white text-brand-blue hover:bg-white/90 transition-colors"
								>
									Start with Professional instead
								</a>
							</div>
						{:else}
							<div class="mt-5 pt-4 border-t border-white/30 text-center">
								<p class="text-xs text-white/80">Contact us for Enterprise pricing</p>
							</div>
						{/if}
					</div>
					</div>
				</form>
			</div>
		{/if}
	</div>
	<!-- Legal footer -->
	<footer class="relative z-10 py-4 text-center text-xs text-white/70">
		<nav class="flex flex-wrap justify-center gap-x-5 gap-y-1">
			<a href="/terms" class="hover:text-white transition-colors">Terms &amp; Conditions</a>
			<a href="/privacy" class="hover:text-white transition-colors">Privacy Policy</a>
			<a href="/refund-policy" class="hover:text-white transition-colors">Refund Policy</a>
		</nav>
		<p class="mt-2">&copy; {new Date().getFullYear()} Seemus Design &amp; Web, trading as OnNuma.</p>
	</footer>
</section>
