<script>
	import { page } from '$app/stores';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: data = $page.data || {};
	$: events = data.events || [];
	$: rotas = data.rotas || [];
	$: contacts = data.contacts || [];
	$: lists = data.lists || [];
	$: csrfToken = data.csrfToken || '';

	let selectedEventId = '';
	let selectedRotaId = '';
	let contactSelectionType = 'individual'; // 'individual' or 'list'
	let selectedContactIds = new Set();
	let selectedListId = '';
	
	// New flexible timing options
	let patternType = 'day-of-month'; // 'day-of-month' or 'day-of-week'
	let dayOfMonthPosition = 'beginning'; // 'beginning', 'middle', 'end'
	let dayOfWeek = 'monday'; // 'monday', 'tuesday', etc.
	let weekOfMonth = 'first'; // 'first', 'second', 'third', 'fourth', 'last', 'any'
	let frequency = 1; // Number
	let endDate = '';
	let searchTerm = '';
	let submitting = false;
	let results = null;

	$: filteredRotas = selectedEventId 
		? rotas.filter(r => r.eventId === selectedEventId)
		: [];

	$: filteredContacts = searchTerm
		? contacts.filter(c => 
			(c.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
			(c.lastName || '').toLowerCase().includes(searchTerm.toLowerCase())
		)
		: contacts;

	function toggleContactSelection(contactId) {
		if (selectedContactIds.has(contactId)) {
			selectedContactIds.delete(contactId);
		} else {
			selectedContactIds.add(contactId);
		}
		selectedContactIds = selectedContactIds; // Trigger reactivity
	}

	function selectAllContacts() {
		filteredContacts.forEach(contact => {
			selectedContactIds.add(contact.id);
		});
		selectedContactIds = selectedContactIds;
	}

	function deselectAllContacts() {
		filteredContacts.forEach(contact => {
			selectedContactIds.delete(contact.id);
		});
		selectedContactIds = selectedContactIds;
	}

	async function handleSubmit() {
		if (!selectedRotaId) {
			await dialog.alert('Please select a rota', 'Validation Error');
			return;
		}

		if (contactSelectionType === 'individual' && selectedContactIds.size === 0) {
			await dialog.alert('Please select at least one contact', 'Validation Error');
			return;
		}

		if (contactSelectionType === 'list' && !selectedListId) {
			await dialog.alert('Please select a contact list', 'Validation Error');
			return;
		}

		if (!patternType) {
			await dialog.alert('Please select a pattern type', 'Validation Error');
			return;
		}

		if (patternType === 'day-of-month' && !dayOfMonthPosition) {
			await dialog.alert('Please select a day of month position', 'Validation Error');
			return;
		}

		if (patternType === 'day-of-week' && (!dayOfWeek || !weekOfMonth)) {
			await dialog.alert('Please select day of week and week of month', 'Validation Error');
			return;
		}

		if (!frequency) {
			await dialog.alert('Please select frequency', 'Validation Error');
			return;
		}

		if (!endDate) {
			await dialog.alert('Please select an end date', 'Validation Error');
			return;
		}

		submitting = true;
		results = null;

		try {
			const formData = new FormData();
			formData.append('_csrf', csrfToken);
			formData.append('rotaId', selectedRotaId);
			formData.append('contactSelectionType', contactSelectionType);
			
			if (contactSelectionType === 'individual') {
				formData.append('contactIds', JSON.stringify(Array.from(selectedContactIds)));
			} else {
				formData.append('listId', selectedListId);
			}
			
			formData.append('patternType', patternType);
			if (patternType === 'day-of-month') {
				formData.append('dayOfMonthPosition', dayOfMonthPosition);
			} else {
				formData.append('dayOfWeek', dayOfWeek);
				formData.append('weekOfMonth', weekOfMonth);
			}
			
			formData.append('frequency', frequency.toString());
			formData.append('endDate', endDate);

			const response = await fetch('?/assign', {
				method: 'POST',
				headers: {
					'Accept': 'application/json'
				},
				body: formData
			});

			let result;
			try {
				const responseData = await response.json();
				console.log('[CLIENT] Response status:', response.status, response.ok);
				console.log('[CLIENT] Response data:', responseData);
				
				// SvelteKit form actions wrap the response in { type, status, data }
				// The data field is a JSON string that needs to be parsed
				if (responseData.data) {
					try {
						const parsedData = JSON.parse(responseData.data);
						// The parsed data is an array where the first element is the result object
						if (Array.isArray(parsedData) && parsedData.length > 0) {
							result = parsedData[0];
						} else {
							result = parsedData;
						}
					} catch (e) {
						console.error('[CLIENT] Error parsing data string:', e);
						result = responseData;
					}
				} else {
					result = responseData;
				}
				
				console.log('[CLIENT] Parsed result:', result);
			} catch (e) {
				console.error('[CLIENT] JSON parse error:', e);
				result = { error: 'Invalid response from server' };
			}
			
			if (!response.ok || result.error) {
				const errorMessage = result.error || 'Failed to assign contacts';
				results = { error: errorMessage };
				notifications.error(errorMessage);
			} else {
				// Ensure we have the correct structure
				const assignmentsMade = Number(result.assignmentsMade) || 0;
				const occurrencesMatched = Number(result.occurrencesMatched) || 0;
				const skippedFull = Number(result.skippedFull) || 0;
				const skippedDuplicate = Number(result.skippedDuplicate) || 0;
				
				// Create a new object to ensure reactivity
				results = {
					success: true,
					assignmentsMade,
					occurrencesMatched,
					skippedFull,
					skippedDuplicate
				};
				
				console.log('[CLIENT] Setting results:', results);
				notifications.success(`Successfully assigned ${assignmentsMade} contact${assignmentsMade !== 1 ? 's' : ''} to ${occurrencesMatched} occurrence${occurrencesMatched !== 1 ? 's' : ''}`);
			}
		} catch (error) {
			results = { error: error.message };
			notifications.error(error.message);
		} finally {
			submitting = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex justify-between items-center">
			<h2 class="text-2xl font-bold text-gray-900">Bulk Rota Assignment</h2>
			<a
				href="/hub/rotas"
				class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700 flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				Back
			</a>
		</div>
		<p class="mt-2 text-sm text-gray-600">
			Automatically assign contacts to rotas based on flexible monthly frequency and timing criteria.
		</p>
	</div>

	<!-- Selection Form -->
	<div class="bg-white shadow rounded-lg p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Selection</h3>
		
		<div class="space-y-4">
			<!-- Event and Rota Selection -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Event <span class="text-hub-red-500">*</span></label>
					<select 
						bind:value={selectedEventId} 
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
					>
						<option value="">Select an event</option>
						{#each events as event}
							<option value={event.id}>{event.title}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Rota <span class="text-hub-red-500">*</span></label>
					<select 
						bind:value={selectedRotaId}
						disabled={!selectedEventId}
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3 disabled:bg-gray-100"
					>
						<option value="">Select a rota</option>
						{#each filteredRotas as rota}
							<option value={rota.id}>{rota.role} (Capacity: {rota.capacity})</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- Contact Selection -->
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Contact Selection <span class="text-hub-red-500">*</span></label>
				<div class="flex gap-4 mb-3">
					<label class="flex items-center">
						<input type="radio" bind:group={contactSelectionType} value="individual" class="mr-2" />
						<span>Individual Contacts</span>
					</label>
					<label class="flex items-center">
						<input type="radio" bind:group={contactSelectionType} value="list" class="mr-2" />
						<span>Contact List</span>
					</label>
				</div>

				{#if contactSelectionType === 'list'}
					<select 
						bind:value={selectedListId}
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
					>
						<option value="">Select a list</option>
						{#each lists as list}
							<option value={list.id}>{list.name} ({list.contactIds?.length || 0} contacts)</option>
						{/each}
					</select>
				{:else}
					<div class="space-y-2">
						<input
							type="text"
							bind:value={searchTerm}
							placeholder="Search contacts..."
							class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
						/>
						<div class="flex justify-between items-center">
							<span class="text-sm text-gray-600">
								{selectedContactIds.size} contact{selectedContactIds.size !== 1 ? 's' : ''} selected
							</span>
							<div class="flex gap-2">
								<button
									type="button"
									on:click={selectAllContacts}
									class="text-sm text-hub-green-600 hover:text-hub-green-800 underline"
								>
									Select All
								</button>
								<button
									type="button"
									on:click={deselectAllContacts}
									class="text-sm text-gray-600 hover:text-gray-800 underline"
								>
									Deselect All
								</button>
							</div>
						</div>
						<div class="max-h-64 overflow-y-auto border border-gray-200 rounded-md p-2">
							{#if filteredContacts.length > 0}
								<div class="space-y-1">
									{#each filteredContacts as contact}
										<label class="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer">
											<input
												type="checkbox"
												checked={selectedContactIds.has(contact.id)}
												on:change={() => toggleContactSelection(contact.id)}
												class="mr-3"
											/>
											<div class="flex-1">
												<div class="font-medium text-sm">
													{`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}
												</div>
												<div class="text-xs text-gray-500">{contact.email}</div>
											</div>
										</label>
									{/each}
								</div>
							{:else}
								<p class="text-sm text-gray-500 italic">No contacts found</p>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Pattern Type, Position, Frequency, and End Date -->
			<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
				<!-- Pattern Type Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Pattern Type <span class="text-hub-red-500">*</span></label>
					<select 
						bind:value={patternType}
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
					>
						<option value="day-of-month">Day of Month</option>
						<option value="day-of-week">Day of Week</option>
					</select>
				</div>

				<!-- Day of Month Position or Day of Week Options -->
				{#if patternType === 'day-of-month'}
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Position <span class="text-hub-red-500">*</span></label>
						<select 
							bind:value={dayOfMonthPosition}
							class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
						>
							<option value="beginning">Beginning</option>
							<option value="middle">Middle</option>
							<option value="end">End</option>
						</select>
					</div>
				{:else}
					<div class="grid grid-cols-2 gap-2 md:col-span-2">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Day of Week <span class="text-hub-red-500">*</span></label>
							<select 
								bind:value={dayOfWeek}
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
							>
								<option value="monday">Monday</option>
								<option value="tuesday">Tuesday</option>
								<option value="wednesday">Wednesday</option>
								<option value="thursday">Thursday</option>
								<option value="friday">Friday</option>
								<option value="saturday">Saturday</option>
								<option value="sunday">Sunday</option>
							</select>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Week of Month <span class="text-hub-red-500">*</span></label>
							<select 
								bind:value={weekOfMonth}
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
							>
								<option value="first">First</option>
								<option value="second">Second</option>
								<option value="third">Third</option>
								<option value="fourth">Fourth</option>
								<option value="last">Last</option>
								<option value="any">Any (all occurrences)</option>
							</select>
						</div>
					</div>
				{/if}

				<!-- Frequency -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Frequency <span class="text-hub-red-500">*</span></label>
					<input
						type="number"
						bind:value={frequency}
						min="1"
						placeholder="e.g., 1, 2, 3"
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
					/>
				</div>

				<!-- End Date -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">End Date <span class="text-hub-red-500">*</span></label>
					<input
						type="date"
						bind:value={endDate}
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Submit Button -->
	<div class="bg-white shadow rounded-lg p-6">
		<button
			on:click={handleSubmit}
			disabled={submitting || !selectedRotaId || !patternType || !frequency || frequency < 1 || !endDate || (contactSelectionType === 'individual' && selectedContactIds.size === 0) || (contactSelectionType === 'list' && !selectedListId) || (patternType === 'day-of-month' && !dayOfMonthPosition) || (patternType === 'day-of-week' && (!dayOfWeek || !weekOfMonth))}
			class="bg-hub-green-600 text-white px-6 py-2.5 rounded-md hover:bg-hub-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
		>
			{#if submitting}
				<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
				Processing...
			{:else}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				Assign Contacts
			{/if}
		</button>
	</div>

	<!-- Results -->
	{#if results}
		<div class="bg-white shadow rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Results</h3>
			{#if results.error}
				<div class="p-4 bg-hub-red-50 border border-hub-red-200 rounded-md">
					<p class="text-hub-red-800 font-medium">{results.error}</p>
				</div>
			{:else if results.success || (results.assignmentsMade !== undefined && results.occurrencesMatched !== undefined)}
				<div class="space-y-3">
					<div class="p-4 bg-hub-green-50 border border-hub-green-200 rounded-md">
						<p class="text-hub-green-800 font-medium">
							✓ Successfully assigned {results.assignmentsMade || 0} contact{(results.assignmentsMade || 0) !== 1 ? 's' : ''} to {results.occurrencesMatched || 0} occurrence{(results.occurrencesMatched || 0) !== 1 ? 's' : ''}
						</p>
					</div>
					{#if results.skippedFull > 0 || results.skippedDuplicate > 0}
						<div class="p-4 bg-hub-yellow-50 border border-hub-yellow-200 rounded-md">
							<p class="text-hub-yellow-800 font-medium">
								⚠ Some assignments were skipped:
							</p>
							<ul class="mt-2 space-y-1 text-sm text-hub-yellow-700">
								{#if results.skippedFull > 0}
									<li>• {results.skippedFull} occurrence{results.skippedFull !== 1 ? 's' : ''} were already full</li>
								{/if}
								{#if results.skippedDuplicate > 0}
									<li>• {results.skippedDuplicate} assignment{results.skippedDuplicate !== 1 ? 's' : ''} were duplicates (already assigned)</li>
								{/if}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
