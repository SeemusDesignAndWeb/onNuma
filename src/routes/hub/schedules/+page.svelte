<script>
	import { page } from '$app/stores';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto } from '$app/navigation';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { terminology } from '$lib/crm/stores/terminology.js';
	import { onMount } from 'svelte';

	$: data = $page.data || {};
	$: rotas = data.rotas || [];
	$: currentPage = data.currentPage || 1;
	$: totalPages = data.totalPages || 1;
	$: search = data.search || '';
	$: csrfToken = data.csrfToken || '';

	let searchInput = search;
	let tableContainer;

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchInput) {
			params.set('search', searchInput);
		}
		params.set('page', '1');
		goto(`/hub/schedules?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		goto(`/hub/schedules?${params.toString()}`);
	}

	async function handleDelete(rotaId) {
		const rota = rotas.find(r => r.id === rotaId);
		if (!rota) return;
		
		const confirmed = await dialog.confirm(
			`Are you sure you want to delete the schedule "${rota.role}"? This action cannot be undone.`,
			'Delete Schedule',
			{ confirmText: 'Delete', cancelText: 'Cancel' }
		);
		
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/delete';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			const rotaIdInput = document.createElement('input');
			rotaIdInput.type = 'hidden';
			rotaIdInput.name = 'rotaId';
			rotaIdInput.value = rotaId;
			form.appendChild(rotaIdInput);
			
			document.body.appendChild(form);
			form.submit();
		}
	}

	onMount(() => {
		if (tableContainer) {
			const handleClick = (e) => {
				const deleteButton = e.target.closest('[data-delete-rota]');
				if (deleteButton) {
					e.preventDefault();
					e.stopPropagation();
					const rotaId = deleteButton.getAttribute('data-delete-rota');
					handleDelete(rotaId);
				}
			};
			
			tableContainer.addEventListener('click', handleClick);
			
			return () => {
				tableContainer.removeEventListener('click', handleClick);
			};
		}
	});

	const columns = [
		{ key: 'eventTitle', label: 'Event' },
		{ key: 'role', label: 'Role' },
		{ 
			key: 'assignees', 
			label: 'People Assigned',
			render: (val) => Array.isArray(val) ? val.length : 0
		},
		{
			key: 'coveredCount',
			label: 'Dates Covered',
			render: (val) => val !== undefined && val !== null ? val : 0
		},
		{
			key: 'visibility',
			label: 'Visibility',
			render: (val, row) => {
				const visibility = row.visibility || 'public';
				const badgeClass = visibility === 'public' 
					? 'bg-hub-green-100 text-hub-green-800' 
					: 'bg-gray-100 text-gray-800';
				return `<span class="px-2.5 py-1.5 text-xs rounded ${badgeClass}">${visibility === 'public' ? 'Public' : 'Internal'}</span>`;
			}
		},
		{
			key: 'actions',
			label: '',
			render: (val, row) => {
				return `<button 
					class="text-hub-red-600 hover:text-hub-red-800 font-bold text-lg delete-rota-btn w-6 h-6 flex items-center justify-center"
					data-delete-rota="${row.id}"
					type="button"
					title="Delete schedule"
				>×</button>`;
			}
		}
	];

	/** Mobile card view: only rota name */
	const mobileColumns = [
		{ key: 'role', label: 'Schedule', render: (val) => val || '—' }
	];
</script>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold">{$terminology.rota}s</h2>
	<div class="flex flex-wrap gap-2">
		<a href="/view-schedules" target="_blank" class="btn-theme-4 px-2.5 py-1.5 rounded-md text-xs">
			View Your {$terminology.rota}s
		</a>
		<a href="/hub/schedules/invite" class="btn-theme-1 px-2.5 py-1.5 rounded-md text-xs">
			Bulk Invite
		</a>
		<a href="/hub/schedules/bulk-assign" class="btn-theme-1 px-2.5 py-1.5 rounded-md text-xs">
			Bulk Assign
		</a>
		<a href="/hub/schedules/new" class="btn-theme-2 px-2.5 py-1.5 rounded-md text-xs">
			New {$terminology.rota}
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search schedules..."
			class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-[18px] py-2.5"
		/>
		<button type="submit" class="btn-theme-3 px-2.5 py-1.5 rounded-md text-xs">
			Search
		</button>
	</form>
</div>

<div bind:this={tableContainer}>
	<Table 
		{columns}
		{mobileColumns}
		rows={rotas}
		emptyMessage="No schedules yet. Create an event first, then add schedules from the event page."
		onRowClick={(row) => goto(`/hub/schedules/${row.id}`)}
	/>
</div>

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

