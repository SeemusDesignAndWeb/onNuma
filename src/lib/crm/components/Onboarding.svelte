<script>
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { getOnboardingSteps, ONBOARDING_ROUTE_STORAGE_KEY } from '$lib/crm/onboardingSteps.js';

	export let showOnboarding = false;
	/** When true, render as inline page content (e.g. Help page) instead of a modal popup */
	export let inline = false;
	export let admin = null;
	export let superAdminEmail = null;
	/** Org's allowed areas from MultiOrg (null = no restriction) */
	export let organisationAreaPermissions = null;

	$: steps = getOnboardingSteps(admin, superAdminEmail, organisationAreaPermissions);

	function setOnboardingRoute() {
		if (browser && typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(ONBOARDING_ROUTE_STORAGE_KEY, 'true');
		}
	}

	let dismissing = false;
	let dismissed = false;

	$: visible = inline ? (steps.length > 0) : (showOnboarding && !dismissed && steps.length > 0);

	async function dismiss(gotoFirst = false) {
		if (dismissing) return;
		dismissing = true;
		try {
			const res = await fetch('/hub/api/onboarding-dismiss', { method: 'POST' });
			if (res.ok) {
				dismissed = true;
				await invalidateAll();
				if (gotoFirst && steps[0]) {
					window.location.href = steps[0].href;
				}
			}
		} finally {
			dismissing = false;
		}
	}
</script>

{#if visible}
	{#if inline}
		<div class="space-y-6" aria-labelledby="onboarding-title">
			<div>
				<h1 id="onboarding-title" class="font-bold text-gray-900" style="font-size: 1.25rem">Welcome to TheHUB</h1>
				<p class="mt-1 text-sm text-gray-600">Follow the route below to get the most out of your site.</p>
			</div>
			<ol class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
				{#each steps as step, i}
					<li>
						<div class="group flex flex-col h-full rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-theme-button-1/50 hover:shadow-md transition-all">
							<a
								href={step.href}
								on:click={setOnboardingRoute}
								class="flex flex-col flex-1 min-h-0 focus:outline-none focus:ring-2 focus:ring-theme-button-1/40 focus:ring-inset rounded-lg -m-1 p-1"
							>
								<span class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-theme-button-1 text-sm font-bold text-white" aria-hidden="true">
									{i + 1}
								</span>
								<h2 class="mt-3 text-sm font-semibold text-gray-900 group-hover:text-theme-button-1">{step.title}</h2>
								<p class="mt-1 flex-1 text-sm text-gray-600">{step.description}</p>
								<span class="mt-3 inline-flex items-center text-sm font-medium text-theme-button-1 group-hover:underline">
									Go to {step.title}
									<svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
									</svg>
								</span>
							</a>
							{#if step.helpHref}
								<div class="mt-3 flex justify-end">
									<a
										href={step.helpHref}
										on:click|stopPropagation
										class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-theme-button-1 hover:opacity-90 rounded-lg transition-opacity"
										title="Guide"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
										</svg>
										Guide
									</a>
								</div>
							{/if}
						</div>
					</li>
				{/each}
			</ol>
			{#if steps[0]}
				<div class="pt-2">
					<a
						href={steps[0].href}
						on:click={setOnboardingRoute}
						class="inline-flex px-4 py-2 text-sm font-medium text-white rounded-lg bg-theme-button-1 hover:opacity-90 transition-opacity"
					>
						Start with step 1 — {steps[0].title}
					</a>
				</div>
			{/if}
		</div>
	{:else}
		<div class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 p-4" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
			<div class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
				<div class="p-6 border-b border-gray-200">
					<h2 id="onboarding-title" class="font-bold text-gray-900" style="font-size: 1.25rem">Welcome to TheHUB</h2>
					<p class="mt-1 text-sm text-gray-600">Follow the numbered route to get started.</p>
				</div>
				<div class="p-6 overflow-y-auto flex-1">
					<ol class="space-y-3" role="list">
						{#each steps as step, i}
							<li>
								<div class="flex gap-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4 hover:border-theme-button-1/40 hover:bg-theme-button-1/5 transition-colors">
									<a
										href={step.href}
										on:click={setOnboardingRoute}
										class="flex min-w-0 flex-1 gap-4 focus:outline-none focus:ring-2 focus:ring-theme-button-1/40 focus:ring-inset rounded-lg -m-1 p-1"
									>
										<span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-theme-button-1 text-base font-bold text-white">
											{i + 1}
										</span>
										<div class="min-w-0 flex-1">
											<h3 class="text-sm font-semibold text-gray-900">{step.title}</h3>
											<p class="mt-0.5 text-sm text-gray-600">{step.description}</p>
											<span class="mt-2 inline-flex items-center text-sm font-medium text-theme-button-1 hover:underline">
												Go to {step.title}
												<svg class="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
												</svg>
											</span>
										</div>
									</a>
									{#if step.helpHref}
										<a
											href={step.helpHref}
											on:click|stopPropagation
											class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-theme-button-1 hover:opacity-90 rounded-lg transition-opacity self-center"
											title="Guide"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
											</svg>
											Guide
										</a>
									{/if}
								</div>
							</li>
						{/each}
					</ol>
				</div>
				<div class="p-6 border-t border-gray-200 flex flex-wrap gap-3 justify-end">
					<button
						type="button"
						class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						on:click={() => dismiss(false)}
						disabled={dismissing}
					>
						Skip for now
					</button>
					<button
						type="button"
						class="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors bg-theme-button-1 hover:opacity-90"
						on:click={() => { setOnboardingRoute(); dismiss(true); }}
						disabled={dismissing}
					>
						{steps[0] ? 'Start with step 1 — ' + steps[0].title : 'Get started'}
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
