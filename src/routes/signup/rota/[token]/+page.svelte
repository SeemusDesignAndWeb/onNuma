<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';

	$: data = $page.data || {};
	$: token = data.token;
	$: rotas = data.rotas || [];
	$: event = data.event;
	$: occurrences = data.occurrences || [];
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
	let selectedRotas = new Set(); // Store as "rotaId:occurrenceId" or "rotaId" if no occurrence
	let spouse = null;
	let signUpWithSpouse = false;
	let checkingSpouse = false;
	let spouseCheckTimeout = null;
	let previousEmail = '';
	let previousName = '';
	let contactConfirmed = true; // Track if contact is confirmed
	let matchedContact = null; // Store the matched contact record

	// Reactive value for the hidden input - explicitly depend on selectedRotas
	// Convert Set to array and stringify whenever selectedRotas changes
	$: selectedRotasJson = (() => {
		// Force reactivity by accessing selectedRotas
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
		// Create a new Set with updated contents to ensure Svelte detects the change
		const newSet = new Set(selectedRotas);
		if (newSet.has(key)) {
			newSet.delete(key);
			console.log('[Rota Signup] Removed selection:', key, 'New size:', newSet.size);
		} else {
			newSet.add(key);
			console.log('[Rota Signup] Added selection:', key, 'New size:', newSet.size);
		}
		selectedRotas = newSet; // Assign new Set to trigger reactivity
		console.log('[Rota Signup] Current selectedRotas:', Array.from(selectedRotas));
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
			// Always get the latest value directly from selectedRotas to ensure it's current
			const selectedArray = Array.from(selectedRotas).map(key => {
				const parts = key.split(':');
				return {
					rotaId: parts[0],
					occurrenceId: parts.length > 1 ? parts[1] : null
				};
			});
			const jsonStr = JSON.stringify(selectedArray);
			console.log('[Rota Signup] Updating hidden input. selectedRotas.size:', selectedRotas.size, 'selectedArray:', selectedArray, 'jsonStr:', jsonStr);
			node.value = jsonStr;
		}
		
		// Update immediately
		update();
		
		// Update on form submit with capture:true to run BEFORE enhance processes the form
		// This ensures we have the latest value even if there's a timing issue
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
		// Force reactivity by accessing selectedRotas
		const _ = selectedRotas.size;
		// Update the input value directly from selectedRotas to ensure it's current
		const selectedArray = Array.from(selectedRotas).map(key => {
			const parts = key.split(':');
			return {
				rotaId: parts[0],
				occurrenceId: parts.length > 1 ? parts[1] : null
			};
		});
		const jsonStr = JSON.stringify(selectedArray);
		console.log('[Rota Signup] Reactive update. selectedRotas.size:', selectedRotas.size, 'selectedArray:', selectedArray, 'jsonStr:', jsonStr);
		hiddenInputNode.value = jsonStr;
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

<div class="min-h-screen bg-gray-50 pt-[70px]">
	<div class="max-w-7xl mx-auto py-8 px-4 sm:py-12 sm:px-6 lg:px-8">

		{#if rotas.length === 0}
			<div class="bg-white shadow rounded-lg p-6">
				<p class="text-gray-500">No rotas available for this event.</p>
				<p class="text-sm text-gray-400 mt-2">This may be because the rota is set to "Internal" visibility, which is not accessible via public signup links.</p>
			</div>
		{:else if occurrences.length === 0 && rotas.length > 0}
			<div class="bg-white shadow rounded-lg p-6">
				<p class="text-gray-500">No upcoming occurrences available for this event.</p>
				<p class="text-sm text-gray-400 mt-2">All occurrences for this event are in the past. Please contact the event organizer for more information.</p>
				<div class="mt-4 space-y-4">
					{#each rotas as rota}
						<div class="border-l-4 border-l-brand-blue border border-gray-200 rounded-lg p-4">
							<h3 class="text-lg font-semibold text-gray-900">{rota.role}</h3>
							<p class="text-sm text-gray-500 mt-1">This rota has no upcoming occurrences available for signup.</p>
						</div>
					{/each}
				</div>
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
					<!-- Your Details - Left column on large screens -->
					<div class="lg:col-span-1">
						<div class="bg-white shadow rounded-lg p-6 sticky top-[76px] space-y-6">
							<div>
								<h1 class="text-2xl font-bold text-brand-blue mb-2">{event?.title || 'Volunteer Signup'}</h1>
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
						</div>
					</div>

					<!-- Available Rotas - Right column on large screens -->
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
												{#if rota.helpFiles && rota.helpFiles.length > 0}
													<div class="mt-2 ml-4">
														<p class="text-xs font-medium text-gray-700 mb-1">Help Files:</p>
														<div class="flex flex-wrap gap-2">
															{#each rota.helpFiles as helpFile}
																{#if helpFile.type === 'link'}
																	<a
																		href={helpFile.url}
																		target="_blank"
																		rel="noopener noreferrer"
																		class="inline-flex items-center gap-1 text-xs text-brand-blue hover:text-brand-blue/80 hover:underline px-2 py-1 rounded bg-brand-blue/5 border border-brand-blue/20"
																	>
																		<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
																		</svg>
																		<span>{helpFile.title}</span>
																	</a>
																{:else}
																	<a
																		href="/hub/rotas/help-files/{helpFile.filename}"
																		target="_blank"
																		rel="noopener noreferrer"
																		class="inline-flex items-center gap-1 text-xs text-brand-green hover:text-brand-green/80 hover:underline px-2 py-1 rounded bg-brand-green/5 border border-brand-green/20"
																	>
																		<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
																		</svg>
																		<span>{helpFile.title || helpFile.originalName}</span>
																	</a>
																{/if}
															{/each}
														</div>
													</div>
												{/if}
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

