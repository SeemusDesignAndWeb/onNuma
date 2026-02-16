<script>
	import { page } from '$app/stores';
	import { formatDateLongUK, formatTimeUK } from '$lib/crm/utils/dateFormat.js';

	export let data = {};
	$: member = data?.member ?? null;
	$: memberName = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : '';
	$: rotas = data?.rotas ?? [];
	$: loadError = data?.error ?? '';
	$: csrfToken = data?.csrfToken ?? '';
	$: formResult = $page.form;

	$: sortedRotas = [...rotas].sort((a, b) => {
		if (!a.date && !b.date) return 0;
		if (!a.date) return 1;
		if (!b.date) return -1;
		return new Date(a.date) - new Date(b.date);
	});

	let confirmingRotaKey = null; // 'rotaId:occurrenceId' when showing confirm for that item
	function openConfirm(rotaId, occurrenceId) {
		confirmingRotaKey = occurrenceId ? `${rotaId}:${occurrenceId}` : `${rotaId}:`;
	}
	function closeConfirm() {
		confirmingRotaKey = null;
	}
</script>

<svelte:head>
	<title>My rotas – MyHUB</title>
</svelte:head>

<div class="my-page-content">
	<h1 class="my-heading">My rotas</h1>

	{#if loadError}
		<div class="my-alert my-alert-error" role="alert">
			<p>{loadError}</p>
		</div>
	{/if}
	{#if formResult?.error}
		<div class="my-alert my-alert-error" role="alert">
			<p>{formResult.error}</p>
		</div>
	{/if}
	{#if formResult?.success}
		<div class="my-alert my-alert-success" role="status">
			<p>{formResult.message}</p>
		</div>
	{/if}

	{#if sortedRotas.length === 0 && !loadError}
		<div class="my-card">
			<div class="my-card-body">
				<div class="my-alert my-alert-info" role="status">
					<p>You don't have any upcoming rotas yet.</p>
					<p class="mt-4">
						<a href="/myhub/opportunities" class="my-link">Sign up for rotas here</a> if you'd like to volunteer.
					</p>
				</div>
			</div>
		</div>
	{:else}
		<p class="my-lead">
			{#if memberName}Showing rotas for <strong>{memberName}</strong>. {:else}Your upcoming rotas.{/if}
			Thank you for volunteering.
		</p>
		<div class="my-card">
			<div class="my-card-body">
				<ul class="my-rota-list" role="list">
					{#each sortedRotas as rota}
						{@const confirmKey = (rota.occurrenceId ? `${rota.rotaId}:${rota.occurrenceId}` : `${rota.rotaId}:`)}
						<li class="my-rota-item">
							<span class="my-rota-role">{rota.role}</span>
							<span class="my-rota-event">{rota.eventTitle}</span>
							{#if rota.date}
								<p class="my-rota-date">
									<span class="font-semibold">{formatDateLongUK(rota.date)}</span>
									{#if rota.startTime}
										<span class="block mt-0.5">
											{formatTimeUK(rota.startTime)}
											{#if rota.endTime}
												– {formatTimeUK(rota.endTime)}
											{/if}
										</span>
									{/if}
								</p>
							{:else}
								<p class="my-muted">Date to be confirmed</p>
							{/if}
							{#if rota.location}
								<p class="my-rota-location">{rota.location}</p>
							{/if}
							<div class="my-rota-cannot-attend">
								{#if confirmingRotaKey === confirmKey}
									<form method="POST" action="?/cannotVolunteer" class="my-cannot-form">
										<input type="hidden" name="_csrf" value={csrfToken} />
										<input type="hidden" name="rotaId" value={rota.rotaId} />
										<input type="hidden" name="occurrenceId" value={rota.occurrenceId ?? ''} />
										<p class="my-cannot-confirm-text">We'll email the rota owner so they can find a replacement. Are you sure?</p>
										<div class="my-cannot-buttons">
											<button type="button" class="my-btn my-btn-secondary" on:click={closeConfirm}>Cancel</button>
											<button type="submit" class="my-btn my-btn-primary">Notify owner</button>
										</div>
									</form>
								{:else}
									<label class="my-cannot-label">
										<input type="checkbox" on:change={(e) => e.target.checked && openConfirm(rota.rotaId, rota.occurrenceId)} />
										<span>I can no longer volunteer on this date</span>
									</label>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
				<p class="mt-6 text-[1.0625rem] text-gray-600">
					Want to do more?
					<a href="/myhub/opportunities" class="my-btn my-btn-primary my-rota-signup-btn">Sign up for more rotas</a>
				</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.my-heading {
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
		margin-bottom: 0.5rem;
	}
	@media (min-width: 640px) {
		.my-heading {
			font-size: 1.75rem;
		}
	}
	.my-lead {
		font-size: 1.0625rem;
		color: #4b5563;
		margin-bottom: 1.5rem;
		line-height: 1.5;
	}
	.my-card {
		background: #fff;
		border-radius: 1rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.08);
		border: 1px solid #e5e7eb;
		overflow: hidden;
	}
	.my-card-body {
		padding: 1.5rem;
	}
	@media (min-width: 640px) {
		.my-card-body {
			padding: 2rem;
		}
	}
	.my-alert {
		padding: 1rem 1.25rem;
		border-radius: 0.75rem;
		border: 2px solid;
		font-size: 1.0625rem;
		line-height: 1.5;
	}
	.my-alert-error {
		background: #fef2f2;
		border-color: #fecaca;
		color: #991b1b;
	}
	.my-alert-info {
		background: #fffbeb;
		border-color: #fde68a;
		color: #92400e;
	}
	.my-alert-success {
		background: #f0fdf4;
		border-color: #bbf7d0;
		color: #166534;
	}
	.my-rota-cannot-attend {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #e5e7eb;
	}
	.my-cannot-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
		color: #6b7280;
		cursor: pointer;
	}
	.my-cannot-label input { width: auto; }
	.my-cannot-form { margin-top: 0.5rem; }
	.my-cannot-confirm-text {
		font-size: 0.9375rem;
		color: #4b5563;
		margin-bottom: 0.75rem;
	}
	.my-cannot-buttons {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.my-btn {
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		border: 2px solid transparent;
	}
	.my-btn-primary {
		background: #2563eb;
		color: #fff;
		border-color: #2563eb;
	}
	.my-btn-primary:hover {
		background: #1d4ed8;
		border-color: #1d4ed8;
	}
	.my-btn-secondary {
		background: #f3f4f6;
		color: #374151;
		border-color: #e5e7eb;
	}
	.my-btn-secondary:hover {
		background: #e5e7eb;
	}
	.my-muted {
		font-size: 1rem;
		color: #6b7280;
	}
	.my-rota-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
	.my-rota-item {
		padding: 1.25rem;
		background: #f9fafb;
		border: 2px solid #e5e7eb;
		border-radius: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.my-rota-role {
		font-size: 1.125rem;
		font-weight: 700;
		color: #111827;
	}
	.my-rota-event {
		font-size: 1.0625rem;
		color: #374151;
	}
	.my-rota-date {
		font-size: 1.0625rem;
		color: #4b5563;
		margin-top: 0.25rem;
	}
	.my-rota-location {
		font-size: 1rem;
		color: #6b7280;
		margin-top: 0.25rem;
	}
	.my-link {
		font-weight: 600;
		color: #2563eb;
		text-decoration: underline;
	}
	.my-link:hover {
		color: #1d4ed8;
	}
	.my-rota-signup-btn {
		display: inline-flex;
		align-items: center;
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.75rem;
		font-size: 1rem;
		text-decoration: none;
		color: #fff;
	}
	.my-rota-signup-btn:hover {
		text-decoration: none;
		color: #fff;
	}
</style>
