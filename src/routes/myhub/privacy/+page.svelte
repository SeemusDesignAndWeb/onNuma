<script>
	import { page } from '$app/stores';

	$: htmlContent = $page.data?.privacyPolicyHtml || '<p>Loading privacy policy...</p>';
</script>

<svelte:head>
	<title>Privacy policy – MyHUB</title>
</svelte:head>

<div class="my-privacy-wrap">
	<div class="my-privacy-card">
		<div class="prose prose-lg max-w-none p-6 md:p-8">
			{@html htmlContent}
		</div>
	</div>
</div>

<style>
	.my-privacy-wrap {
		width: 100%;
		min-width: 0;
		max-width: 100%;
	}
	.my-privacy-card {
		width: 100%;
		max-width: 100%;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
		border-radius: 0.75rem;
		border: 1px solid var(--myhub-card-border, #e2e8f0);
		overflow: hidden;
	}
	:global(.my-privacy-wrap .prose) {
		color: #374151;
	}
	:global(.my-privacy-wrap .prose h1) {
		color: var(--myhub-primary);
		font-size: 2.25em;
		font-weight: 700;
		margin-top: 0;
		margin-bottom: 0.75em;
		border-bottom: 2px solid var(--myhub-card-border, #e2e8f0);
		padding-bottom: 0.5em;
	}
	:global(.my-privacy-wrap .prose h2) {
		color: var(--myhub-primary);
		font-size: 1.875em;
		font-weight: 600;
		margin-top: 2em;
		margin-bottom: 1em;
		border-bottom: 1px solid var(--myhub-card-border, #e2e8f0);
		padding-bottom: 0.3em;
	}
	:global(.my-privacy-wrap .prose h3) {
		color: #374151;
		font-size: 1.5em;
		font-weight: 600;
		margin-top: 1.5em;
		margin-bottom: 0.75em;
	}
	:global(.my-privacy-wrap .prose h4) {
		color: #4b5563;
		font-size: 1.25em;
		font-weight: 600;
		margin-top: 1.25em;
		margin-bottom: 0.5em;
	}
	:global(.my-privacy-wrap .prose p) {
		margin-bottom: 1em;
		margin-top: 1em;
		line-height: 1.75;
		font-size: 1em;
	}
	:global(.my-privacy-wrap .prose p:first-child) {
		margin-top: 0;
	}
	:global(.my-privacy-wrap .prose p:last-child) {
		margin-bottom: 0;
	}
	:global(.my-privacy-wrap .prose h1 + p, .my-privacy-wrap .prose h2 + p, .my-privacy-wrap .prose h3 + p, .my-privacy-wrap .prose h4 + p) {
		margin-top: 0.5em;
	}
	:global(.my-privacy-wrap .prose p + ul, .my-privacy-wrap .prose p + ol) {
		margin-top: 0.5em;
	}
	:global(.my-privacy-wrap .prose ul + p, .my-privacy-wrap .prose ol + p) {
		margin-top: 1em;
	}
	:global(.my-privacy-wrap .prose ul, .my-privacy-wrap .prose ol) {
		margin-bottom: 1em;
		margin-top: 1em;
		padding-left: 1.625em;
		list-style-type: disc;
	}
	:global(.my-privacy-wrap .prose ol) {
		list-style-type: decimal;
	}
	:global(.my-privacy-wrap .prose li) {
		margin-bottom: 0.5em;
		line-height: 1.75;
		display: list-item;
		font-size: 1em;
	}
	:global(.my-privacy-wrap .prose strong) {
		color: #1f2937;
		font-weight: 600;
	}
	:global(.my-privacy-wrap .prose em) {
		font-style: italic;
	}
	:global(.my-privacy-wrap .prose a) {
		color: var(--myhub-primary);
		text-decoration: underline;
	}
	:global(.my-privacy-wrap .prose a:hover) {
		color: var(--myhub-primary-hover);
	}
	:global(.my-privacy-wrap .prose code) {
		background-color: #f3f4f6;
		padding: 0.125em 0.375em;
		border-radius: 0.25em;
		font-size: 0.875em;
		font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
	}
	:global(.my-privacy-wrap .prose hr) {
		border: none;
		border-top: 1px solid var(--myhub-card-border, #e2e8f0);
		margin: 2em 0;
	}
	:global(.my-privacy-wrap .prose blockquote) {
		border-left: 4px solid var(--myhub-accent);
		padding-left: 1em;
		margin-left: 0;
		color: #6b7280;
		font-style: italic;
	}
</style>
