<script>
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';
	import { contacts as contactsStore, hubDataLoaded } from '$lib/crm/stores/hubData.js';

	const ITEMS_PER_PAGE = 10;

	$: data = $page.data || {};
	$: csrfToken = data.csrfToken || '';
	$: isSuperAdmin = data.isSuperAdmin || false;
	$: planLimit = data.planLimit ?? 0;
	$: totalInOrg = data.totalInOrg ?? 0;
	$: overPlanLimit = planLimit > 0 && totalInOrg > planLimit;

	// URL-based state (for bookmarkable URLs)
	$: urlSearch = $page.url?.searchParams?.get('search') || '';
	$: urlPage = parseInt($page.url?.searchParams?.get('page') || '1', 10);
	$: urlAvailabilityDay = $page.url?.searchParams?.get('availabilityDay') || '';
	$: urlAvailabilityTime = $page.url?.searchParams?.get('availabilityTime') || '';
	$: urlAvailabilityMode = $page.url?.searchParams?.get('availabilityMode') || 'available';

	// Use store data when loaded, otherwise fall back to server data
	$: useStoreData = $hubDataLoaded && $contactsStore.length > 0;
	$: allContacts = useStoreData ? $contactsStore : (data.contacts || []);

	// Client-side search and pagination when using store data (and optional client-side availability filter)
	const AVAIL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
	const AVAIL_TIMES = ['morning', 'afternoon', 'evening'];
	function isUnavailableForSlot(c, day, time) {
		return !!(c?.unavailability?.[day]?.[time]);
	}
	$: searchLower = urlSearch.toLowerCase();
	$: bySearch = urlSearch
		? allContacts.filter(c =>
			c.firstName?.toLowerCase().includes(searchLower) ||
			c.lastName?.toLowerCase().includes(searchLower) ||
			c.email?.toLowerCase().includes(searchLower)
		)
		: allContacts;
	$: hasAvailFilter = urlAvailabilityDay && urlAvailabilityTime &&
		AVAIL_DAYS.includes(urlAvailabilityDay) && AVAIL_TIMES.includes(urlAvailabilityTime);
	$: filteredContacts = !hasAvailFilter ? bySearch : bySearch.filter((c) => {
		const unav = isUnavailableForSlot(c, urlAvailabilityDay, urlAvailabilityTime);
		return urlAvailabilityMode === 'unavailable' ? unav : !unav;
	});

	// When using server data (no store), use server-provided list and pagination
	$: totalFiltered = useStoreData ? filteredContacts.length : (data.total ?? 0);
	$: totalPages = Math.max(1, Math.ceil(totalFiltered / ITEMS_PER_PAGE));
	$: currentPage = useStoreData ? Math.min(urlPage, totalPages) : (data.currentPage ?? 1);
	$: startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
	$: contacts = useStoreData
		? filteredContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE)
		: (data.contacts || []);

	// Search input binding (local state for typing)
	let searchInput = urlSearch;
	$: if (urlSearch !== searchInput && !searchInput) {
		searchInput = urlSearch;
	}

	// Availability filter (sync from URL when not set locally)
	let availabilityDayInput = urlAvailabilityDay;
	let availabilityTimeInput = urlAvailabilityTime;
	let availabilityModeInput = urlAvailabilityMode;
	$: if (urlAvailabilityDay !== availabilityDayInput && urlAvailabilityDay) availabilityDayInput = urlAvailabilityDay;
	$: if (urlAvailabilityTime !== availabilityTimeInput && urlAvailabilityTime) availabilityTimeInput = urlAvailabilityTime;
	$: if (urlAvailabilityMode !== availabilityModeInput) availabilityModeInput = urlAvailabilityMode;

	let showBulkUpdateDialog = false;
	let bulkUpdateResult = null;
	let isSubmitting = false;
	let updateField = 'membershipStatus';
	let updateValue = 'member';
	let filterCondition = 'empty';

	function buildParams(overrides = {}) {
		const params = new URLSearchParams();
		if (urlSearch || overrides.search) params.set('search', overrides.search ?? urlSearch);
		if (urlAvailabilityDay || overrides.availabilityDay) params.set('availabilityDay', overrides.availabilityDay ?? urlAvailabilityDay);
		if (urlAvailabilityTime || overrides.availabilityTime) params.set('availabilityTime', overrides.availabilityTime ?? urlAvailabilityTime);
		if ((urlAvailabilityMode && urlAvailabilityMode !== 'available') || overrides.availabilityMode) params.set('availabilityMode', overrides.availabilityMode ?? urlAvailabilityMode);
		params.set('page', String(overrides.page ?? 1));
		return params;
	}

	function handleSearch() {
		const params = buildParams({ search: searchInput, page: 1 });
		goto(`/hub/contacts?${params.toString()}`);
	}

	function handlePageChange(newPage) {
		const params = buildParams({ page: newPage });
		goto(`/hub/contacts?${params.toString()}`);
	}

	function handleAvailabilityFilter() {
		const params = buildParams({ page: 1 });
		if (availabilityDayInput) params.set('availabilityDay', availabilityDayInput);
		if (availabilityTimeInput) params.set('availabilityTime', availabilityTimeInput);
		params.set('availabilityMode', availabilityModeInput);
		goto(`/hub/contacts?${params.toString()}`);
	}

	function clearAvailabilityFilter() {
		availabilityDayInput = '';
		availabilityTimeInput = '';
		availabilityModeInput = 'available';
		const params = buildParams({ page: 1 });
		params.delete('availabilityDay');
		params.delete('availabilityTime');
		params.delete('availabilityMode');
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
	/** Mobile card view: only first name, last name, telephone */
	$: mobileColumns = [
		{ key: 'firstName', label: 'First name', render: (val) => val || '—' },
		{ key: 'lastName', label: 'Last name', render: (val) => val || '—' },
		{ key: 'phone', label: 'Telephone', render: (val) => val || '—' }
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
	<h2 class="text-xl sm:text-2xl font-bold">Volunteers</h2>
	<div class="flex flex-wrap gap-2">
		<a href="/hub/volunteers" class="bg-amber-500 text-white px-2.5 py-1.5 rounded-md hover:bg-amber-600 inline-flex items-center gap-1.5 text-xs">
			<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
			</svg>
			Pending Volunteers
		</a>
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
		<a href="/hub/contacts/import" class="bg-theme-button-1 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Import
		</a>
		<a href="/hub/contacts/new" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Add Volunteer
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search volunteers..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-[18px] py-2.5"
		/>
		<button type="submit" class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
			Search
		</button>
	</form>
</div>

<div class="mb-4 flex flex-wrap items-end gap-2">
	<span class="text-sm font-medium text-gray-700">Availability:</span>
	<select
		bind:value={availabilityDayInput}
		class="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-2"
		aria-label="Day"
	>
		<option value="">Any day</option>
		<option value="monday">Monday</option>
		<option value="tuesday">Tuesday</option>
		<option value="wednesday">Wednesday</option>
		<option value="thursday">Thursday</option>
		<option value="friday">Friday</option>
		<option value="saturday">Saturday</option>
		<option value="sunday">Sunday</option>
	</select>
	<select
		bind:value={availabilityTimeInput}
		class="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-2"
		aria-label="Time of day"
	>
		<option value="">Any time</option>
		<option value="morning">Morning</option>
		<option value="afternoon">Afternoon</option>
		<option value="evening">Evening</option>
	</select>
	<select
		bind:value={availabilityModeInput}
		class="rounded-md border-gray-300 shadow-sm text-sm py-1.5 px-2"
		aria-label="Show"
	>
		<option value="available">Show available</option>
		<option value="unavailable">Show unavailable</option>
	</select>
	<button
		type="button"
		on:click={handleAvailabilityFilter}
		class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs"
	>
		Apply
	</button>
	{#if hasAvailFilter}
		<button
			type="button"
			on:click={clearAvailabilityFilter}
			class="text-gray-600 hover:text-gray-800 text-xs underline"
		>
			Clear filter
		</button>
	{/if}
</div>

{#if overPlanLimit}
	<p class="mb-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
		Your plan includes access to the first {planLimit} volunteers (sorted by name). You have {totalInOrg} in total; the rest are not shown but are kept. Upgrade your plan to see and manage all volunteers.
	</p>
{/if}

{#if bulkUpdateResult}
	<div class="mb-4 p-4 rounded-md {bulkUpdateResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}">
		{#if bulkUpdateResult.error}
			<p class="text-red-800">{bulkUpdateResult.error}</p>
		{:else}
			<p class="text-green-800">{bulkUpdateResult.message || `Successfully updated ${bulkUpdateResult.updatedCount || 0} volunteer(s).`}</p>
		{/if}
	</div>
{/if}

<div role="region" aria-label="Volunteers table">
	<Table {columns} {mobileColumns} rows={contacts} emptyMessage="No volunteers yet. Add your first volunteer above." onRowClick={(row) => goto(`/hub/contacts/${row.id}`)} />
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
			<h3 id="bulk-update-title" class="text-xl font-bold text-gray-900 mb-4">Bulk Update Volunteers</h3>
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
						<label class="block text-sm font-medium text-gray-700 mb-2">Update Which Volunteers?</label>
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
						{isSubmitting ? 'Updating...' : 'Update Volunteers'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

