<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: event = $page.data?.event;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let formData = {
		startsAt: '',
		endsAt: '',
		location: event?.location || '',
		maxSpaces: '',
		repeatType: 'none',
		repeatInterval: 1,
		repeatEndType: 'never',
		repeatEndDate: '',
		repeatCount: '',
		repeatDayOfMonth: '',
		repeatDayOfWeek: '',
		repeatWeekOfMonth: ''
	};
	let information = '';

	$: showRecurrenceOptions = formData.repeatType !== 'none';
	$: showWeeklyOptions = formData.repeatType === 'weekly';
	$: showMonthlyOptions = formData.repeatType === 'monthly';
	$: showEndDate = formData.repeatEndType === 'date';
	$: showEndCount = formData.repeatEndType === 'count';
</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-gray-900">New Occurrence</h2>
		<p class="text-gray-600 mt-1">Event: {event?.title}</p>
	</div>

	<form method="POST" action="?/create" use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="information" value={information} />
		
		<!-- Occurrence Details Panel -->
		<div class="border border-gray-200 rounded-lg p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Occurrence Details</h3>
			<div class="space-y-4">
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
				<FormField 
					label="Location" 
					name="location" 
					bind:value={formData.location} 
				/>
				<FormField 
					label="Number of Spaces" 
					name="maxSpaces" 
					type="number" 
					bind:value={formData.maxSpaces}
					help="Maximum number of people who can sign up for this occurrence (leave empty for unlimited)"
				/>
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-1">Information</label>
					<HtmlEditor bind:value={information} name="information" />
					<p class="mt-1 text-sm text-gray-500">Additional information about this occurrence</p>
				</div>
			</div>
		</div>

		<!-- Recurrence Panel -->
		<div class="border border-gray-200 rounded-lg p-6 mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Recurrence</h3>
			<div class="space-y-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Repeat</label>
						<select name="repeatType" bind:value={formData.repeatType} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
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
							<select name="repeatDayOfWeek" bind:value={formData.repeatDayOfWeek} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
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
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Repeat on</label>
								<select name="repeatWeekOfMonth" bind:value={formData.repeatWeekOfMonth} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
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
									<select name="repeatDayOfWeek" bind:value={formData.repeatDayOfWeek} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
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

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Ends</label>
							<select name="repeatEndType" bind:value={formData.repeatEndType} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
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

		<div class="flex gap-2">
			<button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
				Create Occurrence{formData.repeatType !== 'none' ? 's' : ''}
			</button>
			<a href="/hub/events/{event?.id}" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
				Cancel
			</a>
		</div>
	</form>

</div>
