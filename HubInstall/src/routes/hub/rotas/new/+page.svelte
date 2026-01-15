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
	let formData = {
		eventId: '',
		occurrenceId: '',
		role: '',
		capacity: 1,
		ownerId: '',
		visibility: 'public'
	};
	
	// Initialize formData.eventId from URL parameter only once, not reactively
	let initialized = false;
	$: if (data.eventId && !initialized) {
		formData.eventId = data.eventId;
		initialized = true;
	}

	$: filteredOccurrences = formData.eventId
		? occurrences.filter(o => o.eventId === formData.eventId)
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
	<div class="flex justify-between items-center mb-6">
		<h2 class="text-2xl font-bold text-gray-900">New Rota</h2>
		<div class="flex gap-2">
			<a href="/hub/rotas" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700">
				Cancel
			</a>
			<button type="submit" form="rota-create-form" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
				Create Rota
			</button>
		</div>
	</div>

	<form id="rota-create-form" method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="notes" bind:value={notes} />
		
		<!-- Basic Information Panel -->
		<div class="border border-gray-200 rounded-lg p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div class="md:col-span-2">
					<label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
					<select name="eventId" bind:value={formData.eventId} required class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4">
						<option value="">Select an event</option>
						{#each events as event}
							<option value={event.id}>{event.title}</option>
						{/each}
					</select>
				</div>
				{#if filteredOccurrences.length > 0}
					<div class="md:col-span-2">
						<label class="block text-sm font-medium text-gray-700 mb-1">Occurrence (optional)</label>
						<select name="occurrenceId" bind:value={formData.occurrenceId} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4">
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
					<label class="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
					<select name="visibility" bind:value={formData.visibility} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4">
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
					<label class="block text-sm font-medium text-gray-700 mb-1">Search Owner (optional)</label>
					<input
						type="text"
						bind:value={ownerSearchTerm}
						placeholder="Search by name or email..."
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Select Owner</label>
					<select 
						name="ownerId" 
						value={formData.ownerId || ''}
						on:change={(e) => {
							formData.ownerId = e.target.value || '';
						}}
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4"
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

		<!-- Notes Panel -->
		<div class="border border-gray-200 rounded-lg p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
			<div>
				<HtmlEditor bind:value={notes} name="notes" />
			</div>
		</div>
	</form>

</div>

