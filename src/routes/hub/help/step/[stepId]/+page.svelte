<script>
	export let data = {};
	$: step = data?.step ?? null;
</script>

{#if step}
	<div class="prose prose-sm max-w-none">
		<div class="mb-6">
			<a href="/hub/help" class="text-sm text-theme-button-1 hover:underline">← Back to Help</a>
		</div>
		<h1 class="text-lg font-bold text-gray-900 mb-4">{step.title} — Help</h1>
		<div class="onboarding-step-help text-gray-700 text-sm leading-relaxed space-y-3">
			{@html step.helpContent}
		</div>
		<div class="mt-6 pt-4 border-t border-gray-200">
			<a href={step.href} class="inline-flex items-center px-4 py-2 text-sm font-medium text-white rounded-lg bg-theme-button-1 hover:opacity-90">
				Go to {step.title}
				<svg class="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</a>
		</div>
	</div>
{:else}
	<div class="text-sm text-gray-600">
		<p>Help for this step is not available, or you don’t have access.</p>
		<a href="/hub/help" class="text-theme-button-1 hover:underline">Back to Help</a>
	</div>
{/if}

<style>
	:global(.onboarding-step-help h3) {
		font-size: 0.875rem;
		font-weight: 600;
		color: #111827;
		margin-top: 1rem;
		margin-bottom: 0.25rem;
	}
	:global(.onboarding-step-help p) {
		margin-bottom: 0.5rem;
	}
	:global(.onboarding-step-help ul) {
		list-style-type: disc;
		padding-left: 1.25rem;
		margin-bottom: 0.5rem;
	}
	:global(.onboarding-step-help a) {
		color: var(--color-button-1, #0284c7);
	}
	:global(.onboarding-step-help a:hover) {
		text-decoration: underline;
	}
	:global(.onboarding-step-help code) {
		background: #f3f4f6;
		padding: 0 0.25rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}
</style>
