<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: meetingPlanners = data.meetingPlanners || [];
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
		goto(`/hub/meeting-planners?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		goto(`/hub/meeting-planners?${params.toString()}`);
	}

	const columns = [
		{ key: 'eventTitle', label: 'Event' },
		{ 
			key: 'occurrenceDate', 
			label: 'Occurrence',
			render: (val) => val ? formatDateTimeUK(val) : 'All occurrences'
		},
		{ 
			key: 'updatedAt', 
			label: 'Last Updated',
			render: (val) => val ? formatDateTimeUK(val) : '-'
		}
	];
</script>

<div class="mb-4 flex justify-between items-center">
	<h2 class="text-2xl font-bold text-gray-900">Meeting Planners</h2>
	<div class="flex gap-2">
		<a href="/hub/meeting-planners/quick-view" class="bg-hub-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-blue-700">
			Quick View
		</a>
		<a href="/hub/meeting-planners/new" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
			New Meeting Planner
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search meeting planners..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-2.5 py-1.5"
		/>
		<button type="submit" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700">
			Search
		</button>
	</form>
</div>

<Table {columns} rows={meetingPlanners} onRowClick={(row) => goto(`/hub/meeting-planners/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />
