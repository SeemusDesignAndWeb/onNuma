<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { getWeekKey, formatWeekKey } from '$lib/crm/utils/weekUtils.js';

	$: events = $page.data?.events || [];
	$: occurrences = $page.data?.occurrences || [];
	$: weekNotes = $page.data?.weekNotes || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;

	// Get current month/year from URL params or use current date
	let viewMode = $page.url.searchParams.get('view') || 'month';
	let currentDate = (() => {
		const params = new URLSearchParams($page.url.search);
		const year = parseInt(params.get('year')) || new Date().getFullYear();
		const month = parseInt(params.get('month')) || new Date().getMonth();
		return new Date(year, month, 1);
	})();

	$: {
		const params = new URLSearchParams($page.url.search);
		const year = parseInt(params.get('year')) || new Date().getFullYear();
		const month = parseInt(params.get('month')) || new Date().getMonth();
		viewMode = params.get('view') || 'month';
		currentDate = new Date(year, month, 1);
	}

	// Week notes state
	let editingWeekNote = false;
	let weekNoteDate = '';
	let weekNoteText = '';
	let showWeekNotesModal = false;
	let weekNoteSearchDate = '';
	let editingWeekKey = null;
	let lastProcessedFormResult = null;
	const weekNotesModalStorageKey = 'egcc_week_notes_modal_open';
	let recurrenceStartDate = '';
	let recurrenceEndDate = '';
	let recurrenceWeeks = 2; // Number of weeks between repeats (default: every other week = 2)
	let enableRecurrence = false;

	$: filteredWeekNotes = (() => {
		if (weekNoteSearchDate) {
			const searchKey = getWeekKey(weekNoteSearchDate);
			return weekNotes.filter(note => note.weekKey === searchKey);
		}
		return weekNotes.slice(0, 2);
	})();

	onMount(() => {
		if (!browser) return;
		const shouldReopen = sessionStorage.getItem(weekNotesModalStorageKey) === 'true';
		if (shouldReopen) {
			showWeekNotesModal = true;
			sessionStorage.removeItem(weekNotesModalStorageKey);
		}
	});

	$: if (formResult && browser && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;

		if (formResult?.success) {
			if (formResult?.type === 'weekNote') {
				const count = formResult?.count || 1;
				if (count > 1) {
					notifications.success(`Week notes saved successfully (${count} dates)`);
				} else {
					notifications.success('Week note saved successfully');
				}
				editingWeekNote = false;
				weekNoteDate = '';
				weekNoteText = '';
				editingWeekKey = null;
				recurrenceStartDate = '';
				recurrenceEndDate = '';
				enableRecurrence = false;
			} else if (formResult?.type === 'deleteWeekNote') {
				notifications.success('Week note deleted successfully');
				cancelEditingWeekNote();
				if (browser) {
					sessionStorage.setItem(weekNotesModalStorageKey, 'true');
				}
			}
			setTimeout(() => {
				if (browser) {
					goto($page.url, { invalidateAll: true });
				}
			}, 100);
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	// Find related week notes (same text content, likely created as repeats)
	function findRelatedWeekNotes(currentWeekKey, currentNote) {
		if (!currentNote?.note) return [];
		
		// Find all notes with the same text content
		const related = weekNotes.filter(note => 
			note.weekKey !== currentWeekKey && 
			note.note === currentNote.note
		);
		
		// Sort by weekKey (date)
		return related.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
	}

	// Reactive statement for related notes when editing
	$: relatedNotesWhenEditing = editingWeekKey && weekNoteText 
		? findRelatedWeekNotes(editingWeekKey, { note: weekNoteText })
		: [];

	// Detect repeat pattern from related notes
	function detectRepeatPattern(relatedNotes, currentWeekKey) {
		if (relatedNotes.length === 0) return null;
		
		const allKeys = [currentWeekKey, ...relatedNotes.map(n => n.weekKey)].sort();
		const dates = allKeys.map(key => {
			const [year, month, day] = key.split('-').map(Number);
			return new Date(year, month - 1, day);
		});
		
		// Calculate intervals between dates (in weeks)
		const intervals = [];
		for (let i = 1; i < dates.length; i++) {
			const diffMs = dates[i] - dates[i - 1];
			const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
			const diffWeeks = diffDays / 7;
			// Allow for small rounding differences (within 1 day)
			const roundedWeeks = Math.round(diffWeeks);
			if (roundedWeeks > 0 && roundedWeeks <= 52 && Math.abs(diffWeeks - roundedWeeks) < 0.5) {
				intervals.push(roundedWeeks);
			}
		}
		
		// If all intervals are the same, we have a pattern
		if (intervals.length > 0 && intervals.every(val => val === intervals[0])) {
			// Convert week start dates back to regular dates for the date inputs
			const startDate = dates[0];
			const endDate = dates[dates.length - 1];
			return {
				weeks: intervals[0],
				startDate: startDate.toISOString().split('T')[0],
				endDate: endDate.toISOString().split('T')[0]
			};
		}
		
		return null;
	}

	function startEditingWeekNote(weekKey = null, existingNote = null) {
		if (weekKey) {
			editingWeekKey = weekKey;
			const [year, month, day] = weekKey.split('-').map(Number);
			const date = new Date(year, month - 1, day);
			weekNoteDate = date.toISOString().split('T')[0];
		} else {
			editingWeekKey = null;
			weekNoteDate = new Date().toISOString().split('T')[0];
		}
		weekNoteText = existingNote?.note || '';
		
		// Check for related notes (repeats)
		const relatedNotes = weekKey && existingNote ? findRelatedWeekNotes(weekKey, existingNote) : [];
		
		if (relatedNotes.length > 0) {
			// Try to detect the repeat pattern
			const pattern = detectRepeatPattern(relatedNotes, weekKey);
			if (pattern) {
				enableRecurrence = true;
				recurrenceStartDate = pattern.startDate;
				recurrenceEndDate = pattern.endDate;
				recurrenceWeeks = pattern.weeks;
			} else {
				// If pattern can't be detected, just show the first and last dates
				enableRecurrence = true;
				const allKeys = [weekKey, ...relatedNotes.map(n => n.weekKey)].sort();
				const firstDate = new Date(allKeys[0].split('-').map(Number));
				const lastDate = new Date(allKeys[allKeys.length - 1].split('-').map(Number));
				recurrenceStartDate = firstDate.toISOString().split('T')[0];
				recurrenceEndDate = lastDate.toISOString().split('T')[0];
				recurrenceWeeks = 2; // Default, user can adjust
			}
		} else {
			// No related notes, start fresh
			recurrenceStartDate = weekNoteDate;
			recurrenceEndDate = '';
			recurrenceWeeks = 2;
			enableRecurrence = false;
		}
		
		editingWeekNote = true;
	}

	function cancelEditingWeekNote() {
		editingWeekNote = false;
		weekNoteDate = '';
		weekNoteText = '';
		editingWeekKey = null;
		recurrenceStartDate = '';
		recurrenceEndDate = '';
		recurrenceWeeks = 2;
		enableRecurrence = false;
	}

	// Calculate all dates for repeat based on number of weeks
	function calculateRecurrenceDates(startDateStr, endDateStr, weeks = 2) {
		if (!startDateStr || !endDateStr) return [];
		
		const startDate = new Date(startDateStr);
		const endDate = new Date(endDateStr);
		const dates = [];
		
		// Start with the first date
		let currentDate = new Date(startDate);
		
		// Add dates every N weeks (N * 7 days) until we reach the end date
		const daysToAdd = weeks * 7;
		while (currentDate <= endDate) {
			dates.push(currentDate.toISOString().split('T')[0]);
			// Add N weeks worth of days
			currentDate.setDate(currentDate.getDate() + daysToAdd);
		}
		
		return dates;
	}

	$: if (enableRecurrence && !recurrenceStartDate && weekNoteDate) {
		recurrenceStartDate = weekNoteDate;
	}

	$: recurrenceDates = (() => {
		if (!enableRecurrence || !recurrenceStartDate || !recurrenceEndDate) {
			return [];
		}
		
		const dates = calculateRecurrenceDates(recurrenceStartDate, recurrenceEndDate, recurrenceWeeks);
		
		// Always include the initial weekNoteDate if it exists and is within the date range
		if (weekNoteDate) {
			const noteDate = new Date(weekNoteDate);
			const startDate = new Date(recurrenceStartDate);
			const endDate = new Date(recurrenceEndDate);
			
			// Check if weekNoteDate is within the range and not already in the array
			if (noteDate >= startDate && noteDate <= endDate) {
				const noteDateStr = noteDate.toISOString().split('T')[0];
				if (!dates.includes(noteDateStr)) {
					// Add it and sort to keep dates in order
					dates.push(noteDateStr);
					dates.sort();
				}
			}
		}
		
		return dates;
	})();

	function closeWeekNotesModal() {
		showWeekNotesModal = false;
		cancelEditingWeekNote();
		weekNoteSearchDate = '';
	}

	async function handleDeleteWeekNote(weekKey) {
		const confirmed = await dialog.confirm('Are you sure you want to delete this week note?', 'Delete Week Note');
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/deleteWeekNote';

			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);

			const weekKeyInput = document.createElement('input');
			weekKeyInput.type = 'hidden';
			weekKeyInput.name = 'weekKey';
			weekKeyInput.value = weekKey;
			form.appendChild(weekKeyInput);

			document.body.appendChild(form);
			form.submit();
		}
	}

	function getMonthName(date) {
		return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
	}

	function navigateMonth(direction) {
		const newDate = new Date(currentDate);
		newDate.setMonth(currentDate.getMonth() + direction);
		goto(`/hub/events/calendar?year=${newDate.getFullYear()}&month=${newDate.getMonth()}&view=${viewMode}`);
	}

	function navigateWeek(direction) {
		const newDate = new Date(currentDate);
		if (viewMode === 'week') {
			newDate.setDate(currentDate.getDate() + (direction * 7));
		} else {
			newDate.setMonth(currentDate.getMonth() + direction);
		}
		goto(`/hub/events/calendar?year=${newDate.getFullYear()}&month=${newDate.getMonth()}&view=${viewMode}`);
	}

	function navigateYear(direction) {
		const newDate = new Date(currentDate);
		newDate.setFullYear(currentDate.getFullYear() + direction);
		goto(`/hub/events/calendar?year=${newDate.getFullYear()}&month=${newDate.getMonth()}&view=${viewMode}`);
	}

	function goToToday() {
		const today = new Date();
		goto(`/hub/events/calendar?year=${today.getFullYear()}&month=${today.getMonth()}&view=${viewMode}`);
	}

	function setView(mode) {
		viewMode = mode;
		goto(`/hub/events/calendar?year=${currentDate.getFullYear()}&month=${currentDate.getMonth()}&view=${mode}`);
	}

	// Get occurrences for a specific date
	function getOccurrencesForDate(date) {
		const targetYear = date.getFullYear();
		const targetMonth = date.getMonth();
		const targetDay = date.getDate();
		return occurrences.filter(occ => {
			const occDate = new Date(occ.startsAt);
			return occDate.getFullYear() === targetYear &&
			       occDate.getMonth() === targetMonth &&
			       occDate.getDate() === targetDay;
		});
	}

	// Get occurrences for a date range
	function getOccurrencesForRange(startDate, endDate) {
		return occurrences.filter(occ => {
			const occDate = new Date(occ.startsAt);
			return occDate >= startDate && occDate <= endDate;
		}).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
	}

	// Year view helpers
	function getMonthsInYear(year) {
		const months = [];
		for (let month = 0; month < 12; month++) {
			months.push(new Date(year, month, 1));
		}
		return months;
	}

	function getOccurrencesForMonth(year, month) {
		const startDate = new Date(year, month, 1);
		const endDate = new Date(year, month + 1, 0, 23, 59, 59);
		return getOccurrencesForRange(startDate, endDate);
	}

	// Month view helpers
	function getDaysInMonth(date) {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDayOfWeek = firstDay.getDay();
		// Adjust for Monday-first week: Sunday (0) -> column 6, Monday (1) -> column 0, etc.
		const offset = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;

		const days = [];
		
		// Add empty cells for days before the first day of the month
		for (let i = 0; i < offset; i++) {
			days.push(null);
		}

		// Add all days of the month
		for (let day = 1; day <= daysInMonth; day++) {
			days.push(new Date(year, month, day));
		}

		return days;
	}

	// Week view helpers
	function getWeekDays(date) {
		const weekStart = new Date(date);
		const day = weekStart.getDay();
		// Adjust to Monday: Sunday (0) -> go back 6 days, Monday (1) -> go back 0 days, etc.
		const diff = weekStart.getDate() - (day === 0 ? 6 : day - 1);
		weekStart.setDate(diff);
		
		const days = [];
		for (let i = 0; i < 7; i++) {
			const d = new Date(weekStart);
			d.setDate(weekStart.getDate() + i);
			days.push(d);
		}
		return days;
	}

	$: monthDays = viewMode === 'month' ? getDaysInMonth(currentDate) : [];
	$: weekDays = viewMode === 'week' ? getWeekDays(currentDate) : [];
	$: yearMonths = viewMode === 'year' ? getMonthsInYear(currentDate.getFullYear()) : [];
	$: agendaOccurrences = viewMode === 'agenda' ? getOccurrencesForRange(
		new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
		new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
	) : [];

	const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const dayNamesFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

	// Helper function to get event color styles
	function getEventColorStyles(event) {
		const color = event?.color || '#9333ea';
		// Calculate a lighter background color (20% opacity)
		const rgb = hexToRgb(color);
		const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
		// Use the original color for text
		const textColor = color;
		return {
			backgroundColor: bgColor,
			color: textColor,
			borderColor: color
		};
	}

	// Helper to convert hex to RGB
	function hexToRgb(hex) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? {
			r: parseInt(result[1], 16),
			g: parseInt(result[2], 16),
			b: parseInt(result[3], 16)
		} : { r: 147, g: 51, b: 234 }; // Default purple
	}

	// Handle clicking on a day square to create a new event
	function handleDayClick(day, event) {
		// Don't navigate if clicking on an event link
		if (event.target.closest('a')) {
			return;
		}
		// Format date as YYYY-MM-DD
		const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
		goto(`/hub/events/new?date=${dateStr}`);
	}

	// Format time display for events - show "All day" for all-day events
	function formatEventTime(occ) {
		if (occ.allDay) {
			return 'All day';
		}
		const startTime = new Date(occ.startsAt);
		return startTime.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
	}

	// Format time range display for events - show "All day" for all-day events
	function formatEventTimeRange(occ) {
		if (occ.allDay) {
			return 'All day';
		}
		const startTime = new Date(occ.startsAt);
		const endTime = new Date(occ.endsAt);
		return `${startTime.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}`;
	}

	// Format time range display for events (US format) - show "All day" for all-day events
	function formatEventTimeRangeUS(occ) {
		if (occ.allDay) {
			return 'All day';
		}
		const startTime = new Date(occ.startsAt);
		const endTime = new Date(occ.endsAt);
		return `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
	}
</script>

	<div class="mb-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Event Calendar</h2>
			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					on:click={() => {
						showWeekNotesModal = true;
						if (!editingWeekNote) {
							cancelEditingWeekNote();
						}
					}}
					class="bg-hub-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-blue-700 text-xs"
				>
					Week Notes
				</button>
				<a href="/hub/events?view=list" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs">
					List View
				</a>
				<a href="/hub/events/new" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs">
					New Event
				</a>
			</div>
		</div>

	<!-- View Mode Tabs -->
	<div class="flex gap-1 sm:gap-2 mb-4 border-b border-gray-200 overflow-x-auto">
		<button
			on:click={() => setView('year')}
			class="px-2 sm:px-[18px] py-2.5 text-xs sm:text-base font-medium transition-colors whitespace-nowrap {viewMode === 'year' ? 'text-hub-green-600 border-b-2 border-hub-green-600' : 'text-gray-600 hover:text-gray-900'}"
		>
			Year
		</button>
		<button
			on:click={() => setView('month')}
			class="px-2 sm:px-[18px] py-2.5 text-xs sm:text-base font-medium transition-colors whitespace-nowrap {viewMode === 'month' ? 'text-hub-green-600 border-b-2 border-hub-green-600' : 'text-gray-600 hover:text-gray-900'}"
		>
			Month
		</button>
		<button
			on:click={() => setView('week')}
			class="px-2 sm:px-[18px] py-2.5 text-xs sm:text-base font-medium transition-colors whitespace-nowrap {viewMode === 'week' ? 'text-hub-green-600 border-b-2 border-hub-green-600' : 'text-gray-600 hover:text-gray-900'}"
		>
			Week
		</button>
		<button
			on:click={() => setView('agenda')}
			class="px-2 sm:px-[18px] py-2.5 text-xs sm:text-base font-medium transition-colors whitespace-nowrap {viewMode === 'agenda' ? 'text-hub-green-600 border-b-2 border-hub-green-600' : 'text-gray-600 hover:text-gray-900'}"
		>
			Agenda
		</button>
	</div>

	<!-- Navigation Controls -->
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
		<div class="flex items-center gap-2">
			<button
				on:click={() => {
					if (viewMode === 'year') {
						navigateYear(-1);
					} else if (viewMode === 'month') {
						navigateMonth(-1);
					} else {
						navigateWeek(-1);
					}
				}}
				class="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-xs"
			>
				←
			</button>
			<button
				on:click={goToToday}
				class="px-3 sm:px-4 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-xs"
			>
				Today
			</button>
			<button
				on:click={() => {
					if (viewMode === 'year') {
						navigateYear(1);
					} else if (viewMode === 'month') {
						navigateMonth(1);
					} else {
						navigateWeek(1);
					}
				}}
				class="px-2 sm:px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-xs"
			>
				→
			</button>
		</div>
		<h3 class="text-base sm:text-xl font-semibold text-gray-900 text-center sm:text-left">
			{#if viewMode === 'year'}
				{currentDate.getFullYear()}
			{:else if viewMode === 'month'}
				{getMonthName(currentDate)}
			{:else if viewMode === 'week'}
				<span class="hidden sm:inline">Week of {weekDays[0]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - {weekDays[6]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
				<span class="sm:hidden">{weekDays[0]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - {weekDays[6]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}</span>
			{:else}
				{getMonthName(currentDate)}
			{/if}
		</h3>
		<div class="flex justify-center sm:justify-end">
			{#if viewMode === 'year'}
				<select
					value={currentDate.getFullYear()}
					on:change={(e) => {
						const year = parseInt(e.target.value);
						goto(`/hub/events/calendar?year=${year}&month=0&view=${viewMode}`);
					}}
					class="px-2 sm:px-3 py-1 text-sm border border-gray-500 rounded-md"
				>
					{#each Array(10) as _, i}
						{@const year = new Date().getFullYear() - 5 + i}
						<option value={year} selected={year === currentDate.getFullYear()}>
							{year}
						</option>
					{/each}
				</select>
			{:else}
				<select
					value="{currentDate.getFullYear()}-{String(currentDate.getMonth() + 1).padStart(2, '0')}"
					on:change={(e) => {
						const [year, month] = e.target.value.split('-').map(Number);
						goto(`/hub/events/calendar?year=${year}&month=${month - 1}&view=${viewMode}`);
					}}
					class="px-2 sm:px-3 py-1 text-sm border border-gray-500 rounded-md"
				>
					{#each Array(12) as _, i}
						{@const year = currentDate.getFullYear()}
						{@const monthDate = new Date(year, i, 1)}
						<option value="{year}-{String(i + 1).padStart(2, '0')}" selected={i === currentDate.getMonth()}>
							{monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
						</option>
					{/each}
				</select>
			{/if}
		</div>
	</div>
</div>

{#if showWeekNotesModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-auto">
			<div class="flex items-center justify-between p-4 border-b border-gray-200">
				<h3 class="text-lg font-semibold text-gray-900">Week Notes</h3>
				<button
					type="button"
					on:click={closeWeekNotesModal}
					class="text-gray-500 hover:text-gray-700 text-sm"
				>
					Close
				</button>
			</div>

			<div class="p-4 space-y-4">
				{#if !editingWeekNote}
					<button
						type="button"
						on:click={() => startEditingWeekNote()}
						class="bg-hub-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-hub-blue-700 text-xs whitespace-nowrap"
					>
						New Week Note
					</button>
				{/if}

				{#if editingWeekNote}
					<form method="POST" action="?/saveWeekNote" use:enhance>
						<input type="hidden" name="_csrf" value={csrfToken} />
						<div class="bg-gray-50 rounded-lg p-3 sm:p-4 space-y-4">
							{#if !enableRecurrence}
								<div>
									<label for="week-note-date" class="block text-xs font-medium text-gray-700 mb-1">
										Select a date in the week
									</label>
									<input
										id="week-note-date"
										type="date"
										bind:value={weekNoteDate}
										required
										class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-1.5 px-2 text-sm"
									/>
									<p class="mt-1 text-xs text-gray-500">
										{#if weekNoteDate}
											Week: {formatWeekKey(getWeekKey(weekNoteDate))}
										{/if}
									</p>
								</div>
							{/if}

							<div>
								<label class="flex items-center gap-2 cursor-pointer">
									<input
										type="checkbox"
										bind:checked={enableRecurrence}
										on:change={() => {
											if (enableRecurrence) {
												// When enabling repeat, always set start date to current weekNoteDate
												if (weekNoteDate) {
													recurrenceStartDate = weekNoteDate;
												}
											} else {
												// When disabling, sync weekNoteDate with start date if it exists
												if (recurrenceStartDate) {
													weekNoteDate = recurrenceStartDate;
												}
											}
										}}
										class="rounded border-gray-300 text-hub-blue-600 focus:ring-hub-blue-500"
									/>
									<span class="text-xs font-medium text-gray-700">Add repeat</span>
								</label>
							</div>

							{#if enableRecurrence}
								<div class="space-y-3 bg-blue-50 rounded-md p-3 border border-blue-200">
									<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
										<div>
											<label for="recurrence-start-date" class="block text-xs font-medium text-gray-700 mb-1">
												Start date
											</label>
											<input
												id="recurrence-start-date"
												type="date"
												bind:value={recurrenceStartDate}
												required
												class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-1.5 px-2 text-sm"
											/>
										</div>
										<div>
											<label for="recurrence-weeks" class="block text-xs font-medium text-gray-700 mb-1">
												Every number of weeks
											</label>
											<input
												id="recurrence-weeks"
												type="number"
												min="1"
												max="52"
												bind:value={recurrenceWeeks}
												required={enableRecurrence}
												class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-1.5 px-2 text-sm"
												title={recurrenceWeeks === 1 ? 'Every week' : recurrenceWeeks === 2 ? 'Every other week' : `Every ${recurrenceWeeks} weeks`}
											/>
										</div>
										<div>
											<label for="recurrence-end-date" class="block text-xs font-medium text-gray-700 mb-1">
												End date
											</label>
											<input
												id="recurrence-end-date"
												type="date"
												bind:value={recurrenceEndDate}
												required={enableRecurrence}
												min={recurrenceStartDate}
												class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-1.5 px-2 text-sm"
											/>
										</div>
									</div>
									{#if recurrenceDates.length > 0}
										<div class="mt-2">
											<p class="text-xs font-medium text-gray-700 mb-1">
												Will create {recurrenceDates.length} week note{recurrenceDates.length !== 1 ? 's' : ''} 
												{#if recurrenceWeeks === 1}
													(every week):
												{:else if recurrenceWeeks === 2}
													(every other week):
												{:else}
													(every {recurrenceWeeks} weeks):
												{/if}
											</p>
											<div class="text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
												{#each recurrenceDates as date}
													<div class="pl-2">• {formatWeekKey(getWeekKey(date))}</div>
												{/each}
											</div>
										</div>
									{/if}
									
									{#if editingWeekKey}
										{#if relatedNotesWhenEditing.length > 0}
											<div class="mt-3 pt-3 border-t border-blue-300">
												<p class="text-xs font-medium text-gray-700 mb-2">
													Related week notes with same text ({relatedNotesWhenEditing.length}):
												</p>
												<div class="space-y-1.5 max-h-32 overflow-y-auto">
													{#each relatedNotesWhenEditing as relatedNote}
														<div class="flex items-center justify-between bg-white rounded px-2 py-1.5 border border-gray-200">
															<span class="text-xs text-gray-700">
																{formatWeekKey(relatedNote.weekKey)}
															</span>
															<button
																type="button"
																on:click={() => handleDeleteWeekNote(relatedNote.weekKey)}
																class="text-xs text-hub-red-600 hover:text-hub-red-800 px-2 py-0.5 rounded hover:bg-red-50"
																title="Remove this repeat"
															>
																Remove
															</button>
														</div>
													{/each}
												</div>
											</div>
										{/if}
									{/if}
									{#each recurrenceDates as date}
										<input type="hidden" name="dates[]" value={date} />
									{/each}
								</div>
							{:else}
								<input type="hidden" name="date" value={weekNoteDate} />
							{/if}

							<div>
								<p class="block text-xs font-medium text-gray-700 mb-1">Week Note</p>
								<HtmlEditor bind:value={weekNoteText} name="note" />
								<p class="mt-1 text-xs text-gray-500">
									This note appears in emails for the selected week{enableRecurrence && recurrenceDates.length > 1 ? 's' : ''}.
								</p>
							</div>
							<div class="flex gap-2">
					<button
						type="submit"
						class="bg-hub-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-hub-blue-700 text-xs whitespace-nowrap"
					>
						Save Week Note{enableRecurrence && recurrenceDates.length > 0 ? `s (${recurrenceDates.length})` : ''}
					</button>
					{#if editingWeekKey}
						<button
							type="button"
							on:click={() => handleDeleteWeekNote(editingWeekKey)}
							class="bg-hub-red-600 text-white px-3 py-1.5 rounded-md hover:bg-hub-red-700 text-xs whitespace-nowrap"
						>
							Delete
						</button>
					{/if}
								<button
									type="button"
									on:click={cancelEditingWeekNote}
									class="bg-gray-600 text-white px-3 py-1.5 rounded-md hover:bg-gray-700 text-xs whitespace-nowrap"
								>
						Back
								</button>
							</div>
						</div>
					</form>
				{/if}

				{#if !editingWeekNote}
					<div>
						<label for="week-note-search" class="block text-xs font-medium text-gray-700 mb-1">
							Find a week note by date
						</label>
						<input
							id="week-note-search"
							type="date"
							bind:value={weekNoteSearchDate}
							class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-1.5 px-2 text-sm"
						/>
						<p class="mt-1 text-xs text-gray-500">
							Showing {weekNoteSearchDate ? 'matching week' : 'latest 2 week notes'}.
						</p>
					</div>

					{#if filteredWeekNotes.length === 0}
						<p class="text-sm text-gray-500">No week notes found.</p>
					{:else}
						<div class="space-y-3">
							{#each filteredWeekNotes as weekNote}
								<button
									type="button"
									on:click={() => startEditingWeekNote(weekNote.weekKey, weekNote)}
									class="border border-gray-200 rounded-lg p-3 sm:p-4 text-left w-full hover:border-hub-blue-300 hover:shadow-sm transition"
								>
									<div class="flex justify-between items-start gap-2 mb-2">
										<div class="flex-1">
											<h4 class="text-sm font-semibold text-gray-900">
												Week of {formatWeekKey(weekNote.weekKey)}
											</h4>
										</div>
									</div>
									<div class="text-sm text-gray-700 prose prose-sm max-w-none">
										{#if weekNote.note}
											{@html weekNote.note}
										{:else}
											<p class="text-gray-400 italic">No note content</p>
										{/if}
									</div>
								</button>
							{/each}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Year View -->
{#if viewMode === 'year'}
	<div class="bg-white shadow rounded-lg overflow-hidden">
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-4 p-2 sm:p-4">
			{#each yearMonths as monthDate}
				{@const monthOccurrences = getOccurrencesForMonth(monthDate.getFullYear(), monthDate.getMonth())}
				{@const isCurrentMonth = monthDate.getMonth() === new Date().getMonth() && monthDate.getFullYear() === new Date().getFullYear()}
				<div 
					class="border border-gray-200 rounded-lg p-2 sm:p-3 hover:border-hub-blue-300 hover:shadow-md transition-all cursor-pointer {isCurrentMonth ? 'bg-hub-blue-50 border-hub-blue-300' : ''}"
					role="button"
					tabindex="0"
					on:click={() => goto(`/hub/events/calendar?year=${monthDate.getFullYear()}&month=${monthDate.getMonth()}&view=month`)}
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							goto(`/hub/events/calendar?year=${monthDate.getFullYear()}&month=${monthDate.getMonth()}&view=month`);
						}
					}}
				>
					<div class="text-xs sm:text-sm font-semibold text-gray-900 mb-1 sm:mb-2">
						{monthDate.toLocaleDateString('en-US', { month: 'long' })}
					</div>
					<div class="text-xs text-gray-500 mb-1 sm:mb-2">
						{monthOccurrences.length} {monthOccurrences.length === 1 ? 'event' : 'events'}
					</div>
					<div class="space-y-1">
						{#each monthOccurrences.slice(0, 2) as occ}
							{@const colorStyles = getEventColorStyles(occ.event)}
							<div 
								class="text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded truncate" 
								style="background-color: {colorStyles.backgroundColor}; color: {colorStyles.color}; border: 1px solid {colorStyles.borderColor};"
								title="{occ.event?.title || 'Event'}"
							>
								<span class="hidden sm:inline">{new Date(occ.startsAt).getDate()} - </span>{occ.event?.title || 'Event'}
							</div>
						{/each}
						{#if monthOccurrences.length > 2}
							<div class="text-xs text-gray-500 px-1.5 sm:px-2">
								+{monthOccurrences.length - 2} more
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- Month View -->
{#if viewMode === 'month'}
	<!-- Mobile: List View -->
	<div class="block md:hidden bg-white shadow rounded-lg overflow-hidden">
		<div class="divide-y divide-gray-200">
			{#each monthDays as day}
				{#if day}
					{@const dayOccurrences = getOccurrencesForDate(day)}
					{@const isToday = day.toDateString() === new Date().toDateString()}
					{@const dayOfWeek = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getDay()}
					{@const isSunday = dayOfWeek === 0}
					<div 
						class="p-3 {isToday ? 'bg-hub-blue-50' : ''} cursor-pointer hover:bg-gray-50 transition-colors"
						style={isSunday && !isToday ? 'background-color: rgba(59, 130, 246, 0.05);' : ''}
						on:click={(e) => handleDayClick(day, e)}
						role="button"
						tabindex="0"
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleDayClick(day, e);
							}
						}}
					>
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center gap-2">
								<div class="text-sm font-semibold {isToday ? 'text-hub-blue-600' : 'text-gray-900'}">
									{day.getDate()}
								</div>
								<div class="text-xs text-gray-500">
									{dayNames[(day.getDay() + 6) % 7]}
								</div>
							</div>
							{#if dayOccurrences.length > 0}
								<div class="text-xs text-gray-500">
									{dayOccurrences.length} {dayOccurrences.length === 1 ? 'event' : 'events'}
								</div>
							{/if}
						</div>
						<div class="space-y-1.5">
							{#each dayOccurrences as occ}
								{@const colorStyles = getEventColorStyles(occ.event)}
								<a
									href="/hub/events/{occ.eventId}"
									class="block text-xs px-2.5 py-1.5.5 rounded hover:opacity-80 transition-colors"
									style="background-color: {colorStyles.backgroundColor}; color: {colorStyles.color}; border: 1px solid {colorStyles.borderColor};"
									on:click|stopPropagation
								>
									<div class="font-medium truncate">{occ.event?.title || 'Event'}</div>
									<div class="text-xs opacity-75 mt-0.5">
										{formatEventTime(occ)}
									</div>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			{/each}
		</div>
	</div>
	
	<!-- Desktop: Grid View -->
	<div class="hidden md:block bg-white shadow rounded-lg overflow-hidden">
		<div class="grid grid-cols-7 border-b border-gray-200">
			{#each dayNames as dayName}
				<div class="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50">
					{dayName}
				</div>
			{/each}
		</div>
		<div class="grid grid-cols-7">
			{#each monthDays as day}
				{#if day}
					{@const dayOccurrences = getOccurrencesForDate(day)}
					{@const isToday = day.toDateString() === new Date().toDateString()}
					{@const dayOfWeek = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getDay()}
					{@const isSunday = dayOfWeek === 0}
					<div 
						class="min-h-[120px] border-r border-b border-gray-200 p-2 {isToday ? 'bg-hub-blue-50' : ''} cursor-pointer hover:bg-gray-50 transition-colors"
						style={isSunday && !isToday ? 'background-color: rgba(59, 130, 246, 0.05);' : 'background-color: white;'}
						on:click={(e) => handleDayClick(day, e)}
						role="button"
						tabindex="0"
						on:keydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								handleDayClick(day, e);
							}
						}}
					>
						<div class="text-sm font-medium mb-1 {isToday ? 'text-hub-blue-600' : 'text-gray-900'}">
							{day.getDate()}
						</div>
						<div class="space-y-1">
							{#each dayOccurrences.slice(0, 3) as occ}
								{@const colorStyles = getEventColorStyles(occ.event)}
								<a
									href="/hub/events/{occ.eventId}"
									class="block text-xs px-2.5 py-1.5 rounded truncate hover:opacity-80 transition-colors"
									style="background-color: {colorStyles.backgroundColor}; color: {colorStyles.color}; border: 1px solid {colorStyles.borderColor};"
									title="{occ.event?.title || 'Event'}"
									on:click|stopPropagation
								>
									{formatEventTime(occ)} {occ.event?.title || 'Event'}
								</a>
							{/each}
							{#if dayOccurrences.length > 3}
								<div class="text-xs text-gray-500 px-2">
									+{dayOccurrences.length - 3} more
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div class="min-h-[120px] border-r border-b border-gray-200 bg-gray-50"></div>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<!-- Week View -->
{#if viewMode === 'week'}
	<!-- Mobile: List View -->
	<div class="block md:hidden bg-white shadow rounded-lg overflow-hidden">
		<div class="divide-y divide-gray-200">
			{#each weekDays as day}
				{@const dayOccurrences = getOccurrencesForDate(day)}
				{@const isToday = day.toDateString() === new Date().toDateString()}
				{@const dayOfWeek = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getDay()}
				{@const isSunday = dayOfWeek === 0}
				<div 
					class="p-3 {isToday ? 'bg-hub-blue-50' : ''} cursor-pointer hover:bg-gray-50 transition-colors"
					style={isSunday && !isToday ? 'background-color: rgba(59, 130, 246, 0.05);' : ''}
					on:click={(e) => handleDayClick(day, e)}
					role="button"
					tabindex="0"
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleDayClick(day, e);
						}
					}}
				>
					<div class="flex items-center gap-2 mb-2">
						<div class="text-sm font-semibold {isToday ? 'text-hub-blue-600' : 'text-gray-900'}">
							{dayNames[(day.getDay() + 6) % 7]}
						</div>
						<div class="text-xs text-gray-500">
							{day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
						</div>
						{#if dayOccurrences.length > 0}
							<div class="text-xs text-gray-500 ml-auto">
								{dayOccurrences.length} {dayOccurrences.length === 1 ? 'event' : 'events'}
							</div>
						{/if}
					</div>
					<div class="space-y-1.5">
						{#each dayOccurrences as occ}
							{@const startTime = new Date(occ.startsAt)}
							{@const endTime = new Date(occ.endsAt)}
							{@const colorStyles = getEventColorStyles(occ.event)}
							<a
								href="/hub/events/{occ.eventId}"
								class="block text-xs px-2.5 py-1.5.5 rounded hover:opacity-80 transition-colors"
								style="background-color: {colorStyles.backgroundColor}; color: {colorStyles.color}; border: 1px solid {colorStyles.borderColor};"
								on:click|stopPropagation
							>
								<div class="font-medium truncate">{occ.event?.title || 'Event'}</div>
								<div class="text-xs opacity-75 mt-0.5">
									{formatEventTimeRange(occ)}
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</div>
	
	<!-- Desktop: Grid View -->
	<div class="hidden md:block bg-white shadow rounded-lg overflow-hidden">
		<div class="grid grid-cols-8 border-b border-gray-200">
			<div class="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50"></div>
			{#each weekDays as day}
				{@const isToday = day.toDateString() === new Date().toDateString()}
				<div class="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 {isToday ? 'bg-hub-blue-50' : ''}">
					<div>{dayNames[(day.getDay() + 6) % 7]}</div>
					<div class="text-xs font-normal mt-1">{day.getDate()}</div>
				</div>
			{/each}
		</div>
		<div class="grid grid-cols-8">
			<div class="border-r border-gray-200 p-2 space-y-1">
				{#each Array(24) as _, hour}
					<div class="text-xs text-gray-500 h-12 flex items-start pt-1">
						{hour.toString().padStart(2, '0')}:00
					</div>
				{/each}
			</div>
			{#each weekDays as day}
				{@const dayOccurrences = getOccurrencesForDate(day)}
				{@const isToday = day.toDateString() === new Date().toDateString()}
				{@const dayOfWeek = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getDay()}
				{@const isSunday = dayOfWeek === 0}
				<div 
					class="min-h-[576px] border-r border-gray-200 p-1 {isToday ? 'bg-hub-blue-50' : ''} relative cursor-pointer hover:bg-gray-50 transition-colors"
					style={isSunday && !isToday ? 'background-color: rgba(59, 130, 246, 0.05);' : ''}
					on:click={(e) => handleDayClick(day, e)}
					role="button"
					tabindex="0"
					on:keydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleDayClick(day, e);
						}
					}}
				>
					{#each dayOccurrences as occ}
						{@const startTime = new Date(occ.startsAt)}
						{@const endTime = new Date(occ.endsAt)}
						{@const startHour = startTime.getHours() + startTime.getMinutes() / 60}
						{@const duration = (endTime - startTime) / (1000 * 60 * 60)}
						{@const colorStyles = getEventColorStyles(occ.event)}
						<a
							href="/hub/events/{occ.eventId}"
							class="absolute left-1 right-1 rounded px-2.5 py-1.5 text-xs block hover:opacity-80 transition-colors"
							style="top: {startHour * 24}px; height: {Math.max(duration * 24, 20)}px; background-color: {colorStyles.backgroundColor}; color: {colorStyles.color}; border: 1px solid {colorStyles.borderColor};"
							title="{occ.event?.title || 'Event'}"
							on:click|stopPropagation
						>
							<div class="font-medium truncate">{occ.event?.title || 'Event'}</div>
							<div class="text-xs opacity-75">
								{formatEventTimeRangeUS(occ)}
							</div>
						</a>
					{/each}
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- Agenda View -->
{#if viewMode === 'agenda'}
	<div class="bg-white shadow rounded-lg overflow-hidden">
		{#if agendaOccurrences.length === 0}
			<div class="p-6 sm:p-8 text-center text-gray-500">
				No events scheduled for this month
			</div>
		{:else}
			<div class="divide-y divide-gray-200">
				{#each agendaOccurrences as occ}
					{@const occDate = new Date(occ.startsAt)}
					{@const occEnd = new Date(occ.endsAt)}
					<a
						href="/hub/events/{occ.eventId}"
						class="block p-3 sm:p-4 hover:bg-gray-50 transition-colors"
					>
						<div class="flex items-start gap-3 sm:gap-4">
							<div class="flex-shrink-0 w-16 sm:w-20 text-center">
								<div class="text-xs sm:text-sm font-semibold text-gray-900">
									{occDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
								</div>
								<div class="text-xs text-gray-500">
									{occDate.toLocaleDateString('en-GB', { weekday: 'short' })}
								</div>
							</div>
							<div class="flex-1 min-w-0">
								<div class="text-xs font-medium text-gray-900 mb-1">
									{occ.event?.title || 'Event'}
								</div>
								<div class="text-xs sm:text-sm text-gray-600">
									{formatEventTimeRange(occ)}
									{#if occ.location}
										<span class="ml-2">• {occ.location}</span>
									{/if}
								</div>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
{/if}

