<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';
	import Pager from '$lib/crm/components/Pager.svelte';

	$: data = $page.data || {};
	$: auditLogs = data.auditLogs || [];
	$: currentPage = data.currentPage || 1;
	$: totalPages = data.totalPages || 0;
	$: total = data.total || 0;
	$: actionFilter = data.actionFilter || '';
	$: adminIdFilter = data.adminIdFilter || '';
	$: search = data.search || '';
	$: uniqueActions = data.uniqueActions || [];
	$: uniqueAdminIds = data.uniqueAdminIds || [];
	$: adminMap = data.adminMap || {};
	$: error = data.error;

	let searchInput = search;
	let selectedAction = actionFilter;
	let selectedAdminId = adminIdFilter;

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchInput) {
			params.set('search', searchInput);
		}
		if (selectedAction) {
			params.set('action', selectedAction);
		}
		if (selectedAdminId) {
			params.set('adminId', selectedAdminId);
		}
		params.set('page', '1');
		goto(`/hub/audit-logs?${params.toString()}`);
	}

	function handleFilterChange() {
		handleSearch();
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		if (actionFilter) {
			params.set('action', actionFilter);
		}
		if (adminIdFilter) {
			params.set('adminId', adminIdFilter);
		}
		params.set('page', page.toString());
		goto(`/hub/audit-logs?${params.toString()}`);
	}

	function clearFilters() {
		searchInput = '';
		selectedAction = '';
		selectedAdminId = '';
		goto('/hub/audit-logs');
	}

	function formatAction(action) {
		if (!action) return 'Unknown';
		// Format action names for display
		return action
			.replace(/_/g, ' ')
			.replace(/\b\w/g, l => l.toUpperCase());
	}

	function getActionColor(action) {
		if (!action) return 'bg-gray-500';
		if (action.includes('create')) return 'bg-green-500';
		if (action.includes('update')) return 'bg-blue-500';
		if (action.includes('delete')) return 'bg-red-500';
		if (action.includes('login')) return 'bg-purple-500';
		if (action.includes('sensitive')) return 'bg-orange-500';
		return 'bg-gray-500';
	}
</script>

<div class="flex-1 p-6">
	<div class="max-w-7xl mx-auto">
		<h2 class="text-2xl font-bold text-gray-900 mb-6">Audit Logs</h2>

		{#if error}
			<div class="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm text-red-700">{error}</p>
					</div>
				</div>
			</div>
		{:else}
			<!-- Filters -->
			<div class="bg-white shadow rounded-lg p-4 mb-6">
				<form on:submit|preventDefault={handleSearch} class="space-y-4">
					<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
						<!-- Search -->
						<div>
							<label for="search" class="block text-sm font-medium text-gray-700 mb-1">Search</label>
							<input
								id="search"
								type="text"
								bind:value={searchInput}
								placeholder="Search logs..."
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-3 py-2"
							/>
						</div>

						<!-- Action Filter -->
						<div>
							<label for="action" class="block text-sm font-medium text-gray-700 mb-1">Action</label>
							<select
								id="action"
								bind:value={selectedAction}
								on:change={handleFilterChange}
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-3 py-2"
							>
								<option value="">All Actions</option>
								{#each uniqueActions as action}
									<option value={action}>{formatAction(action)}</option>
								{/each}
							</select>
						</div>

						<!-- Admin Filter -->
						<div>
							<label for="adminId" class="block text-sm font-medium text-gray-700 mb-1">Admin</label>
							<select
								id="adminId"
								bind:value={selectedAdminId}
								on:change={handleFilterChange}
								class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-3 py-2"
							>
								<option value="">All Admins</option>
								{#each uniqueAdminIds as adminId}
									<option value={adminId}>{adminMap[adminId]?.email || adminId}</option>
								{/each}
							</select>
						</div>

						<!-- Buttons -->
						<div class="flex items-end gap-2">
							<button
								type="submit"
								class="flex-1 bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700"
							>
								Search
							</button>
							<button
								type="button"
								on:click={clearFilters}
								class="bg-gray-500 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-600"
							>
								Clear
							</button>
						</div>
					</div>
				</form>
			</div>

			<!-- Results Summary -->
			<div class="mb-4 text-sm text-gray-600">
				Showing {auditLogs.length} of {total} log entries
			</div>

			<!-- Audit Logs Table -->
			<div class="bg-white shadow rounded-lg overflow-hidden">
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
								<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each auditLogs as log}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{formatDateUK(log.timestamp || log.createdAt)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white {getActionColor(log.action)}">
											{formatAction(log.action)}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{log.adminName || 'System'}
									</td>
									<td class="px-6 py-4 text-sm text-gray-500">
										<div class="max-w-md">
											{#if log.details}
												<details class="cursor-pointer">
													<summary class="text-blue-600 hover:text-blue-800">View Details</summary>
													<pre class="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">{JSON.stringify(log.details, null, 2)}</pre>
												</details>
											{:else}
												<span class="text-gray-400">-</span>
											{/if}
										</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{log.ipAddress || '-'}
									</td>
								</tr>
							{:else}
								<tr>
									<td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">
										No audit logs found
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="px-6 py-4 border-t border-gray-200">
						<Pager currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
