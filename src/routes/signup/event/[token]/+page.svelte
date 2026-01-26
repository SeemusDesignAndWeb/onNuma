<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: event = $page.data?.event;
	$: occurrences = $page.data?.occurrences || [];
	$: rotas = $page.data?.rotas || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'success') {
				notifications.success(result.data?.message || 'Successfully signed up for rotas!');
			} else if (result.type === 'failure') {
				// Check for clash error specifically
				const errorMsg = result.data?.error || 'Failed to sign up';
				if (errorMsg.includes('clashing') || errorMsg.includes('clash')) {
					notifications.error(errorMsg);
				} else {
					notifications.error(errorMsg);
				}
			}
			await update();
		};
	}

	let name = '';
	let email = '';
	let selectedRotas = new Set(); // Store as "rotaId:occurrenceId"

	// Reactive value for the hidden input
	$: selectedRotasJson = JSON.stringify(getSelectedRotasArray());

	function toggleRotaSelection(rotaId, occurrenceId) {
		const key = occurrenceId ? `${rotaId}:${occurrenceId}` : rotaId;
		if (selectedRotas.has(key)) {
			selectedRotas.delete(key);
		} else {
			selectedRotas.add(key);
		}
		selectedRotas = selectedRotas; // Trigger reactivity
	}

	function isRotaSelected(rotaId, occurrenceId) {
		const key = occurrenceId ? `${rotaId}:${occurrenceId}` : rotaId;
		return selectedRotas.has(key);
	}

	function getSelectedRotasArray() {
		// Convert Set to array of {rotaId, occurrenceId}
		return Array.from(selectedRotas).map(key => {
			const parts = key.split(':');
			return {
				rotaId: parts[0],
				occurrenceId: parts.length > 1 ? parts[1] : null
			};
		});
	}

	function getAssigneesForRotaOccurrence(rota, occurrenceId) {
		if (!rota.assigneesByOcc) return [];
		return rota.assigneesByOcc[occurrenceId] || [];
	}

	function isRotaFull(rota, occurrenceId) {
		const assignees = getAssigneesForRotaOccurrence(rota, occurrenceId);
		return assignees.length >= rota.capacity;
	}

	function isEmailAlreadySignedUp(rota, occurrenceId) {
		if (!email) return false;
		const assignees = getAssigneesForRotaOccurrence(rota, occurrenceId);
		return assignees.some(a => a.email && a.email.toLowerCase() === email.toLowerCase());
	}

	// Action to keep hidden input in sync with selectedRotas
	function syncHiddenInput(node) {
		function update() {
			const selectedArray = getSelectedRotasArray();
			const jsonStr = JSON.stringify(selectedArray);
			node.value = jsonStr;
		}
		
		// Update immediately
		update();
		
		// Update on form submit with capture:true to run BEFORE enhance processes the form
		const form = node.closest('form');
		if (form) {
			form.addEventListener('submit', update, { capture: true, once: false });
		}
		
		// Also update reactively when selectedRotas changes
		let lastSelectedRotasSize = selectedRotas.size;
		const checkInterval = setInterval(() => {
			if (selectedRotas.size !== lastSelectedRotasSize) {
				lastSelectedRotasSize = selectedRotas.size;
				update();
			}
		}, 50);
		
		return {
			update,
			destroy() {
				if (form) {
					form.removeEventListener('submit', update, { capture: true });
				}
				clearInterval(checkInterval);
			}
		};
	}
</script>

<div class="min-h-screen bg-gray-50 pt-[70px]">
	<div class="max-w-7xl mx-auto py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
		{#if rotas.length === 0}
			<div class="bg-white shadow rounded-lg p-6">
				<p class="text-gray-500">No rotas available for this event.</p>
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

				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
					<!-- Left Column: Event Name, User Details, Quick Links, Sign Up Button -->
					<div class="lg:col-span-1">
						<div class="bg-white shadow rounded-lg p-6 sticky top-[76px] space-y-6">
							<div>
								<h1 class="text-2xl font-bold text-brand-blue mb-2">{event?.title || 'Event Signup'}</h1>
								{#if event?.location}
									<div class="flex items-center gap-2 text-gray-600 mb-4 text-sm">
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
										<span>{event.location}</span>
									</div>
								{/if}
								<h2 class="text-xl font-bold text-gray-900 mb-4">Your Details</h2>
								<div class="space-y-4">
									<div>
										<label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
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
									</div>
								</div>
							</div>

							{#if rotas.length > 0}
								<div class="border-t border-gray-200 pt-6">
									<h3 class="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
										<svg class="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
										</svg>
										Quick Links
									</h3>
									<nav class="space-y-2">
										{#each rotas as rota}
											<a
												href="#rota-{rota.id}"
												class="block text-sm text-brand-blue hover:text-brand-blue/80 hover:underline py-1.5 px-2 rounded hover:bg-brand-blue/5 transition-colors"
											>
												{rota.role}
											</a>
										{/each}
									</nav>
								</div>
							{/if}

							<div class="border-t border-gray-200 pt-6">
								<button
									type="submit"
									disabled={selectedRotas.size === 0 || !name || !email}
									class="w-full bg-brand-green text-white px-8 py-3 rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:transform-none flex items-center justify-center gap-2"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									Sign Up for Selected Rotas ({selectedRotas.size})
								</button>
							</div>
						</div>
					</div>

					<!-- Right Column: Rotas with Occurrences as Small Boxes -->
					<div class="lg:col-span-2">
						<div class="bg-white shadow rounded-lg p-6">
							<div class="space-y-6">
								{#each rotas as rota}
									<div id="rota-{rota.id}" class="border-l-4 border-l-brand-blue border border-gray-200 rounded-lg p-4 scroll-mt-6 bg-white hover:shadow-md transition-shadow">
										<div class="flex items-start justify-between mb-3">
											<div class="flex-1">
												<h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
													<span class="w-2 h-2 rounded-full bg-brand-green"></span>
													{rota.role}
												</h3>
												{#if rota.notes}
													<div class="text-sm text-gray-600 mt-1 ml-4">{@html rota.notes}</div>
												{/if}
												<p class="text-sm text-gray-500 mt-1 ml-4">
													Capacity: <span class="font-medium text-brand-blue">{rota.capacity}</span> {rota.capacity === 1 ? 'person' : 'people'} per occurrence
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
													{@const alreadySignedUp = isEmailAlreadySignedUp(rota, occ.id)}
													{@const canSelect = !isFull && !alreadySignedUp}
													
													<div class="border-2 rounded p-2 transition-all {isSelected ? 'bg-brand-green/10 border-brand-green shadow-sm' : 'border-gray-200 hover:border-brand-blue/50'} {!canSelect && !isSelected ? 'opacity-60' : ''}">
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
																		<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-brand-yellow/10 text-brand-yellow border border-brand-yellow/20">
																			Signed up
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
					</div>
				</div>
			</form>
		{/if}
	</div>
	
	<!-- Notification Popups -->
	<NotificationPopup />
</div>

