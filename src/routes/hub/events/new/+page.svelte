<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { EVENT_COLORS } from '$lib/crm/server/validators.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'redirect') {
				notifications.success('Event created successfully');
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to create event');
			}
			await update();
		};
	}

	let description = '';
	let formData = {
		title: '',
		location: '',
		visibility: 'private',
		enableSignup: false,
		hideFromEmail: false,
		color: '#9333ea',
		repeatType: 'none',
		repeatInterval: 1,
		repeatEndType: 'never',
		repeatEndDate: '',
		repeatCount: '',
		repeatDayOfMonth: '',
		repeatDayOfWeek: '',
		repeatWeekOfMonth: '',
		firstStart: '',
		firstEnd: ''
	};

	$: showRecurrenceOptions = formData.repeatType !== 'none';
	$: showWeeklyOptions = formData.repeatType === 'weekly';
	$: showMonthlyOptions = formData.repeatType === 'monthly';
	$: showEndDate = formData.repeatEndType === 'date';
	$: showEndCount = formData.repeatEndType === 'count';
</script>

<div class="bg-white shadow rounded-lg p-4 sm:p-6">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
		<h2 class="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">New Event</h2>
		<div class="flex flex-wrap gap-2 w-full sm:w-auto">
			<a href="/hub/events" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs flex-1 sm:flex-none text-center">
				Cancel
			</a>
			<button type="submit" form="event-create-form" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs flex-1 sm:flex-none">
				<span class="hidden sm:inline">Create Event</span>
				<span class="sm:hidden">Create</span>
			</button>
		</div>
	</div>

	<form id="event-create-form" method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="description" value={description} />
		<input type="hidden" name="firstStart" value={formData.firstStart} />
		<input type="hidden" name="firstEnd" value={formData.firstEnd} />
		
		<!-- Basic Information Panel -->
		<div class="border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
			<h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Basic Information</h3>
			<div class="space-y-3 sm:space-y-4">
				<FormField label="Title" name="title" bind:value={formData.title} required />
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
					<FormField label="Location" name="location" bind:value={formData.location} />
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
						<select name="visibility" bind:value={formData.visibility} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 sm:py-3 px-3 sm:px-4 text-xs">
							<option value="private">Private (Hub Admins only)</option>
							<option value="internal">Internal (Church only)</option>
							<option value="public">Public (Everyone)</option>
						</select>
					</div>
				</div>
				<div class="flex items-center">
					<input
						type="checkbox"
						id="enableSignup"
						name="enableSignup"
						bind:checked={formData.enableSignup}
						class="h-4 w-4 text-hub-green-600 focus:ring-hub-green-500 border-gray-300 rounded"
					/>
					<label for="enableSignup" class="ml-2 block text-sm text-gray-700">
						Add Signup to this event
					</label>
				</div>
				<div class="flex items-center">
					<input
						type="checkbox"
						id="hideFromEmail"
						name="hideFromEmail"
						bind:checked={formData.hideFromEmail}
						class="h-4 w-4 text-hub-green-600 focus:ring-hub-green-500 border-gray-300 rounded"
					/>
					<label for="hideFromEmail" class="ml-2 block text-sm text-gray-700">
						Hide from email
					</label>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Event Color</label>
					<div class="flex items-center gap-2 sm:gap-3">
						<div class="w-8 h-8 sm:w-10 sm:h-10 rounded border border-gray-300 flex-shrink-0" style="background-color: {formData.color};"></div>
						<select name="color" bind:value={formData.color} class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 sm:py-3 px-3 sm:px-4 text-xs">
							{#each EVENT_COLORS as colorOption}
								<option value={colorOption.value}>{colorOption.label}</option>
							{/each}
						</select>
					</div>
					<p class="text-xs text-gray-500 mt-1">This color will be used to display the event on the calendar</p>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
					<HtmlEditor bind:value={description} name="description" />
				</div>
			</div>
		</div>

		<!-- First Occurrence Panel -->
		<div class="border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
			<h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">First Occurrence</h3>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
				<FormField label="Start Date & Time" name="firstStart" type="datetime-local" bind:value={formData.firstStart} required />
				<FormField label="End Date & Time" name="firstEnd" type="datetime-local" bind:value={formData.firstEnd} required />
			</div>
		</div>

		<!-- Recurrence Panel -->
		<div class="border border-gray-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
			<h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Recurrence</h3>
			<div class="space-y-3 sm:space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
						<select name="repeatType" bind:value={formData.repeatType} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 sm:py-3 px-3 sm:px-4 text-xs">
							<option value="none">Does not repeat</option>
							<option value="daily">Daily</option>
							<option value="weekly">Weekly</option>
							<option value="monthly">Monthly</option>
							<option value="yearly">Yearly</option>
						</select>
					</div>
					{#if showRecurrenceOptions}
						<FormField label="Repeat every" name="repeatInterval" type="number" bind:value={formData.repeatInterval} />
					{/if}
				</div>

				{#if showRecurrenceOptions}
					{#if showWeeklyOptions}
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Repeat on day of week</label>
							<select name="repeatDayOfWeek" bind:value={formData.repeatDayOfWeek} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 sm:py-3 px-3 sm:px-4 text-xs">
								<option value="">Same day as first occurrence</option>
								<option value="monday">Monday</option>
								<option value="tuesday">Tuesday</option>
								<option value="wednesday">Wednesday</option>
								<option value="thursday">Thursday</option>
								<option value="friday">Friday</option>
								<option value="saturday">Saturday</option>
								<option value="sunday">Sunday</option>
							</select>
						</div>
					{/if}

					{#if showMonthlyOptions}
						<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Repeat on</label>
								<select name="repeatWeekOfMonth" bind:value={formData.repeatWeekOfMonth} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 sm:py-3 px-3 sm:px-4 text-xs">
									<option value="">Same day of month</option>
									<option value="first">First</option>
									<option value="second">Second</option>
									<option value="third">Third</option>
									<option value="fourth">Fourth</option>
									<option value="last">Last</option>
								</select>
							</div>
							{#if formData.repeatWeekOfMonth}
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Day of week</label>
									<select name="repeatDayOfWeek" bind:value={formData.repeatDayOfWeek} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 sm:py-3 px-3 sm:px-4 text-xs">
										<option value="">Select day</option>
										<option value="monday">Monday</option>
										<option value="tuesday">Tuesday</option>
										<option value="wednesday">Wednesday</option>
										<option value="thursday">Thursday</option>
										<option value="friday">Friday</option>
										<option value="saturday">Saturday</option>
										<option value="sunday">Sunday</option>
									</select>
								</div>
							{:else}
								<FormField label="Day of month (1-31)" name="repeatDayOfMonth" type="number" bind:value={formData.repeatDayOfMonth} />
							{/if}
						</div>
					{/if}

					<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Ends</label>
							<select name="repeatEndType" bind:value={formData.repeatEndType} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 sm:py-3 px-3 sm:px-4 text-xs">
								<option value="never">Never</option>
								<option value="date">On date</option>
								<option value="count">After number of occurrences</option>
							</select>
						</div>
						{#if showEndDate}
							<FormField label="End date" name="repeatEndDate" type="date" bind:value={formData.repeatEndDate} />
						{:else if showEndCount}
							<FormField label="Number of occurrences" name="repeatCount" type="number" bind:value={formData.repeatCount} />
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</form>

</div>
