<script>
	import { formatDateLongUK, formatTimeUK } from '$lib/crm/utils/dateFormat.js';

	export let data = {};
	$: member = data?.member ?? null;
	$: memberName = member ? `${member.firstName || ''} ${member.lastName || ''}`.trim() : '';
	$: rotas = data?.rotas ?? [];
	$: loadError = data?.error ?? '';

	$: sortedRotas = [...rotas].sort((a, b) => {
		if (!a.date && !b.date) return 0;
		if (!a.date) return 1;
		if (!b.date) return -1;
		return new Date(a.date) - new Date(b.date);
	});
</script>

<svelte:head>
	<title>My rotas – myHub</title>
</svelte:head>

<div class="my-page-content">
	<h1 class="my-heading">My rotas</h1>

	{#if loadError}
		<div class="my-alert my-alert-error" role="alert">
			<p>{loadError}</p>
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
	}
	.my-rota-signup-btn:hover {
		text-decoration: none;
	}
</style>
