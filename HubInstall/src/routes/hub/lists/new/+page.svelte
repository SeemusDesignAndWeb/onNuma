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
	<h2 class="text-2xl font-bold text-gray-900 mb-6">New List</h2>

	<form method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<FormField label="Name" name="name" bind:value={formData.name} required />
		<FormField label="Description" name="description" type="textarea" rows="3" bind:value={formData.description} />
		<div class="flex gap-2">
			<button type="submit" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
				Create List
			</button>
			<a href="/hub/lists" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700">
				Cancel
			</a>
		</div>
	</form>

</div>

