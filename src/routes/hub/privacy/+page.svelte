<script>
	import { page } from '$app/stores';
	
	$: htmlContent = $page.data?.privacyPolicyHtml || '<p>Loading privacy policy...</p>';
</script>

<div class="flex-1 p-6 w-full max-w-full">
	<div class="w-full max-w-full">
		<div class="bg-white shadow rounded-lg overflow-hidden">
			<div class="prose prose-lg max-w-none p-6 md:p-8">
				{@html htmlContent}
			</div>
		</div>
	</div>
</div>

<style>
	:global(.prose) {
		color: #374151;
	}

	:global(.prose h1) {
		color: #1f2937;
		font-size: 2.25em;
		font-weight: 700;
		margin-top: 0;
		margin-bottom: 0.75em;
		border-bottom: 2px solid #e5e7eb;
		padding-bottom: 0.5em;
	}

	:global(.prose h2) {
		color: #1f2937;
		font-size: 1.875em;
		font-weight: 600;
		margin-top: 2em;
		margin-bottom: 1em;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.3em;
	}

	:global(.prose h3) {
		color: #374151;
		font-size: 1.5em;
		font-weight: 600;
		margin-top: 1.5em;
		margin-bottom: 0.75em;
	}

	:global(.prose h4) {
		color: #4b5563;
		font-size: 1.25em;
		font-weight: 600;
		margin-top: 1.25em;
		margin-bottom: 0.5em;
	}

	:global(.prose p) {
		margin-bottom: 1em;
		margin-top: 1em;
		line-height: 1.75;
		font-size: 1em;
	}

	:global(.prose p:first-child) {
		margin-top: 0;
	}

	:global(.prose p:last-child) {
		margin-bottom: 0;
	}

	:global(.prose h1 + p, .prose h2 + p, .prose h3 + p, .prose h4 + p) {
		margin-top: 0.5em;
	}

	:global(.prose p + ul, .prose p + ol) {
		margin-top: 0.5em;
	}

	:global(.prose ul + p, .prose ol + p) {
		margin-top: 1em;
	}

	:global(.prose ul, .prose ol) {
		margin-bottom: 1em;
		margin-top: 1em;
		padding-left: 1.625em;
		list-style-type: disc;
	}

	:global(.prose ol) {
		list-style-type: decimal;
	}

	:global(.prose li) {
		margin-bottom: 0.5em;
		line-height: 1.75;
		display: list-item;
		font-size: 1em;
	}

	:global(.prose strong) {
		color: #1f2937;
		font-weight: 600;
	}

	:global(.prose em) {
		font-style: italic;
	}

	:global(.prose a) {
		color: #2563eb;
		text-decoration: underline;
	}

	:global(.prose a:hover) {
		color: #1d4ed8;
	}

	:global(.prose code) {
		background-color: #f3f4f6;
		padding: 0.125em 0.375em;
		border-radius: 0.25em;
		font-size: 0.875em;
		font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
	}

	:global(.prose hr) {
		border: none;
		border-top: 1px solid #e5e7eb;
		margin: 2em 0;
	}

	:global(.prose blockquote) {
		border-left: 4px solid #3b82f6;
		padding-left: 1em;
		margin-left: 0;
		color: #6b7280;
		font-style: italic;
	}
</style>
