<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import ConfirmDialog from '$lib/crm/components/ConfirmDialog.svelte';
	import { goto } from '$app/navigation';

	$: csrfToken = $page.data?.csrfToken || '';
	$: video = $page.data?.video || {};
	$: formResult = $page.form;
	$: created = $page.url.searchParams.get('created') === 'true';
	
	let showDeleteDialog = false;
	let deleteForm;
	
	// Initialize formData from video, update reactively when video changes
	let formData = {
		title: video?.title || '',
		description: video?.description || '',
		embedCode: video?.embedCode || ''
	};
	
	// Update formData when video loads/changes
	$: if (video && video.id) {
		formData = {
			title: video.title || '',
			description: video.description || '',
			embedCode: video.embedCode || ''
		};
	}

	onMount(() => {
		if (created) {
			notifications.success('Video created successfully');
			// Clean up URL
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.delete('created');
			window.history.replaceState({}, '', newUrl);
		}
	});

	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'success' && result.data?.success) {
				notifications.success('Video updated successfully');
			} else if (result.type === 'failure') {
				const errorMessage = result.data?.error || 'Failed to update video';
				notifications.error(errorMessage);
			}
			await update();
		};
	}

	function handleDelete() {
		showDeleteDialog = true;
	}

	function confirmDelete() {
		if (deleteForm) {
			deleteForm.requestSubmit();
		}
	}

</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Edit Video</h2>
		<div class="flex flex-wrap gap-2">
			<a href="/hub/videos" class="bg-gray-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-gray-700 text-sm sm:text-base">
				Back
			</a>
			<button 
				type="button"
				on:click={handleDelete}
				class="bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-red-700 text-sm sm:text-base"
			>
				Delete
			</button>
			<button type="submit" form="video-edit-form" class="bg-hub-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-hub-green-700 text-sm sm:text-base">
				<span class="hidden sm:inline">Save Changes</span>
				<span class="sm:hidden">Save</span>
			</button>
		</div>
	</div>

	<form id="video-edit-form" method="POST" action="?/update" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<FormField label="Title" name="title" bind:value={formData.title} required />
		<FormField label="Description" name="description" type="textarea" rows="3" bind:value={formData.description} />
		
		<div class="mb-4">
			<label for="embedCode" class="block text-sm font-medium text-gray-700 mb-1">
				Embed Code <span class="text-red-600">*</span>
			</label>
			<textarea
				id="embedCode"
				name="embedCode"
				bind:value={formData.embedCode}
				rows="6"
				required
				class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-4 py-2 font-mono text-sm"
				placeholder="Paste the embed code from Loom here..."
			></textarea>
			<p class="mt-1 text-sm text-gray-500">
				To get the embed code: In Loom, click Share → Embed → Copy embed code
			</p>
		</div>

		{#if formData.embedCode}
			<div class="mb-4 p-4 bg-gray-50 rounded-lg">
				<h3 class="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
				<div class="max-w-2xl">
					{@html formData.embedCode}
				</div>
			</div>
		{/if}
	</form>

	<form method="POST" action="?/delete" bind:this={deleteForm} use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
	</form>
</div>

<ConfirmDialog
	open={showDeleteDialog}
	title="Delete Video"
	message="Are you sure you want to delete this video? This action cannot be undone."
	confirmText="Delete"
	cancelText="Cancel"
	onConfirm={confirmDelete}
	onCancel={() => showDeleteDialog = false}
/>
