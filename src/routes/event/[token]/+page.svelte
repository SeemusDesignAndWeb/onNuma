<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: event = $page.data?.event;
	$: occurrences = $page.data?.occurrences || [];
	$: allOccurrences = $page.data?.allOccurrences || [];
	$: occurrenceId = $page.data?.occurrenceId;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;

	let selectedOccurrenceId = occurrenceId || '';
	let name = '';
	let email = '';
	let guestCount = 0;

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

	// Get selected occurrence details
	$: selectedOccurrence = occurrences.find(occ => occ.id === selectedOccurrenceId) || 
		(allOccurrences.find(occ => occ.id === selectedOccurrenceId));
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

					<!-- Occurrence Details (if one is selected) -->
					{#if selectedOccurrence}
						{@const effectiveMaxSpaces = selectedOccurrence.maxSpaces !== null && selectedOccurrence.maxSpaces !== undefined 
							? selectedOccurrence.maxSpaces 
							: (event?.maxSpaces || null)}
						<div class="bg-white shadow rounded-lg p-6">
							<h2 class="text-2xl font-bold text-gray-900 mb-4">Selected Date</h2>
							<div class="space-y-3">
								<div>
									<h3 class="text-lg font-semibold text-gray-900">
										{formatDate(selectedOccurrence.startsAt)}
									</h3>
									<p class="text-sm text-gray-600">
										{formatTime(selectedOccurrence.startsAt)} - {formatTime(selectedOccurrence.endsAt)}
									</p>
									{#if selectedOccurrence.location}
										<p class="text-sm text-gray-600 mt-1">
											📍 {selectedOccurrence.location}
										</p>
									{/if}
								</div>
								{#if effectiveMaxSpaces}
									<div class="pt-3 border-t border-gray-200">
										<div class="text-sm">
											<span class="font-medium text-gray-900">
												{selectedOccurrence.totalAttendees || 0}
											</span>
											<span class="text-gray-500"> / {effectiveMaxSpaces} spots</span>
										</div>
										<div class="text-xs text-gray-500 mt-1">
											{#if selectedOccurrence.isFull}
												<span class="text-red-600 font-medium">Full</span>
											{:else if selectedOccurrence.availableSpots !== null}
												<span class="text-green-600">{selectedOccurrence.availableSpots} available</span>
											{/if}
										</div>
									</div>
								{/if}
								{#if selectedOccurrence.information}
									<div class="pt-3 border-t border-gray-200 text-sm text-gray-700 prose prose-sm max-w-none">
										{@html selectedOccurrence.information}
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Right Side: Signup Form -->
				<div class="bg-white shadow rounded-lg p-6">
					<h2 class="text-2xl font-bold text-gray-900 mb-4">Sign Up for This Event</h2>
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
								{#each allOccurrences as occ}
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

						<button
							type="submit"
							class="w-full bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium"
						>
							Sign Up
						</button>
					</form>
				</div>
			</div>
		{/if}
	</div>
</div>

<NotificationPopup />
