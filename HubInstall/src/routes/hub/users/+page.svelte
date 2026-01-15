<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: admins = data.admins || [];
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
		goto(`/hub/users?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		goto(`/hub/users?${params.toString()}`);
	}

	function getStatusBadge(admin) {
		if (admin.accountLockedUntil && new Date(admin.accountLockedUntil) > new Date()) {
			return { text: 'Locked', class: 'bg-hub-red-100 text-hub-red-800' };
		}
		if (!admin.emailVerified) {
			return { text: 'Unverified', class: 'bg-hub-yellow-100 text-hub-yellow-800' };
		}
		return { text: 'Active', class: 'bg-hub-green-100 text-hub-green-800' };
	}

	const columns = [
		{ key: 'email', label: 'Email' },
		{ key: 'name', label: 'Name', render: (val) => val || '-' },
		{ 
			key: 'status', 
			label: 'Status',
			render: (val, row) => {
				const badge = getStatusBadge(row);
				return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.class}">${badge.text}</span>`;
			}
		},
		{ 
			key: 'emailVerified', 
			label: 'Email Verified',
			render: (val) => val ? 'Yes' : 'No'
		},
		{ 
			key: 'createdAt', 
			label: 'Created',
			render: (val) => val ? formatDateUK(val) : '-'
		}
	];
</script>

<div class="mb-4 flex justify-between items-center">
	<h2 class="text-2xl font-bold text-gray-900">Admin Users</h2>
	<div class="flex gap-2">
		<a href="/hub/users/new" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
			Add Admin User
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search by email or name..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-2.5 py-1.5"
		/>
		<button type="submit" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700">
			Search
		</button>
	</form>
</div>

<Table {columns} rows={admins} onRowClick={(row) => goto(`/hub/users/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

