<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { slide } from 'svelte/transition';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import MultiSelect from '$lib/crm/components/MultiSelect.svelte';
	import ImagePicker from '$lib/components/ImagePicker.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { EVENT_COLORS } from '$lib/crm/constants/eventColours.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: eventColors = $page.data?.eventColors || EVENT_COLORS;
	$: lists = $page.data?.lists || [];
	
	// Get date from URL parameter and pre-fill form
	$: {
		const dateParam = $page.url.searchParams.get('date');
		if (dateParam && !formData.firstDate && !formData.firstStart) {
			// Parse YYYY-MM-DD format
			const [year, month, day] = dateParam.split('-').map(Number);
			if (year && month && day) {
				// Set the date for all-day mode
				formData.firstDate = dateParam;
				// Also set default times for non-all-day mode (9 AM to 5 PM)
				const monthStr = String(month).padStart(2, '0');
				const dayStr = String(day).padStart(2, '0');
				formData.firstStart = `${year}-${monthStr}-${dayStr}T09:00`;
				formData.firstEnd = `${year}-${monthStr}-${dayStr}T17:00`;
			}
		}
	}
	
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
	let selectedListIds = [];
	let showImagePicker = false;
	
	let formData = {
		title: '',
		location: '',
		image: '',
		visibility: 'private',
		enableSignup: false,
		hideFromEmail: false,
		showDietaryRequirements: false,
		maxSpaces: '',
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
		firstEnd: '',
		allDay: false,
		firstDate: ''
	};

	function handleImageSelect(imagePath) {
		formData.image = imagePath;
		showImagePicker = false;
	}

	$: showRecurrenceOptions = formData.repeatType !== 'none';
	$: showWeeklyOptions = formData.repeatType === 'weekly';
	$: showMonthlyOptions = formData.repeatType === 'monthly';
	$: showEndDate = formData.repeatEndType === 'date';
	$: showEndCount = formData.repeatEndType === 'count';

	// Handle all day toggle - convert between date and datetime-local
	function handleAllDayToggle() {
		if (formData.allDay) {
			// When switching to all day, extract date from datetime if available
			if (formData.firstStart && !formData.firstDate) {
				formData.firstDate = formData.firstStart.split('T')[0];
			}
			// Set to start and end of day
			if (formData.firstDate) {
				formData.firstStart = `${formData.firstDate}T00:00`;
				formData.firstEnd = `${formData.firstDate}T23:59`;
			}
		} else {
			// When switching from all day, extract date and set default time
			if (formData.firstDate && !formData.firstStart) {
				formData.firstStart = `${formData.firstDate}T09:00`;
				formData.firstEnd = `${formData.firstDate}T17:00`;
			} else if (formData.firstStart) {
				formData.firstDate = formData.firstStart.split('T')[0];
			}
		}
	}

	// Update datetime when date changes in all-day mode
	$: if (formData.allDay && formData.firstDate) {
		formData.firstStart = `${formData.firstDate}T00:00`;
		formData.firstEnd = `${formData.firstDate}T23:59`;
	}
</script>

<div class="bg-white shadow rounded-lg p-3 sm:p-4 mb-4">
	<div class="mb-3">
		<h2 class="text-base sm:text-lg md:text-xl font-bold text-gray-900">New Event</h2>
	</div>
	
	<!-- Buttons Panel -->
	<div class="bg-gray-50 rounded-lg p-2 mb-3">
		<div class="flex flex-nowrap justify-between items-center gap-2 overflow-x-auto">
			<div class="flex flex-nowrap gap-2 overflow-x-auto">
				<!-- Left aligned buttons -->
			</div>
			<div class="flex flex-nowrap gap-2 overflow-x-auto">
				<a
					href="/hub/events"
					class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 flex items-center gap-1.5 text-xs whitespace-nowrap flex-shrink-0"
				>
					Cancel
				</a>
				<button
					type="submit"
					form="event-create-form"
					class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs whitespace-nowrap flex-shrink-0"
				>
					Create Event
				</button>
			</div>
		</div>
	</div>

	<form id="event-create-form" method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="description" value={description} />
		<input type="hidden" name="image" value={formData.image || ''} />
		<input type="hidden" name="firstStart" value={formData.firstStart} />
		<input type="hidden" name="firstEnd" value={formData.firstEnd} />
		<input type="hidden" name="firstDate" value={formData.firstDate} />
		<input type="hidden" name="allDay" value={formData.allDay ? 'true' : 'false'} />
		
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-4">
			<!-- Left Column (Narrow) -->
			<div class="lg:col-span-1 space-y-3">
				<!-- Basic Info -->
				<div class="bg-gray-50 rounded-lg p-3">
					<h3 class="text-xs font-semibold text-gray-900 mb-3">Basic Information</h3>
					<div class="space-y-3">
						<FormField label="Title" name="title" bind:value={formData.title} required />
						<FormField label="Location" name="location" bind:value={formData.location} />
					</div>
				</div>

				<!-- Signup -->
				<div class="bg-gray-50 rounded-lg p-3">
					<h3 class="text-xs font-semibold text-gray-900 mb-3">Signup</h3>
					<div class="space-y-3">
						<div class="flex items-center">
							<input
								type="checkbox"
								id="enableSignup"
								name="enableSignup"
								bind:checked={formData.enableSignup}
								class="h-4 w-4 text-hub-green-600 focus:ring-theme-button-2 border-gray-300 rounded"
							/>
							<label for="enableSignup" class="ml-2 block text-xs text-gray-700">
								Enable signup
							</label>
						</div>
						{#if formData.enableSignup}
							<div>
								<label for="maxSpaces" class="block text-xs font-medium text-gray-700 mb-1">Max spaces</label>
								<input
									id="maxSpaces"
									name="maxSpaces"
									type="number"
									min="1"
									bind:value={formData.maxSpaces}
									class="w-20 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-1.5 px-2 text-sm"
								/>
							</div>
							<div class="flex items-center">
								<input
									type="checkbox"
									id="showDietaryRequirements"
									name="showDietaryRequirements"
									bind:checked={formData.showDietaryRequirements}
									class="h-4 w-4 text-hub-green-600 focus:ring-theme-button-2 border-gray-300 rounded"
								/>
								<label for="showDietaryRequirements" class="ml-2 block text-xs text-gray-700">
									Ask dietary reqs
								</label>
							</div>
						{/if}
					</div>
				</div>

				<!-- Occurrence Time (Narrow) -->
				<div class="bg-gray-50 rounded-lg p-3">
					<h3 class="text-xs font-semibold text-gray-900 mb-3">Time & Date</h3>
					<div class="space-y-3">
						<div class="flex items-center">
							<input
								type="checkbox"
								id="allDay"
								name="allDay"
								bind:checked={formData.allDay}
								on:change={handleAllDayToggle}
								class="h-4 w-4 text-hub-green-600 focus:ring-theme-button-2 border-gray-300 rounded"
							/>
							<label for="allDay" class="ml-2 block text-xs text-gray-700">
								All Day Event
							</label>
						</div>
						{#if formData.allDay}
							<FormField label="Date" name="firstDate" type="date" bind:value={formData.firstDate} required />
						{:else}
							<FormField label="Start" name="firstStart" type="datetime-local" bind:value={formData.firstStart} required />
							<FormField label="End" name="firstEnd" type="datetime-local" bind:value={formData.firstEnd} required />
						{/if}
					</div>
				</div>
			</div>
			
			<!-- Right Column (Wide) -->
			<div class="lg:col-span-3 space-y-3">
				<!-- Description -->
				<div class="bg-gray-50 rounded-lg p-3">
					<h3 class="text-xs font-semibold text-gray-900 mb-3">Description</h3>
					<HtmlEditor bind:value={description} name="description" showImagePicker={true} />
				</div>

				<!-- Recurrence -->
				<div class="bg-gray-50 rounded-lg p-3">
					<h3 class="text-xs font-semibold text-gray-900 mb-3">Recurrence</h3>
					<div class="space-y-3">
						<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
							<div>
								<label for="repeatType" class="block text-xs font-medium text-gray-700 mb-1">Repeat</label>
								<select id="repeatType" name="repeatType" bind:value={formData.repeatType} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
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
							<div transition:slide|local>
								{#if showWeeklyOptions}
									<div class="mt-3">
										<label for="repeatDayOfWeek" class="block text-xs font-medium text-gray-700 mb-1">Repeat on day of week</label>
										<select id="repeatDayOfWeek" name="repeatDayOfWeek" bind:value={formData.repeatDayOfWeek} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
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
									<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3">
										<div>
											<label for="repeatWeekOfMonth" class="block text-xs font-medium text-gray-700 mb-1">Repeat on</label>
											<select id="repeatWeekOfMonth" name="repeatWeekOfMonth" bind:value={formData.repeatWeekOfMonth} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
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
												<label for="repeatDayOfWeekMonth" class="block text-xs font-medium text-gray-700 mb-1">Day of week</label>
												<select id="repeatDayOfWeekMonth" name="repeatDayOfWeek" bind:value={formData.repeatDayOfWeek} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
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

								<div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 mt-3">
									<div>
										<label for="repeatEndType" class="block text-xs font-medium text-gray-700 mb-1">Ends</label>
										<select id="repeatEndType" name="repeatEndType" bind:value={formData.repeatEndType} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
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
							</div>
						{/if}
					</div>
				</div>

				<!-- Display -->
				<div class="bg-gray-50 rounded-lg p-3">
					<h3 class="text-xs font-semibold text-gray-900 mb-3">Display</h3>
					<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
						<div>
							<label class="block text-xs font-medium text-gray-700 mb-1">Image</label>
							{#if formData.image}
								<div class="mb-2 rounded border border-gray-300 overflow-hidden bg-gray-100 aspect-[2/1] min-h-[120px]">
									<img src={formData.image} alt="Event preview" class="w-full h-full object-cover" />
								</div>
							{/if}
							<button
								type="button"
								on:click={() => showImagePicker = true}
								class="w-full text-xs py-2 px-3 rounded-md border border-gray-500 bg-white text-gray-700 hover:bg-gray-50"
							>
								{formData.image ? 'Change image' : 'Choose image'}
							</button>
						</div>
						<div>
							<label for="event-visibility" class="block text-xs font-medium text-gray-700 mb-1">Visibility</label>
							<select id="event-visibility" name="visibility" bind:value={formData.visibility} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
								<option value="private">Private (Hub Admins only)</option>
								<option value="internal">Internal ({$page.data?.churchBoltOn ? 'Church only' : 'Organisation only'})</option>
								<option value="public">Public (Everyone)</option>
							</select>
						</div>
						<div>
							<label for="event-color" class="block text-xs font-medium text-gray-700 mb-1">Color</label>
							<div class="flex items-center gap-2 mt-1">
								<div class="w-6 h-6 rounded border border-gray-300 flex-shrink-0" style="background-color: {formData.color};"></div>
								<select id="event-color" name="color" bind:value={formData.color} class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm">
									{#each eventColors as colorOption}
										<option value={colorOption.value}>{colorOption.label}</option>
									{/each}
								</select>
							</div>
						</div>
					</div>
					<div class="border-t border-gray-200 pt-4">
						<h4 class="text-xs font-semibold text-gray-900 mb-3">Email</h4>
						<div class="flex items-center mb-3">
							<input
								type="checkbox"
								id="hideFromEmail"
								name="hideFromEmail"
								bind:checked={formData.hideFromEmail}
								class="h-4 w-4 text-hub-green-600 focus:ring-theme-button-2 border-gray-300 rounded"
							/>
							<label for="hideFromEmail" class="ml-2 block text-xs text-gray-700">
								Hide from email
							</label>
						</div>
						<div>
							<MultiSelect
								label="Lists to email"
								name="listIds"
								options={lists.map(list => ({ id: list.id, name: list.name }))}
								bind:selected={selectedListIds}
								placeholder="Select lists..."
							/>
							<p class="text-xs text-gray-500 mt-1">Select lists to show this event to on an email. If no lists are selected, the event will be sent to everyone (based on visibility).</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	</form>
</div>

<ImagePicker open={showImagePicker} onSelect={handleImageSelect} on:close={() => (showImagePicker = false)} imagesApiUrl="/hub/api/images" />
