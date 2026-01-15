<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: templates = $page.data?.templates || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Handle errors - success notification is shown on detail page via URL parameter
	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'failure') {
				// Only show error if it's actually a failure
				const errorMessage = result.data?.error || 'Failed to create email';
				notifications.error(errorMessage);
			}
			await update();
		};
	}
	
	// Show notifications from form results (fallback for errors)
	$: if (formResult?.type === 'failure' && formResult?.data?.error) {
		notifications.error(formResult.data.error);
	}

	let htmlContent = '';
	let selectedTemplateId = '';
	let formData = {
		subject: ''
	};

	async function loadTemplate() {
		if (!selectedTemplateId) return;
		
		try {
			const response = await fetch(`/hub/emails/templates/${selectedTemplateId}/load`);
			if (response.ok) {
				const template = await response.json();
				formData.subject = template.subject || '';
				htmlContent = template.htmlContent || '';
			}
		} catch (error) {
			console.error('Failed to load template:', error);
			notifications.error('Failed to load template');
		}
	}

	function handleTemplateChange() {
		if (selectedTemplateId) {
			loadTemplate();
		}
	}
</script>

<div class="bg-white shadow rounded-lg p-6">
	<h2 class="text-2xl font-bold text-gray-900 mb-6">New Email</h2>

	<form method="POST" action="?/create" use:enhance={handleEnhance}>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<div class="mb-4">
			<label class="block text-sm font-medium text-gray-700 mb-1">Load Template (optional)</label>
			<select
				bind:value={selectedTemplateId}
				on:change={handleTemplateChange}
				class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4"
			>
				<option value="">-- Select a template --</option>
				{#each templates as template}
					<option value={template.id}>{template.name}</option>
				{/each}
			</select>
			<p class="mt-1 text-xs text-gray-500">Selecting a template will load its content into the form</p>
		</div>
		<FormField label="Subject" name="subject" bind:value={formData.subject} required />
		<div class="mb-4">
			<label class="block text-sm font-medium text-gray-700 mb-1">HTML Content</label>
			<HtmlEditor bind:value={htmlContent} name="htmlContent" showPlaceholders={true} showImagePicker={true} />
		</div>
		<div class="flex gap-2">
			<button type="submit" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
				Create Email
			</button>
			<a href="/hub/emails" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700">
				Cancel
			</a>
		</div>
	</form>

</div>

