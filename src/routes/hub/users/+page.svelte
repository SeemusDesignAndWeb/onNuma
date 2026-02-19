<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	
	// Area labels mapping
	const areaLabels = {
		contacts: 'Contacts',
		lists: 'Lists',
		rotas: 'Schedules',
		events: 'Events',
		meeting_planners: 'Meeting Planner',
		newsletters: 'Newsletters',
		forms: 'Forms',
		safeguarding_forms: 'Safeguarding Forms',
		members: 'Members',
		users: 'Users'
	};

	$: data = $page.data || {};
	$: admins = data.admins || [];
	$: currentPage = data.currentPage || 1;
	$: totalPages = data.totalPages || 1;
	$: search = data.search || '';
	$: adminCount = data.adminCount ?? 0;
	$: maxAdmins = data.maxAdmins ?? 1;
	$: atAdminLimit = maxAdmins != null && adminCount >= maxAdmins;
	$: planLabel = (data.plan || 'free').charAt(0).toUpperCase() + (data.plan || 'free').slice(1);
	$: showLimitMessage = $page.url.searchParams.get('limit') === '1';

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

	function getAreaLabel(value) {
		return areaLabels[value] || value;
	}

	function renderPermissions(permissions, isSuperAdmin) {
		if (isSuperAdmin) {
			return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Super Admin</span>';
		}
		if (!permissions || permissions.length === 0) {
			return '<span class="text-gray-500 italic">No permissions</span>';
		}
		const labels = permissions.slice(0, 3).map(p => getAreaLabel(p));
		const more = permissions.length > 3 ? ` +${permissions.length - 3} more` : '';
		return labels.join(', ') + more;
	}

	const columns = [
		{ key: 'email', label: 'Email' },
		{ key: 'name', label: 'Name', render: (val) => val || '-' },
		{ 
			key: 'permissions', 
			label: 'Permissions',
			render: (val, row) => renderPermissions(val, row.isSuperAdmin)
		},
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

{#if showLimitMessage}
	<div class="mb-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
		Admin limit reached ({adminCount} / {maxAdmins} for {planLabel} plan). Upgrade your plan to add more admins.
	</div>
{/if}

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Admins</h2>
	<div class="flex flex-wrap gap-2 items-center">
		<span class="text-sm text-gray-600">{planLabel} plan: {adminCount} / {maxAdmins} admins</span>
		{#if atAdminLimit}
			<span class="btn-theme-2 px-2.5 py-1.5 rounded-md text-xs opacity-60 cursor-not-allowed" title="User limit reached. Upgrade your plan to add more admins.">
				Add Admin
			</span>
		{:else}
			<a href="/hub/users/new" class="btn-theme-2 px-2.5 py-1.5 rounded-md text-xs">
				Add Admin
			</a>
		{/if}
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search by email or name..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-[18px] py-2.5"
		/>
		<button type="submit" class="btn-theme-3 px-2.5 py-1.5 rounded-md text-xs">
			Search
		</button>
	</form>
</div>

<Table {columns} rows={admins} onRowClick={(row) => goto(`/hub/users/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

