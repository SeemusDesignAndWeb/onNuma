<script>
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: data = $page.data || {};
	$: contacts = data.contacts || [];
	$: currentPage = data.currentPage || 1;
	$: totalPages = data.totalPages || 1;
	$: search = data.search || '';
	$: csrfToken = data.csrfToken || '';
	$: isSuperAdmin = data.isSuperAdmin || false;
	$: planLimit = data.planLimit ?? 0;
	$: totalInOrg = data.totalInOrg ?? 0;
	$: overPlanLimit = planLimit > 0 && totalInOrg > planLimit;

	let searchInput = search;
	let showBulkUpdateDialog = false;
	let bulkUpdateResult = null;
	let isSubmitting = false;
	let updateField = 'membershipStatus';
	let updateValue = 'member';
	let filterCondition = 'empty';

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

	$: columns = [
		{ key: 'firstName', label: 'First Name', render: (val) => val || '-' },
		{ key: 'lastName', label: 'Last Name', render: (val) => val || '-' },
		{ key: 'email', label: 'Email', render: (val) => val || '-' },
		{ key: 'phone', label: 'Phone', render: (val) => val || '-' },
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

	$: formResult = $page.form;
	
	// Handle form result
	$: if (formResult) {
		isSubmitting = false;
		if (formResult.error) {
			bulkUpdateResult = { error: formResult.error };
		} else if (formResult.success !== undefined) {
			bulkUpdateResult = {
				message: formResult.message || `Successfully updated ${formResult.updatedCount || 0} contact(s).`,
				updatedCount: formResult.updatedCount || 0
			};
			showBulkUpdateDialog = false;
			// Reload the page after a short delay to show the updated data
			setTimeout(() => {
				window.location.reload();
			}, 2000);
		}
	}
</script>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Contacts</h2>
	<div class="flex flex-wrap gap-2">
		{#if isSuperAdmin}
			<button
				on:click={() => showBulkUpdateDialog = true}
				class="bg-theme-button-1 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs"
			>
				Bulk Update
			</button>
		{/if}
		<a href="/signup/member" target="_blank" rel="noopener noreferrer" class="bg-hub-yellow-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-yellow-700 inline-flex items-center gap-1.5 text-xs">
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
			</svg>
			<span class="hidden sm:inline">Public Signup Form</span>
			<span class="sm:hidden">Signup Form</span>
		</a>
		<a href="/signup/membership-form" target="_blank" rel="noopener noreferrer" class="bg-hub-yellow-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-yellow-700 inline-flex items-center gap-1.5 text-xs">
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
			</svg>
			<span class="hidden sm:inline">Membership Form</span>
			<span class="sm:hidden">Membership</span>
		</a>
		<a href="/hub/contacts/import" class="bg-theme-button-1 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Import
		</a>
		<a href="/hub/contacts/new" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
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
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-[18px] py-2.5"
		/>
		<button type="submit" class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Search
		</button>
	</form>
</div>

{#if overPlanLimit}
	<p class="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
		Your plan includes access to the first {planLimit} contacts (sorted by name). You have {totalInOrg} in total; the rest are not shown but are kept. Upgrade your plan to see and manage all contacts.
	</p>
{/if}

{#if bulkUpdateResult}
	<div class="mb-4 p-4 rounded-md {bulkUpdateResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}">
		{#if bulkUpdateResult.error}
			<p class="text-red-800">{bulkUpdateResult.error}</p>
		{:else}
			<p class="text-green-800">{bulkUpdateResult.message || `Successfully updated ${bulkUpdateResult.updatedCount || 0} contact(s).`}</p>
		{/if}
	</div>
{/if}

<div role="region" aria-label="Contacts table">
	<Table {columns} rows={contacts} emptyMessage="No contacts yet. Add your first contact above." onRowClick={(row) => goto(`/hub/contacts/${row.id}`)} />
</div>

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

{#if showBulkUpdateDialog}
	<div 
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
		role="button"
		tabindex="0"
		on:click={() => showBulkUpdateDialog = false}
		on:keydown={(e) => e.key === 'Escape' && (showBulkUpdateDialog = false)}
		aria-label="Close modal"
	>
		<div class="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" on:click|stopPropagation role="dialog" aria-labelledby="bulk-update-title" aria-modal="true">
			<h3 id="bulk-update-title" class="text-xl font-bold text-gray-900 mb-4">Bulk Update Contacts</h3>
			<p class="text-gray-700 mb-6 text-sm">
				This will update contacts based on your selection. This action cannot be undone. Are you sure you want to continue?
			</p>
			<form
				method="POST"
				action="?/bulkUpdateMembershipStatus"
				use:enhance={() => {
					isSubmitting = true;
					bulkUpdateResult = null;
					return async ({ update }) => {
						await update();
					};
				}}
			>
				<input type="hidden" name="_csrf" value={csrfToken} />
				
				<div class="space-y-4 mb-6">
					<!-- Field Selection -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">Field to Update</label>
						<select 
							bind:value={updateField}
							on:change={() => {
								// Reset value when field changes
								if (updateField === 'membershipStatus') {
									updateValue = 'member';
								} else {
									updateValue = '';
								}
							}}
							class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-theme-button-1 py-2 px-3"
						>
							<option value="membershipStatus">Membership Status</option>
							<option value="dateJoined">Date Joined</option>
						</select>
					</div>

					<!-- Value Input -->
					{#if updateField === 'membershipStatus'}
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Membership Status</label>
							<select 
								bind:value={updateValue}
								name="updateValue"
								class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-theme-button-1 py-2 px-3"
							>
								<option value="member">Member</option>
								<option value="regular-attender">Regular Attender</option>
								<option value="visitor">Visitor</option>
								<option value="former-member">Former Member</option>
								<option value="">(Empty)</option>
							</select>
						</div>
					{:else}
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-2">Date Joined</label>
							<input
								type="date"
								bind:value={updateValue}
								name="updateValue"
								class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-theme-button-1 py-2 px-3"
							/>
							<p class="mt-1 text-xs text-gray-500">Leave empty to clear the date</p>
						</div>
					{/if}

					<!-- Filter Condition -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">Update Which Contacts?</label>
						<select 
							bind:value={filterCondition}
							name="filterCondition"
							class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-theme-button-1 py-2 px-3"
						>
							<option value="empty">Only contacts where field is empty</option>
							<option value="all">All contacts (override existing values)</option>
						</select>
					</div>
				</div>

				<input type="hidden" name="updateField" value={updateField} />
				<input type="hidden" name="filterCondition" value={filterCondition} />

				<div class="flex gap-3 justify-end">
					<button
						type="button"
						on:click={() => {
							showBulkUpdateDialog = false;
							bulkUpdateResult = null;
							updateField = 'membershipStatus';
							updateValue = 'member';
							filterCondition = 'empty';
						}}
						class="px-[18px] py-2.5 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="px-[18px] py-2.5 bg-theme-button-1 text-white rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={isSubmitting}
					>
						{isSubmitting ? 'Updating...' : 'Update Contacts'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

