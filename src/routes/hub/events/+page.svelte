<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: events = data.events || [];
	$: currentPage = data.currentPage || 1;
	$: totalPages = data.totalPages || 1;
	$: search = data.search || '';

	let searchInput = search;

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchInput) {
			params.set('search', searchInput);
		}
		params.set('page', '1');
		params.set('view', 'list');
		goto(`/hub/events?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		params.set('view', 'list');
		goto(`/hub/events?${params.toString()}`);
	}

	const columns = [
		{ key: 'title', label: 'Title' },
		{ key: 'location', label: 'Location' },
		{ 
			key: 'visibility', 
			label: 'Visibility',
			render: (val) => val || 'private'
		},
		{ 
			key: 'createdAt', 
			label: 'Created',
			render: (val) => val ? formatDateUK(val) : ''
		}
	];
	/** Mobile list view: only event name and date */
	const mobileColumns = [
		{ key: 'title', label: 'Event', render: (val) => val || '—' },
		{ key: 'createdAt', label: 'Date', render: (val) => val ? formatDateUK(val) : '—' }
	];
</script>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold">Events</h2>
	<div class="flex flex-wrap gap-2">
		<a href="/hub/events/calendar" class="btn-theme-1 px-2.5 py-1.5 rounded-md text-xs">
			Calendar View
		</a>
		<a href="/hub/events/new" class="btn-theme-2 px-2.5 py-1.5 rounded-md text-xs">
			New Event
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex flex-col sm:flex-row gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search events..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-3 sm:px-[18px] py-2.5 text-xs"
		/>
		<button type="submit" class="btn-theme-3 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap">
			Search
		</button>
	</form>
</div>

<Table {columns} {mobileColumns} rows={events} emptyMessage="No events yet. Add your first event above." onRowClick={(row) => goto(`/hub/events/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

