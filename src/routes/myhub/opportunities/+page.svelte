<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatMyhubDate, formatMyhubTime } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: data = $page.data || {};
	$: member = data.member ?? null;
	$: memberEmail = (member?.email || '').toLowerCase().trim();
	$: eventsWithRotas = data.eventsWithRotas || [];
	$: csrfToken = data.csrfToken || '';
	$: spouse = data.spouse || null;
	$: formResult = $page.form;

	let selectedRotas = new Set();
	let signUpWithSpouse = false;

	$: selectedCount = selectedRotas.size;
	$: totalRotas = eventsWithRotas.reduce((sum, { rotas }) => sum + rotas.length, 0);

	// Only submit selections where the user is not already signed up (allows adding more without re-submitting existing)
	$: newSelectionsForSubmit = (() => {
		const out = [];
		for (const { rotas, occurrences } of eventsWithRotas) {
			for (const rota of rotas) {
				for (const occ of occurrences || []) {
					const key = occ.id ? `${rota.id}:${occ.id}` : rota.id;
					if (selectedRotas.has(key) && !isEmailAlreadySignedUp(rota, occ.id)) {
						out.push({ rotaId: rota.id, occurrenceId: occ.id || null });
					}
				}
			}
		}
		return out;
	})();
	$: newSelectionsCount = newSelectionsForSubmit.length;
	$: submittedRotasJson = JSON.stringify(newSelectionsForSubmit);

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'success') {
				notifications.success(result.data?.message || 'You\u2019re signed up. Thank you!');
				await invalidateAll();
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Something went wrong. Please try again.');
			}
			await update({ reset: false });
		};
	}

	function toggleRotaSelection(rotaId, occurrenceId) {
		const key = occurrenceId ? `${rotaId}:${occurrenceId}` : rotaId;
		const next = new Set(selectedRotas);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		selectedRotas = next;
	}

	function isRotaSelected(rotaId, occurrenceId) {
		return selectedRotas.has(occurrenceId ? `${rotaId}:${occurrenceId}` : rotaId);
	}

	function getAssigneesForRotaOccurrence(rota, occurrenceId) {
		return (rota.assigneesByOcc && rota.assigneesByOcc[occurrenceId]) || [];
	}

	function isRotaFull(rota, occurrenceId) {
		const cap = rota.capacity ?? rota.slots ?? 1;
		return getAssigneesForRotaOccurrence(rota, occurrenceId).length >= cap;
	}

	function isEmailAlreadySignedUp(rota, occurrenceId) {
		const assignees = getAssigneesForRotaOccurrence(rota, occurrenceId);
		const emails = new Set();
		if (memberEmail) emails.add(memberEmail);
		if (signUpWithSpouse && spouse?.email) emails.add(spouse.email.toLowerCase().trim());
		return assignees.some(a => a.email && emails.has(a.email.toLowerCase().trim()));
	}

	let hiddenInputNode = null;
	function syncHiddenInput(node) {
		hiddenInputNode = node;
		function update() {
			node.value = submittedRotasJson;
		}
		update();
		const form = node.closest('form');
		if (form) form.addEventListener('submit', update, { capture: true });
		return {
			update,
			destroy() {
				if (form) form.removeEventListener('submit', update, { capture: true });
				hiddenInputNode = null;
			}
		};
	}
	$: if (hiddenInputNode) {
		hiddenInputNode.value = submittedRotasJson;
	}

	let expandedEventId = null;
	function toggleEvent(id) {
		expandedEventId = expandedEventId === id ? null : id;
	}

	const INITIAL_LIMIT = 5;
	let showAll = false;
	$: visibleEvents = showAll ? eventsWithRotas : eventsWithRotas.slice(0, INITIAL_LIMIT);
	$: hasMore = eventsWithRotas.length > INITIAL_LIMIT;

</script>

<svelte:head>
	<title>Sign up for rotas – MyHUB</title>
</svelte:head>

<div class="my-opp">
	<h1 class="my-opp-title">Sign up for rotas</h1>
	<p class="my-opp-lead">Select the rota, tick each date you would like to volunteer for.</p>

	{#if totalRotas === 0}
		<div class="my-card my-card-body">
			<p class="my-muted">No rotas are available for signup right now.</p>
		</div>
	{:else}
		<form method="POST" action="?/signup" use:enhance={handleEnhance} class="my-opp-form">
			<input type="hidden" name="_csrf" value={csrfToken} />
			<input type="hidden" name="selectedRotas" value={submittedRotasJson} use:syncHiddenInput />

			{#if spouse}
				<div class="my-card my-card-body">
					<label class="my-checkbox-wrap">
						<input type="checkbox" name="signUpWithSpouse" bind:checked={signUpWithSpouse} class="my-checkbox" />
						<span class="my-checkbox-label">Sign up for me and {spouse.firstName || 'my partner'}</span>
					</label>
				</div>
			{/if}

			<!-- Available rotas -->
			<div class="my-opp-rotas">
				{#each visibleEvents as { event, rotas, occurrences }}
					{#if rotas.length > 0}
						<div class="my-card my-event-card">
							<button type="button" class="my-event-head" on:click={() => toggleEvent(event.id)} aria-expanded={expandedEventId === event.id}>
								<span class="my-event-title">{event.title}</span>
								<svg class="my-event-chevron" class:open={expandedEventId === event.id} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
							</button>
							{#if expandedEventId === event.id}
								<div class="my-event-body">
									{#each rotas as rota}
										<div class="my-rota-block">
											<p class="my-rota-role">{rota.role}</p>
											{#if occurrences.length > 0}
												<div class="my-occurrences">
													{#each occurrences as occ}
														{@const assignees = getAssigneesForRotaOccurrence(rota, occ.id)}
														{@const cap = rota.capacity ?? rota.slots ?? 1}
														{@const full = assignees.length >= cap}
														{@const selected = isRotaSelected(rota.id, occ.id)}
														{@const already = isEmailAlreadySignedUp(rota, occ.id)}
														{@const canSelect = !full && !already}
														<label class="my-occ-label" class:disabled={!canSelect && !selected} class:selected={selected}>
															<input
																type="checkbox"
																checked={selected}
																disabled={!canSelect && !selected}
																on:change={() => toggleRotaSelection(rota.id, occ.id)}
																class="my-occ-checkbox"
															/>
															<span class="my-occ-text">{formatMyhubDate(occ.startsAt)} · {formatMyhubTime(occ.startsAt)}</span>
															<span class="my-occ-meta">{assignees.length}/{cap} filled</span>
															{#if full}<span class="my-occ-full">Full</span>{/if}
															{#if already}<span class="my-occ-done" aria-hidden="true">✓ You</span>{/if}
														</label>
													{/each}
												</div>
											{:else}
												<p class="my-muted text-sm">No dates available.</p>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				{/each}
			</div>

			{#if hasMore && !showAll}
				<button type="button" class="my-see-more-btn" on:click={() => { showAll = true; }}>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
					See all {eventsWithRotas.length} opportunities
				</button>
			{/if}

			{#if formResult?.type === 'failure' && formResult.data?.error}
				<div class="my-alert my-alert-error" role="alert">
					<p>{formResult.data.error}</p>
				</div>
			{/if}

			<div class="my-opp-bottom">
				<a href="/myhub/availability" class="my-btn my-opp-away-btn">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					Set away dates
				</a>
				<button type="submit" disabled={newSelectionsCount === 0} class="my-btn my-btn-primary my-opp-submit">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					Sign up {newSelectionsCount > 0 ? `(${newSelectionsCount})` : ''}
				</button>
			</div>
		</form>
	{/if}
</div>

<NotificationPopup />

<style>
	.my-opp { padding-bottom: 1rem; }
	@media (min-width: 1024px) {
		.my-opp { padding-bottom: 6rem; }
	}
	.my-opp-title { font-size: 1.5rem; font-weight: 700; color: #111827; margin-bottom: 0.5rem; }
	.my-opp-lead { font-size: 1.0625rem; color: #4b5563; margin-bottom: 1.5rem; line-height: 1.5; }
	.my-opp-form .my-card { margin-bottom: 1.5rem; }
	.my-event-card { padding: 0; overflow: hidden; }
	.my-event-head {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		min-height: 3.5rem;
		background: #f9fafb;
		border: none;
		border-bottom: 1px solid #e5e7eb;
		font-size: 1.125rem;
		font-weight: 600;
		color: #111827;
		text-align: left;
		cursor: pointer;
	}
	.my-event-head:hover { background: #f3f4f6; }
	.my-event-title { flex: 1; }
	.my-event-chevron { width: 1.5rem; height: 1.5rem; flex-shrink: 0; transition: transform 0.2s; }
	.my-event-chevron.open { transform: rotate(180deg); }
	.my-event-body { padding: 1rem 1.25rem; }
	.my-rota-block { margin-bottom: 1.25rem; }
	.my-rota-block:last-child { margin-bottom: 0; }
	.my-rota-role { font-size: 1.0625rem; font-weight: 600; color: #374151; margin-bottom: 0.75rem; }
	.my-occurrences { display: flex; flex-direction: column; gap: 0.5rem; }
	.my-occ-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		min-height: 3rem;
		border: 2px solid #e5e7eb;
		border-radius: 0.75rem;
		cursor: pointer;
		background: #fff;
		transition: border-color 0.15s, background 0.15s;
	}
	.my-occ-label:hover:not(.disabled) { border-color: #93c5fd; background: #eff6ff; }
	.my-occ-label.selected { border-color: #2563eb; background: #eff6ff; }
	.my-occ-label.disabled { opacity: 0.7; cursor: not-allowed; }
	.my-occ-checkbox { width: 1.375rem; height: 1.375rem; flex-shrink: 0; accent-color: #2563eb; }
	.my-occ-text { font-size: 1.0625rem; font-weight: 600; color: #111827; flex: 1; }
	.my-occ-meta { font-size: 0.9375rem; color: #6b7280; }
	.my-occ-full { font-size: 0.75rem; font-weight: 700; background: #dc2626; color: #fff; padding: 0.2rem 0.5rem; border-radius: 0.25rem; }
	.my-occ-done { font-size: 0.875rem; color: #059669; font-weight: 600; }
	.my-opp-bottom {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 50;
		background: #fff;
		border-top: 2px solid #e5e7eb;
		padding: 1rem 1.25rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		box-shadow: 0 -4px 12px rgba(0,0,0,0.06);
	}
	.my-opp-away-btn {
		font-size: 1rem;
		font-weight: 600;
		color: #2563eb;
		background: #eff6ff;
		border: 2px solid #2563eb;
		text-decoration: none;
		padding: 0.75rem 1.25rem;
		min-height: 3.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border-radius: 0.75rem;
		transition: background 0.2s, border-color 0.2s;
	}
	.my-opp-away-btn:hover {
		background: #dbeafe;
		border-color: #1d4ed8;
		color: #1d4ed8;
	}
	.my-opp-submit {
		min-height: 3.5rem;
		padding: 0.875rem 1.75rem;
		font-size: 1.125rem;
		font-weight: 700;
	}
	.my-checkbox-wrap { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; min-height: 2.75rem; }
	.my-checkbox { width: 1.25rem; height: 1.25rem; accent-color: #2563eb; }
	.my-checkbox-label { font-size: 1rem; font-weight: 500; color: #374151; }
	.my-card-body { padding: 1.5rem; }
	@media (min-width: 640px) { .my-card-body { padding: 2rem; } }
	.my-card { background: #fff; border-radius: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); border: 1px solid #e5e7eb; }
	.my-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; border-radius: 0.75rem; border: none; cursor: pointer; transition: opacity 0.2s; }
	.my-btn:disabled { opacity: 0.6; cursor: not-allowed; }
	.my-btn-primary { background: #2563eb; color: #fff; font-weight: 700; }
	.my-btn-primary:hover:not(:disabled) { background: #1d4ed8; }
	.my-alert { padding: 1rem 1.25rem; border-radius: 0.75rem; border: 2px solid; font-size: 1rem; line-height: 1.5; }
	.my-alert-error { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
	.my-muted { color: #6b7280; }
	.my-see-more-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 1rem;
		background: #fff;
		border: 2px dashed #d1d5db;
		border-radius: 0.75rem;
		color: #4b5563;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		margin-bottom: 1rem;
		transition: border-color 0.15s, color 0.15s;
	}
	.my-see-more-btn:hover { border-color: #2563eb; color: #2563eb; }
</style>
