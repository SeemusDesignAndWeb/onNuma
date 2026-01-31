<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatDateTimeUK, formatDateUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: data = $page.data || {};
	$: eventsWithRotas = data.eventsWithRotas || [];
	$: csrfToken = data.csrfToken || '';
	$: formResult = $page.form;

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'success') {
				notifications.success(result.data?.message || 'Successfully signed up for rotas!');
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to sign up');
			}
			await update();
		};
	}

	let name = '';
	let email = '';
	let selectedRotas = new Set(); // Store as "rotaId:occurrenceId"
	let spouse = null;
	let signUpWithSpouse = false;
	let checkingSpouse = false;
	let spouseCheckTimeout = null;
	let previousEmail = '';
	let previousName = '';
	let contactConfirmed = true; // Track if contact is confirmed
	let matchedContact = null; // Store the matched contact record

	// Reactive value for the hidden input
	$: selectedRotasJson = (() => {
		const size = selectedRotas.size;
		const keys = Array.from(selectedRotas);
		return JSON.stringify(
			keys.map(key => {
				const parts = key.split(':');
				return {
					rotaId: parts[0],
					occurrenceId: parts.length > 1 ? parts[1] : null
				};
			})
		);
	})();

	function toggleRotaSelection(rotaId, occurrenceId) {
		const key = occurrenceId ? `${rotaId}:${occurrenceId}` : rotaId;
		const newSet = new Set(selectedRotas);
		if (newSet.has(key)) {
			newSet.delete(key);
		} else {
			newSet.add(key);
		}
		selectedRotas = newSet;
	}

	function isRotaSelected(rotaId, occurrenceId) {
		const key = occurrenceId ? `${rotaId}:${occurrenceId}` : rotaId;
		return selectedRotas.has(key);
	}

	function getAssigneesForRotaOccurrence(rota, occurrenceId) {
		if (!rota.assigneesByOcc) return [];
		return rota.assigneesByOcc[occurrenceId] || [];
	}

	function isRotaFull(rota, occurrenceId) {
		const assignees = getAssigneesForRotaOccurrence(rota, occurrenceId);
		return assignees.length >= rota.capacity;
	}

	function isEmailAlreadySignedUp(rota, occurrenceId, currentEmail, currentMatchedContact, currentSignUpWithSpouse, currentSpouse) {
		if (!currentEmail && !currentMatchedContact) return false;
		const assignees = getAssigneesForRotaOccurrence(rota, occurrenceId);
		
		const emailsToCheck = new Set();
		if (currentEmail) emailsToCheck.add(currentEmail.toLowerCase().trim());
		if (currentMatchedContact?.email) emailsToCheck.add(currentMatchedContact.email.toLowerCase().trim());
		if (currentSignUpWithSpouse && currentSpouse?.email) emailsToCheck.add(currentSpouse.email.toLowerCase().trim());
		
		return assignees.some(a => a.email && emailsToCheck.has(a.email.toLowerCase().trim()));
	}

	// Action to ensure hidden input is updated on form submit
	let hiddenInputNode = null;
	
	function syncHiddenInput(node) {
		hiddenInputNode = node;
		
		function update() {
			const selectedArray = Array.from(selectedRotas).map(key => {
				const parts = key.split(':');
				return {
					rotaId: parts[0],
					occurrenceId: parts.length > 1 ? parts[1] : null
				};
			});
			const jsonStr = JSON.stringify(selectedArray);
			node.value = jsonStr;
		}
		
		update();
		
		const form = node.closest('form');
		if (form) {
			form.addEventListener('submit', update, { capture: true, once: false });
		}
		
		return {
			update,
			destroy() {
				if (form) {
					form.removeEventListener('submit', update, { capture: true });
				}
				hiddenInputNode = null;
			}
		};
	}
	
	// Reactive statement to update hidden input whenever selectedRotas changes
	$: if (hiddenInputNode) {
		const _ = selectedRotas.size;
		const selectedArray = Array.from(selectedRotas).map(key => {
			const parts = key.split(':');
			return {
				rotaId: parts[0],
				occurrenceId: parts.length > 1 ? parts[1] : null
			};
		});
		const jsonStr = JSON.stringify(selectedArray);
		hiddenInputNode.value = jsonStr;
	}

	// Calculate total rotas count
	$: totalRotas = eventsWithRotas.reduce((sum, { rotas }) => sum + rotas.length, 0);

	let expandedDescriptions = new Set();
	function toggleDescription(eventId) {
		if (expandedDescriptions.has(eventId)) {
			expandedDescriptions.delete(eventId);
		} else {
			expandedDescriptions.add(eventId);
		}
		expandedDescriptions = expandedDescriptions;
	}

	let expandedRotaDescriptions = new Set();
	function toggleRotaDescription(rotaId) {
		if (expandedRotaDescriptions.has(rotaId)) {
			expandedRotaDescriptions.delete(rotaId);
		} else {
			expandedRotaDescriptions.add(rotaId);
		}
		expandedRotaDescriptions = expandedRotaDescriptions;
	}

	// Holiday / Away Day state
	let holidayStart = '';
	let holidayEnd = '';
	let holidayAllDay = true;
	let bookingHoliday = false;
	let showHolidayPopup = false;
	let myHolidays = [];
	let cancellingHolidayId = null;

	// Set default holiday dates to today/tomorrow
	$: if (!holidayStart) {
		const now = new Date();
		now.setMinutes(0);
		now.setSeconds(0);
		now.setMilliseconds(0);
		
		if (holidayAllDay) {
			holidayStart = now.toISOString().split('T')[0];
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			holidayEnd = tomorrow.toISOString().split('T')[0];
		} else {
			holidayStart = now.toISOString().slice(0, 16);
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			holidayEnd = tomorrow.toISOString().slice(0, 16);
		}
	}

	// Adjust format when switching allDay
	let lastAllDay = holidayAllDay;
	$: if (holidayAllDay !== lastAllDay) {
		if (holidayAllDay) {
			// Switching to date only
			if (holidayStart && holidayStart.includes('T')) holidayStart = holidayStart.split('T')[0];
			if (holidayEnd && holidayEnd.includes('T')) holidayEnd = holidayEnd.split('T')[0];
		} else {
			// Switching to datetime
			if (holidayStart && !holidayStart.includes('T')) holidayStart = holidayStart + 'T09:00';
			if (holidayEnd && !holidayEnd.includes('T')) holidayEnd = holidayEnd + 'T17:00';
		}
		lastAllDay = holidayAllDay;
	}

	async function bookAwayDay() {
		if (!email || !name) {
			notifications.error('Please enter your name and email first');
			document.getElementById('name')?.focus();
			return;
		}

		if (!holidayStart || !holidayEnd) {
			notifications.error('Please select start and end dates');
			return;
		}

		bookingHoliday = true;
		try {
			const response = await fetch('/api/holidays', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					name,
					startDate: holidayStart,
					endDate: holidayEnd,
					allDay: holidayAllDay
				})
			});

			const result = await response.json();
			if (response.ok) {
				notifications.success('Away day booked successfully!');
				await fetchMyHolidays();
				// Reset holiday dates but keep email/name
				const nextWeek = new Date(holidayStart);
				nextWeek.setDate(nextWeek.getDate() + 7);
				holidayStart = nextWeek.toISOString().slice(0, 16);
				const nextWeekEnd = new Date(holidayEnd);
				nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
				holidayEnd = nextWeekEnd.toISOString().slice(0, 16);
			} else {
				notifications.error(result.error || 'Failed to book away day');
			}
		} catch (error) {
			console.error('Error booking away day:', error);
			notifications.error('An error occurred. Please try again.');
		} finally {
			bookingHoliday = false;
		}
	}

	async function fetchMyHolidays() {
		if (!email?.trim()) return;
		try {
			const res = await fetch(`/api/holidays?email=${encodeURIComponent(email.trim())}`);
			const data = await res.json();
			myHolidays = Array.isArray(data) ? data : [];
		} catch (e) {
			myHolidays = [];
		}
	}

	async function cancelAwayDay(holidayId) {
		if (!email?.trim()) return;
		cancellingHolidayId = holidayId;
		try {
			const res = await fetch('/api/holidays', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: holidayId, email: email.trim() })
			});
			const result = await res.json();
			if (res.ok) {
				notifications.success('Away day cancelled.');
				await fetchMyHolidays();
			} else {
				notifications.error(result.error || 'Failed to cancel away day');
			}
		} catch (e) {
			notifications.error('An error occurred. Please try again.');
		} finally {
			cancellingHolidayId = null;
		}
	}

	$: if (showHolidayPopup && email?.trim()) {
		fetchMyHolidays();
	}

	// Check for spouse when email and name change
	async function checkSpouse(emailToCheck, nameToCheck) {
		if (!emailToCheck || !emailToCheck.includes('@') || !nameToCheck || !nameToCheck.trim()) {
			spouse = null;
			signUpWithSpouse = false;
			return;
		}

		checkingSpouse = true;
		try {
			const params = new URLSearchParams({
				email: emailToCheck,
				name: nameToCheck
			});
			const response = await fetch(`/api/check-contact-spouse?${params.toString()}`);
			const data = await response.json();
			
			// Only update if email and name haven't changed while we were checking
			if (email === emailToCheck && name === nameToCheck) {
				if (data.matched) {
					matchedContact = data.contact;
					contactConfirmed = data.contact?.confirmed !== false;
					if (data.spouse) {
						spouse = data.spouse;
					} else {
						spouse = null;
						signUpWithSpouse = false;
					}
				} else {
					matchedContact = null;
					contactConfirmed = false;
					spouse = null;
					signUpWithSpouse = false;
				}
			}
		} catch (error) {
			console.error('Error checking spouse:', error);
			// Only update if email and name haven't changed while we were checking
			if (email === emailToCheck && name === nameToCheck) {
				contactConfirmed = false;
				spouse = null;
				signUpWithSpouse = false;
			}
		} finally {
			// Only update checking state if email and name haven't changed
			if (email === emailToCheck && name === nameToCheck) {
				checkingSpouse = false;
			}
		}
	}

	// Reactive statement to check spouse when email or name changes
	$: if (email !== previousEmail || name !== previousName) {
		previousEmail = email;
		previousName = name;
		
		// Clear any existing timeout
		if (spouseCheckTimeout) {
			clearTimeout(spouseCheckTimeout);
			spouseCheckTimeout = null;
		}
		
		if (!email || !email.includes('@') || !name || !name.trim()) {
			matchedContact = null;
			contactConfirmed = false;
			spouse = null;
			signUpWithSpouse = false;
			checkingSpouse = false;
		} else {
			// Debounce the check
			spouseCheckTimeout = setTimeout(() => {
				checkSpouse(email, name);
				spouseCheckTimeout = null;
			}, 500);
		}
	}
</script>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto py-8 px-4 sm:py-12 sm:px-6 lg:px-8 mt-16">
		{#if totalRotas === 0}
			<div class="bg-white shadow rounded-lg p-6">
				<p class="text-gray-500">No rotas available for signup.</p>
			</div>
		{:else}
			<form 
				method="POST" 
				action="?/signup" 
				use:enhance={handleEnhance}
			>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input 
					type="hidden" 
					name="selectedRotas" 
					value={selectedRotasJson}
					use:syncHiddenInput
				/>

				{#if totalRotas > 0}
					<div class="bg-white shadow rounded-lg p-4 mb-6 lg:sticky top-[76px] z-20 overflow-x-auto lg:overflow-x-visible">
						<div class="flex flex-col lg:flex-row lg:items-center gap-3">
							<h3 class="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-shrink-0">
								<svg class="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
								</svg>
								Quick Links:
							</h3>
							<nav class="flex flex-wrap gap-2 flex-1">
								{#each eventsWithRotas as { event, rotas }}
									{#each rotas as rota}
										<a
											href="#event-{event.id}-rota-{rota.id}"
											class="inline-flex items-center text-xs text-brand-blue hover:text-brand-blue/80 hover:underline py-1 px-2 rounded hover:bg-brand-blue/5 border border-brand-blue/10 transition-colors whitespace-nowrap"
										>
											<span class="text-gray-400 mr-1">{event.title}:</span> {rota.role}
										</a>
									{/each}
								{/each}
							</nav>
							<div class="flex-shrink-0 lg:ml-auto hidden lg:flex">
								<button
									type="button"
									on:click={() => { showHolidayPopup = true; if (email?.trim()) fetchMyHolidays(); }}
									class="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 font-medium shadow transition-colors flex items-center justify-center gap-2 text-xs whitespace-nowrap"
								>
									<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									Book Away Day
								</button>
							</div>
						</div>
					</div>
				{/if}

				{#if showHolidayPopup}
					<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4" on:click={() => showHolidayPopup = false}>
						<div class="bg-white rounded-xl shadow-2xl w-full max-w-md min-w-0 p-4 sm:p-6 overflow-hidden max-h-[90vh] overflow-y-auto [max-width:min(28rem,calc(100vw-2rem))]" on:click|stopPropagation>
							<div class="flex items-center justify-between mb-6">
								<h3 class="text-xl font-bold text-gray-900 flex items-center gap-2">
									<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-7l.94-2.06L15 11l-2.06.94L12 14l-.94-2.06L9 11l2.06-.94L12 9z" />
									</svg>
									Book Your Away Day
								</h3>
								<button type="button" on:click={() => showHolidayPopup = false} class="text-gray-400 hover:text-gray-600 transition-colors">
									<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
							</div>

							<div class="space-y-4">
								<div class="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
									<p class="text-sm text-blue-800">
										Enter your away dates below. We'll make sure you aren't assigned to any rotas during this period.
									</p>
								</div>

								{#if !name || !email}
									<div class="bg-yellow-50 p-3 rounded-lg border border-yellow-200 mb-4">
										<p class="text-xs text-yellow-800 font-medium">
											Please enter your name and email in the main form first.
										</p>
									</div>
								{/if}

								{#if name && email}
									<div class="mb-4">
										<p class="text-sm font-medium text-gray-700 mb-2">Your booked away days</p>
										{#if myHolidays.length > 0}
											<ul class="space-y-2">
												{#each myHolidays as h}
													<li class="flex items-center justify-between gap-2 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100 text-sm">
														<span class="text-gray-700">
															{h.allDay ? formatDateUK(h.startDate) : formatDateTimeUK(h.startDate)} – {h.allDay ? formatDateUK(h.endDate) : formatDateTimeUK(h.endDate)}
														</span>
														<button
															type="button"
															on:click={() => cancelAwayDay(h.id)}
															disabled={cancellingHolidayId === h.id}
															class="text-red-600 hover:text-red-700 hover:underline text-xs font-medium disabled:opacity-50 shrink-0"
														>
															{cancellingHolidayId === h.id ? 'Cancelling...' : 'Cancel'}
														</button>
													</li>
												{/each}
											</ul>
										{:else}
											<p class="text-sm text-gray-500 py-2">You have no away days booked. Add one below.</p>
										{/if}
									</div>
								{/if}

								<div class="grid grid-cols-1 gap-4 min-w-0">
									<div class="min-w-0">
										<label for="popup-holiday-start" class="block text-sm font-medium text-gray-700 mb-1">From</label>
										{#if holidayAllDay}
											<input
												type="date"
												id="popup-holiday-start"
												bind:value={holidayStart}
												class="w-full min-w-0 max-w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 text-sm box-border"
											/>
										{:else}
											<input
												type="datetime-local"
												id="popup-holiday-start"
												bind:value={holidayStart}
												class="w-full min-w-0 max-w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 text-sm box-border"
											/>
										{/if}
									</div>
									<div class="min-w-0">
										<label for="popup-holiday-end" class="block text-sm font-medium text-gray-700 mb-1">To</label>
										{#if holidayAllDay}
											<input
												type="date"
												id="popup-holiday-end"
												bind:value={holidayEnd}
												class="w-full min-w-0 max-w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 text-sm box-border"
											/>
										{:else}
											<input
												type="datetime-local"
												id="popup-holiday-end"
												bind:value={holidayEnd}
												class="w-full min-w-0 max-w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2 px-3 text-sm box-border"
											/>
										{/if}
									</div>
									<div class="flex items-center gap-4 py-2">
										<label class="flex items-center gap-2 cursor-pointer group">
											<input
												type="checkbox"
												bind:checked={holidayAllDay}
												class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
											/>
											<span class="text-sm font-medium text-gray-700 group-hover:text-gray-900">All Day</span>
										</label>
									</div>
								</div>

								<div class="pt-4 flex flex-col gap-3">
									<button
										type="button"
										on:click={async () => {
											await bookAwayDay();
											if (!bookingHoliday) showHolidayPopup = false;
										}}
										disabled={bookingHoliday || !name || !email}
										class="w-full bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg transition-all flex items-center justify-center gap-2"
									>
										{#if bookingHoliday}
											<svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
											Booking...
										{:else}
											Confirm Away Day
										{/if}
									</button>
									<button
										type="button"
										on:click={() => showHolidayPopup = false}
										class="w-full bg-gray-100 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-200 font-medium transition-colors text-sm"
									>
										Cancel
									</button>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
					<!-- Your Details - Left column on large screens -->
					<div class="lg:col-span-1">
						<div class="bg-white shadow rounded-lg p-6 lg:sticky top-[76px] space-y-6">
							<div>
								<h1 class="text-2xl font-bold text-brand-blue mb-2">Rota Signup</h1>
								<p class="text-sm text-gray-600 mb-4">
									Sign up for available rotas across all events. Select the dates you're available for each role.
								</p>
								<h2 class="text-xl font-bold text-gray-900 mb-4">Your Details</h2>
								<div class="space-y-4">
									<div>
										<label for="name" class="block text-sm font-medium text-gray-700 mb-1">Full Name (i.e. Fred Bloggs)</label>
										<input
											type="text"
											id="name"
											name="name"
											bind:value={name}
											required
											class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
										/>
									</div>
									<div>
										<label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
										<input
											type="email"
											id="email"
											name="email"
											bind:value={email}
											required
											class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
										/>
										{#if checkingSpouse}
											<p class="text-xs text-gray-500 mt-1">Checking...</p>
										{/if}
									</div>
									{#if spouse}
										<div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
											<label class="flex items-start cursor-pointer group">
												<input
													type="checkbox"
													name="signUpWithSpouse"
													bind:checked={signUpWithSpouse}
													class="mt-1 mr-3 w-5 h-5 rounded border-gray-300 text-brand-blue focus:ring-brand-blue cursor-pointer"
												/>
												<div class="flex-1">
													<span class="text-sm font-medium text-gray-900 block">
														Sign up for you and {spouse.firstName || spouse.lastName ? `${spouse.firstName || ''} ${spouse.lastName || ''}`.trim() : 'your partner'}?
													</span>
													<span class="text-xs text-gray-600 mt-1 block">
														Both of you will be signed up for the selected rotas
													</span>
												</div>
											</label>
										</div>
									{/if}
									{#if matchedContact}
										<div class="mt-2 flex items-center gap-2 text-xs text-gray-500">
											<i class="fa fa-heart text-red-500"></i>
											<span>This shows if you are already signed up</span>
										</div>
									{/if}
								</div>
								<!-- Book Away Day - visible on mobile only (after name/email) -->
								<div class="pt-4 flex lg:hidden">
									<button
										type="button"
										on:click={() => { showHolidayPopup = true; if (email?.trim()) fetchMyHolidays(); }}
										class="w-full bg-blue-600 text-white px-4 py-2.5 rounded-md hover:bg-blue-700 font-medium shadow transition-colors flex items-center justify-center gap-2 text-sm"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										Book Away Day
									</button>
								</div>
							</div>

							<div class="border-t border-gray-200 pt-6">
								<button
									type="submit"
									disabled={selectedRotas.size === 0 || !name || !email || !contactConfirmed}
									class="w-full bg-brand-green text-white px-8 py-3 rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:transform-none flex items-center justify-center gap-2"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									Sign Up for Selected Rotas ({selectedRotas.size})
								</button>
							</div>

							{#if !contactConfirmed && email && name}
								<div class="border-t border-gray-200 pt-6">
									<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
										<div class="flex items-start gap-3">
											<svg class="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
											</svg>
											<div class="flex-1">
												<p class="text-sm font-medium text-yellow-800">Contact Not Confirmed</p>
												<p class="text-xs text-yellow-700 mt-1">Your contact details need to be confirmed before you can sign up for rotas. Please contact an administrator.</p>
											</div>
										</div>
									</div>
								</div>
							{/if}
						</div>
					</div>

					<!-- Available Rotas - Right column on large screens -->
					<div class="lg:col-span-2">
						<div class="space-y-8">
							{#each eventsWithRotas as { event, rotas, occurrences }}
								{#if rotas.length > 0}
									<div class="bg-white shadow rounded-lg p-6">
										<div class="mb-6">
											<h2 id="event-{event.id}" class="text-2xl font-bold text-brand-blue mb-2 scroll-mt-[160px]">{event.title}</h2>
											<div class="flex items-center justify-between gap-4 mb-2">
												{#if event.location}
													<div class="flex items-center gap-2 text-gray-600 text-sm">
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
														</svg>
														<span>{event.location}</span>
													</div>
												{:else}
													<div></div>
												{/if}

												{#if event.description}
													<button 
														type="button"
														on:click={() => toggleDescription(event.id)}
														class="text-xs text-brand-blue hover:underline focus:outline-none whitespace-nowrap flex items-center gap-1"
													>
														<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
														</svg>
														{expandedDescriptions.has(event.id) ? 'Hide Event Description' : 'View Event Description'}
													</button>
												{/if}
											</div>

											{#if event.description && expandedDescriptions.has(event.id)}
												<div class="text-sm text-gray-600 mt-2 bg-gray-50 p-3 rounded border border-gray-100">
													{@html event.description}
												</div>
											{/if}
										</div>

										<div class="space-y-6">
											{#each rotas as rota}
												<div id="event-{event.id}-rota-{rota.id}" class="border-l-4 border-l-brand-blue border border-gray-200 rounded-lg p-4 scroll-mt-[160px] bg-white hover:shadow-md transition-shadow">
													<div class="flex items-start justify-between mb-3">
														<div class="flex-1">
															<h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
																<span class="w-2 h-2 rounded-full bg-brand-green"></span>
																{rota.role}
															</h3>
															{#if rota.notes}
																<button
																	type="button"
																	on:click={() => toggleRotaDescription(rota.id)}
																	class="text-xs text-brand-blue hover:underline focus:outline-none whitespace-nowrap flex items-center gap-1 mt-1 ml-4"
																>
																	<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
																	</svg>
																	{expandedRotaDescriptions.has(rota.id) ? 'Hide Rota Description' : 'View Rota Description'}
																</button>
															{/if}
															{#if rota.notes && expandedRotaDescriptions.has(rota.id)}
																<div class="text-sm text-gray-600 mt-2 ml-4 bg-gray-50 p-3 rounded border border-gray-100">{@html rota.notes}</div>
															{/if}
															<p class="text-sm text-gray-500 mt-1 ml-4">
																Capacity: <span class="font-medium text-brand-blue">{rota.capacity}</span> {rota.capacity === 1 ? 'person is' : 'people are'} ideal for this rota
															</p>
														</div>
													</div>

													{#if occurrences.length > 0}
														<!-- Show all occurrences for this rota in a compact grid -->
														<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
															{#each occurrences as occ}
																{@const assignees = getAssigneesForRotaOccurrence(rota, occ.id)}
																{@const isFull = isRotaFull(rota, occ.id)}
																{@const isSelected = isRotaSelected(rota.id, occ.id)}
																{@const alreadySignedUp = isEmailAlreadySignedUp(rota, occ.id, email, matchedContact, signUpWithSpouse, spouse)}
																{@const canSelect = !isFull && !alreadySignedUp}
																{@const hasSomeFilled = assignees.length > 0 && !isFull}
																{@const bgColor = isFull ? 'bg-red-100' : (hasSomeFilled ? 'bg-green-100' : 'bg-white')}
																
																<div class="border-2 rounded p-2 transition-all {bgColor} {isSelected ? 'border-brand-green shadow-sm ring-2 ring-brand-green/20' : 'border-gray-200 hover:border-brand-blue/50'} {!canSelect && !isSelected ? 'opacity-60' : ''}">
																	<label class="flex items-start cursor-pointer {!canSelect && !isSelected ? 'cursor-not-allowed' : ''}">
																		<input
																			type="checkbox"
																			checked={isSelected}
																			on:change={() => toggleRotaSelection(rota.id, occ.id)}
																			disabled={!canSelect && !isSelected}
																			class="mt-0.5 mr-2 flex-shrink-0 accent-brand-green"
																		/>
																		<div class="flex-1 min-w-0">
																			<div class="text-xs font-medium text-gray-900 leading-tight">
																				{formatDateTimeUK(occ.startsAt)}
																			</div>
																			<div class="flex items-center gap-1.5 mt-1 flex-wrap">
																				<span class="text-xs font-medium text-brand-blue">
																					{assignees.length}/{rota.capacity}
																				</span>
																				{#if isFull}
																					<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-brand-red/10 text-brand-red border border-brand-red/20">
																						Full
																					</span>
																				{/if}
																				{#if alreadySignedUp}
																					<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20" title="Already signed up">
																						<i class="fa fa-heart text-red-500"></i>
																					</span>
																				{/if}
																			</div>
																		</div>
																	</label>
																</div>
															{/each}
														</div>
													{:else}
														<p class="text-gray-500 text-sm">No occurrences available for this event.</p>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				</div>

				{#if formResult?.type === 'failure' && formResult.data?.error}
					<div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
						<p class="text-red-800">{formResult.data.error}</p>
					</div>
				{/if}
			</form>
		{/if}
	</div>
	
	<!-- Notification Popups -->
	<NotificationPopup />
</div>
