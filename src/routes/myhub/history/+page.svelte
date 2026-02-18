<script>
	import { page } from '$app/stores';
	import { formatMyhubDate } from '$lib/crm/utils/dateFormat.js';

	$: pastShifts = $page.data?.pastShifts ?? [];
	$: shiftCount = $page.data?.shiftCount ?? 0;
	$: orgName = $page.data?.orgName ?? '';
	$: thankyouMessages = $page.data?.thankyouMessages ?? [];

	function handlePrint() {
		window.print();
	}
	// Show name only; never show sender email (same fix as personal email)
	function senderDisplay(msg) {
		const n = msg.fromName;
		return (n && typeof n === 'string' && !n.includes('@')) ? n : 'Your coordinator';
	}
</script>

<svelte:head>
	<title>My volunteering history</title>
</svelte:head>

<div class="my-page-content">
	<!-- Header -->
	<header class="my-history-header">
		<h1 class="my-history-title">
			Your contribution{orgName ? ` to ${orgName}` : ''}
		</h1>
	</header>

	<!-- Celebratory stat -->
	{#if shiftCount > 0}
		<div class="my-history-stat" aria-label="Total shifts volunteered">
			<p class="my-history-stat-number">{shiftCount}</p>
			<p class="my-history-stat-label">
				{shiftCount === 1 ? "time you've volunteered" : "times you've volunteered"}
			</p>
		</div>
	{/if}

	<!-- Thank-you messages from coordinator -->
	{#if thankyouMessages.length > 0}
		<section aria-label="Messages from your coordinator" class="my-thankyou-section">
			<h2 class="my-thankyou-heading">A note of thanks</h2>
			<div class="my-thankyou-list">
				{#each thankyouMessages as msg}
					<div class="my-thankyou-card" role="article">
						<svg class="my-thankyou-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
						</svg>
						<div class="my-thankyou-body">
							<p class="my-thankyou-message">"{msg.message}"</p>
							<p class="my-thankyou-from">— {senderDisplay(msg)}</p>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Shift list -->
	{#if pastShifts.length > 0}
		<section aria-label="Past shifts">
			<ul class="my-history-list">
				{#each pastShifts as shift}
					<li class="my-history-item">
						<span class="my-history-event">{shift.eventTitle}</span>
						{#if shift.role}
							<span class="my-history-role">{shift.role}</span>
						{/if}
						<span class="my-history-date">{formatMyhubDate(shift.date)}</span>
					</li>
				{/each}
			</ul>
		</section>

		<!-- Print button -->
		<div class="my-history-print-wrap no-print">
			<button type="button" class="my-history-print-btn" on:click={handlePrint}>
				<svg class="my-history-print-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
				</svg>
				Print this page
			</button>
		</div>
	{:else}
		<div class="my-history-empty">
			<p>No past shifts recorded yet — they'll appear here once a shift date has passed.</p>
		</div>
	{/if}
</div>

<style>
	.my-page-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Header */
	.my-history-header {
		margin-bottom: 0.25rem;
	}
	.my-history-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--myhub-primary);
		margin: 0;
		line-height: 1.3;
	}
	@media (min-width: 640px) {
		.my-history-title { font-size: 1.75rem; }
	}

	/* Celebratory stat */
	.my-history-stat {
		background: var(--myhub-primary, #2563a8);
		border-radius: 1.25rem;
		padding: 2rem 1.5rem;
		text-align: center;
		color: #fff;
	}
	.my-history-stat-number {
		font-size: 4rem;
		font-weight: 800;
		line-height: 1;
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.02em;
	}
	@media (min-width: 480px) {
		.my-history-stat-number { font-size: 5rem; }
	}
	.my-history-stat-label {
		font-size: 1.125rem;
		font-weight: 500;
		margin: 0;
		opacity: 0.9;
	}

	/* Shift list */
	.my-history-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	.my-history-item {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		gap: 0.125rem 1rem;
		padding: 1rem 0;
		border-bottom: 1px solid #e5e7eb;
		align-items: baseline;
	}
	.my-history-item:first-child {
		border-top: 1px solid #e5e7eb;
	}
	.my-history-event {
		font-size: 1rem;
		font-weight: 600;
		color: #111827;
		grid-column: 1;
		grid-row: 1;
	}
	.my-history-role {
		font-size: 0.9375rem;
		color: #6b7280;
		grid-column: 1;
		grid-row: 2;
	}
	.my-history-date {
		font-size: 0.9375rem;
		color: #6b7280;
		grid-column: 2;
		grid-row: 1 / 3;
		text-align: right;
		white-space: nowrap;
		align-self: center;
	}

	/* Print button */
	.my-history-print-wrap {
		display: flex;
		justify-content: center;
		padding-top: 0.5rem;
	}
	.my-history-print-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: none;
		border: 2px solid #d1d5db;
		border-radius: 0.75rem;
		color: #374151;
		font-size: 1rem;
		font-weight: 600;
		padding: 0.75rem 1.5rem;
		min-height: 3rem;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}
	.my-history-print-btn:hover {
		background: #f3f4f6;
		border-color: #9ca3af;
	}
	.my-history-print-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}

	/* Thank-you cards */
	.my-thankyou-section {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.my-thankyou-heading {
		font-size: 1.125rem;
		font-weight: 700;
		color: #92400e;
		margin: 0 0 0.75rem 0;
	}
	.my-thankyou-list {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}
	.my-thankyou-card {
		display: flex;
		gap: 1rem;
		background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
		border: 1px solid #fde68a;
		border-radius: 1.25rem;
		padding: 1.25rem 1.5rem;
		align-items: flex-start;
	}
	.my-thankyou-icon {
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
		color: #d97706;
		margin-top: 0.1rem;
	}
	.my-thankyou-body {
		flex: 1;
		min-width: 0;
	}
	.my-thankyou-message {
		font-size: 1.0625rem;
		color: #78350f;
		line-height: 1.6;
		margin: 0 0 0.5rem 0;
		font-style: italic;
	}
	.my-thankyou-from {
		font-size: 0.9375rem;
		color: #92400e;
		font-weight: 600;
		margin: 0;
	}

	/* Empty state */
	.my-history-empty {
		background: #f8fafc;
		border: 1px dashed #cbd5e1;
		border-radius: 1rem;
		padding: 1.75rem;
		color: #64748b;
		font-size: 1.0625rem;
		text-align: center;
		line-height: 1.5;
	}

	/* =====================
	   PRINT STYLESHEET
	   =====================
	   Large text, clean layout, no navigation, no buttons.
	   The layout sidebar/header are hidden by the layout's own print rules.
	*/
	@media print {
		:global(body) {
			background: #fff !important;
			color: #000 !important;
		}

		/* Hide the print button and any no-print elements */
		:global(.no-print),
		.my-history-print-wrap {
			display: none !important;
		}

		.my-history-title {
			font-size: 22pt;
			color: #000 !important;
			margin-bottom: 4pt;
		}

		.my-history-stat {
			background: none !important;
			border: 2pt solid #000;
			border-radius: 8pt;
			padding: 14pt 12pt;
			color: #000 !important;
			margin-bottom: 16pt;
		}
		.my-history-stat-number {
			font-size: 48pt;
			color: #000 !important;
		}
		.my-history-stat-label {
			font-size: 14pt;
			color: #000 !important;
		}

		.my-history-item {
			padding: 8pt 0;
		}
		.my-history-event {
			font-size: 13pt;
			color: #000 !important;
		}
		.my-history-role,
		.my-history-date {
			font-size: 11pt;
			color: #444 !important;
		}

		.my-thankyou-card {
			background: none !important;
			border: 1pt solid #aaa;
			border-radius: 6pt;
			padding: 10pt 12pt;
			break-inside: avoid;
		}
		.my-thankyou-icon { display: none !important; }
		.my-thankyou-message {
			font-size: 12pt;
			color: #000 !important;
		}
		.my-thankyou-from {
			font-size: 11pt;
			color: #444 !important;
		}
		.my-thankyou-heading {
			font-size: 14pt;
			color: #000 !important;
		}
	}
</style>
