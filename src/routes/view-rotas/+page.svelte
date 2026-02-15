<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatDateLongUK, formatTimeUK, formatDateUK } from '$lib/crm/utils/dateFormat.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: formResult = $page.form;
	$: data = $page.data || {};

	let name = '';
	let email = '';
	let submitted = false;
	let userRotas = [];
	let searchName = '';
	let isSubmitting = false;

	function handleEnhance() {
		return async ({ update, result }) => {
			isSubmitting = true;
			if (result.type === 'success' && result.data?.success) {
				submitted = true;
				searchName = result.data.name;
				userRotas = result.data.rotas || [];
				if (userRotas.length === 0) {
					notifications.info('No rotas found for this email address.');
				}
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to search for rotas. Please try again.');
			}
			await update();
			isSubmitting = false;
		};
	}

	function resetForm() {
		submitted = false;
		name = '';
		email = '';
		userRotas = [];
		searchName = '';
	}

	$: sortedRotas = [...userRotas].sort((a, b) => {
		if (!a.date && !b.date) return 0;
		if (!a.date) return 1;
		if (!b.date) return -1;
		return new Date(a.date) - new Date(b.date);
	});
</script>

<svelte:head>
	<title>My volunteering – See my rotas</title>
</svelte:head>

<!-- Public "My volunteering" layout: clear nav, high contrast, large touch targets for 60+ -->
<div class="min-h-screen bg-slate-50">
	<!-- Simple header with two clear options -->
	<header class="bg-white border-b-2 border-slate-200 shadow-sm">
		<div class="max-w-3xl mx-auto px-4 sm:px-6 py-5">
			<h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">My volunteering</h1>
			<p class="text-slate-600 text-lg mb-6">See your rotas and sign up for more. Choose an option below.</p>
			<nav class="flex flex-wrap gap-3" aria-label="Volunteer options">
				<a
					href="/view-rotas"
					class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-lg font-semibold bg-slate-900 text-white min-h-[52px] shadow-md hover:bg-slate-800 transition-colors"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
					</svg>
					See my rotas
				</a>
				<a
					href="/signup/rotas"
					class="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-lg font-semibold bg-white text-slate-700 border-2 border-slate-300 min-h-[52px] hover:bg-slate-50 hover:border-slate-400 transition-colors"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
					</svg>
					Sign up for rotas
				</a>
			</nav>
		</div>
	</header>

	<main class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
		<div class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
			{#if !submitted}
				<!-- Step 1: Enter details – large, clear form -->
				<div class="p-6 sm:p-8">
					<h2 class="text-xl sm:text-2xl font-bold text-slate-900 mb-2">See your rotas</h2>
					<p class="text-slate-600 text-lg mb-6 leading-relaxed">
						Enter your name and email below. We'll show you the rotas you're signed up for. Your details are only used to look up your commitments.
					</p>

					<form method="POST" action="?/search" use:enhance={handleEnhance} class="space-y-5">
						<div>
							<label for="name" class="block text-lg font-semibold text-slate-800 mb-2">
								Full name
							</label>
							<input
								type="text"
								id="name"
								name="name"
								bind:value={name}
								required
								autocomplete="name"
								class="volunteer-input w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
								placeholder="e.g. John Smith"
							/>
						</div>
						<div>
							<label for="email" class="block text-lg font-semibold text-slate-800 mb-2">
								Email address
							</label>
							<input
								type="email"
								id="email"
								name="email"
								bind:value={email}
								required
								autocomplete="email"
								class="volunteer-input w-full rounded-xl border-2 border-slate-300 px-4 py-3 text-lg text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
								placeholder="your.email@example.com"
							/>
						</div>

						{#if formResult?.type === 'failure' && formResult.data?.error}
							<div class="rounded-xl bg-red-50 border-2 border-red-200 p-4" role="alert">
								<p class="text-red-800 text-lg">{formResult.data.error}</p>
							</div>
						{/if}

						<button
							type="submit"
							disabled={isSubmitting || !name?.trim() || !email?.trim()}
							class="w-full rounded-xl bg-blue-600 text-white text-xl font-bold py-4 px-6 shadow-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[56px] flex items-center justify-center gap-2"
						>
							{#if isSubmitting}
								<svg class="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Looking up your rotas...
							{:else}
								Show my rotas
							{/if}
						</button>
					</form>
				</div>
			{:else}
				<!-- Step 2: Results – large, readable list -->
				<div class="p-6 sm:p-8">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
						<div>
							<h2 class="text-xl sm:text-2xl font-bold text-slate-900">Your rotas</h2>
							<p class="text-slate-600 text-lg mt-1">Showing rotas for <strong class="text-slate-900">{searchName}</strong></p>
						</div>
						<button
							type="button"
							on:click={resetForm}
							class="rounded-xl border-2 border-slate-300 bg-white px-5 py-3 text-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors min-h-[52px]"
						>
							Look up different details
						</button>
					</div>

					{#if userRotas.length === 0}
						<div class="rounded-xl bg-amber-50 border-2 border-amber-200 p-6" role="status">
							<p class="text-amber-900 text-lg leading-relaxed">
								We didn't find any rotas for this email address. If you've only just signed up, they may appear soon. If you think something's wrong, please contact your church or group office.
							</p>
							<p class="mt-4 text-lg">
								<a href="/signup/rotas" class="font-semibold text-blue-600 hover:text-blue-800 underline">Sign up for rotas here</a> if you'd like to volunteer.
							</p>
						</div>
					{:else}
						<p class="text-slate-600 text-lg mb-6">You're signed up for the following. Thank you for volunteering.</p>
						<ul class="space-y-4" role="list">
							{#each sortedRotas as rota}
								<li class="rounded-xl border-2 border-slate-200 bg-slate-50 p-5 sm:p-6">
									<div class="flex flex-col gap-2">
										<span class="text-lg font-bold text-slate-900">{rota.role}</span>
										<span class="text-lg text-slate-700">{rota.eventTitle}</span>
										{#if rota.date}
											<p class="text-lg text-slate-600 mt-1">
												<span class="font-semibold">{formatDateLongUK(rota.date)}</span>
												{#if rota.startTime}
													<span class="block text-slate-600 mt-0.5">
														{formatTimeUK(rota.startTime)}
														{#if rota.endTime}
															– {formatTimeUK(rota.endTime)}
														{/if}
													</span>
												{/if}
											</p>
										{:else}
											<p class="text-slate-500 text-lg">Date to be confirmed</p>
										{/if}
										{#if rota.location}
											<p class="text-slate-600 text-lg">📍 {rota.location}</p>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
						<p class="mt-6 text-lg text-slate-600">
							Want to do more? <a href="/signup/rotas" class="font-semibold text-blue-600 hover:text-blue-800 underline">Sign up for more rotas</a>.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</main>

	<NotificationPopup />
</div>

<style>
	/* 18px minimum for inputs helps older users and avoids iOS zoom on focus */
	.volunteer-input {
		min-height: 3.25rem;
		font-size: 1.125rem;
	}
	@media (min-width: 640px) {
		.volunteer-input {
			min-height: 3.5rem;
			font-size: 1.25rem;
		}
	}
</style>
