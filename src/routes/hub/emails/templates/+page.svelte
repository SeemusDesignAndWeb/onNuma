<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Table from '$lib/crm/components/Table.svelte';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: templates = $page.data?.templates || [];
	$: csrfToken = $page.data?.csrfToken || '';

	const columns = [
		{ key: 'name', label: 'Template Name' },
		{ key: 'description', label: 'Description' },
		{ 
			key: 'createdAt', 
			label: 'Created',
			render: (val) => val ? formatDateUK(val) : ''
		},
		{ 
			key: 'updatedAt', 
			label: 'Last Updated',
			render: (val) => val ? formatDateUK(val) : ''
		}
	];
</script>

	<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
		<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Email Templates</h2>
		<div class="flex flex-wrap items-center gap-2">
			<a href="/hub/emails/templates/new" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
				New Template
			</a>
		</div>
	</div>

<Table columns={columns} rows={templates} onRowClick={(row) => goto(`/hub/emails/templates/${row.id}`)} />

