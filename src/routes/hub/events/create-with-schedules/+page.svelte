<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { slide } from 'svelte/transition';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { EVENT_COLORS } from '$lib/crm/constants/eventColours.js';

	$: data = $page.data || {};
	$: event = data.event;
	$: eventId = data.eventId || '';
	$: teams = data.teams || [];
	$: eventColors = data.eventColors || EVENT_COLORS;
	$: csrfToken = data.csrfToken || '';
	$: formResult = $page.form;

	$: step = eventId ? 2 : 1;
	$: if (formResult?.error) notifications.error(formResult.error);

	// Pre-fill date from URL (e.g. from calendar)
	$: {
		const dateParam = $page.url.searchParams.get('date');
		if (dateParam && step === 1 && !eventFormData.firstDate && !eventFormData.firstStart) {
			const [y, m, d] = dateParam.split('-').map(Number);
			if (y && m && d) {
				eventFormData.firstDate = dateParam;
				const ms = String(m).padStart(2, '0'), ds = String(d).padStart(2, '0');
				eventFormData.firstStart = `${y}-${ms}-${ds}T09:00`;
				eventFormData.firstEnd = `${y}-${ms}-${ds}T17:00`;
			}
		}
	}

	let description = '';
	let eventFormData = {
		title: '',
		location: '',
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

	// Schedule items for step 2: { type: 'single', role, capacity } | { type: 'team', teamId, teamName, roleCount }
	let scheduleItems = [];
	let showAddSchedule = false;
	let addMode = 'single';
	let addSingleRole = '';
	let addSingleCapacity = 1;
	let addTeamId = '';
	let scheduleVisibility = 'public';

	$: addTeam = addTeamId ? teams.find(t => t.id === addTeamId) : null;
	$: addTeamRoleCount = addTeam?.roles?.length ?? 0;

	function handleEventEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'redirect') notifications.success('Event created. Now add schedules.');
			else if (result.type === 'failure') notifications.error(result.data?.error || 'Failed to create event');
			await update();
		};
	}

	function handleSchedulesEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'redirect') notifications.success('Schedules created.');
			else if (result.type === 'failure') notifications.error(result.data?.error || 'Failed to create schedules');
			await update();
		};
	}

	function addSingleSchedule() {
		const role = (addSingleRole || '').trim();
		if (!role) return;
		scheduleItems = [...scheduleItems, { type: 'single', role, capacity: addSingleCapacity }];
		addSingleRole = '';
		addSingleCapacity = 1;
		showAddSchedule = false;
	}

	function addTeamSchedule() {
		if (!addTeamId) return;
		const team = teams.find(t => t.id === addTeamId);
		if (!team) return;
		scheduleItems = [...scheduleItems, { type: 'team', teamId: team.id, teamName: team.name, roleCount: (team.roles || []).length }];
		addTeamId = '';
		showAddSchedule = false;
	}

	function removeScheduleItem(index) {
		scheduleItems = scheduleItems.filter((_, i) => i !== index);
	}

	function handleAllDayToggle() {
		if (eventFormData.allDay && eventFormData.firstDate && (!eventFormData.firstStart || !eventFormData.firstEnd)) {
			eventFormData.firstStart = `${eventFormData.firstDate}T00:00`;
			eventFormData.firstEnd = `${eventFormData.firstDate}T23:59`;
		} else if (!eventFormData.allDay && eventFormData.firstDate) {
			eventFormData.firstStart = `${eventFormData.firstDate}T09:00`;
			eventFormData.firstEnd = `${eventFormData.firstDate}T17:00`;
		}
	}

	$: scheduleItemsJson = JSON.stringify(scheduleItems);
	$: showRecurrenceOptions = eventFormData.repeatType !== 'none';
	$: showWeeklyOptions = eventFormData.repeatType === 'weekly';
	$: showMonthlyOptions = eventFormData.repeatType === 'monthly';
</script>

<div class="max-w-4xl mx-auto">
	<!-- Visual workflow diagram -->
	<div class="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 mb-6">
		<div class="flex flex-row items-center justify-center gap-2 sm:gap-3 mb-4">
			<div class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-theme-button-2/10 flex items-center justify-center flex-shrink-0 mb-[13px]">
				<svg class="w-5 h-5 sm:w-6 sm:h-6 text-theme-button-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
			</div>
			<h2 class="text-lg sm:text-xl font-bold text-gray-900">Event Quick Start</h2>
		</div>
		<div class="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-sm" aria-hidden="true">
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center justify-center w-10 h-10 rounded-full font-semibold text-white {step >= 1 ? 'bg-theme-button-2' : 'bg-gray-300'}">1</span>
				<span class="font-medium text-gray-700">Event</span>
			</div>
			<svg class="w-6 h-6 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center justify-center w-10 h-10 rounded-full font-semibold text-white {step >= 2 ? 'bg-theme-button-2' : 'bg-gray-300'}">2</span>
				<span class="font-medium text-gray-700">Schedules</span>
			</div>
			<svg class="w-6 h-6 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center justify-center w-10 h-10 rounded-full font-semibold text-white bg-gray-300">3</span>
				<span class="font-medium text-gray-500">Done</span>
			</div>
		</div>
		<p class="text-xs text-gray-500 mt-3 text-center">Add one event, then add one or more schedules (single roles or whole teams).</p>
		<p class="text-xs text-gray-500 mt-2 text-center">
			Once set up, you can add more options to your event by clicking
			{#if eventId}
				<a href="/hub/events/{eventId}" class="text-theme-button-2 font-medium hover:underline">Edit event</a>.
			{:else}
				Edit event.
			{/if}
		</p>
	</div>

	{#if step === 1}
		<!-- Step 1: Create event -->
		<div class="bg-white shadow rounded-lg p-4 sm:p-6">
			<h3 class="text-xl font-bold text-gray-900 mb-4">Step 1 — Event details</h3>
			<form method="POST" action="?/createEvent" use:enhance={handleEventEnhance}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="description" value={description} />
				<input type="hidden" name="firstStart" value={eventFormData.firstStart} />
				<input type="hidden" name="firstEnd" value={eventFormData.firstEnd} />
				<input type="hidden" name="firstDate" value={eventFormData.firstDate} />
				<input type="hidden" name="allDay" value={eventFormData.allDay ? 'true' : 'false'} />
				<input type="hidden" name="visibility" value={eventFormData.visibility} />
				<input type="hidden" name="enableSignup" value={eventFormData.enableSignup ? 'on' : ''} />
				<input type="hidden" name="hideFromEmail" value={eventFormData.hideFromEmail ? 'on' : ''} />
				<input type="hidden" name="showDietaryRequirements" value={eventFormData.showDietaryRequirements ? 'on' : ''} />
				<input type="hidden" name="color" value={eventFormData.color} />
				<input type="hidden" name="repeatType" value={eventFormData.repeatType} />
				<input type="hidden" name="repeatInterval" value={eventFormData.repeatInterval} />
				<input type="hidden" name="repeatEndType" value={eventFormData.repeatEndType} />
				<input type="hidden" name="repeatEndDate" value={eventFormData.repeatEndDate} />
				<input type="hidden" name="repeatCount" value={eventFormData.repeatCount} />
				<input type="hidden" name="repeatDayOfMonth" value={eventFormData.repeatDayOfMonth} />
				<input type="hidden" name="repeatDayOfWeek" value={eventFormData.repeatDayOfWeek} />
				<input type="hidden" name="repeatWeekOfMonth" value={eventFormData.repeatWeekOfMonth} />

				<div class="space-y-4">
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Event title" name="title" bind:value={eventFormData.title} required />
						<FormField label="Location" name="location" bind:value={eventFormData.location} />
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="bg-gray-50 rounded-lg p-3">
							<h4 class="text-xs font-semibold text-gray-900 mb-2">Time & date</h4>
							<div class="flex items-center gap-2 mb-2">
								<input type="checkbox" id="allDay" bind:checked={eventFormData.allDay} on:change={handleAllDayToggle} class="h-4 w-4 text-theme-button-2 rounded border-gray-300" />
								<label for="allDay" class="text-sm text-gray-700">All day</label>
							</div>
							{#if eventFormData.allDay}
								<FormField label="Date" name="firstDate" type="date" bind:value={eventFormData.firstDate} required />
							{:else}
								<FormField label="Start" name="firstStart" type="datetime-local" bind:value={eventFormData.firstStart} required />
								<FormField label="End" name="firstEnd" type="datetime-local" bind:value={eventFormData.firstEnd} required />
							{/if}
						</div>

						<div class="bg-gray-50 rounded-lg p-3">
							<h4 class="text-xs font-semibold text-gray-900 mb-2">Recurrence</h4>
							<select name="repeatType" bind:value={eventFormData.repeatType} class="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm">
								<option value="none">Does not repeat</option>
								<option value="daily">Daily</option>
								<option value="weekly">Weekly</option>
								<option value="monthly">Monthly</option>
								<option value="yearly">Yearly</option>
							</select>
							{#if showRecurrenceOptions}
								<div class="mt-2">
									<label for="wizard-repeat-interval" class="block text-xs text-gray-600 mb-1">Repeat every</label>
									<input id="wizard-repeat-interval" type="number" name="repeatInterval" bind:value={eventFormData.repeatInterval} min="1" class="w-20 rounded-md border border-gray-300 py-1.5 px-2 text-sm" />
								</div>
								{#if showWeeklyOptions}
									<div class="mt-2">
										<label for="wizard-repeat-day" class="block text-xs text-gray-600 mb-1">On day</label>
										<select id="wizard-repeat-day" name="repeatDayOfWeek" bind:value={eventFormData.repeatDayOfWeek} class="block w-full rounded-md border border-gray-300 py-2 px-2 text-sm">
											<option value="">Same day as first</option>
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
							{/if}
						</div>
					</div>

					<div class="flex flex-wrap gap-2 pt-2">
						<a href="/hub/events" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-medium">Cancel</a>
						<button type="submit" class="bg-theme-button-2 text-white px-4 py-2 rounded-md hover:opacity-90 text-sm font-medium">Create event & continue</button>
					</div>
				</div>
			</form>
		</div>
	{:else}
		<!-- Step 2: Add schedules -->
		<div class="bg-white shadow rounded-lg p-4 sm:p-6">
			<h3 class="text-xl font-bold text-gray-900 mb-1">Step 2 — Schedules for {event?.title || 'this event'}</h3>
			<p class="text-sm text-gray-500 mb-4">Add single roles or whole teams. You can add more schedules later from the event page.</p>

			{#if scheduleItems.length > 0}
				<ul class="space-y-2 mb-4">
					{#each scheduleItems as item, i}
						<li class="flex items-center justify-between gap-2 py-2 px-3 bg-gray-50 rounded-md border border-gray-100" transition:slide>
							{#if item.type === 'single'}
								<span class="text-sm font-medium text-gray-900">{item.role}</span>
								<span class="text-xs text-gray-500">1 role · capacity {item.capacity}</span>
							{:else}
								<span class="text-sm font-medium text-gray-900">{item.teamName}</span>
								<span class="text-xs text-gray-500">{item.roleCount} role{item.roleCount !== 1 ? 's' : ''}</span>
							{/if}
							<button type="button" on:click={() => removeScheduleItem(i)} class="text-red-600 hover:text-red-800 text-xs font-medium" title="Remove">Remove</button>
						</li>
					{/each}
				</ul>
			{/if}

			{#if showAddSchedule}
				<div class="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50" transition:slide>
					<div class="flex gap-4 mb-3">
						<label class="inline-flex items-center gap-2 cursor-pointer">
							<input type="radio" bind:group={addMode} value="single" class="text-theme-button-2 border-gray-300" />
							<span class="text-sm">Single role</span>
						</label>
						<label class="inline-flex items-center gap-2 cursor-pointer">
							<input type="radio" bind:group={addMode} value="team" class="text-theme-button-2 border-gray-300" />
							<span class="text-sm">Team</span>
						</label>
					</div>
					{#if addMode === 'single'}
						<div class="flex flex-wrap gap-2 items-end">
							<div class="flex-1 min-w-[120px]">
								<label for="wizard-add-role-name" class="block text-xs font-medium text-gray-700 mb-1">Role name</label>
								<input id="wizard-add-role-name" type="text" bind:value={addSingleRole} placeholder="e.g. Host" class="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" />
							</div>
							<div class="w-24">
								<label for="wizard-add-capacity" class="block text-xs font-medium text-gray-700 mb-1">Capacity</label>
								<input id="wizard-add-capacity" type="number" bind:value={addSingleCapacity} min="1" class="w-full rounded-md border border-gray-300 py-2 px-3 text-sm" />
							</div>
							<button type="button" on:click={addSingleSchedule} class="bg-theme-button-2 text-white px-3 py-2 rounded-md text-sm">Add</button>
							<button type="button" on:click={() => (showAddSchedule = false)} class="text-gray-600 hover:text-gray-800 text-sm">Cancel</button>
						</div>
					{:else}
						<div class="flex flex-wrap gap-2 items-end">
							<div class="flex-1 min-w-[180px]">
								<label for="wizard-add-team" class="block text-xs font-medium text-gray-700 mb-1">Team</label>
								<select id="wizard-add-team" bind:value={addTeamId} class="w-full rounded-md border border-gray-300 py-2 px-3 text-sm">
									<option value="">Select a team</option>
									{#each teams as t}
										<option value={t.id}>{t.name}{(t.roles || []).length ? ` (${t.roles.length} roles)` : ''}</option>
									{/each}
								</select>
							</div>
							<button type="button" on:click={addTeamSchedule} disabled={!addTeamId} class="bg-theme-button-2 text-white px-3 py-2 rounded-md text-sm disabled:opacity-50">Add team</button>
							<button type="button" on:click={() => (showAddSchedule = false)} class="text-gray-600 hover:text-gray-800 text-sm">Cancel</button>
						</div>
					{/if}
				</div>
			{:else}
				<button type="button" on:click={() => (showAddSchedule = true)} class="mb-4 text-theme-button-2 hover:underline font-medium text-sm">+ Add schedule (single role or team)</button>
			{/if}

			<form method="POST" action="?/createSchedules" use:enhance={handleSchedulesEnhance}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="eventId" value={eventId} />
				<input type="hidden" name="scheduleItems" value={scheduleItemsJson} />
				<input type="hidden" name="visibility" value={scheduleVisibility} />

				<div class="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-200">
					<a href="/hub/events/{eventId}" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 text-sm font-medium">Skip — go to event</a>
					<button type="submit" class="bg-theme-button-2 text-white px-4 py-2 rounded-md hover:opacity-90 text-sm font-medium">
						{scheduleItems.length > 0 ? `Create ${scheduleItems.length} schedule${scheduleItems.length !== 1 ? 's' : ''} & finish` : 'Finish without schedules'}
					</button>
				</div>
			</form>
		</div>
	{/if}
</div>
