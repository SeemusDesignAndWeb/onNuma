<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Handle errors - success notification is shown on detail page via URL parameter
	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'failure') {
				// Only show error if it's actually a failure
				const errorMessage = result.data?.error || 'Failed to create list';
				notifications.error(errorMessage);
			}
			await update();
		};
	}
	
	// Show notifications from form results (fallback for errors)
	$: if (formResult?.type === 'failure' && formResult?.data?.error) {
		notifications.error(formResult.data.error);
	}

	let formData = {
		name: '',
		description: ''
	};
</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h2 class="text-xl sm:text-2xl font-bold text-gray-900">New List</h2>
		<div class="flex flex-wrap gap-2">
			<a href="/hub/lists" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs">
				Cancel
			</a>
			<button type="submit" form="list-create-form" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs">
				<span class="hidden sm:inline">Create List</span>
				<span class="sm:hidden">Create</span>
			</button>
		</div>
	</div>

	<form id="list-create-form" method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<FormField label="Name" name="name" bind:value={formData.name} required />
		<FormField label="Description" name="description" type="textarea" rows="3" bind:value={formData.description} />
	</form>

</div>

