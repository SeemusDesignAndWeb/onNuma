<script>
	/** @type {string} */
	export let htmlContent = '';
	/** @type {string} */
	export let title = '';
</script>

<div class="policy-doc">
	<div class="policy-doc-inner w-full">
		{#if title}
			<h1 class="policy-title">{title}</h1>
		{/if}
		<div class="prose prose-lg max-w-none p-6 md:p-8 bg-white shadow rounded-lg overflow-hidden">
			{@html htmlContent}
		</div>
		<footer class="policy-footer">
			<nav>
				<a href="/">Home</a>
				<a href="/terms">Terms &amp; Conditions</a>
				<a href="/privacy">Privacy Policy</a>
				<a href="/refund-policy">Refund Policy</a>
			</nav>
			<p>&copy; {new Date().getFullYear()} Seemus Design &amp; Web, trading as OnNuma.</p>
		</footer>
	</div>
</div>

<style>
	.policy-doc {
		padding: 2rem 1rem;
		width: 100%;
		max-width: 100%;
	}
	.policy-doc-inner {
		width: 100%;
		max-width: 100%;
	}

	.policy-title {
		font-size: 2rem;
		font-weight: 700;
		color: #1f2937;
		margin-bottom: 1.5rem;
		text-align: center;
	}

	:global(.policy-doc .prose) {
		color: #374151;
	}

	:global(.policy-doc .prose h1) {
		color: #1f2937;
		font-size: 2.25em;
		font-weight: 700;
		margin-top: 0;
		margin-bottom: 0.75em;
		border-bottom: 2px solid #e5e7eb;
		padding-bottom: 0.5em;
	}

	:global(.policy-doc .prose h2) {
		color: #1f2937;
		font-size: 1.875em;
		font-weight: 600;
		margin-top: 2em;
		margin-bottom: 1em;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.3em;
	}

	:global(.policy-doc .prose h3) {
		color: #374151;
		font-size: 1.5em;
		font-weight: 600;
		margin-top: 1.5em;
		margin-bottom: 0.75em;
	}

	:global(.policy-doc .prose h4) {
		color: #4b5563;
		font-size: 1.25em;
		font-weight: 600;
		margin-top: 1.25em;
		margin-bottom: 0.5em;
	}

	:global(.policy-doc .prose p) {
		margin-bottom: 1em;
		margin-top: 1em;
		line-height: 1.75;
		font-size: 1em;
	}

	:global(.policy-doc .prose p:first-child) {
		margin-top: 0;
	}

	:global(.policy-doc .prose h1 + p, .policy-doc .prose h2 + p, .policy-doc .prose h3 + p, .policy-doc .prose h4 + p) {
		margin-top: 0.5em;
	}

	:global(.policy-doc .prose p + ul, .policy-doc .prose p + ol) {
		margin-top: 0.5em;
	}

	:global(.policy-doc .prose ul, .policy-doc .prose ol) {
		margin-bottom: 1em;
		margin-top: 1em;
		padding-left: 1.625em;
		list-style-type: disc;
	}

	:global(.policy-doc .prose ol) {
		list-style-type: decimal;
	}

	:global(.policy-doc .prose li) {
		margin-bottom: 0.5em;
		line-height: 1.75;
		display: list-item;
		font-size: 1em;
	}

	:global(.policy-doc .prose strong) {
		color: #1f2937;
		font-weight: 600;
	}

	:global(.policy-doc .prose a) {
		color: #2563eb;
		text-decoration: underline;
	}

	:global(.policy-doc .prose a:hover) {
		color: #1d4ed8;
	}

	:global(.policy-doc .prose code) {
		background-color: #f3f4f6;
		padding: 0.125em 0.375em;
		border-radius: 0.25em;
		font-size: 0.875em;
	}

	:global(.policy-doc .prose hr) {
		border: none;
		border-top: 1px solid #e5e7eb;
		margin: 2em 0;
	}

	.policy-footer {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e5e7eb;
		text-align: center;
		font-size: 0.8125rem;
		color: #6b7280;
	}

	.policy-footer nav {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem 1.25rem;
		margin-bottom: 0.5rem;
	}

	.policy-footer nav a {
		color: #4b5563;
		text-decoration: none;
		transition: color 0.15s;
	}

	.policy-footer nav a:hover {
		color: #1f2937;
		text-decoration: underline;
	}

	.policy-footer p {
		margin: 0;
	}
</style>
