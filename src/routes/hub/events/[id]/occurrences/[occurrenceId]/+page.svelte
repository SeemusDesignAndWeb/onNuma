<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { onMount, onDestroy } from 'svelte';

	$: event = $page.data?.event;
	$: occurrence = $page.data?.occurrence;
	$: rotas = $page.data?.rotas || [];
	$: signups = $page.data?.signups || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && browser && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			if (formResult?.type === 'deleteSignup') {
				notifications.success('Signup removed successfully');
			} else {
				notifications.success('Occurrence updated successfully');
			}
			// Reset editing mode after successful save
			setTimeout(() => {
				editing = false;
				// Reload page data to get updated occurrence
				if (browser) {
					goto($page.url, { invalidateAll: true });
				}
			}, 100);
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	async function handleDeleteSignup(signupId) {
		const confirmed = await dialog.confirm('Are you sure you want to remove this signup?', 'Remove Signup');
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/deleteSignup';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			const signupIdInput = document.createElement('input');
			signupIdInput.type = 'hidden';
			signupIdInput.name = 'signupId';
			signupIdInput.value = signupId;
			form.appendChild(signupIdInput);
			
			document.body.appendChild(form);
			form.submit();
		}
	}

	let editing = false;
	let formData = {
		startsAt: '',
		endsAt: '',
		location: '',
		maxSpaces: '',
		allDay: false,
		occurrenceDate: ''
	};
	let information = '';
	let showApplyScopeDialog = false;
	
	// Handle Escape key to close dialog
	function handleEscapeKey(e) {
		if (e.key === 'Escape' && showApplyScopeDialog) {
			handleCancelDialog();
		}
	}
	
	// Set up and clean up Escape key listener
	$: if (browser) {
		if (showApplyScopeDialog) {
			window.addEventListener('keydown', handleEscapeKey);
		} else {
			window.removeEventListener('keydown', handleEscapeKey);
		}
	}

	// Handle all day toggle for occurrence edit
	function handleAllDayToggle() {
		if (formData.allDay) {
			if (formData.startsAt && !formData.occurrenceDate) {
				formData.occurrenceDate = formData.startsAt.split('T')[0];
			}
			if (formData.occurrenceDate) {
				formData.startsAt = `${formData.occurrenceDate}T00:00`;
				formData.endsAt = `${formData.occurrenceDate}T23:59`;
			}
		} else {
			if (formData.occurrenceDate && !formData.startsAt) {
				formData.startsAt = `${formData.occurrenceDate}T09:00`;
				formData.endsAt = `${formData.occurrenceDate}T17:00`;
			} else if (formData.startsAt) {
				formData.occurrenceDate = formData.startsAt.split('T')[0];
			}
		}
	}

	// Update datetime when date changes in all-day mode
	$: if (formData.allDay && formData.occurrenceDate) {
		formData.startsAt = `${formData.occurrenceDate}T00:00`;
		formData.endsAt = `${formData.occurrenceDate}T23:59`;
	}

	// Initialize form data when occurrence is loaded (avoid hydration issues)
	$: if (occurrence && !editing) {
		// Check if this is an all-day event (starts at 00:00 and ends at 23:59 on same day)
		const startDate = occurrence.startsAt ? new Date(occurrence.startsAt) : null;
		const endDate = occurrence.endsAt ? new Date(occurrence.endsAt) : null;
		const isAllDay = occurrence.allDay || (startDate && endDate && 
			startDate.getHours() === 0 && startDate.getMinutes() === 0 &&
			endDate.getHours() === 23 && endDate.getMinutes() === 59 &&
			startDate.toDateString() === endDate.toDateString());
		
		// Convert ISO dates to datetime-local format or date format
		const startDateStr = startDate ? startDate.toISOString().slice(0, 16) : '';
		const endDateStr = endDate ? endDate.toISOString().slice(0, 16) : '';
		const dateStr = startDate ? startDate.toISOString().slice(0, 10) : '';
		
		// Use occurrence maxSpaces if set, otherwise leave empty to show it's using event default
		formData = {
			startsAt: startDateStr,
			endsAt: endDateStr,
			location: occurrence.location || '',
			maxSpaces: occurrence.maxSpaces !== null && occurrence.maxSpaces !== undefined ? occurrence.maxSpaces.toString() : '',
			allDay: isAllDay,
			occurrenceDate: dateStr
		};
		information = occurrence.information || '';
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this occurrence?', 'Delete Occurrence');
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

	function handleFormSubmit(event) {
		event.preventDefault();
		showApplyScopeDialog = true;
	}

	async function handleApplyScope(scope) {
		showApplyScopeDialog = false;
		
		// Get the form
		const form = document.getElementById('occurrence-edit-form');
		if (!form) return;
		
		// Remove any existing applyScope input
		const existingScopeInput = form.querySelector('input[name="applyScope"]');
		if (existingScopeInput) {
			existingScopeInput.remove();
		}
		
		// Add the selected scope
		const scopeInput = document.createElement('input');
		scopeInput.type = 'hidden';
		scopeInput.name = 'applyScope';
		scopeInput.value = scope;
		form.appendChild(scopeInput);
		
		// Create FormData and submit via fetch
		const formData = new FormData(form);
		
		// Construct the action URL properly
		// The form action is "?/update", so we append it to the current page pathname
		const actionUrl = $page.url.pathname + '?/update';
		
		try {
			const response = await fetch(actionUrl, {
				method: 'POST',
				headers: {
					'Accept': 'application/json'
				},
				credentials: 'same-origin',
				body: formData
			});
			
			// Check if response is successful
			if (!response.ok) {
				// If status is not OK, try to get error message
				let errorMsg = `Server returned status ${response.status}`;
				try {
					const contentType = response.headers.get('content-type');
					if (contentType && contentType.includes('application/json')) {
						const result = await response.json();
						errorMsg = result?.error || result?.message || errorMsg;
					}
				} catch {
					// Ignore parsing errors
				}
				notifications.error(errorMsg);
				return;
			}
			
			// Response is OK (200), now parse the result
			const contentType = response.headers.get('content-type');
			let result;
			
			if (contentType && contentType.includes('application/json')) {
				result = await response.json();
			} else {
				// If not JSON, try to parse as text
				const text = await response.text();
				try {
					result = JSON.parse(text);
				} catch {
					// If it's not JSON, but status is 200, assume success
					result = { success: true };
				}
			}
			
			// Check if the result indicates success
			if (result?.success !== false && !result?.error) {
				// Success!
				notifications.success(`Occurrence updated successfully${scope === 'future' ? ' (applied to all future occurrences)' : ''}`);
				// Reset editing mode and reload page data
				setTimeout(() => {
					editing = false;
					if (browser) {
						goto($page.url, { invalidateAll: true });
					}
				}, 100);
			} else {
				// Result indicates an error
				const errorMsg = result?.error || result?.message || 'Failed to update occurrence';
				console.error('Update failed:', { status: response.status, result });
				notifications.error(errorMsg);
			}
		} catch (error) {
			console.error('Error updating occurrence:', error);
			notifications.error('Failed to update occurrence: ' + (error.message || 'Unknown error'));
		}
	}

	function handleCancelDialog() {
		showApplyScopeDialog = false;
	}
</script>

{#if event && occurrence}
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<div>
				<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Occurrence Details</h2>
				<p class="text-gray-600 mt-1 text-xs">Event: {event.title}</p>
			</div>
			<div class="flex flex-wrap gap-2">
				{#if editing}
					<button
						type="submit"
						form="occurrence-edit-form"
						class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs"
					>
						Save Changes
					</button>
					<button
						type="button"
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs"
					>
						Back
					</button>
				{:else}
					<a
						href="/hub/events/{event.id}"
						class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs"
					>
						Back
					</a>
					<button
						on:click={() => editing = true}
						class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs"
					>
						Edit
					</button>
					<button
						on:click={handleDelete}
						class="bg-hub-red-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-red-700 text-xs"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form id="occurrence-edit-form" method="POST" action="?/update" on:submit|preventDefault={handleFormSubmit}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="information" value={information} />
				<input type="hidden" name="allDay" value={formData.allDay ? 'true' : 'false'} />
				
				<!-- Date & Time Panel -->
				<div class="bg-gray-50 rounded-lg p-4 mb-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Date & Time</h3>
					<div class="space-y-4">
						<div class="flex items-center">
							<input
								type="checkbox"
								id="allDay"
								name="allDay"
								bind:checked={formData.allDay}
								on:change={handleAllDayToggle}
								class="h-4 w-4 text-hub-green-600 focus:ring-hub-green-500 border-gray-300 rounded"
							/>
							<label for="allDay" class="ml-2 block text-sm text-gray-700">
								All Day Event
							</label>
						</div>
						{#if formData.allDay}
							<FormField 
								label="Date" 
								name="occurrenceDate" 
								type="date" 
								bind:value={formData.occurrenceDate} 
								required 
							/>
						{:else}
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
								<FormField 
									label="Start Date & Time" 
									name="startsAt" 
									type="datetime-local" 
									bind:value={formData.startsAt} 
									required 
								/>
								<FormField 
									label="End Date & Time" 
									name="endsAt" 
									type="datetime-local" 
									bind:value={formData.endsAt} 
									required 
								/>
							</div>
						{/if}
					</div>
				</div>
				
				<!-- Location & Capacity Panel -->
				<div class="bg-gray-50 rounded-lg p-4 mb-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Location & Capacity</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField 
							label="Location" 
							name="location" 
							bind:value={formData.location} 
						/>
						<FormField 
							label="Number of Spaces (Override)" 
							name="maxSpaces" 
							type="number" 
							bind:value={formData.maxSpaces}
							help={event?.maxSpaces 
								? `Override the event default (${event.maxSpaces}). Leave empty to use event default (${event.maxSpaces}) or set a specific value for this occurrence.`
								: 'Override the event default (Unlimited). Leave empty to use event default (Unlimited) or set a specific value for this occurrence.'}
						/>
					</div>
				</div>
				
				<!-- Additional Information Panel -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
					<div class="mb-4">
						<HtmlEditor bind:value={information} name="information" />
						<p class="mt-1 text-sm text-gray-500">Additional information about this occurrence</p>
					</div>
				</div>
			</form>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Date & Time Panel -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Date & Time</h3>
					<dl class="space-y-3">
						<div>
							<dt class="text-sm font-medium text-gray-500">Start</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{#if occurrence.allDay}
									{occurrence.startsAt ? new Date(occurrence.startsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '-'} <span class="text-gray-500">(All Day)</span>
								{:else}
									{occurrence.startsAt ? formatDateTimeUK(occurrence.startsAt) : '-'}
								{/if}
							</dd>
						</div>
						{#if !occurrence.allDay}
							<div>
								<dt class="text-sm font-medium text-gray-500">End</dt>
								<dd class="mt-1 text-sm text-gray-900">
									{occurrence.endsAt ? formatDateTimeUK(occurrence.endsAt) : '-'}
								</dd>
							</div>
						{/if}
					</dl>
				</div>
				
				<!-- Location & Capacity Panel -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Location & Capacity</h3>
					<dl class="space-y-3">
						{#if occurrence.location}
							<div>
								<dt class="text-sm font-medium text-gray-500">Location</dt>
								<dd class="mt-1 text-sm text-gray-900">{occurrence.location}</dd>
							</div>
						{/if}
						<div>
							<dt class="text-sm font-medium text-gray-500">Maximum Spaces</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{#if occurrence.maxSpaces !== null && occurrence.maxSpaces !== undefined}
									{occurrence.maxSpaces} (override)
								{:else if event.maxSpaces}
									{event.maxSpaces} (from event default)
								{:else}
									Unlimited
								{/if}
							</dd>
						</div>
					</dl>
				</div>
			</div>
			
			<!-- Additional Information Panel -->
			{#if occurrence.information}
				<div class="bg-gray-50 rounded-lg p-4 mt-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
					<div class="text-sm text-gray-900 prose prose-sm max-w-none">
						{@html occurrence.information}
					</div>
				</div>
			{/if}
		{/if}

	</div>

	<!-- Event Signups Section -->
	{#if event?.enableSignup}
		<div class="bg-white shadow rounded-lg p-6 mt-6">
			<h3 class="text-xl font-bold text-gray-900 mb-4">Event Signups</h3>
			
			{#if signups.length === 0}
				<p class="text-gray-500">No signups for this occurrence yet.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guests</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Attendees</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Signed Up</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each signups as signup}
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{signup.contactName || signup.name || 'Unknown'}
										{#if signup.contactId}
											<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-hub-blue-100 text-hub-blue-800">
												Contact
											</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{signup.email}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{signup.guestCount || 0}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{(signup.guestCount || 0) + 1}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{signup.createdAt ? formatDateTimeUK(signup.createdAt) : '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm">
										<button
											on:click={() => handleDeleteSignup(signup.id)}
											class="text-hub-red-600 hover:text-hub-red-800 font-medium"
											title="Remove signup"
										>
											Remove
										</button>
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot class="bg-gray-50">
							<tr>
								<td colspan="2" class="px-[18px] py-2.5 text-sm font-medium text-gray-900">Total</td>
								<td class="px-[18px] py-2.5 text-sm font-medium text-gray-900">
									{signups.reduce((sum, s) => sum + (s.guestCount || 0), 0)}
								</td>
								<td class="px-[18px] py-2.5 text-sm font-bold text-gray-900">
									{signups.reduce((sum, s) => sum + (s.guestCount || 0) + 1, 0)}
								</td>
								<td class="px-[18px] py-2.5"></td>
								<td class="px-[18px] py-2.5"></td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Rotas Section -->
	<div class="bg-white shadow rounded-lg p-6 mt-6">
		<h3 class="text-xl font-bold text-gray-900 mb-4">Rotas for this Occurrence</h3>
		
		{#if rotas.length === 0}
			<p class="text-gray-500">No rotas assigned to this occurrence.</p>
		{:else}
			<div class="space-y-6">
				{#each rotas as rota}
					<div class="border border-gray-200 rounded-lg p-4">
						<div class="flex justify-between items-start mb-3">
							<div>
								<h4 class="text-lg font-semibold text-gray-900">{rota.role}</h4>
								{#if rota.description}
									<p class="text-sm text-gray-600 mt-1">{rota.description}</p>
								{/if}
							</div>
							<div class="text-right">
								<div class="text-sm text-gray-600">
									<span class="font-medium text-hub-blue-600">{rota.assignedCount}</span> / <span class="text-gray-500">{rota.capacity || '∞'}</span>
								</div>
								<div class="text-xs text-gray-500 mt-1">
									{#if rota.spotsRemaining > 0}
										<span class="text-hub-green-600">{rota.spotsRemaining} spots remaining</span>
									{:else if rota.spotsRemaining === 0}
										<span class="text-hub-red-600">Full</span>
									{/if}
								</div>
							</div>
						</div>

						{#if rota.assigneesForOcc && rota.assigneesForOcc.length > 0}
							<div class="mt-4">
								<h5 class="text-sm font-medium text-gray-700 mb-2">Signed Up:</h5>
								<ul class="space-y-1">
									{#each rota.assigneesForOcc as assignee}
										<li class="text-sm text-gray-600 flex items-center gap-2">
											<span class="w-2 h-2 bg-hub-green-600 rounded-full"></span>
											<span>{assignee.name}</span>
										</li>
									{/each}
								</ul>
							</div>
						{:else}
							<p class="text-sm text-gray-500 mt-2">No one signed up yet.</p>
						{/if}

						<div class="mt-3">
							<a 
								href="/hub/rotas/{rota.id}" 
								class="text-sm text-hub-blue-600 hover:text-hub-blue-600/80 underline"
							>
								View rota details →
							</a>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Apply Scope Dialog -->
	{#if showApplyScopeDialog}
		<div
			class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="dialog-title"
		>
			<button
				class="absolute inset-0 w-full h-full cursor-default"
				on:click={handleCancelDialog}
				aria-label="Close dialog"
				tabindex="-1"
			></button>
			<div
				class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-scale-in relative z-10"
				role="document"
			>
				<h3 id="dialog-title" class="text-lg font-semibold text-gray-900 mb-2">
					Apply Changes To
				</h3>
				<p class="text-sm text-gray-600 mb-4">
					How would you like to apply these changes?
				</p>
				<div class="space-y-3 mb-6">
					<button
						on:click={() => handleApplyScope('this')}
						class="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md border-2 border-transparent hover:border-hub-green-500 transition-all"
					>
						<div class="font-medium text-gray-900">Just this occurrence</div>
						<div class="text-sm text-gray-600 mt-1">Changes will only be applied to this occurrence.</div>
					</button>
					<button
						on:click={() => handleApplyScope('future')}
						class="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md border-2 border-transparent hover:border-hub-green-500 transition-all"
					>
						<div class="font-medium text-gray-900">All future occurrences</div>
						<div class="text-sm text-gray-600 mt-1">Changes will be applied to this occurrence and all future occurrences of this event.</div>
					</button>
				</div>
				<div class="flex justify-end">
					<button
						on:click={handleCancelDialog}
						class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-medium"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

