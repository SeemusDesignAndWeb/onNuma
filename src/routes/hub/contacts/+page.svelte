<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: contacts = data.contacts || [];
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
		goto(`/hub/contacts?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		goto(`/hub/contacts?${params.toString()}`);
	}

	const columns = [
		{ key: 'email', label: 'Email' },
		{ key: 'firstName', label: 'First Name' },
		{ key: 'lastName', label: 'Last Name' },
		{ key: 'phone', label: 'Phone' },
		{ 
			key: 'city', 
			label: 'City',
			render: (val) => val || '-'
		},
		{ 
			key: 'membershipStatus', 
			label: 'Status',
			render: (val) => val ? val.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : '-'
		},
		{ 
			key: 'createdAt', 
			label: 'Created',
			render: (val) => val ? formatDateUK(val) : ''
		}
	];
</script>

<div class="mb-4 flex justify-between items-center">
	<h2 class="text-2xl font-bold text-gray-900">Contacts</h2>
	<div class="flex gap-2">
		<a href="/signup/member" target="_blank" rel="noopener noreferrer" class="bg-hub-yellow-600 text-white px-4 py-2 rounded-md hover:bg-hub-yellow-700 inline-flex items-center gap-2">
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
			</svg>
			Public Signup Form
		</a>
		<a href="/hub/contacts/import" class="bg-hub-blue-600 text-white px-4 py-2 rounded-md hover:bg-hub-blue-700">
			Import Contacts
		</a>
		<a href="/hub/contacts/new" class="bg-hub-green-600 text-white px-4 py-2 rounded-md hover:bg-hub-green-700">
			Add Contact
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search contacts..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-4 py-2"
		/>
		<button type="submit" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
			Search
		</button>
	</form>
</div>

<Table {columns} rows={contacts} onRowClick={(row) => goto(`/hub/contacts/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

