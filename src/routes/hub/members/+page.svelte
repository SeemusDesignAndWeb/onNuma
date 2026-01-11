<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: members = data.members || [];
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
		goto(`/hub/members?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		goto(`/hub/members?${params.toString()}`);
	}

	const columns = [
		{ 
			key: 'firstName', 
			label: 'First Name', 
			render: (val) => val || '-' 
		},
		{ 
			key: 'lastName', 
			label: 'Last Name', 
			render: (val) => val || '-' 
		},
		{ 
			key: 'email', 
			label: 'Email', 
			render: (val) => val || '-' 
		},
		{ 
			key: 'phone', 
			label: 'Phone', 
			render: (val) => val || '-' 
		},
		{ 
			key: 'dateJoined', 
			label: 'Date Joined',
			render: (val) => val ? formatDateUK(val) : '-'
		},
		{ 
			key: 'createdAt', 
			label: 'Created',
			render: (val) => val ? formatDateUK(val) : ''
		}
	];
</script>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Members</h2>
	<div class="flex flex-wrap gap-2">
		<a href="/hub/contacts" class="bg-gray-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-gray-700 inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
			<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
			</svg>
			Back to Contacts
		</a>
	</div>
</div>

<div class="bg-white shadow rounded-lg p-6">
	<!-- Search -->
	<div class="mb-6">
		<form on:submit|preventDefault={handleSearch} class="flex gap-2">
			<input
				type="text"
				bind:value={searchInput}
				placeholder="Search members by name or email..."
				class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-hub-blue-500 focus:ring-hub-blue-500 px-4 py-2"
			/>
			<button
				type="submit"
				class="bg-hub-blue-600 text-white px-4 py-2 rounded-md hover:bg-hub-blue-700"
			>
				Search
			</button>
		</form>
	</div>

	<!-- Members Table -->
	{#if members.length > 0}
		<Table 
			{columns}
			rows={members}
			onRowClick={(member) => goto(`/hub/members/${member.id}`)}
		/>
		
		{#if totalPages > 1}
			<div class="mt-6">
				<Pager 
					currentPage={currentPage} 
					totalPages={totalPages} 
					onPageChange={handlePageChange}
				/>
			</div>
		{/if}
	{:else}
		<div class="text-center py-12">
			<p class="text-gray-500 text-lg">
				{#if search}
					No members found matching "{search}".
				{:else}
					No members found.
				{/if}
			</p>
		</div>
	{/if}
</div>
