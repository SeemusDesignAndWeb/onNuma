<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';

	$: data = $page.data || {};
	$: csrfToken = data?.csrfToken || '';
	$: preferences = data?.preferences ?? null;
	$: orgName = data?.orgName ?? '';
	$: formResult = $page.form;

	let subscribed = true;
	let reminderEmail = true;
	let reminderTiming = '1week';
	let aboutMe = '';
	let isSubmitting = false;
	let saveSuccess = false;
	let saveMessage = '';
	let initialized = false;

	$: if (preferences && !initialized) {
		subscribed = preferences.subscribed !== false;
		reminderEmail = preferences.reminderEmail !== false;
		reminderTiming = preferences.reminderTiming || '1week';
		aboutMe = preferences.aboutMe || '';
		initialized = true;
	}

	$: if (formResult?.success) {
		saveSuccess = true;
		saveMessage = formResult.message || 'Preferences saved.';
		if (formResult.preferences) {
			subscribed = formResult.preferences.subscribed !== false;
			reminderEmail = formResult.preferences.reminderEmail !== false;
			reminderTiming = formResult.preferences.reminderTiming || '1week';
			aboutMe = formResult.preferences.aboutMe || '';
		}
	} else if (formResult?.error) {
		saveSuccess = false;
	}

	function handleEnhance() {
		isSubmitting = true;
		saveSuccess = false;
		return async ({ update }) => {
			await update({ reset: false });
			isSubmitting = false;
		};
	}
</script>

<svelte:head>
	<title>My preferences – MyHUB</title>
</svelte:head>

<div class="my-page-content">
	<h1 class="my-pref-page-title">My preferences</h1>

	{#if !preferences}
		<div class="my-alert my-alert-info">
			<p>Sign in to manage your preferences.</p>
		</div>
	{:else}
		{#if saveSuccess}
			<div class="my-save-success" role="status">
				<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>
				<p>{saveMessage}</p>
			</div>
		{/if}
		{#if formResult?.error}
			<div class="my-alert my-alert-warn" role="alert">
				<p>{formResult.error}</p>
			</div>
		{/if}

		<form method="POST" action="?/update" use:enhance={handleEnhance}>
			<input type="hidden" name="_csrf" value={csrfToken} />

			<!-- ── Section 1: Reminders ────────────────────────────── -->
			<section class="my-pref-section-block">
				<h2 class="my-pref-section-title">How I'd like to be reminded</h2>
				<p class="my-pref-section-desc">
					We'll send you a friendly reminder before each shift you're signed up for.
				</p>

				<!-- Email reminders toggle -->
				<div class="my-pref-toggle-row">
					<div class="my-pref-toggle-info">
						<span class="my-pref-toggle-label">Email reminders</span>
						<span class="my-pref-toggle-sub">Reminders sent to {preferences.email}</span>
					</div>
					<label class="my-toggle-wrap">
						<input
							type="checkbox"
							name="reminderEmail"
							bind:checked={reminderEmail}
							class="my-toggle-input"
						/>
						<span class="my-toggle" class:active={reminderEmail}></span>
						<span class="my-toggle-status">{reminderEmail ? 'On' : 'Off'}</span>
					</label>
				</div>

				<!-- How far in advance -->
				{#if reminderEmail}
					<fieldset class="my-timing-fieldset">
						<legend class="my-timing-legend">How far in advance?</legend>
						<div class="my-timing-options">
							{#each [
								{ value: '1day',         label: '1 day before' },
								{ value: '2days',        label: '2 days before' },
								{ value: '1week',        label: '1 week before' },
								{ value: '1week-and-1day', label: '1 week and 1 day before' }
							] as opt}
								<label class="my-timing-option" class:selected={reminderTiming === opt.value}>
									<input
										type="radio"
										name="reminderTiming"
										value={opt.value}
										bind:group={reminderTiming}
										class="my-timing-radio"
									/>
									{opt.label}
								</label>
							{/each}
						</div>
					</fieldset>
				{/if}
			</section>

			<!-- ── Section 2: Newsletters ──────────────────────────── -->
			<section class="my-pref-section-block">
				<h2 class="my-pref-section-title">Newsletters &amp; updates</h2>
				<p class="my-pref-section-desc">
					General newsletters and event updates sent to {preferences.email}.
				</p>
				<div class="my-pref-toggle-row">
					<span class="my-pref-toggle-label">Receive newsletters</span>
					<label class="my-toggle-wrap">
						<input
							type="checkbox"
							name="subscribed"
							bind:checked={subscribed}
							class="my-toggle-input"
						/>
						<span class="my-toggle" class:active={subscribed}></span>
						<span class="my-toggle-status">{subscribed ? 'On' : 'Off'}</span>
					</label>
				</div>
			</section>

			<!-- ── Section 3: About me ─────────────────────────────── -->
			<section class="my-pref-section-block">
				<h2 class="my-pref-section-title">About me</h2>
				<label for="about-me" class="my-pref-section-desc">
					Anything you'd like your coordinator to know? (skills, preferences, anything that helps them plan)
				</label>
				<textarea
					id="about-me"
					name="aboutMe"
					bind:value={aboutMe}
					rows="4"
					maxlength="1000"
					placeholder="e.g. I'm happy to help set up but prefer not to do late evenings. I can drive and am happy to help transport equipment."
					class="my-about-textarea"
				></textarea>
				<p class="my-about-hint">{aboutMe.length}/1000</p>
			</section>

			<!-- ── Save ───────────────────────────────────────────────── -->
			<div class="my-submit-wrap">
				<button type="submit" class="my-save-btn" disabled={isSubmitting}>
					{#if isSubmitting}
						<svg class="my-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Saving…
					{:else}
						Save my preferences
					{/if}
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	.my-page-content {
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.my-pref-page-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--myhub-primary, #2563a8);
		margin: 0 0 1.5rem 0;
	}
	@media (min-width: 640px) {
		.my-pref-page-title { font-size: 1.75rem; }
	}

	/* Success banner */
	.my-save-success {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		background: #f0fdf4;
		border: 2px solid #bbf7d0;
		border-radius: 0.875rem;
		padding: 1rem 1.25rem;
		color: #166534;
		font-size: 1.0625rem;
		font-weight: 500;
		line-height: 1.5;
		margin-bottom: 1.5rem;
	}
	.my-save-success svg {
		width: 1.375rem;
		height: 1.375rem;
		flex-shrink: 0;
		color: #16a34a;
		margin-top: 0.125rem;
	}
	.my-save-success p { margin: 0; }

	/* Section blocks */
	.my-pref-section-block {
		background: #fff;
		border: 1px solid #e5e7eb;
		border-radius: 1rem;
		padding: 1.5rem;
		margin-bottom: 1.25rem;
	}
	@media (min-width: 640px) {
		.my-pref-section-block { padding: 1.75rem 2rem; }
	}
	.my-pref-section-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: #111827;
		margin: 0 0 0.5rem 0;
	}
	.my-pref-section-desc {
		display: block;
		font-size: 1rem;
		color: #6b7280;
		line-height: 1.5;
		margin: 0 0 1.25rem 0;
	}

	/* ── Toggle switch ── */
	.my-pref-toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.my-pref-toggle-info {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.my-pref-toggle-label {
		font-size: 1rem;
		font-weight: 600;
		color: #111827;
	}
	.my-pref-toggle-sub {
		font-size: 0.9375rem;
		color: #6b7280;
	}
	.my-toggle-wrap {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		cursor: pointer;
		flex-shrink: 0;
	}
	.my-toggle-input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.my-toggle {
		position: relative;
		width: 3.25rem;
		height: 2rem;
		background: #d1d5db;
		border-radius: 2rem;
		transition: background 0.2s;
		flex-shrink: 0;
	}
	.my-toggle::after {
		content: '';
		position: absolute;
		top: 0.1875rem;
		left: 0.1875rem;
		width: 1.625rem;
		height: 1.625rem;
		background: #fff;
		border-radius: 50%;
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0,0,0,0.2);
	}
	.my-toggle.active {
		background: var(--myhub-primary, #2563a8);
	}
	.my-toggle.active::after {
		transform: translateX(1.25rem);
	}
	.my-toggle-input:focus-visible + .my-toggle {
		outline: 2px solid var(--myhub-accent, #4A97D2);
		outline-offset: 2px;
	}
	.my-toggle-status {
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
		min-width: 2.25rem;
	}

	/* ── Reminder timing ── */
	.my-timing-fieldset {
		border: none;
		margin: 1.25rem 0 0 0;
		padding: 0;
	}
	.my-timing-legend {
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
		margin-bottom: 0.75rem;
	}
	.my-timing-options {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.my-timing-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		border: 2px solid #e5e7eb;
		border-radius: 0.75rem;
		font-size: 1rem;
		font-weight: 500;
		color: #374151;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s;
	}
	.my-timing-option.selected {
		border-color: var(--myhub-primary, #2563a8);
		background: #eff6ff;
		color: #1e40af;
		font-weight: 600;
	}
	.my-timing-radio {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
		accent-color: var(--myhub-primary, #2563a8);
	}

	/* ── About me ── */
	.my-about-textarea {
		width: 100%;
		border: 1px solid #d1d5db;
		border-radius: 0.75rem;
		padding: 0.875rem 1rem;
		font-size: 1rem;
		font-family: inherit;
		color: #374151;
		line-height: 1.5;
		resize: vertical;
		min-height: 7rem;
		box-sizing: border-box;
		transition: border-color 0.15s;
	}
	.my-about-textarea:focus {
		outline: 2px solid var(--myhub-primary, #2563a8);
		outline-offset: 1px;
		border-color: transparent;
	}
	.my-about-hint {
		font-size: 0.875rem;
		color: #9ca3af;
		text-align: right;
		margin: 0.25rem 0 0 0;
	}

	/* ── Save button ── */
	.my-submit-wrap {
		margin-top: 0.5rem;
		margin-bottom: 1rem;
	}
	.my-save-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 3.5rem;
		padding: 0.875rem 1.5rem;
		background: var(--myhub-primary, #2563a8);
		color: #fff;
		font-size: 1.125rem;
		font-weight: 700;
		border: none;
		border-radius: 0.875rem;
		cursor: pointer;
		transition: background 0.15s;
	}
	.my-save-btn:hover:not(:disabled) {
		background: var(--myhub-primary-hover, #1d4d82);
	}
	.my-save-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.my-spinner {
		width: 1.375rem;
		height: 1.375rem;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin { to { transform: rotate(360deg); } }

	/* Alerts */
	.my-alert {
		padding: 1rem 1.25rem;
		border-radius: 0.75rem;
		border: 2px solid;
		font-size: 1.0625rem;
		line-height: 1.5;
		margin-bottom: 1.25rem;
	}
	.my-alert-info {
		background: #fffbeb;
		border-color: #fde68a;
		color: #92400e;
	}
	.my-alert-warn {
		background: #fef2f2;
		border-color: #fca5a5;
		color: #991b1b;
	}

	/* =====================
	   PRINT STYLESHEET
	   Readable summary of current preferences. No buttons, no chrome.
	   ===================== */
	@media print {
		:global(body) {
			background: #fff !important;
			color: #000 !important;
		}
		.my-pref-page-title {
			font-size: 20pt;
			color: #000 !important;
			margin-bottom: 12pt;
		}
		.my-pref-section-block {
			border: 1pt solid #ccc !important;
			border-radius: 6pt !important;
			padding: 12pt !important;
			margin-bottom: 12pt !important;
			background: #fff !important;
			break-inside: avoid;
		}
		.my-pref-section-title {
			font-size: 14pt;
			color: #000 !important;
			margin-bottom: 4pt;
		}
		.my-pref-section-desc {
			font-size: 11pt;
			color: #444 !important;
			margin-bottom: 8pt;
		}
		/* Hide interactive controls, show static state */
		.my-submit-wrap,
		.my-save-success,
		.my-alert,
		.my-spinner {
			display: none !important;
		}
		.my-toggle-status,
		.my-pref-toggle-label,
		.my-pref-toggle-sub,
		.my-timing-legend,
		.my-timing-option,
		.my-about-textarea,
		.my-about-hint {
			font-size: 11pt;
			color: #000 !important;
		}
	}
</style>
