<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: data = $page.data || {};
	$: events = data.events || [];
	$: occurrences = data.occurrences || [];
	$: contacts = data.contacts || [];
	$: formResult = $page.form;
	$: csrfToken = data.csrfToken || '';
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let notes = '';
	let ownerSearchTerm = '';
	let filteredOwnerContacts = [];
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
	
	// Initialize formData.eventId from URL parameter only once, not reactively
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
		if (!contacts || contacts.length === 0) {
			return [];
		}
		
		// Start with all contacts or filtered by search term
		let filtered = ownerSearchTerm
			? contacts.filter(c => 
				(c.email || '').toLowerCase().includes(ownerSearchTerm.toLowerCase()) ||
				(c.firstName || '').toLowerCase().includes(ownerSearchTerm.toLowerCase()) ||
				(c.lastName || '').toLowerCase().includes(ownerSearchTerm.toLowerCase())
			)
			: [...contacts]; // Create a copy to avoid mutation issues
		
		// Always include the currently selected owner if they exist, even if they don't match the search
		if (formData.ownerId) {
			const selectedOwner = contacts.find(c => c.id === formData.ownerId);
			if (selectedOwner) {
				// Check if selected owner is already in the filtered list
				const isInFiltered = filtered.some(c => c.id === selectedOwner.id);
				if (!isInFiltered) {
					// Add selected owner at the beginning
					filtered = [selectedOwner, ...filtered];
				}
			}
		}
		
		return filtered;
	})();
	
	// Log when ownerId changes
	$: if (formData.ownerId) {
		console.log('[Rota New] formData.ownerId changed to:', formData.ownerId);
	}

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'redirect') {
				notifications.success('Rota created successfully');
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to create rota');
			}
			await update();
		};
	}
</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h2 class="text-xl sm:text-2xl font-bold text-gray-900">New Rota</h2>
		<div class="flex flex-wrap gap-2">
			<a href="/hub/rotas" class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
				Cancel
			</a>
			<button type="submit" form="rota-create-form" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
				<span class="hidden sm:inline">Create Rota</span>
				<span class="sm:hidden">Create</span>
			</button>
		</div>
	</div>

	<form id="rota-create-form" method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="notes" bind:value={notes} />
		<input type="hidden" name="helpFiles" value={JSON.stringify(helpFiles)} />
		
		<!-- Basic Information Panel -->
		<div class="border border-gray-200 rounded-lg p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="md:col-span-2">
					<label for="eventId" class="block text-sm font-medium text-gray-700 mb-1">Event</label>
					<select id="eventId" name="eventId" bind:value={formData.eventId} required class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-3 px-4">
						<option value="">Select an event</option>
						{#each events as event}
							<option value={event.id}>{event.title}</option>
						{/each}
					</select>
				</div>
				{#if filteredOccurrences.length > 0}
					<div class="md:col-span-2">
						<label for="occurrenceId" class="block text-sm font-medium text-gray-700 mb-1">Occurrence (optional)</label>
						<select id="occurrenceId" name="occurrenceId" bind:value={formData.occurrenceId} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-3 px-4">
							<option value="">All occurrences (recurring)</option>
							{#each filteredOccurrences as occurrence}
								<option value={occurrence.id}>{formatDateTimeUK(occurrence.startsAt)}</option>
							{/each}
						</select>
					</div>
				{/if}
				<FormField label="Role" name="role" bind:value={formData.role} required />
				<FormField label="Capacity" name="capacity" type="number" bind:value={formData.capacity} required />
				<div>
					<label for="visibility" class="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
					<select id="visibility" name="visibility" bind:value={formData.visibility} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-3 px-4">
						<option value="public">Public</option>
						<option value="internal">Internal</option>
					</select>
					<p class="mt-1 text-xs text-gray-500">Public rotas can be accessed via signup links. Internal rotas are only visible to admins.</p>
				</div>
			</div>
		</div>

		<!-- Owner Panel -->
		<div class="border border-gray-200 rounded-lg p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Owner</h3>
			<div class="space-y-4">
				<div>
					<label for="ownerSearch" class="block text-sm font-medium text-gray-700 mb-1">Search Owner (optional)</label>
					<input
						id="ownerSearch"
						type="text"
						bind:value={ownerSearchTerm}
						placeholder="Search by name or email..."
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-3 px-4"
					/>
				</div>
				<div>
					<label for="ownerId" class="block text-sm font-medium text-gray-700 mb-1">Select Owner</label>
					<select 
						id="ownerId"
						name="ownerId" 
						value={formData.ownerId || ''}
						on:change={(e) => {
							formData.ownerId = e.target.value || '';
						}}
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-3 px-4"
					>
						<option value="">No owner</option>
						{#each filteredOwnerContacts as contact (contact.id)}
							{@const contactId = String(contact.id || '')}
							<option value={contactId} selected={formData.ownerId === contactId}>
								{`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email} {contact.email ? `(${contact.email})` : ''}
							</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-gray-500">The owner will be notified when this rota is updated</p>
				</div>
			</div>
		</div>

		<!-- Help Files Panel -->
		<div class="border border-gray-200 rounded-lg p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Help Files</h3>
			<p class="text-sm text-gray-600 mb-3">Add links to documents or resources.</p>
			
			{#each helpFiles as file, index}
				<div class="flex gap-2 mb-3 items-start p-3 bg-gray-50 rounded-md">
					<div class="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
						<input 
							type="text" 
							bind:value={file.title} 
							placeholder="Title" 
							class="rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm" 
							required 
						/>
						<input 
							type="url" 
							bind:value={file.url} 
							placeholder="URL (https://...)" 
							class="rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm" 
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
			
			<button 
				type="button" 
				on:click={addHelpLink} 
				class="bg-theme-button-1 text-white px-3 py-2 rounded-md hover:opacity-90 text-sm flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
				</svg>
				Add Link
			</button>
			<p class="mt-3 text-xs text-gray-500">You can upload PDF files after creating the rota.</p>
		</div>

		<!-- Notes Panel -->
		<div class="border border-gray-200 rounded-lg p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
			<div>
				<HtmlEditor bind:value={notes} name="notes" />
			</div>
		</div>
	</form>

</div>

