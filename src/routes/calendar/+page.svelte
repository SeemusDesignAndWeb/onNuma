<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Footer from '$lib/components/Footer.svelte';
	import { getContext } from 'svelte';

	export let data;

	let bannerVisible = false;
	
	// Get banner visibility from context
	try {
		const bannerVisibleStore = getContext('bannerVisible');
		if (bannerVisibleStore) {
			bannerVisibleStore.subscribe(value => {
				bannerVisible = value;
			});
		}
	} catch (e) {
		// Context not available
	}

	$: events = data?.events || [];
	$: occurrences = data?.occurrences || [];
	$: eventLinks = data?.eventLinks || {};

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

	function getMonthName(date) {
		return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
	}

	function navigateMonth(direction) {
		const newDate = new Date(currentDate);
		newDate.setMonth(currentDate.getMonth() + direction);
		goto(`/events/calendar?year=${newDate.getFullYear()}&month=${newDate.getMonth()}&view=${viewMode}`);
	}

	function navigateWeek(direction) {
		const newDate = new Date(currentDate);
		if (viewMode === 'week') {
			newDate.setDate(currentDate.getDate() + (direction * 7));
		} else {
			newDate.setMonth(currentDate.getMonth() + direction);
		}
		goto(`/events/calendar?year=${newDate.getFullYear()}&month=${newDate.getMonth()}&view=${viewMode}`);
	}

	function navigateYear(direction) {
		const newDate = new Date(currentDate);
		newDate.setFullYear(currentDate.getFullYear() + direction);
		goto(`/events/calendar?year=${newDate.getFullYear()}&month=${newDate.getMonth()}&view=${viewMode}`);
	}

	function goToToday() {
		const today = new Date();
		goto(`/events/calendar?year=${today.getFullYear()}&month=${today.getMonth()}&view=${viewMode}`);
	}

	function setView(mode) {
		viewMode = mode;
		goto(`/events/calendar?year=${currentDate.getFullYear()}&month=${currentDate.getMonth()}&view=${mode}`);
	}

	// Get occurrences for a specific date
	function getOccurrencesForDate(date) {
		const dateStr = date.toISOString().split('T')[0];
		return occurrences.filter(occ => {
			const occDate = new Date(occ.startsAt);
			const occDateStr = occDate.toISOString().split('T')[0];
			return occDateStr === dateStr;
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

		const days = [];
		
		// Add empty cells for days before the first day of the month
		for (let i = 0; i < startingDayOfWeek; i++) {
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
		const diff = weekStart.getDate() - day; // Adjust to Sunday
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

	const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
</script>

<svelte:head>
	<title>Event Calendar - Eltham Green Community Church</title>
	<meta name="description" content="View our upcoming public events and activities" />
</svelte:head>

<!-- Hero Section -->
<section class="bg-gradient-to-r from-primary to-brand-blue py-20" class:mt-[5px]={bannerVisible}>
	<div class="container mx-auto px-4">
		<div class="max-w-2xl">
			<h1 class="text-white text-4xl md:text-5xl font-bold mb-4">
				Event Calendar
			</h1>
			<p class="text-white text-lg md:text-xl">
				View our upcoming public events and activities
			</p>
		</div>
	</div>
</section>

<!-- Calendar Section -->
<section class="py-20 bg-white">
	<div class="container mx-auto px-4">
		<div class="mb-6">
			<!-- View Mode Tabs -->
			<div class="flex gap-2 mb-4 border-b border-gray-200">
				<button
					on:click={() => setView('year')}
					class="px-4 py-2 font-medium transition-colors {viewMode === 'year' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-600 hover:text-gray-900'}"
				>
					Year
				</button>
				<button
					on:click={() => setView('month')}
					class="px-4 py-2 font-medium transition-colors {viewMode === 'month' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-600 hover:text-gray-900'}"
				>
					Month
				</button>
				<button
					on:click={() => setView('week')}
					class="px-4 py-2 font-medium transition-colors {viewMode === 'week' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-600 hover:text-gray-900'}"
				>
					Week
				</button>
				<button
					on:click={() => setView('agenda')}
					class="px-4 py-2 font-medium transition-colors {viewMode === 'agenda' ? 'text-brand-green border-b-2 border-brand-green' : 'text-gray-600 hover:text-gray-900'}"
				>
					Agenda
				</button>
			</div>

			<!-- Navigation Controls -->
			<div class="flex justify-between items-center mb-4">
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
						class="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
					>
						←
					</button>
					<button
						on:click={goToToday}
						class="px-4 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
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
						class="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
					>
						→
					</button>
				</div>
				<h3 class="text-xl font-semibold text-gray-900">
					{#if viewMode === 'year'}
						{currentDate.getFullYear()}
					{:else if viewMode === 'month'}
						{getMonthName(currentDate)}
					{:else if viewMode === 'week'}
						Week of {weekDays[0]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })} - {weekDays[6]?.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' })}
					{:else}
						{getMonthName(currentDate)}
					{/if}
				</h3>
				<div class="flex gap-2">
					{#if viewMode === 'year'}
						<select
							value={currentDate.getFullYear()}
							on:change={(e) => {
								const year = parseInt(e.target.value);
								goto(`/events/calendar?year=${year}&month=0&view=${viewMode}`);
							}}
							class="px-3 py-1 border border-gray-500 rounded-md"
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
								goto(`/events/calendar?year=${year}&month=${month - 1}&view=${viewMode}`);
							}}
							class="px-3 py-1 border border-gray-500 rounded-md"
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

		<!-- Year View -->
		{#if viewMode === 'year'}
			<div class="bg-white shadow rounded-lg overflow-hidden">
				<div class="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 p-4">
					{#each yearMonths as monthDate}
						{@const monthOccurrences = getOccurrencesForMonth(monthDate.getFullYear(), monthDate.getMonth())}
						{@const isCurrentMonth = monthDate.getMonth() === new Date().getMonth() && monthDate.getFullYear() === new Date().getFullYear()}
						<div class="border border-gray-200 rounded-lg p-3 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer {isCurrentMonth ? 'bg-blue-50 border-blue-300' : ''}"
							on:click={() => goto(`/events/calendar?year=${monthDate.getFullYear()}&month=${monthDate.getMonth()}&view=month`)}
						>
							<div class="text-sm font-semibold text-gray-900 mb-2">
								{monthDate.toLocaleDateString('en-US', { month: 'long' })}
							</div>
							<div class="text-xs text-gray-500 mb-2">
								{monthOccurrences.length} {monthOccurrences.length === 1 ? 'event' : 'events'}
							</div>
							<div class="space-y-1">
								{#each monthOccurrences.slice(0, 3) as occ}
									<div class="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 truncate" title="{occ.event?.title || 'Event'}">
										{new Date(occ.startsAt).getDate()} - {occ.event?.title || 'Event'}
									</div>
								{/each}
								{#if monthOccurrences.length > 3}
									<div class="text-xs text-gray-500 px-2">
										+{monthOccurrences.length - 3} more
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
			<div class="bg-white shadow rounded-lg overflow-hidden">
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
							<div class="min-h-[120px] border-r border-b border-gray-200 p-2 {isToday ? 'bg-blue-50' : ''}">
								<div class="text-sm font-medium mb-1 {isToday ? 'text-blue-600' : 'text-gray-900'}">
									{day.getDate()}
								</div>
								<div class="space-y-1">
									{#each dayOccurrences.slice(0, 3) as occ}
										{@const eventLink = eventLinks[occ.eventId]}
										{#if eventLink}
											<a
												href={eventLink}
												class="block text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 hover:bg-purple-200 truncate"
												title="{occ.event?.title || 'Event'}"
											>
												{new Date(occ.startsAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })} {occ.event?.title || 'Event'}
											</a>
										{:else}
											<div
												class="block text-xs px-2 py-1 rounded bg-purple-100 text-purple-800 truncate"
												title="{occ.event?.title || 'Event'}"
											>
												{new Date(occ.startsAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })} {occ.event?.title || 'Event'}
											</div>
										{/if}
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
			<div class="bg-white shadow rounded-lg overflow-hidden">
				<div class="grid grid-cols-8 border-b border-gray-200">
					<div class="px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50"></div>
					{#each weekDays as day}
						{@const isToday = day.toDateString() === new Date().toDateString()}
						<div class="px-4 py-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 {isToday ? 'bg-blue-50' : ''}">
							<div>{dayNames[day.getDay()]}</div>
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
						<div class="min-h-[576px] border-r border-gray-200 p-1 {isToday ? 'bg-blue-50' : ''} relative">
							{#each dayOccurrences as occ}
								{@const startTime = new Date(occ.startsAt)}
								{@const endTime = new Date(occ.endsAt)}
								{@const startHour = startTime.getHours() + startTime.getMinutes() / 60}
								{@const duration = (endTime - startTime) / (1000 * 60 * 60)}
								{@const eventLink = eventLinks[occ.eventId]}
								{#if eventLink}
									<a
										href={eventLink}
										class="absolute left-1 right-1 rounded px-2 py-1 bg-purple-100 text-purple-800 hover:bg-purple-200 text-xs block"
										style="top: {startHour * 24}px; height: {Math.max(duration * 24, 20)}px;"
										title="{occ.event?.title || 'Event'}"
									>
										<div class="font-medium truncate">{occ.event?.title || 'Event'}</div>
										<div class="text-xs opacity-75">
											{startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
										</div>
									</a>
								{:else}
									<div
										class="absolute left-1 right-1 rounded px-2 py-1 bg-purple-100 text-purple-800 text-xs block"
										style="top: {startHour * 24}px; height: {Math.max(duration * 24, 20)}px;"
										title="{occ.event?.title || 'Event'}"
									>
										<div class="font-medium truncate">{occ.event?.title || 'Event'}</div>
										<div class="text-xs opacity-75">
											{startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - {endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
										</div>
									</div>
								{/if}
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
					<div class="p-8 text-center text-gray-500">
						No public events scheduled for this month
					</div>
				{:else}
					<div class="divide-y divide-gray-200">
						{#each agendaOccurrences as occ}
							{@const occDate = new Date(occ.startsAt)}
							{@const occEnd = new Date(occ.endsAt)}
							{@const eventLink = eventLinks[occ.eventId]}
							{#if eventLink}
								<a
									href={eventLink}
									class="block p-4 hover:bg-gray-50 transition-colors"
								>
									<div class="flex items-start gap-4">
										<div class="flex-shrink-0 w-20 text-center">
											<div class="text-sm font-semibold text-gray-900">
												{occDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
											</div>
											<div class="text-xs text-gray-500">
												{occDate.toLocaleDateString('en-GB', { weekday: 'short' })}
											</div>
										</div>
										<div class="flex-1 min-w-0">
											<div class="font-medium text-gray-900 mb-1">
												{occ.event?.title || 'Event'}
											</div>
											<div class="text-sm text-gray-600">
												{occDate.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })} - {occEnd.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
												{#if occ.location}
													<span class="ml-2">• {occ.location}</span>
												{/if}
											</div>
										</div>
									</div>
								</a>
							{:else}
								<div class="block p-4">
									<div class="flex items-start gap-4">
										<div class="flex-shrink-0 w-20 text-center">
											<div class="text-sm font-semibold text-gray-900">
												{occDate.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
											</div>
											<div class="text-xs text-gray-500">
												{occDate.toLocaleDateString('en-GB', { weekday: 'short' })}
											</div>
										</div>
										<div class="flex-1 min-w-0">
											<div class="font-medium text-gray-900 mb-1">
												{occ.event?.title || 'Event'}
											</div>
											<div class="text-sm text-gray-600">
												{occDate.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })} - {occEnd.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
												{#if occ.location}
													<span class="ml-2">• {occ.location}</span>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/if}
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</section>

<Footer />

