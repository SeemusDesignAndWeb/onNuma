<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: forms = data.forms || [];
	$: latestSubmissions = data.latestSubmissions || [];
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
		goto(`/hub/forms?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		goto(`/hub/forms?${params.toString()}`);
	}

	const columns = [
		{ key: 'name', label: 'Name' },
		{ 
			key: 'description', 
			label: 'Description',
			render: (val) => val ? (val.length > 50 ? val.substring(0, 50) + '...' : val) : ''
		},
		{ 
			key: 'fields', 
			label: 'Fields',
			render: (val) => Array.isArray(val) ? val.length : 0
		},
		{ 
			key: 'isSafeguarding', 
			label: 'Safeguarding',
			render: (val) => val ? 'Yes' : 'No'
		},
		{ 
			key: 'createdAt', 
			label: 'Created',
			render: (val) => val ? formatDateUK(val) : ''
		}
	];
</script>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Forms</h2>
	<a href="/hub/forms/new" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs">
		New Form
	</a>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search forms..."
			class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-4"
		/>
		<button type="submit" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs">
			Search
		</button>
	</form>
</div>

<Table {columns} rows={forms} onRowClick={(row) => goto(`/hub/forms/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

<!-- Latest Form Submissions -->
<div class="mt-8 bg-white shadow rounded-lg p-6">
	<div class="flex justify-between items-center mb-4">
		<h3 class="text-lg font-semibold text-gray-900">Latest Form Submissions</h3>
	</div>
	{#if latestSubmissions.length === 0}
		<p class="text-sm text-gray-500">No form submissions yet</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form</th>
						<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
						<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each latestSubmissions as submission}
						<tr 
							class="hover:bg-gray-50 cursor-pointer"
							on:click={() => goto(`/hub/forms/${submission.formId}/submissions/${submission.id}`)}
						>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
								{submission.formName}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
								{submission.submittedAt ? formatDateTimeUK(submission.submittedAt) : '-'}
							</td>
							<td class="px-6 py-4 text-sm text-gray-500">
								{#if submission.encryptedData}
									<span class="text-hub-yellow-600 font-medium">🔒 Encrypted (Safeguarding)</span>
								{:else if submission.data && typeof submission.data === 'object'}
									{@const keys = Object.keys(submission.data)}
									{#if keys.length > 0}
										{@const firstKey = keys[0]}
										{@const firstValue = String(submission.data[firstKey])}
										{firstKey}: {firstValue.length > 50 ? firstValue.substring(0, 50) + '...' : firstValue}
									{:else}
										-
									{/if}
								{:else}
									-
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

