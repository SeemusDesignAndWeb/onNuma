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
	$: formResult = $page.form;
	$: csrfToken = data.csrfToken || '';
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let notes = '';
	let formData = {
		eventId: '',
		occurrenceId: '',
		role: '',
		capacity: 1
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
	<h2 class="text-2xl font-bold text-gray-900 mb-6">New Rota</h2>

	<form method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="notes" bind:value={notes} />
		<div class="mb-4">
			<label class="block text-sm font-medium text-gray-700 mb-1">Event</label>
			<select name="eventId" bind:value={formData.eventId} required class="w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
				<option value="">Select an event</option>
				{#each events as event}
					<option value={event.id}>{event.title}</option>
				{/each}
			</select>
		</div>
		{#if filteredOccurrences.length > 0}
			<div class="mb-4">
				<label class="block text-sm font-medium text-gray-700 mb-1">Occurrence (optional)</label>
				<select name="occurrenceId" bind:value={formData.occurrenceId} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
					<option value="">All occurrences (recurring)</option>
					{#each filteredOccurrences as occurrence}
						<option value={occurrence.id}>{formatDateTimeUK(occurrence.startsAt)}</option>
					{/each}
				</select>
			</div>
		{/if}
		<FormField label="Role" name="role" bind:value={formData.role} required />
		<FormField label="Capacity" name="capacity" type="number" bind:value={formData.capacity} required />
		<div class="mb-4">
			<label class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
			<HtmlEditor bind:value={notes} name="notes" />
		</div>
		<div class="flex gap-2">
			<button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
				Create Rota
			</button>
			<a href="/hub/rotas" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
				Cancel
			</a>
		</div>
	</form>

</div>

