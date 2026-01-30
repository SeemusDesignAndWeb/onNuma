<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: meetingPlanner = $page.data?.meetingPlanner;
	$: event = $page.data?.event;
	$: occurrence = $page.data?.occurrence;
	$: eventOccurrences = $page.data?.eventOccurrences || [];
	$: rotas = $page.data?.rotas || {};
	$: rawRotas = $page.data?.rawRotas || {};
	$: rotasToLoad = $page.data?.rotasToLoad || [];
	$: availableContacts = $page.data?.availableContacts || [];
	$: lists = $page.data?.lists || [];
	$: speakerSeries = $page.data?.speakerSeries || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Debug: Log when data changes
	$: if (browser) {
		console.log('[CLIENT] Data updated:', {
			meetingPlannerId: meetingPlanner?.id,
			meetingPlannerOccurrenceId: meetingPlanner?.occurrenceId,
			rotas: Object.keys(rotas).map(key => ({
				key,
				assigneesCount: rotas[key]?.assignees?.length || 0,
				rawAssigneesCount: rawRotas[key]?.assignees?.length || 0
			}))
		});
	}
	
	// Always in edit mode - initialize form data from meeting planner
	let notes = '';
	let formData = {
		communionHappening: false,
		speakerTopic: '',
		speakerSeries: ''
	};
	let initializedMeetingPlannerId = null;

	// Initialize form data when meeting planner loads (only once per meeting planner)
	$: if (meetingPlanner && meetingPlanner.id !== initializedMeetingPlannerId) {
		let restoredFromStorage = false;
		
		// Check if there's unsaved form data in sessionStorage
		if (browser && typeof sessionStorage !== 'undefined') {
			const unsavedFormDataKey = `unsavedMeetingPlanner_${meetingPlanner.id}`;
			const unsavedData = sessionStorage.getItem(unsavedFormDataKey);
			if (unsavedData) {
				try {
					const parsed = JSON.parse(unsavedData);
					notes = parsed.notes || meetingPlanner.notes || '';
					formData = {
						communionHappening: parsed.communionHappening ?? meetingPlanner.communionHappening ?? false,
						speakerTopic: parsed.speakerTopic || meetingPlanner.speakerTopic || '',
						speakerSeries: parsed.speakerSeries || meetingPlanner.speakerSeries || ''
					};
					restoredFromStorage = true;
				} catch (error) {
					console.error('[CLIENT] Error parsing unsaved form data:', error);
					// Fall through to use database values
				}
			}
		}
		
		// Use database values if no unsaved data found or if restoration failed
		if (!restoredFromStorage) {
			notes = meetingPlanner.notes || '';
			formData = {
				communionHappening: meetingPlanner.communionHappening || false,
				speakerTopic: meetingPlanner.speakerTopic || '',
				speakerSeries: meetingPlanner.speakerSeries || ''
			};
		}
		
		initializedMeetingPlannerId = meetingPlanner.id;
	}

	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Preserve form data before page unload (for cases like form.submit() in removeAssignee)
	function preserveFormData() {
		if (browser && meetingPlanner?.id && typeof sessionStorage !== 'undefined') {
			const unsavedFormDataKey = `unsavedMeetingPlanner_${meetingPlanner.id}`;
			const unsavedData = {
				notes: notes,
				communionHappening: formData.communionHappening,
				speakerTopic: formData.speakerTopic,
				speakerSeries: formData.speakerSeries
			};
			sessionStorage.setItem(unsavedFormDataKey, JSON.stringify(unsavedData));
		}
	}

	// Check for notification stored in sessionStorage (from page reload after adding assignees)
	onMount(() => {
		console.log('[CLIENT] onMount called');
		console.log('[CLIENT] meetingPlanner:', meetingPlanner);
		console.log('[CLIENT] rotas:', rotas);
		console.log('[CLIENT] rawRotas:', rawRotas);
		
		if (browser && typeof sessionStorage !== 'undefined') {
			const storedNotification = sessionStorage.getItem('assigneeNotification');
			console.log('[CLIENT] Stored notification from sessionStorage:', storedNotification);
			if (storedNotification) {
				sessionStorage.removeItem('assigneeNotification');
				notifications.success(storedNotification);
			}
			
			// Add beforeunload listener to preserve form data
			window.addEventListener('beforeunload', preserveFormData);
		}
		
		return () => {
			if (browser) {
				window.removeEventListener('beforeunload', preserveFormData);
			}
		};
	});

	// Show notifications from form results
	$: if (formResult && browser && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			if (formResult?.type === 'addAssignee' || formResult?.type === 'removeAssignee') {
				const message = formResult.message || (formResult.type === 'addAssignee' ? 'Assignee added successfully' : 'Assignee removed successfully');
				notifications.success(message);
				if (browser) {
					// Preserve unsaved form data before refresh
					if (meetingPlanner?.id && typeof sessionStorage !== 'undefined') {
						const unsavedFormDataKey = `unsavedMeetingPlanner_${meetingPlanner.id}`;
						const unsavedData = {
							notes: notes,
							communionHappening: formData.communionHappening,
							speakerTopic: formData.speakerTopic,
							speakerSeries: formData.speakerSeries
						};
						sessionStorage.setItem(unsavedFormDataKey, JSON.stringify(unsavedData));
					}
					// Force immediate refresh to show updated assignees
					// Use invalidateAll to ensure fresh data from server
					invalidateAll();
				}
			} else if (formResult?.type !== 'addAssignee' && formResult?.type !== 'removeAssignee') {
				notifications.success('Meeting planner updated successfully');
				// Clear unsaved form data after successful save
				if (browser && meetingPlanner?.id && typeof sessionStorage !== 'undefined') {
					const unsavedFormDataKey = `unsavedMeetingPlanner_${meetingPlanner.id}`;
					sessionStorage.removeItem(unsavedFormDataKey);
				}
				if (browser) {
					setTimeout(() => {
						invalidateAll();
					}, 100);
				}
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this meeting planner?', 'Delete Meeting Planner');
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/delete';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			document.body.appendChild(form);
			form.submit();
		}
	}

	// Rota management functions
	let showAddAssignees = {};
	let searchTerm = {};
	let selectedContactIds = {};
	let selectedOccurrenceId = {};
	let selectedListId = {};

	function initializeRotaState(rotaKey) {
		if (!showAddAssignees[rotaKey]) showAddAssignees[rotaKey] = false;
		if (!searchTerm[rotaKey]) searchTerm[rotaKey] = '';
		if (!selectedContactIds[rotaKey]) selectedContactIds[rotaKey] = new Set();
		if (!selectedListId[rotaKey]) selectedListId[rotaKey] = '';
		if (!selectedOccurrenceId[rotaKey]) {
			// Default to meeting planner's occurrence if set, otherwise first occurrence
			selectedOccurrenceId[rotaKey] = meetingPlanner?.occurrenceId || (eventOccurrences.length > 0 ? eventOccurrences[0].id : '') || '';
		}
	}

	$: Object.keys(rotas).forEach(key => initializeRotaState(key));

	// Filter contacts by list if a list is selected
	// Create a reactive statement that updates when lists, selectedListId, or availableContacts change
	$: contactsFilteredByList = (() => {
		const result = {};
		Object.keys(rotas).forEach(rotaKey => {
			if (selectedListId[rotaKey]) {
				const selectedList = lists.find(l => l.id === selectedListId[rotaKey]);
				if (selectedList && selectedList.contactIds) {
					result[rotaKey] = availableContacts.filter(c => selectedList.contactIds.includes(c.id));
				} else {
					result[rotaKey] = availableContacts;
				}
			} else {
				result[rotaKey] = availableContacts;
			}
		});
		return result;
	})();

	// Helper function to sort contacts by first name, then last name
	function sortContacts(contacts) {
		return contacts.sort((a, b) => {
			const aFirstName = (a.firstName || '').toLowerCase();
			const bFirstName = (b.firstName || '').toLowerCase();
			const aLastName = (a.lastName || '').toLowerCase();
			const bLastName = (b.lastName || '').toLowerCase();
			
			if (aFirstName !== bFirstName) {
				return aFirstName.localeCompare(bFirstName);
			}
			return aLastName.localeCompare(bLastName);
		});
	}

	$: filteredContacts = (() => {
		const result = {};
		Object.keys(rotas).forEach(rotaKey => {
			const baseContacts = contactsFilteredByList[rotaKey] || availableContacts;
			const filtered = searchTerm[rotaKey]
				? baseContacts.filter(c => 
					(c.firstName || '').toLowerCase().includes(searchTerm[rotaKey].toLowerCase()) ||
					(c.lastName || '').toLowerCase().includes(searchTerm[rotaKey].toLowerCase())
				)
				: baseContacts;
			// Sort by last name, then first name
			result[rotaKey] = sortContacts([...filtered]);
		});
		return result;
	})();

	function toggleContactSelection(rotaKey, contactId) {
		if (!selectedContactIds[rotaKey]) selectedContactIds[rotaKey] = new Set();
		if (selectedContactIds[rotaKey].has(contactId)) {
			selectedContactIds[rotaKey].delete(contactId);
		} else {
			selectedContactIds[rotaKey].add(contactId);
		}
		selectedContactIds[rotaKey] = selectedContactIds[rotaKey]; // Trigger reactivity
	}
	
	function selectAllContacts(rotaKey) {
		if (!selectedContactIds[rotaKey]) selectedContactIds[rotaKey] = new Set();
		if (filteredContacts[rotaKey]) {
			filteredContacts[rotaKey].forEach(contact => {
				selectedContactIds[rotaKey].add(contact.id);
			});
			selectedContactIds[rotaKey] = selectedContactIds[rotaKey]; // Trigger reactivity
		}
	}
	
	function deselectAllContacts(rotaKey) {
		if (!selectedContactIds[rotaKey]) selectedContactIds[rotaKey] = new Set();
		if (filteredContacts[rotaKey]) {
			filteredContacts[rotaKey].forEach(contact => {
				selectedContactIds[rotaKey].delete(contact.id);
			});
			selectedContactIds[rotaKey] = selectedContactIds[rotaKey]; // Trigger reactivity
		}
	}

	async function handleAddAssignees(rotaKey) {
		console.log('[CLIENT] handleAddAssignees called for rotaKey:', rotaKey);
		console.log('[CLIENT] selectedContactIds:', selectedContactIds[rotaKey]);
		console.log('[CLIENT] selectedOccurrenceId:', selectedOccurrenceId[rotaKey]);
		
		if (!selectedContactIds[rotaKey] || selectedContactIds[rotaKey].size === 0) {
			await dialog.alert('Please select at least one contact to assign', 'No Contacts Selected');
			return;
		}
		
		const rota = rotas[rotaKey];
		if (!rota || !rawRotas[rotaKey]) {
			notifications.error('Rota not found');
			return;
		}

		console.log('[CLIENT] Rota ID:', rawRotas[rotaKey].id);
		console.log('[CLIENT] Current assignees count:', rota.assignees?.length || 0);

		// Always require occurrenceId when adding assignees (rotas are for all occurrences)
		if (eventOccurrences.length > 0 && !selectedOccurrenceId[rotaKey]) {
			notifications.error('Please select an occurrence');
			return;
		}

		const formData = new FormData();
		formData.append('_csrf', csrfToken);
		formData.append('rotaId', rawRotas[rotaKey].id);
		const contactIdsArray = Array.from(selectedContactIds[rotaKey]);
		formData.append('contactIds', JSON.stringify(contactIdsArray));
		if (eventOccurrences.length > 0 && selectedOccurrenceId[rotaKey]) {
			formData.append('occurrenceId', selectedOccurrenceId[rotaKey]);
		}

		console.log('[CLIENT] Submitting form with:', {
			rotaId: rawRotas[rotaKey].id,
			contactIds: contactIdsArray,
			occurrenceId: selectedOccurrenceId[rotaKey] || 'null'
		});

		try {
			const response = await fetch('?/addAssignee', {
				method: 'POST',
				headers: {
					'accept': 'application/json'
				},
				body: formData
			});

			console.log('[CLIENT] Response status:', response.status);
			console.log('[CLIENT] Response ok:', response.ok);
			console.log('[CLIENT] Response redirected:', response.redirected);

			// Check if the response is successful
			if (response.ok || response.redirected) {
				// Try to get the response data to show notification
				let message = 'Assignees added successfully';
				try {
					const contentType = response.headers.get('content-type');
					console.log('[CLIENT] Response content-type:', contentType);
					if (contentType && contentType.includes('application/json')) {
						const result = await response.json();
						console.log('[CLIENT] Response JSON:', result);
						if (result.message) {
							message = result.message;
						}
					} else {
						const text = await response.text();
						console.log('[CLIENT] Response text (first 500 chars):', text.substring(0, 500));
					}
				} catch (error) {
					console.error('[CLIENT] Error parsing response:', error);
				}

				console.log('[CLIENT] Storing notification message:', message);
				// Store message in sessionStorage to show after reload
				if (browser && typeof sessionStorage !== 'undefined') {
					sessionStorage.setItem('assigneeNotification', message);
					
					// Preserve unsaved form data before reload
					if (meetingPlanner?.id) {
						const unsavedFormDataKey = `unsavedMeetingPlanner_${meetingPlanner.id}`;
						const unsavedData = {
							notes: notes,
							communionHappening: formData.communionHappening,
							speakerTopic: formData.speakerTopic,
							speakerSeries: formData.speakerSeries
						};
						sessionStorage.setItem(unsavedFormDataKey, JSON.stringify(unsavedData));
					}
				}

				console.log('[CLIENT] Reloading page...');
				// Force full page reload to show updated assignees
				// This ensures the data is fresh from the server and avoids hydration issues
				window.location.reload();
			} else {
				console.error('[CLIENT] Response not ok, status:', response.status);
				// Handle error response
				try {
					const contentType = response.headers.get('content-type');
					if (contentType && contentType.includes('application/json')) {
						const result = await response.json();
						console.error('[CLIENT] Error result:', result);
						if (result.type === 'failure') {
							notifications.error(result.data?.error || 'Failed to add assignees');
						}
					} else {
						const text = await response.text();
						console.error('[CLIENT] Error text:', text);
						notifications.error('Failed to add assignees');
					}
				} catch (error) {
					console.error('[CLIENT] Error handling error response:', error);
					notifications.error('Failed to add assignees');
				}
			}
		} catch (error) {
			console.error('[CLIENT] Error adding assignees:', error);
			notifications.error('Failed to add assignees');
		}
	}

	async function handleRemoveAssignee(rotaKey, assignee, index) {
		const confirmed = await dialog.confirm('Are you sure you want to remove this assignee?', 'Remove Assignee');
		if (confirmed) {
			const rota = rawRotas[rotaKey];
			if (!rota) {
				notifications.error('Rota not found');
				return;
			}

			// Find the assignee in the raw rota assignees array
			const rawAssignees = rota.assignees || [];
			let originalIndex = -1;
			
			const assigneeOccId = (assignee.occurrenceId === null || assignee.occurrenceId === undefined) ? null : assignee.occurrenceId;
			
			originalIndex = rawAssignees.findIndex((a, idx) => {
				if (typeof a === 'string') {
					if (assignee.id && a === assignee.id) {
						if (rota.occurrenceId !== null && rota.occurrenceId !== undefined) {
							return rota.occurrenceId === assigneeOccId;
						}
						return assigneeOccId === null || assigneeOccId === rota.occurrenceId;
					}
					return false;
				}
				if (a && typeof a === 'object') {
					const aOccurrenceId = (a.occurrenceId === null || a.occurrenceId === undefined) ? null : a.occurrenceId;
					if (aOccurrenceId !== assigneeOccId) {
						return false;
					}
					
					if (typeof a.contactId === 'string') {
						if (assignee.id !== null && assignee.id !== undefined) {
							const aId = a.contactId || a.id;
							return aId === assignee.id;
						}
					} else if (a.contactId && typeof a.contactId === 'object') {
						if (assignee.id === null || assignee.id === undefined) {
							const aEmail = a.contactId.email || a.email;
							const aName = a.contactId.name || a.name;
							if (aEmail && assignee.email) {
								return aEmail.toLowerCase() === assignee.email.toLowerCase() && (aName || '') === (assignee.name || '');
							}
						}
					} else if (a.email && a.name) {
						if (assignee.id === null || assignee.id === undefined) {
							if (a.email && assignee.email) {
								return a.email.toLowerCase() === assignee.email.toLowerCase() && (a.name || '') === (assignee.name || '');
							}
						}
					}
					return false;
				}
				return false;
			});
			
			if (originalIndex === -1) {
				notifications.error('Could not find assignee to remove');
				return;
			}

			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/removeAssignee';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			const rotaIdInput = document.createElement('input');
			rotaIdInput.type = 'hidden';
			rotaIdInput.name = 'rotaId';
			rotaIdInput.value = rota.id;
			form.appendChild(rotaIdInput);
			
			const indexInput = document.createElement('input');
			indexInput.type = 'hidden';
			indexInput.name = 'index';
			indexInput.value = originalIndex;
			form.appendChild(indexInput);
			
			// Preserve unsaved form data before submitting
			if (browser && meetingPlanner?.id && typeof sessionStorage !== 'undefined') {
				const unsavedFormDataKey = `unsavedMeetingPlanner_${meetingPlanner.id}`;
				const unsavedData = {
					notes: notes,
					communionHappening: formData.communionHappening,
					speakerTopic: formData.speakerTopic,
					speakerSeries: formData.speakerSeries
				};
				sessionStorage.setItem(unsavedFormDataKey, JSON.stringify(unsavedData));
			}
			
			document.body.appendChild(form);
			form.submit();
		}
	}

	function getRotaDisplayName(rotaKey) {
		const item = rotasToLoad.find(i => i.key === rotaKey);
		if (item) return item.role;
		
		const names = {
			meetingLeader: 'Meeting Leader',
			worshipLeader: 'Worship Leader and Team',
			speaker: 'Speaker',
			callToWorship: 'Call to Worship'
		};
		return names[rotaKey] || rotaKey;
	}

	function formatDateWithOrdinal(date) {
		if (!date) return '';
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return '';
		
		const day = d.getDate();
		const month = d.toLocaleDateString('en-GB', { month: 'long' });
		const year = d.getFullYear();
		
		// Add ordinal suffix
		const getOrdinal = (n) => {
			const s = ['th', 'st', 'nd', 'rd'];
			const v = n % 100;
			return n + (s[(v - 20) % 10] || s[v] || s[0]);
		};
		
		return `${getOrdinal(day)} ${month} ${year}`;
	}
</script>

{#if meetingPlanner}
	<!-- Header Panel -->
	<div class="bg-white shadow rounded-lg p-3 sm:p-4 mb-4">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 sm:gap-4">
			<div class="flex-1 min-w-0">
				<h2 class="text-lg sm:text-xl font-bold text-gray-900 mb-2">Meeting Planner</h2>
				<div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 text-base sm:text-xl text-gray-600">
					<div>
						<a href="/hub/events/{event.id}" class="text-hub-green-600 hover:text-hub-green-700 underline font-bold break-words">
							{event?.title || 'Unknown'}
						</a>
					</div>
					<div class="text-xs">
						{#if occurrence}
							{formatDateWithOrdinal(occurrence.startsAt)}
						{:else}
							<span class="text-gray-500">All occurrences</span>
						{/if}
					</div>
				</div>
			</div>
			<div class="flex flex-wrap gap-2 w-full sm:w-auto">
				<a
					href="/hub/meeting-planners"
					class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs sm:text-sm flex items-center gap-1 flex-1 sm:flex-none justify-center"
				>
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					Back
				</a>
				<button
					type="submit"
					form="meeting-planner-edit-form"
					class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs sm:text-sm flex-1 sm:flex-none"
				>
					<span class="hidden sm:inline">Save Changes</span>
					<span class="sm:hidden">Save</span>
				</button>
				<button
					on:click={handleDelete}
					class="bg-hub-red-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-red-700 text-xs sm:text-sm flex-1 sm:flex-none"
				>
					Delete
				</button>
			</div>
		</div>
	</div>

	<!-- Main Content Grid -->
	<div class="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
		<!-- Left Column: Meeting Details (1/4 width) -->
		<div class="lg:col-span-1">
			<form id="meeting-planner-edit-form" method="POST" action="?/update" use:enhance={({ formData: fd, cancel }) => {
				return async ({ result, update }) => {
					// Clear unsaved form data after successful save
					if (result.type === 'success' && browser && meetingPlanner?.id && typeof sessionStorage !== 'undefined') {
						const unsavedFormDataKey = `unsavedMeetingPlanner_${meetingPlanner.id}`;
						sessionStorage.removeItem(unsavedFormDataKey);
					}
					await update({ reset: false });
				};
			}}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="notes" value={notes} />
				
				<!-- Meeting Details Panel -->
				<div class="bg-white shadow rounded-lg p-2.5 sm:p-3 mb-3 sm:mb-4">
					<h3 class="text-xs font-semibold text-gray-900 mb-2 sm:mb-3">Meeting Details</h3>
					<div class="space-y-2.5 sm:space-y-3">
						<div class="flex items-center">
							<input
								type="checkbox"
								id="communionHappening"
								name="communionHappening"
								value="on"
								bind:checked={formData.communionHappening}
								class="h-4 w-4 text-hub-green-600 focus:ring-hub-green-500 border-gray-300 rounded"
							/>
							<label for="communionHappening" class="ml-2 block text-xs text-gray-700">
								Communion happening
							</label>
						</div>
						<div>
							<label for="speakerTopic" class="block text-xs font-medium text-gray-700 mb-1">Speaker Topic</label>
							<input
								type="text"
								id="speakerTopic"
								name="speakerTopic"
								bind:value={formData.speakerTopic}
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3 text-sm"
								placeholder="Enter speaker topic"
							/>
						</div>
						<div>
							<label for="speakerSeries" class="block text-xs font-medium text-gray-700 mb-1">Speaker Series</label>
							<input
								type="text"
								id="speakerSeries"
								name="speakerSeries"
								bind:value={formData.speakerSeries}
								list="speakerSeriesList"
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3 text-sm"
								placeholder="Enter or select a series"
							/>
							<datalist id="speakerSeriesList">
								{#each speakerSeries as series}
									<option value={series} />
								{/each}
							</datalist>
						</div>
					</div>
				</div>

				<!-- Notes Panel -->
				<div class="bg-white shadow rounded-lg p-2.5 sm:p-3">
					<h3 class="text-xs font-semibold text-gray-900 mb-2 sm:mb-3">Notes</h3>
					<div>
						<HtmlEditor bind:value={notes} name="notes" />
					</div>
				</div>
			</form>
		</div>

		<!-- Right Column: Rotas Grid (3/4 width) -->
		<div class="lg:col-span-3">
			<div class="bg-white shadow rounded-lg p-3 sm:p-4">
				<div class="flex justify-between items-center mb-3">
					<h3 class="text-base sm:text-lg font-bold text-gray-900">Rotas</h3>
				</div>
				
				<div class="flex flex-wrap -mx-2">
					{#each rotasToLoad as item}
						{@const rotaKey = item.key}
						{@const rota = rotas[rotaKey]}
						{@const rawRota = rawRotas[rotaKey]}
						{#if rota}
							<div class="w-full md:w-1/2 px-2 mb-4">
								<div class="border border-gray-200 rounded-lg p-2.5 sm:p-3 flex flex-col h-full bg-white">
									<div class="flex justify-between items-start mb-2 sm:mb-3">
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-1.5 mb-1">
												<h4 class="text-xs sm:text-sm font-semibold text-gray-900 truncate">{getRotaDisplayName(rotaKey)}</h4>
												<a 
													href="/hub/rotas/{rota.id}" 
													class="text-hub-blue-600 hover:text-hub-blue-800 flex-shrink-0"
													target="_blank"
													title="View full details"
												>
													<svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
													</svg>
												</a>
											</div>
											<div class="text-xs text-gray-500 w-20">
												<span class="font-medium text-gray-700">
													{rota.assignees?.length || 0} Assigned
												</span>
											</div>
										</div>
									</div>

									<div class="flex-1 min-h-[80px] mb-3 {rota.assignees && rota.assignees.length > 3 ? 'max-h-[180px] overflow-y-auto' : ''}">
										{#if rota.assignees && rota.assignees.length > 0}
											<div class="space-y-1.5">
												{#each rota.assignees as assignee, index}
													<div class="flex items-center justify-between p-1.5 bg-gray-50 rounded hover:bg-gray-100 transition-colors">
														<div class="flex-1 min-w-0 pr-1.5">
															{#if assignee.id}
																<a href="/hub/contacts/{assignee.id}" class="text-hub-green-600 hover:text-hub-green-700 underline font-medium text-xs block truncate">
																	{assignee.name || 'Unknown'}
																</a>
															{:else}
																<span class="font-medium text-xs block truncate">{assignee.name || 'Unknown'}</span>
																<span class="text-xs text-gray-400">(Public)</span>
															{/if}
														</div>
														<button
															on:click={() => handleRemoveAssignee(rotaKey, assignee, index)}
															class="text-hub-red-600 hover:text-hub-red-800 p-1 rounded text-xs flex-shrink-0"
															title="Remove assignee"
														>
															<svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
															</svg>
														</button>
													</div>
												{/each}
											</div>
										{:else}
											<p class="text-xs text-gray-400 italic text-center py-3">No assignees yet</p>
										{/if}
									</div>

									<button
										on:click={() => {
											showAddAssignees[rotaKey] = true;
											searchTerm[rotaKey] = '';
											selectedContactIds[rotaKey] = new Set();
											selectedListId[rotaKey] = '';
										}}
										class="w-full bg-hub-green-600 text-white px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-md hover:bg-hub-green-700 text-xs transition-colors"
									>
										+ Add Assignees
									</button>
								</div>

								<!-- Add Assignees Modal -->
								{#if showAddAssignees[rotaKey]}
									<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4" on:click={() => showAddAssignees[rotaKey] = false}>
										<div class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] flex flex-col" on:click|stopPropagation>
											<div class="p-3 sm:p-4 border-b border-gray-200">
												<h3 class="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3">Add Assignees - {getRotaDisplayName(rotaKey)}</h3>
												
												{#if eventOccurrences.length > 0}
													<div class="mb-2 sm:mb-3">
														<label class="block text-xs font-medium text-gray-700 mb-1">Occurrence <span class="text-hub-red-500">*</span></label>
														<select bind:value={selectedOccurrenceId[rotaKey]} required class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-1.5 px-2.5 sm:px-3 text-xs sm:text-sm">
															<option value="">Select an occurrence</option>
															{#each eventOccurrences as occ}
																<option value={occ.id}>
																	{formatDateTimeUK(occ.startsAt)}
																</option>
															{/each}
														</select>
														<p class="mt-1 text-xs text-gray-500">Rotas apply to all occurrences. Select which occurrence to assign to.</p>
													</div>
												{/if}
												
												<div class="mb-2 sm:mb-3">
													<label class="block text-xs font-medium text-gray-700 mb-1">Filter by List (optional)</label>
													<select bind:value={selectedListId[rotaKey]} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-1.5 px-2.5 sm:px-3 text-xs sm:text-sm">
														<option value="">All Contacts</option>
														{#each lists as list}
															<option value={list.id}>{list.name}</option>
														{/each}
													</select>
													<p class="mt-1 text-xs text-gray-500">Select a list to filter contacts</p>
												</div>
												
												<div>
													<input
														type="text"
														bind:value={searchTerm[rotaKey]}
														placeholder="Search contacts..."
														class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-1.5 px-2.5 sm:px-3 text-xs sm:text-sm"
													/>
												</div>
											</div>

											<div class="flex-1 overflow-y-auto p-3 sm:p-4">
												{#if filteredContacts[rotaKey] && filteredContacts[rotaKey].length > 0}
													<div class="mb-3 flex justify-between items-center">
														<span class="text-xs text-gray-600">
															Showing {filteredContacts[rotaKey].length} contact{filteredContacts[rotaKey].length !== 1 ? 's' : ''}
														</span>
														<div class="flex gap-2">
															<button
																on:click={() => selectAllContacts(rotaKey)}
																class="text-xs text-hub-green-600 hover:text-hub-green-800 underline"
															>
																Select All
															</button>
															<button
																on:click={() => deselectAllContacts(rotaKey)}
																class="text-xs text-gray-600 hover:text-gray-800 underline"
															>
																Deselect All
															</button>
														</div>
													</div>
													<div class="space-y-1.5">
														{#each filteredContacts[rotaKey] as contact}
															<label class="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer">
																<input
																	type="checkbox"
																	checked={selectedContactIds[rotaKey]?.has(contact.id)}
																	on:change={() => toggleContactSelection(rotaKey, contact.id)}
																	class="mr-2"
																/>
																<div class="flex-1">
																	<div class="font-medium text-sm">
																		{`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}
																	</div>
																</div>
															</label>
														{/each}
													</div>
												{:else}
													<p class="text-sm text-gray-500">No available contacts to assign.</p>
												{/if}
											</div>

											<div class="p-3 sm:p-4 border-t border-gray-200 flex flex-col sm:flex-row gap-2 sm:justify-end">
												<button
													on:click={() => { 
														showAddAssignees[rotaKey] = false; 
														searchTerm[rotaKey] = ''; 
														selectedContactIds[rotaKey] = new Set(); 
														selectedListId[rotaKey] = '';
													}}
													class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs sm:text-sm w-full sm:w-auto"
												>
													Back
												</button>
												<button
													on:click={() => handleAddAssignees(rotaKey)}
													disabled={!selectedContactIds[rotaKey] || selectedContactIds[rotaKey].size === 0 || (eventOccurrences.length > 0 && !selectedOccurrenceId[rotaKey])}
													class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 disabled:opacity-50 text-xs sm:text-sm w-full sm:w-auto"
												>
													Add Selected ({selectedContactIds[rotaKey]?.size || 0})
												</button>
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			</div>
		</div>
	</div>
{/if}
