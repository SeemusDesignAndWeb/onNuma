<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Table from '$lib/crm/components/Table.svelte';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';

	$: templates = $page.data?.templates || [];

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

	<div class="mb-4 flex justify-between items-center">
		<h2 class="text-2xl font-bold text-gray-900">Email Templates</h2>
		<a href="/hub/emails/templates/new" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
			New Template
		</a>
	</div>

<Table columns={columns} rows={templates} onRowClick={(row) => goto(`/hub/emails/templates/${row.id}`)} />

