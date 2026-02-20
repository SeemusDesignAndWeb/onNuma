<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatMyhubDate, formatMyhubTime } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data;
	$: event = data.event || {};
	$: occurrences = data.occurrences || [];
	$: rotas = data.rotas || [];
	$: csrfToken = data.csrfToken || '';
	$: theme = data.theme || null;
	$: logoPath = theme?.logoPath?.trim() || '/assets/OnNuma-Icon.png';

	// step: 'browse' | 'identity' | 'confirmed'
	let step = 'browse';
	let selectedSlots = [];
	$: selectedCount = selectedSlots.length;

	let firstName = '';
	let lastName = '';
	let email = '';
	let phone = '';

	$: formResult = $page.form;
	$: if (formResult?.success) step = 'confirmed';

	function isSlotSelected(rotaId, occurrenceId) {
		return selectedSlots.some((s) => s.rotaId === rotaId && s.occurrenceId === occurrenceId);
	}

	function toggleSlot(rotaId, occurrenceId, rotaRole, occurrenceDate) {
		const idx = selectedSlots.findIndex((s) => s.rotaId === rotaId && s.occurrenceId === occurrenceId);
		if (idx >= 0) {
			selectedSlots = selectedSlots.filter((_, i) => i !== idx);
		} else {
			selectedSlots = [...selectedSlots, { rotaId, occurrenceId, rotaRole, occurrenceDate }];
		}
	}

	$: selectedRotasJson = JSON.stringify(
		selectedSlots.map(({ rotaId, occurrenceId }) => ({ rotaId, occurrenceId }))
	);
</script>

<svelte:head>
	<title>Volunteer signup – {event.title || 'Sign up'}</title>
</svelte:head>

<div class="su-page">
	<header class="su-header">
		<img src={logoPath} alt="" class="su-logo" width="36" height="36" />
		<span class="su-org-name">Volunteer signup</span>
	</header>

	<main class="su-main">
		{#if step === 'confirmed'}
			<div class="su-card su-confirm">
				{#if formResult?.path === 'A'}
					<div class="su-confirm-icon su-confirm-icon--green" aria-hidden="true">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					</div>
					<h1 class="su-confirm-heading">You're signed up!</h1>
					<p class="su-confirm-body">Thanks, {formResult.name || ''}. You've been added to these slots for <strong>{event.title}</strong>:</p>
					<ul class="su-confirm-slots">
						{#each selectedSlots as s}
							<li>{s.rotaRole} — {formatMyhubDate(s.occurrenceDate)}{s.occurrenceDate ? ', ' + formatMyhubTime(s.occurrenceDate) : ''}</li>
						{/each}
					</ul>
					<p class="su-confirm-note">You'll receive a confirmation email shortly.</p>
				{:else}
					<div class="su-confirm-icon su-confirm-icon--amber" aria-hidden="true">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					</div>
					<h1 class="su-confirm-heading">Thank you{formResult?.name ? ', ' + formResult.name : ''}!</h1>
					<p class="su-confirm-body">We've noted your interest in volunteering for <strong>{event.title}</strong>. A coordinator will be in touch to confirm your place.</p>
					<p class="su-confirm-note">No action needed from you — we'll be in contact soon.</p>
				{/if}
			</div>

		{:else if step === 'identity'}
			<div class="su-step-head">
				<button type="button" class="su-back-btn" on:click={() => { step = 'browse'; }}>
					<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
					Back to slots
				</button>
				<h1 class="su-page-title">Tell us about you</h1>
				<p class="su-page-lead">Just a few details so we can get in touch.</p>
			</div>

			<div class="su-card su-selected-summary">
				<p class="su-selected-label">Your selected slots:</p>
				<ul class="su-selected-list">
					{#each selectedSlots as s}
						<li>{s.rotaRole} — {formatMyhubDate(s.occurrenceDate)}{s.occurrenceDate ? ', ' + formatMyhubTime(s.occurrenceDate) : ''}</li>
					{/each}
				</ul>
			</div>

			<form method="POST" action="?/signup" use:enhance class="su-form">
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="selectedRotas" value={selectedRotasJson} />

				{#if formResult?.error}
					<div class="su-alert" role="alert">{formResult.error}</div>
				{/if}

				<div class="su-field-row">
					<div class="su-field">
						<label class="su-label" for="su-firstName">First name <span class="su-required" aria-hidden="true">*</span></label>
						<input id="su-firstName" class="su-input" type="text" name="firstName" bind:value={firstName} required autocomplete="given-name" placeholder="Jane" />
					</div>
					<div class="su-field">
						<label class="su-label" for="su-lastName">Last name</label>
						<input id="su-lastName" class="su-input" type="text" name="lastName" bind:value={lastName} autocomplete="family-name" placeholder="Smith" />
					</div>
				</div>

				<div class="su-field">
					<label class="su-label" for="su-email">Email address <span class="su-required" aria-hidden="true">*</span></label>
					<input id="su-email" class="su-input" type="email" name="email" bind:value={email} required autocomplete="email" placeholder="jane@example.com" />
				</div>

				<div class="su-field">
					<label class="su-label" for="su-phone">Phone <span class="su-optional">(optional)</span></label>
					<input id="su-phone" class="su-input" type="tel" name="phone" bind:value={phone} autocomplete="tel" placeholder="07700 900 000" />
				</div>

				<div class="su-form-footer">
					<button type="button" class="su-btn su-btn-secondary" on:click={() => { step = 'browse'; }}>Back</button>
					<button type="submit" class="su-btn su-btn-primary">
						<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
						Put my hand up
					</button>
				</div>
			</form>

		{:else}
			<div class="su-step-head">
				<h1 class="su-page-title">{event.title || 'Volunteer signup'}</h1>
				<p class="su-page-lead">Choose the dates you can help. Select as many as you like, then tap Continue.</p>
			</div>

			{#if rotas.length === 0}
				<div class="su-card su-empty">
					<p>No volunteer opportunities are available right now. Please check back soon.</p>
				</div>
			{:else}
				<div class="su-rotas">
					{#each rotas as rota}
						<div class="su-card su-rota-card">
							<h2 class="su-rota-title">{rota.role}</h2>
							{#if occurrences.length === 0}
								<p class="su-muted">No upcoming dates available.</p>
							{:else}
								<div class="su-occurrences">
									{#each occurrences as occ}
										{@const count = rota.countsByOcc?.[occ.id] ?? 0}
										{@const full = count >= rota.capacity}
										{@const selected = isSlotSelected(rota.id, occ.id)}
										<button
											type="button"
											class="su-occ-row"
											class:su-occ-row--selected={selected}
											class:su-occ-row--full={full && !selected}
											disabled={full && !selected}
											on:click={() => !full && toggleSlot(rota.id, occ.id, rota.role, occ.startsAt)}
											aria-pressed={selected}
										>
											<span class="su-occ-check" aria-hidden="true">
												{#if selected}
													<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
												{:else}
													<span class="su-occ-circle"></span>
												{/if}
											</span>
											<span class="su-occ-info">
												<span class="su-occ-date">{formatMyhubDate(occ.startsAt)}</span>
												<span class="su-occ-time">{formatMyhubTime(occ.startsAt)}</span>
											</span>
											<span class="su-occ-status">
												{#if full}
													<span class="su-badge su-badge--full">Full</span>
												{:else}
													<span class="su-occ-spots">{rota.capacity - count} {rota.capacity - count === 1 ? 'spot' : 'spots'} left</span>
												{/if}
											</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<div class="su-sticky-footer">
				<span class="su-footer-label">
					{#if selectedCount > 0}
						<span class="su-footer-count">{selectedCount} {selectedCount === 1 ? 'slot' : 'slots'} selected</span>
					{:else}
						<span class="su-footer-hint">Select at least one slot above</span>
					{/if}
				</span>
				<button
					type="button"
					class="su-btn su-btn-primary"
					disabled={selectedCount === 0}
					on:click={() => { step = 'identity'; }}
				>
					Continue
					<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
				</button>
			</div>
		{/if}
	</main>
</div>

<style>
	.su-page { min-height: 100vh; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
	.su-header { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 0.875rem 1.25rem; display: flex; align-items: center; gap: 0.75rem; }
	.su-logo { width: 2.25rem; height: 2.25rem; object-fit: contain; flex-shrink: 0; }
	.su-org-name { font-size: 1rem; font-weight: 600; color: #111827; }
	.su-main { max-width: 40rem; margin: 0 auto; padding: 1.5rem 1rem 8rem; }
	@media (min-width: 640px) { .su-main { padding: 2rem 1.5rem 8rem; } }
	.su-step-head { margin-bottom: 1.5rem; }
	.su-page-title { font-size: 1.625rem; font-weight: 700; color: #111827; margin: 0 0 0.5rem; line-height: 1.2; }
	.su-page-lead { font-size: 1.0625rem; color: #4b5563; margin: 0; line-height: 1.5; }
	.su-card { background: #fff; border-radius: 1rem; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.06); padding: 1.25rem; margin-bottom: 1rem; }
	@media (min-width: 640px) { .su-card { padding: 1.5rem; } }
	.su-empty { color: #6b7280; font-size: 1.0625rem; }
	.su-rotas { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem; }
	.su-rota-card { padding: 0; overflow: hidden; }
	.su-rota-title { font-size: 1.125rem; font-weight: 700; color: #111827; padding: 1rem 1.25rem; border-bottom: 1px solid #f3f4f6; margin: 0; }
	.su-occurrences { display: flex; flex-direction: column; }
	.su-occ-row { display: flex; align-items: center; gap: 0.875rem; padding: 0.875rem 1.25rem; min-height: 3.5rem; border: none; border-bottom: 1px solid #f3f4f6; background: #fff; cursor: pointer; text-align: left; width: 100%; transition: background 0.12s; }
	.su-occ-row:last-child { border-bottom: none; }
	.su-occ-row:hover:not(:disabled):not(.su-occ-row--selected) { background: #f9fafb; }
	.su-occ-row--selected { background: #ecfdf5; }
	.su-occ-row--full { opacity: 0.55; cursor: not-allowed; }
	.su-occ-check { width: 1.5rem; height: 1.5rem; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #4BB170; }
	.su-occ-check svg { width: 1.25rem; height: 1.25rem; }
	.su-occ-circle { display: block; width: 1.25rem; height: 1.25rem; border: 2px solid #d1d5db; border-radius: 50%; }
	.su-occ-row--selected .su-occ-circle { border-color: #4BB170; }
	.su-occ-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.125rem; }
	.su-occ-date { font-size: 1rem; font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.su-occ-time { font-size: 0.875rem; color: #6b7280; }
	.su-occ-status { flex-shrink: 0; }
	.su-occ-spots { font-size: 0.875rem; color: #059669; font-weight: 500; }
	.su-badge { display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 0.25rem; }
	.su-badge--full { background: #fee2e2; color: #dc2626; }
	.su-form { display: flex; flex-direction: column; gap: 1rem; }
	.su-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	@media (max-width: 400px) { .su-field-row { grid-template-columns: 1fr; } }
	.su-field { display: flex; flex-direction: column; gap: 0.375rem; }
	.su-label { font-size: 0.9375rem; font-weight: 600; color: #374151; }
	.su-required { color: #dc2626; }
	.su-optional { font-weight: 400; color: #9ca3af; }
	.su-input { width: 100%; border: 2px solid #d1d5db; border-radius: 0.75rem; padding: 0.75rem 1rem; font-size: 1rem; color: #111827; background: #fff; transition: border-color 0.15s; box-sizing: border-box; }
	.su-input:focus { outline: none; border-color: #4BB170; }
	.su-form-footer { display: flex; gap: 0.75rem; justify-content: flex-end; padding-top: 0.5rem; flex-wrap: wrap; }
	.su-selected-summary { border-color: #a7f3d0; background: #ecfdf5; }
	.su-selected-label { font-size: 0.9375rem; font-weight: 600; color: #065f46; margin: 0 0 0.5rem; }
	.su-selected-list { margin: 0; padding: 0 0 0 1.25rem; list-style: disc; color: #065f46; font-size: 0.9375rem; line-height: 1.7; }
	.su-alert { background: #fef2f2; border: 2px solid #fecaca; border-radius: 0.75rem; padding: 0.875rem 1rem; color: #991b1b; font-size: 0.9375rem; line-height: 1.5; }
	.su-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border-radius: 0.75rem; font-size: 1.0625rem; font-weight: 700; padding: 0.875rem 1.5rem; min-height: 3.25rem; cursor: pointer; border: none; transition: background 0.15s, opacity 0.15s; }
	.su-btn:disabled { opacity: 0.55; cursor: not-allowed; }
	.su-btn svg { width: 1.25rem; height: 1.25rem; flex-shrink: 0; }
	.su-btn-primary { background: #4BB170; color: #fff; }
	.su-btn-primary:hover:not(:disabled) { background: #3ea363; }
	.su-btn-secondary { background: #fff; color: #374151; border: 2px solid #d1d5db; }
	.su-btn-secondary:hover { background: #f9fafb; }
	.su-sticky-footer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: #fff; border-top: 2px solid #e5e7eb; padding: 0.875rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; box-shadow: 0 -4px 12px rgba(0,0,0,0.06); }
	.su-footer-count { font-size: 1rem; font-weight: 700; color: #4BB170; }
	.su-footer-hint { font-size: 0.9375rem; color: #9ca3af; }
	.su-back-btn { display: inline-flex; align-items: center; gap: 0.375rem; background: none; border: none; color: #6b7280; font-size: 0.9375rem; font-weight: 500; cursor: pointer; padding: 0; margin-bottom: 1rem; }
	.su-back-btn:hover { color: #374151; }
	.su-back-btn svg { width: 1rem; height: 1rem; }
	.su-muted { color: #9ca3af; font-size: 0.9375rem; padding: 0.75rem 1.25rem; }
	.su-confirm { text-align: center; padding: 2rem 1.5rem; }
	.su-confirm-icon { width: 4rem; height: 4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem; }
	.su-confirm-icon svg { width: 2.5rem; height: 2.5rem; }
	.su-confirm-icon--green { background: #d1fae5; color: #059669; }
	.su-confirm-icon--amber { background: #fef3c7; color: #d97706; }
	.su-confirm-heading { font-size: 1.625rem; font-weight: 700; color: #111827; margin: 0 0 0.75rem; }
	.su-confirm-body { font-size: 1.0625rem; color: #374151; line-height: 1.6; margin: 0 0 1rem; }
	.su-confirm-slots { list-style: none; padding: 0; margin: 0 0 1.25rem; text-align: left; display: inline-block; }
	.su-confirm-slots li { font-size: 1rem; color: #059669; font-weight: 600; padding: 0.25rem 0; }
	.su-confirm-slots li::before { content: '✓  '; }
	.su-confirm-note { font-size: 0.9375rem; color: #6b7280; margin: 0; }
</style>
