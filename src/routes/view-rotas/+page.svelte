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

	// Sort rotas by date (upcoming first)
	$: sortedRotas = [...userRotas].sort((a, b) => {
		if (!a.date && !b.date) return 0;
		if (!a.date) return 1;
		if (!b.date) return -1;
		return new Date(a.date) - new Date(b.date);
	});
</script>

<svelte:head>
	<title>View Your Rotas - EGCC</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-12">
	<div class="max-w-6xl mx-auto py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
		<div class="bg-white shadow-lg rounded-lg p-6 sm:p-8">
			<div class="mb-8 text-center">
				<h1 class="text-3xl sm:text-4xl font-bold text-brand-blue mb-2">View Your Rotas</h1>
				<p class="text-gray-600">Enter your details to see all the rotas you're signed up for</p>
			</div>

			{#if !submitted}
				<!-- Search Form -->
				<div class="max-w-md mx-auto">
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
						<h2 class="text-xl font-semibold text-gray-900 mb-2">Get Started</h2>
						<p class="text-sm text-gray-700">Please provide your name and email to view your rotas.</p>
					</div>

					<form method="POST" action="?/search" use:enhance={handleEnhance}>
						<div class="space-y-4">
							<div>
								<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
									Full Name <span class="text-red-500">*</span>
								</label>
								<input
									type="text"
									id="name"
									name="name"
									bind:value={name}
									required
									class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4"
									placeholder="Enter your full name"
								/>
							</div>
							<div>
								<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
									Email <span class="text-red-500">*</span>
								</label>
								<input
									type="email"
									id="email"
									name="email"
									bind:value={email}
									required
									class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4"
									placeholder="your.email@example.com"
								/>
							</div>
						</div>

						{#if formResult?.type === 'failure' && formResult.data?.error}
							<div class="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
								<p class="text-red-800 text-sm">{formResult.data.error}</p>
							</div>
						{/if}

						<div class="mt-6">
							<button
								type="submit"
								disabled={isSubmitting || !name || !email}
								class="w-full bg-brand-green text-white px-6 py-3 rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all"
							>
								{#if isSubmitting}
									<span class="flex items-center justify-center gap-2">
										<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Searching...
									</span>
								{:else}
									View My Rotas
								{/if}
							</button>
						</div>
					</form>
				</div>
			{:else}
				<!-- Results Section -->
				<div>
					<div class="flex items-center justify-between mb-6">
						<div>
							<h2 class="text-2xl font-bold text-gray-900">Your Rotas</h2>
							<p class="text-gray-600 mt-1">Showing rotas for {searchName}</p>
						</div>
						<button
							on:click={resetForm}
							class="text-brand-blue hover:text-brand-blue/80 font-medium transition-colors"
						>
							Search Again
						</button>
					</div>

					{#if userRotas.length === 0}
						<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
							<p class="text-yellow-800">
								No rotas found for this email address. If you believe this is an error, please contact the church office.
							</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
								<thead class="bg-gray-50">
									<tr>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Date
										</th>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Event
										</th>
										<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											Rota
										</th>
									</tr>
								</thead>
								<tbody class="bg-white divide-y divide-gray-200">
									{#each sortedRotas as rota}
										<tr class="hover:bg-gray-50 transition-colors">
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
												{#if rota.date}
													<div class="font-medium">{formatDateLongUK(rota.date)}</div>
													{#if rota.startTime}
														<div class="text-gray-500 text-xs mt-1">
															{formatTimeUK(rota.startTime)}
															{#if rota.endTime}
																- {formatTimeUK(rota.endTime)}
															{/if}
														</div>
													{/if}
												{:else}
													<span class="text-gray-400">No date</span>
												{/if}
											</td>
											<td class="px-6 py-4 text-sm text-gray-900">
												<div class="font-medium">{rota.eventTitle}</div>
												{#if rota.location}
													<div class="text-gray-500 text-xs mt-1">{rota.location}</div>
												{/if}
											</td>
											<td class="px-6 py-4 text-sm font-medium text-gray-900">
												{rota.role}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
	
	<!-- Notification Popups -->
	<NotificationPopup />
</div>
