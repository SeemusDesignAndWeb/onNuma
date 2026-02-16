<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: newsletters = data.newsletters || [];
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
		goto(`/hub/emails?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		goto(`/hub/emails?${params.toString()}`);
	}

	function getStatusBadge(status) {
		const statusText = status || 'draft';
		const statusLabel = statusText.charAt(0).toUpperCase() + statusText.slice(1);
		let badgeClass = 'px-2.5 py-1.5 rounded-full text-xs font-semibold border-2 ';
		
		switch (statusText) {
			case 'sent':
				badgeClass += 'bg-hub-green-100 text-hub-green-800 border-hub-green-300';
				break;
			case 'scheduled':
				badgeClass += 'bg-hub-blue-100 text-hub-blue-800 border-hub-blue-300';
				break;
			case 'draft':
			default:
				badgeClass += 'bg-gray-100 text-gray-800 border-gray-300';
				break;
		}
		
		return `<span class="${badgeClass}">${statusLabel}</span>`;
	}

	const columns = [
		{ key: 'subject', label: 'Subject' },
		{ 
			key: 'status', 
			label: 'Status',
			render: (val) => getStatusBadge(val)
		},
		{ 
			key: 'createdAt', 
			label: 'Created',
			render: (val) => val ? formatDateUK(val) : ''
		}
	];
</script>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Emails</h2>
	<div class="flex flex-wrap gap-2">
		<a href="/hub/emails/templates" class="bg-theme-button-1 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Templates
		</a>
		<a href="/hub/emails/new" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			New Email
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search emails..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-[18px] py-2.5"
		/>
		<button type="submit" class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Search
		</button>
	</form>
</div>

<Table {columns} mobileHideLabels rows={newsletters} emptyMessage="No emails yet. Create your first email above." onRowClick={(row) => goto(`/hub/emails/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

