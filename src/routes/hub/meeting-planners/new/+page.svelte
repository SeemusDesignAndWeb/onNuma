<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: events = $page.data?.events || [];
	$: occurrences = $page.data?.occurrences || [];
	$: eventId = $page.data?.eventId || '';
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: sundayPlannersLabel = $page.data?.sundayPlannersLabel ?? 'Sunday Planners';
	$: singularLabel = sundayPlannersLabel.endsWith('s') ? sundayPlannersLabel.slice(0, -1) : sundayPlannersLabel;
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'redirect') {
				notifications.success('Meeting Planner created successfully');
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to create meeting planner');
			}
			await update();
		};
	}

	let notes = '';
	let formData = {
		eventId: eventId || '',
		occurrenceId: ''
	};

	// Update formData when eventId from URL changes
	$: if (eventId && !formData.eventId) {
		formData.eventId = eventId;
	}

	$: filteredOccurrences = formData.eventId 
		? occurrences.filter(o => o.eventId === formData.eventId)
		: [];
</script>

<div class="space-y-4">
	<!-- Header with Action Buttons -->
	<div class="bg-white shadow rounded-lg p-4 mb-4">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
			<h2 class="text-lg sm:text-xl font-bold text-gray-900">New {singularLabel}</h2>
			<div class="flex flex-wrap gap-2">
				<a href="/hub/meeting-planners" class="bg-white border-2 border-hub-blue-500 text-hub-blue-600 hover:bg-hub-blue-50 px-2.5 py-1.5 rounded-md text-sm">
					Cancel
				</a>
				<button type="submit" form="meeting-planner-form" class="bg-hub-green-600 hover:bg-hub-green-700 text-white px-2.5 py-1.5 rounded-md text-sm">
					<span class="hidden sm:inline">Create {singularLabel}</span>
					<span class="sm:hidden">Create</span>
				</button>
			</div>
		</div>
	</div>

	<form id="meeting-planner-form" method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="notes" value={notes} />
		
		<!-- Event Selection Panel (Full Width) -->
		<div class="bg-white shadow rounded-lg p-4 mb-4">
			<h3 class="text-base font-semibold text-gray-900 mb-3">Event Selection</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div>
					<label class="block text-xs font-medium text-gray-700 mb-1">Event <span class="text-hub-red-500">*</span></label>
					<select 
						name="eventId" 
						bind:value={formData.eventId} 
						required 
						class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
					>
						<option value="">Select an event</option>
						{#each events as event}
							<option value={event.id}>{event.title}</option>
						{/each}
					</select>
				</div>
				{#if filteredOccurrences.length > 0}
					<div>
						<label class="block text-xs font-medium text-gray-700 mb-1">Occurrence (optional)</label>
						<select 
							name="occurrenceId" 
							bind:value={formData.occurrenceId} 
							class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
						>
							<option value="">All occurrences (recurring)</option>
							{#each filteredOccurrences as occurrence}
								<option value={occurrence.id}>{formatDateTimeUK(occurrence.startsAt)}</option>
							{/each}
						</select>
						<p class="mt-1 text-xs text-gray-500">Leave blank to apply to all occurrences</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Notes Panel -->
		<div class="bg-white shadow rounded-lg p-3">
			<h3 class="text-base font-semibold text-gray-900 mb-3">Notes</h3>
			<div>
				<HtmlEditor bind:value={notes} name="notes" />
			</div>
		</div>
	</form>
</div>
