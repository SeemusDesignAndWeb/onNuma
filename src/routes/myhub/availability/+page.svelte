<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatDateLongUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: data = $page.data || {};
	$: csrfToken = data?.csrfToken || '';
	$: holidays = data?.holidays || [];
	$: formResult = $page.form;

	let startDate = '';
	let endDate = '';
	let isAdding = false;
	let isRemoving = {};
	let showAddForm = false;

	// Get today's date in YYYY-MM-DD for min attribute
	const today = new Date().toISOString().split('T')[0];

	// When start date changes, ensure end date is >= start
	$: if (startDate && endDate && endDate < startDate) {
		endDate = startDate;
	}

	// Separate upcoming and past holidays
	$: now = new Date();
	$: upcomingHolidays = holidays.filter((h) => new Date(h.endDate) >= now);
	$: pastHolidays = holidays.filter((h) => new Date(h.endDate) < now);

	// Handle form results
	let lastProcessed = null;
	$: if (formResult && formResult !== lastProcessed) {
		lastProcessed = formResult;
		if (formResult?.success) {
			notifications.success(formResult.message || 'Done.');
			startDate = '';
			endDate = '';
			showAddForm = false;
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	function handleAddEnhance() {
		isAdding = true;
		return async ({ update }) => {
			await update({ reset: false });
			isAdding = false;
		};
	}

	function handleRemoveEnhance(holidayId) {
		isRemoving = { ...isRemoving, [holidayId]: true };
		return async ({ update }) => {
			await update({ reset: false });
			isRemoving = { ...isRemoving, [holidayId]: false };
		};
	}

	function formatRange(h) {
		const start = formatDateLongUK(h.startDate);
		const end = formatDateLongUK(h.endDate);
		if (start === end) return start;
		return `${start} – ${end}`;
	}

	function daysCount(h) {
		const s = new Date(h.startDate);
		const e = new Date(h.endDate);
		const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
		return diff;
	}
</script>

<svelte:head>
	<title>Availability – MyHUB</title>
</svelte:head>

<div class="my-page-content">
	<h1 class="my-heading">Availability</h1>
	<p class="my-lead">
		Set the dates when you're away or unavailable. You won't be scheduled for rotas during these periods.
	</p>

	<!-- Add new away period -->
	{#if !showAddForm}
		<button type="button" class="my-btn my-btn-primary my-btn-add" on:click={() => (showAddForm = true)}>
			<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
			</svg>
			Add away dates
		</button>
	{:else}
		<div class="my-card">
			<div class="my-card-header">
				<h2 class="my-heading-2">Add away dates</h2>
			</div>
			<div class="my-card-body">
				<form method="POST" action="?/add" use:enhance={handleAddEnhance} class="my-form">
					<input type="hidden" name="_csrf" value={csrfToken} />

					<div class="my-field-row">
						<div class="my-field">
							<label class="my-label" for="avail-start">From</label>
							<input
								type="date"
								id="avail-start"
								name="startDate"
								bind:value={startDate}
								min={today}
								required
								class="my-input"
							/>
						</div>
						<div class="my-field">
							<label class="my-label" for="avail-end">To</label>
							<input
								type="date"
								id="avail-end"
								name="endDate"
								bind:value={endDate}
								min={startDate || today}
								required
								class="my-input"
							/>
						</div>
					</div>

					{#if startDate && endDate}
						<p class="my-preview">
							You'll be marked as <strong>away</strong> from <strong>{formatDateLongUK(startDate + 'T00:00:00')}</strong> to <strong>{formatDateLongUK(endDate + 'T00:00:00')}</strong>
							({Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1} {Math.round((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1 === 1 ? 'day' : 'days'}).
						</p>
					{/if}

					<div class="my-form-actions">
						<button type="button" class="my-btn my-btn-secondary" on:click={() => (showAddForm = false)} disabled={isAdding}>
							Cancel
						</button>
						<button type="submit" class="my-btn my-btn-primary" disabled={isAdding || !startDate || !endDate}>
							{#if isAdding}
								<svg class="my-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Adding...
							{:else}
								Add away dates
							{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- Upcoming away periods -->
	{#if upcomingHolidays.length > 0}
		<div class="my-section">
			<h2 class="my-heading-2">Upcoming away dates</h2>
			<ul class="my-holiday-list" role="list">
				{#each upcomingHolidays as h (h.id)}
					<li class="my-holiday-item">
						<div class="my-holiday-info">
							<span class="my-holiday-range">{formatRange(h)}</span>
							<span class="my-holiday-days">
								{daysCount(h)} {daysCount(h) === 1 ? 'day' : 'days'}
							</span>
						</div>
						<form method="POST" action="?/remove" use:enhance={() => handleRemoveEnhance(h.id)} class="my-holiday-remove">
							<input type="hidden" name="_csrf" value={csrfToken} />
							<input type="hidden" name="holidayId" value={h.id} />
							<button
								type="submit"
								class="my-btn-remove"
								disabled={isRemoving[h.id]}
								aria-label="Remove away dates {formatRange(h)}"
							>
								{#if isRemoving[h.id]}
									<svg class="my-spinner-sm" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
									Remove
								{/if}
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<!-- Empty state -->
	{#if upcomingHolidays.length === 0 && !showAddForm}
		<div class="my-card">
			<div class="my-card-body my-empty">
				<svg class="my-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<p class="my-empty-text">You don't have any away dates set.</p>
				<p class="my-empty-sub">When you're going on holiday or unavailable, add your dates here so you won't be scheduled for rotas.</p>
			</div>
		</div>
	{/if}

	<!-- Past away periods -->
	{#if pastHolidays.length > 0}
		<details class="my-section my-past">
			<summary class="my-past-summary">
				Past away dates ({pastHolidays.length})
			</summary>
			<ul class="my-holiday-list" role="list">
				{#each pastHolidays as h (h.id)}
					<li class="my-holiday-item my-holiday-past">
						<div class="my-holiday-info">
							<span class="my-holiday-range">{formatRange(h)}</span>
							<span class="my-holiday-days">
								{daysCount(h)} {daysCount(h) === 1 ? 'day' : 'days'}
							</span>
						</div>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
</div>

<NotificationPopup />

<style>
	.my-page-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}
	.my-heading {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: -0.5rem;
	}
	@media (min-width: 640px) {
		.my-heading {
			font-size: 1.75rem;
		}
	}
	.my-heading-2 {
		font-size: 1.125rem;
		font-weight: 700;
		color: #111827;
	}
	.my-lead {
		font-size: 1.0625rem;
		color: #4b5563;
		line-height: 1.5;
		margin-bottom: -0.25rem;
	}
	.my-section {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.my-card {
		background: #fff;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
		border: 1px solid #e5e7eb;
		overflow: hidden;
	}
	.my-card-header {
		padding: 1.25rem 1.5rem 0;
	}
	@media (min-width: 640px) {
		.my-card-header {
			padding: 1.5rem 2rem 0;
		}
	}
	.my-card-body {
		padding: 1.5rem;
	}
	@media (min-width: 640px) {
		.my-card-body {
			padding: 1.5rem 2rem 2rem;
		}
	}
	.my-form {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	.my-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}
	.my-field-row {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	@media (min-width: 640px) {
		.my-field-row {
			flex-direction: row;
			gap: 1rem;
		}
	}
	.my-label {
		font-size: 1.0625rem;
		font-weight: 600;
		color: #374151;
	}
	.my-input {
		width: 100%;
		min-height: 3.25rem;
		padding: 0.75rem 1rem;
		font-size: 1.125rem;
		border: 2px solid #d1d5db;
		border-radius: 0.75rem;
		color: #111827;
		background: #fff;
	}
	.my-input:focus {
		outline: none;
		border-color: #4A97D2;
		box-shadow: 0 0 0 4px rgba(74, 151, 210, 0.2);
	}
	.my-preview {
		font-size: 1rem;
		color: #4b5563;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 0.75rem;
		padding: 0.875rem 1rem;
		line-height: 1.5;
	}
	.my-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 3.5rem;
		padding: 0.875rem 1.5rem;
		font-size: 1.125rem;
		font-weight: 700;
		border-radius: 0.75rem;
		border: none;
		cursor: pointer;
		transition: opacity 0.2s, background 0.2s;
	}
	.my-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.my-btn-primary {
		background: #2563eb;
		color: #fff;
	}
	.my-btn-primary:hover:not(:disabled) {
		background: #1d4ed8;
	}
	.my-btn-secondary {
		background: #fff;
		color: #374151;
		border: 2px solid #d1d5db;
	}
	.my-btn-secondary:hover:not(:disabled) {
		background: #f9fafb;
		border-color: #9ca3af;
	}
	.my-btn-add {
		align-self: flex-start;
	}
	.my-form-actions {
		display: flex;
		flex-direction: column-reverse;
		gap: 0.75rem;
		padding-top: 0.25rem;
	}
	@media (min-width: 640px) {
		.my-form-actions {
			flex-direction: row;
			justify-content: flex-end;
		}
	}
	/* Holiday list */
	.my-holiday-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.my-holiday-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.25rem;
		background: #fff;
		border: 2px solid #e5e7eb;
		border-radius: 0.75rem;
	}
	.my-holiday-past {
		opacity: 0.6;
	}
	.my-holiday-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}
	.my-holiday-range {
		font-size: 1.0625rem;
		font-weight: 600;
		color: #111827;
	}
	.my-holiday-days {
		font-size: 0.9375rem;
		color: #6b7280;
	}
	.my-holiday-remove {
		flex-shrink: 0;
	}
	.my-btn-remove {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		min-height: 2.75rem;
		font-size: 0.9375rem;
		font-weight: 600;
		color: #dc2626;
		background: #fff;
		border: 2px solid #fecaca;
		border-radius: 0.75rem;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s;
	}
	.my-btn-remove:hover:not(:disabled) {
		background: #fef2f2;
		border-color: #f87171;
	}
	.my-btn-remove:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	/* Empty state */
	.my-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 2.5rem 1.5rem;
	}
	.my-empty-icon {
		width: 3rem;
		height: 3rem;
		color: #9ca3af;
		margin-bottom: 1rem;
	}
	.my-empty-text {
		font-size: 1.125rem;
		font-weight: 600;
		color: #374151;
		margin-bottom: 0.5rem;
	}
	.my-empty-sub {
		font-size: 1rem;
		color: #6b7280;
		max-width: 28rem;
		line-height: 1.5;
	}
	/* Past section */
	.my-past {
		margin-top: 0.5rem;
	}
	.my-past-summary {
		font-size: 1rem;
		font-weight: 600;
		color: #6b7280;
		cursor: pointer;
		padding: 0.5rem 0;
	}
	.my-past-summary:hover {
		color: #374151;
	}
	.my-spinner {
		width: 1.5rem;
		height: 1.5rem;
		animation: spin 0.8s linear infinite;
	}
	.my-spinner-sm {
		width: 1.25rem;
		height: 1.25rem;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
