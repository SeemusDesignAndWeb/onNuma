<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: event = $page.data?.event;
	$: occurrences = $page.data?.occurrences || [];
	$: allOccurrences = $page.data?.allOccurrences || [];
	$: upcomingOccurrencesForSignup = $page.data?.upcomingOccurrencesForSignup || [];
	$: occurrenceId = $page.data?.occurrenceId;
	$: rotas = $page.data?.rotas || [];
	$: upcomingOccurrencesForRotas = $page.data?.upcomingOccurrencesForRotas || [];
	$: rotaViewOccurrenceId = $page.data?.rotaViewOccurrenceId || null;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;

	function getAssigneesForRotaOccurrence(rota, occId) {
		if (!rota.assigneesByOcc) return [];
		return rota.assigneesByOcc[occId] || [];
	}

	let selectedOccurrenceId = occurrenceId || '';
	let name = '';
	let email = '';
	let guestCount = 0;
	let dietaryRequirements = '';

	// If occurrenceId is set, use it as default
	$: if (occurrenceId && !selectedOccurrenceId) {
		selectedOccurrenceId = occurrenceId;
	}

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'success') {
				notifications.success(result.data?.message || 'Successfully signed up for the event!');
				// Reset form
				name = '';
				email = '';
				guestCount = 0;
				dietaryRequirements = '';
				if (!occurrenceId) {
					selectedOccurrenceId = '';
				}
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to sign up');
			}
			await update();
		};
	}

	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { 
			weekday: 'long',
			day: 'numeric', 
			month: 'long', 
			year: 'numeric' 
		});
	}

	function formatTime(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleTimeString('en-GB', { 
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	// Get selected occurrence details (prefer upcoming list so selected date displays when in dropdown)
	$: selectedOccurrence = upcomingOccurrencesForSignup.find(occ => occ.id === selectedOccurrenceId) ||
		occurrences.find(occ => occ.id === selectedOccurrenceId) ||
		allOccurrences.find(occ => occ.id === selectedOccurrenceId);
</script>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
		{#if event}
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Left Side: Event Details -->
				<div class="space-y-6">
					<!-- Event Header -->
					<div class="bg-white shadow rounded-lg p-6">
						<h1 class="text-3xl font-bold text-gray-900 mb-4">{event.title}</h1>
						{#if event.description}
							<div class="prose max-w-none mb-4">
								{@html event.description}
							</div>
						{/if}
						{#if event.location}
							<p class="text-gray-600">
								<strong>Location:</strong> {event.location}
							</p>
						{/if}
					</div>

					<!-- Who's on the rotas: only when linked from email (?occurrenceId=...) -->
					{#if rotas.length > 0 && rotaViewOccurrenceId}
						{@const singleDateOccurrence = rotaViewOccurrenceId
							? (upcomingOccurrencesForRotas.find(occ => occ.id === rotaViewOccurrenceId) || allOccurrences.find(occ => occ.id === rotaViewOccurrenceId))
							: null}
						<div id="rotas" class="bg-white shadow rounded-lg p-6 scroll-mt-6">
							{#if singleDateOccurrence}
								<h2 class="text-xl font-bold text-gray-900 mb-1">Who's on the rotas</h2>
								<p class="text-sm text-gray-600 mb-4">
									{formatDate(singleDateOccurrence.startsAt)} at {formatTime(singleDateOccurrence.startsAt)}
								</p>
								<div class="space-y-4">
									{#each rotas as rota}
										{@const appliesToThisDate = !rota.occurrenceId || rota.occurrenceId === singleDateOccurrence.id}
										{#if appliesToThisDate}
											{@const assignees = getAssigneesForRotaOccurrence(rota, singleDateOccurrence.id)}
											<div class="border-l-4 border-l-brand-blue border border-gray-200 rounded-r-lg p-4">
												<h3 class="text-lg font-semibold text-gray-900 mb-1">{rota.role}</h3>
												{#if assignees.length > 0}
													<p class="text-sm text-gray-700">{assignees.map(a => a.name).join(', ')}</p>
												{:else}
													<p class="text-sm text-gray-400 italic">No one assigned yet</p>
												{/if}
											</div>
										{/if}
									{/each}
								</div>
							{:else}
								<h2 class="text-xl font-bold text-gray-900 mb-4">Who's on the rotas</h2>
								<p class="text-sm text-gray-600 mb-4">Everyone serving at upcoming dates for this event.</p>
								<div class="space-y-6">
									{#each rotas as rota}
										{@const rotaOccurrences = rota.occurrenceId
											? upcomingOccurrencesForRotas.filter(occ => occ.id === rota.occurrenceId)
											: upcomingOccurrencesForRotas}
										<div class="border-l-4 border-l-brand-blue border border-gray-200 rounded-r-lg p-4">
											<h3 class="text-lg font-semibold text-gray-900 mb-3">{rota.role}</h3>
											{#if rotaOccurrences.length === 0}
												<p class="text-sm text-gray-500">No upcoming dates.</p>
											{:else}
												<ul class="space-y-3">
													{#each rotaOccurrences as occ}
														{@const assignees = getAssigneesForRotaOccurrence(rota, occ.id)}
														<li class="text-sm">
															<span class="font-medium text-gray-700">{formatDate(occ.startsAt)}</span>
															<span class="text-gray-500"> at {formatTime(occ.startsAt)}</span>
															{#if assignees.length > 0}
																<span class="text-gray-700"> — {assignees.map(a => a.name).join(', ')}</span>
															{:else}
																<span class="text-gray-400 italic"> — No one assigned yet</span>
															{/if}
														</li>
													{/each}
												</ul>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Right Side: Signup Form -->
				<div class="space-y-6">
					<!-- View Calendar Button -->
					<div class="bg-white shadow rounded-lg p-6">
						<div class="flex justify-end">
							<a
								href="/events/calendar"
								class="inline-flex items-center gap-2 px-3 py-2 bg-brand-blue text-white rounded-md hover:bg-opacity-90 font-medium text-sm transition-all shadow-sm"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								View Calendar
							</a>
						</div>
					</div>

					<!-- Selected Date Display -->
					{#if selectedOccurrence}
						<div class="bg-white shadow rounded-lg p-6">
							<h3 class="text-lg font-semibold text-gray-900 mb-3">Selected Date</h3>
							<div class="space-y-2">
								<p class="text-base font-medium text-gray-900">
									{formatDate(selectedOccurrence.startsAt)}
								</p>
								<p class="text-sm text-gray-600">
									{formatTime(selectedOccurrence.startsAt)} - {formatTime(selectedOccurrence.endsAt)}
								</p>
								{#if selectedOccurrence.location}
									<p class="text-sm text-gray-600">
										📍 {selectedOccurrence.location}
									</p>
								{/if}
							</div>
						</div>
					{/if}

					{#if event.enableSignup}
						<div class="bg-white shadow rounded-lg p-6">
							<h2 class="text-2xl font-bold text-gray-900 mb-4">Sign Up for This Event</h2>
							{#if upcomingOccurrencesForSignup.length === 0}
								<p class="text-gray-600">There are no dates available to sign up for from today onwards. All occurrences for this event have passed.</p>
							{:else}
						<form 
							method="POST" 
							action="?/signup" 
							use:enhance={handleEnhance}
						>
						<input type="hidden" name="_csrf" value={csrfToken} />
						
						<div class="mb-4">
							<label for="occurrenceId" class="block text-sm font-medium text-gray-700 mb-1">
								Select Date <span class="text-red-500">*</span>
							</label>
							<select
								id="occurrenceId"
								name="occurrenceId"
								bind:value={selectedOccurrenceId}
								required
								class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 py-2 px-3"
							>
								<option value="">-- Select a date --</option>
								{#each upcomingOccurrencesForSignup as occ}
									{@const effectiveMaxSpaces = occ.maxSpaces !== null && occ.maxSpaces !== undefined 
										? occ.maxSpaces 
										: (event?.maxSpaces || null)}
									{#if !occ.isFull}
										<option value={occ.id}>
											{formatDate(occ.startsAt)} at {formatTime(occ.startsAt)}
											{#if effectiveMaxSpaces && occ.availableSpots !== null}
												({occ.availableSpots} spots available)
											{/if}
										</option>
									{/if}
								{/each}
							</select>
						</div>

						<div class="mb-4">
							<label for="name" class="block text-sm font-medium text-gray-700 mb-1">
								Your Name <span class="text-red-500">*</span>
							</label>
							<input
								type="text"
								id="name"
								name="name"
								bind:value={name}
								required
								class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 py-2 px-3"
							/>
						</div>

						<div class="mb-4">
							<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
								Your Email <span class="text-red-500">*</span>
							</label>
							<input
								type="email"
								id="email"
								name="email"
								bind:value={email}
								required
								class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 py-2 px-3"
							/>
						</div>

						<div class="mb-4">
							<label for="guestCount" class="block text-sm font-medium text-gray-700 mb-1">
								Number of Guests
							</label>
							<input
								type="number"
								id="guestCount"
								name="guestCount"
								bind:value={guestCount}
								min="0"
								class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 py-2 px-3"
							/>
							<p class="mt-1 text-sm text-gray-500">Just enter number of guests, no need to include yourself.</p>
						</div>

						{#if event.showDietaryRequirements}
							<div class="mb-4">
								<label for="dietaryRequirements" class="block text-sm font-medium text-gray-700 mb-1">
									Any dietary requirements?
								</label>
								<textarea
									id="dietaryRequirements"
									name="dietaryRequirements"
									bind:value={dietaryRequirements}
									rows="2"
									placeholder="e.g. vegetarian, gluten-free, allergies..."
									class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 py-2 px-3"
								></textarea>
							</div>
						{/if}

						<button
							type="submit"
							class="w-full bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium"
						>
							Sign Up
						</button>
					</form>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<NotificationPopup />
