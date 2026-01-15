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
</script>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Events</h2>
	<div class="flex flex-wrap gap-2">
		<a href="/hub/events/calendar" class="bg-hub-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-blue-700 text-xs">
			Calendar View
		</a>
		<a href="/hub/events/new" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs">
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
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-3 sm:px-[18px] py-2.5 text-xs"
		/>
		<button type="submit" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs whitespace-nowrap">
			Search
		</button>
	</form>
</div>

<Table {columns} rows={events} onRowClick={(row) => goto(`/hub/events/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

