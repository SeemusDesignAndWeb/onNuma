<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { getOnboardingSteps, ONBOARDING_ROUTE_STORAGE_KEY } from '$lib/crm/onboardingSteps.js';

	export let admin = null;
	export let superAdminEmail = null;
	export let organisationAreaPermissions = null;

	$: steps = getOnboardingSteps(admin, superAdminEmail, organisationAreaPermissions);
	$: pathname = ($page?.url?.pathname ?? '').replace(/\/$/, '') || '/';

	function stepMatchesPath(step, p) {
		if (p.startsWith('/hub/help/step/')) {
			const stepId = p.replace(/^\/hub\/help\/step\//, '').split('/')[0];
			return step.id === stepId;
		}
		const href = step.href;
		return p === href || (href !== '/hub' && p.startsWith(href + '/'));
	}
	function matchesStep(step) {
		return stepMatchesPath(step, pathname);
	}
	// Use most specific (longest) matching href so the correct step is current after navigation
	$: currentIndex = (() => {
		const matching = steps
			.map((s, i) => ({ step: s, index: i }))
			.filter(({ step }) => stepMatchesPath(step, pathname));
		if (matching.length === 0) return -1;
		const best = matching.reduce((a, b) => (a.step.href.length >= b.step.href.length ? a : b));
		return best.index;
	})();
	$: currentStep = currentIndex >= 0 ? steps[currentIndex] : null;
	$: prevStep = currentIndex > 0 ? steps[currentIndex - 1] : null;
	$: nextStep = currentIndex >= 0 && currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;

	let hiddenByUser = false;
	$: visible = browser && !hiddenByUser && typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ONBOARDING_ROUTE_STORAGE_KEY) === 'true';
	$: showBar = steps.length > 0 && !hiddenByUser && (pathname === '/hub/help' || pathname.startsWith('/hub/help/step/') || visible);

	// Guide popup: show help content for a step
	let guideOpen = false;
	let guideStepIndex = 0;
	$: guideStep = steps[guideStepIndex] ?? null;

	function openGuide() {
		guideStepIndex = currentIndex >= 0 ? currentIndex : 0;
		guideOpen = true;
	}
	function closeGuide() {
		guideOpen = false;
	}
	function setGuideStepIndex(index) {
		if (index >= 0 && index < steps.length) guideStepIndex = index;
	}

	$: stepsWithHelp = steps.filter((s) => s.helpContent);
	function handleGuideKeydown(e) {
		if (e.key === 'Escape') closeGuide();
	}

	function hide() {
		hiddenByUser = true;
		visible = false;
		if (browser) sessionStorage.setItem(ONBOARDING_ROUTE_STORAGE_KEY, 'false');
	}
</script>

{#if showBar}
	<nav class="flex-shrink-0 w-full border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8 py-3 shadow-sm" aria-label="Onboarding route">
		<div class="flex flex-wrap items-end gap-3 sm:gap-4">
			<span class="text-xs font-medium text-gray-500 uppercase tracking-wider self-center mr-1">Route</span>
			{#if prevStep}
				<a
					href={prevStep.href}
					class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-theme-button-1 transition-colors flex-shrink-0"
					title="Previous: {prevStep.title}"
					aria-label="Previous step"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
					</svg>
				</a>
			{/if}
			{#each steps as step, i}
				{@const isCurrent = matchesStep(step)}
				<a
					href={step.href}
					class="inline-flex flex-col items-center rounded-lg px-2.5 py-1.5 min-w-[4rem] text-sm font-medium transition-colors {isCurrent
						? 'bg-theme-button-1 text-white'
						: 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}"
					title={step.title}
				>
					<span class="flex h-6 w-6 items-center justify-center rounded text-xs font-bold {isCurrent ? 'bg-white/20' : 'bg-gray-200 text-gray-600'}">
						{i + 1}
					</span>
					<span class="mt-1 text-center leading-tight">{step.title}</span>
				</a>
			{/each}
			{#if nextStep}
				<a
					href={nextStep.href}
					class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-theme-button-1 transition-colors"
					title="Next: {nextStep.title}"
					aria-label="Next step"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
					</svg>
				</a>
			{/if}
			<div class="ml-auto inline-flex items-center gap-2">
				{#if stepsWithHelp.length > 0}
					<button
						type="button"
						on:click={openGuide}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-theme-button-1 hover:opacity-90 rounded-lg transition-opacity"
						title="Open guide"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
						</svg>
						Guide
					</button>
				{/if}
				<button
					type="button"
					on:click={hide}
					class="inline-flex items-center px-2.5 py-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
				>
					Hide
				</button>
			</div>
		</div>
	</nav>

	{#if guideOpen && steps.length > 0}
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/60 p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="guide-popup-title"
			on:keydown={handleGuideKeydown}
			on:click={closeGuide}
		>
			<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
			<div
				class="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col"
				on:click|stopPropagation
				on:keydown={(e) => { if (e.key === 'Escape') closeGuide(); e.stopPropagation(); }}
				role="document"
			>
				<div class="p-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
					<h2 id="guide-popup-title" class="text-base font-semibold text-gray-900">Guide</h2>
					{#if stepsWithHelp.length > 1}
						<select
							class="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-theme-button-1/40 focus:border-theme-button-1"
							value={guideStepIndex}
							on:change={(e) => setGuideStepIndex(Number(e.currentTarget.value))}
						>
							{#each steps as step, i}
								{#if step.helpContent}
									<option value={i}>{step.title}</option>
								{/if}
							{/each}
						</select>
					{/if}
					<button
						type="button"
						on:click={closeGuide}
						class="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100"
						aria-label="Close"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<div class="p-4 overflow-y-auto flex-1 text-sm text-gray-700 guide-popup-content">
					{#if guideStep?.helpContent}
						{@html guideStep.helpContent}
					{:else}
						<p>No guide for this step.</p>
					{/if}
				</div>
				{#if guideStep?.href}
					<div class="p-4 border-t border-gray-200">
						<a
							href={guideStep.href}
							class="inline-flex items-center text-sm font-medium text-theme-button-1 hover:underline"
						>
							Go to {guideStep.title}
							<svg class="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						</a>
					</div>
				{/if}
			</div>
		</div>
	{/if}
{/if}

<style>
	:global(.guide-popup-content h3) {
		font-size: 0.875rem;
		font-weight: 600;
		color: #111827;
		margin-top: 0.75rem;
		margin-bottom: 0.25rem;
	}
	:global(.guide-popup-content h3:first-child) {
		margin-top: 0;
	}
	:global(.guide-popup-content p) {
		margin-bottom: 0.5rem;
	}
	:global(.guide-popup-content ul) {
		list-style-type: disc;
		padding-left: 1.25rem;
		margin-bottom: 0.5rem;
	}
	:global(.guide-popup-content a) {
		color: var(--color-button-1, #0284c7);
	}
	:global(.guide-popup-content a:hover) {
		text-decoration: underline;
	}
	:global(.guide-popup-content code) {
		background: #f3f4f6;
		padding: 0 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}
</style>
