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

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Meeting Planners</h2>
	<div class="flex flex-wrap gap-2">
		<a href="/hub/meeting-planners/export-next-4-pdf" target="_blank" class="bg-hub-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-hub-blue-700 text-sm sm:text-base flex items-center gap-2">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
			</svg>
			Export PDF
		</a>
		<a href="/hub/meeting-planners/quick-view" class="bg-hub-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-hub-blue-700 text-sm sm:text-base">
			Quick View
		</a>
		<a href="/hub/meeting-planners/new" class="bg-hub-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-hub-green-700 text-sm sm:text-base">
			<span class="hidden sm:inline">New Meeting Planner</span>
			<span class="sm:hidden">New Planner</span>
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search meeting planners..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-4 py-2"
		/>
		<button type="submit" class="bg-gray-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-gray-700 text-sm sm:text-base">
			Search
		</button>
	</form>
</div>

<Table {columns} rows={meetingPlanners} onRowClick={(row) => goto(`/hub/meeting-planners/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />
