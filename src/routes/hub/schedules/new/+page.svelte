<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: data = $page.data || {};
	$: events = data.events || [];
	$: occurrences = data.occurrences || [];
	$: contacts = data.contacts || [];
	$: formResult = $page.form;
	$: csrfToken = data.csrfToken || '';
	
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let notes = '';
	let ownerSearchTerm = '';
	let helpFiles = [];

	let formData = {
		eventId: '',
		occurrenceId: '',
		role: '',
		capacity: 1,
		ownerId: '',
		visibility: 'public'
	};

	function addHelpLink() {
		helpFiles = [...helpFiles, { type: 'link', title: '', url: '' }];
	}

	function removeHelpFile(index) {
		helpFiles = helpFiles.filter((_, i) => i !== index);
	}

	function onUploadPdfClick() {
		notifications.info('You can upload PDFs after creating the schedule.');
	}
	
	let initialized = false;
	$: if (data.eventId && !initialized) {
		formData.eventId = data.eventId;
		initialized = true;
	}

	$: filteredOccurrences = formData.eventId
		? occurrences
			.filter(o => o.eventId === formData.eventId)
			.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
		: [];

	$: filteredOwnerContacts = (() => {
		if (!contacts || contacts.length === 0) return [];
		let filtered = ownerSearchTerm
			? contacts.filter(c => 
				(c.email || '').toLowerCase().includes(ownerSearchTerm.toLowerCase()) ||
				(c.firstName || '').toLowerCase().includes(ownerSearchTerm.toLowerCase()) ||
				(c.lastName || '').toLowerCase().includes(ownerSearchTerm.toLowerCase())
			)
			: [...contacts];
		if (formData.ownerId) {
			const selectedOwner = contacts.find(c => c.id === formData.ownerId);
			if (selectedOwner && !filtered.some(c => c.id === selectedOwner.id)) {
				filtered = [selectedOwner, ...filtered];
			}
		}
		return filtered;
	})();

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'redirect') {
				notifications.success('Schedule created successfully');
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to create schedule');
			}
			await update();
		};
	}
</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h2 class="text-xl sm:text-2xl font-bold text-gray-900">New Schedule</h2>
		<div class="flex flex-wrap gap-2">
			<a href="/hub/schedules" class="bg-theme-button-3 text-white px-3 py-2 rounded-md hover:opacity-90 text-sm font-medium">
				Cancel
			</a>
			<button type="submit" form="rota-create-form" class="bg-theme-button-2 text-white px-3 py-2 rounded-md hover:opacity-90 text-sm font-medium">
				Create Schedule
			</button>
		</div>
	</div>

	<form id="rota-create-form" method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="notes" bind:value={notes} />
		<input type="hidden" name="helpFiles" value={JSON.stringify(helpFiles)} />
		
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Basic Information (top-left) -->
			<div class="border border-gray-200 rounded-lg p-6 shadow-sm">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
				<div class="space-y-4">
					<div>
						<label for="eventId" class="block text-sm font-medium text-gray-700 mb-1">Event</label>
						<select id="eventId" name="eventId" bind:value={formData.eventId} required class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2.5 px-3 text-gray-900">
							<option value="">Select an event</option>
							{#each events as event}
								<option value={event.id}>{event.title}</option>
							{/each}
						</select>
						<p class="mt-1 text-xs text-gray-500">Select the event that this schedule belongs to</p>
					</div>
					<div>
						<label for="visibility" class="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
						<select id="visibility" name="visibility" bind:value={formData.visibility} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2.5 px-3 text-gray-900">
							<option value="public">Public</option>
							<option value="internal">Internal</option>
						</select>
						<p class="mt-1 text-xs text-gray-500">Public schedules can be accessed via signup links. Internal schedules are only visible to admins.</p>
					</div>
					<div>
						<label for="role" class="block text-sm font-medium text-gray-700 mb-1">Schedule name <span class="text-hub-red-500">*</span></label>
						<input id="role" type="text" name="role" bind:value={formData.role} required placeholder="" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2.5 px-3 text-gray-900" />
						<p class="mt-1 text-xs text-gray-500">The name of the schedule (e.g. 'Worship Team', 'Welcome Team')</p>
					</div>
					<div>
						<label for="capacity" class="block text-sm font-medium text-gray-700 mb-1">Number of people needed <span class="text-hub-red-500">*</span></label>
						<input id="capacity" type="number" name="capacity" bind:value={formData.capacity} required min="1" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2.5 px-3 text-gray-900" />
						<p class="mt-1 text-xs text-gray-500">The number of people needed for this schedule</p>
					</div>
					{#if filteredOccurrences.length > 0}
						<div>
							<label for="occurrenceId" class="block text-sm font-medium text-gray-700 mb-1">Occurrence (optional)</label>
							<select id="occurrenceId" name="occurrenceId" bind:value={formData.occurrenceId} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2.5 px-3 text-gray-900">
								<option value="">All occurrences (recurring)</option>
								{#each filteredOccurrences as occurrence}
									<option value={occurrence.id}>{formatDateTimeUK(occurrence.startsAt)}</option>
								{/each}
							</select>
						</div>
					{/if}
				</div>
			</div>

			<!-- Owner (top-right) -->
			<div class="border border-gray-200 rounded-lg p-6 shadow-sm">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Owner</h3>
				<div class="space-y-4">
					<div>
						<label for="ownerSearch" class="block text-sm font-medium text-gray-700 mb-1">Search Owner (optional)</label>
						<p class="text-xs text-gray-500 mb-2">Use the search box to find a person, then select them from the list below</p>
						<input
							id="ownerSearch"
							type="text"
							bind:value={ownerSearchTerm}
							placeholder="Search by name or email..."
							class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2.5 px-3 text-gray-900"
						/>
					</div>
					<div>
						<label for="ownerId" class="block text-sm font-medium text-gray-700 mb-1">Select Owner</label>
						<select
							id="ownerId"
							name="ownerId"
							bind:value={formData.ownerId}
							class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2.5 px-3 text-gray-900"
						>
							<option value="">No owner</option>
							{#each filteredOwnerContacts as contact (contact.id)}
								<option value={contact.id}>{`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}{contact.email ? ` (${contact.email})` : ''}</option>
							{/each}
						</select>
						<p class="mt-1 text-xs text-gray-500">The owner will be notified when this schedule is updated</p>
					</div>
				</div>
			</div>

			<!-- Notes (bottom-left) -->
			<div class="border border-gray-200 rounded-lg p-6 shadow-sm">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
				<HtmlEditor bind:value={notes} name="notes" placeholder="Enter content..." />
			</div>

			<!-- Help Files (bottom-right) -->
			<div class="border border-gray-200 rounded-lg p-6 shadow-sm">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Help Files</h3>
				<p class="text-sm text-gray-600 mb-2">Add documents or links that people can download when signing up for this schedule.</p>
				<p class="text-xs text-gray-500 mb-4">Choose to add a link to a file or upload a file</p>
				
				<div class="flex flex-wrap gap-2 mb-4">
					<button
						type="button"
						on:click={addHelpLink}
						class="bg-theme-button-1 text-white px-3 py-2 rounded-md hover:opacity-90 text-sm font-medium"
					>
						Add Link
					</button>
					<button
						type="button"
						on:click={onUploadPdfClick}
						class="bg-theme-button-2 text-white px-3 py-2 rounded-md hover:opacity-90 text-sm font-medium"
					>
						Upload PDF
					</button>
				</div>

				{#each helpFiles as file, index}
					<div class="flex gap-2 mb-3 items-start p-3 bg-gray-50 rounded-md">
						<div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
							<input
								type="text"
								bind:value={file.title}
								placeholder="Title"
								class="rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
								required
							/>
							<input
								type="url"
								bind:value={file.url}
								placeholder="URL (https://...)"
								class="rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
								required
							/>
						</div>
						<button
							type="button"
							on:click={() => removeHelpFile(index)}
							class="text-hub-red-600 hover:text-hub-red-800 p-2"
							title="Remove"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
						</button>
					</div>
				{/each}
			</div>
		</div>
	</form>
</div>
