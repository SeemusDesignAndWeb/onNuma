<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: template = $page.data?.template;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Show notifications from form results
	$: if (formResult?.success) {
		notifications.success('Template updated successfully');
		// Exit edit mode after successful save
		// The page will automatically reload with updated data via use:enhance
		editing = false;
	}
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let editing = false;
	let htmlContent = '';
	let formData = {
		name: '',
		subject: '',
		description: ''
	};

	// Update form data and htmlContent when template loads (only when not editing)
	$: if (template && !editing) {
		formData = {
			name: template.name || '',
			subject: template.subject || '',
			description: template.description || ''
		};
		// Always keep htmlContent in sync with template
		if (template.htmlContent && (!htmlContent || htmlContent !== template.htmlContent)) {
			htmlContent = template.htmlContent;
		}
	}
	
	function startEditing() {
		// Ensure formData and htmlContent are set before entering edit mode
		if (template) {
			formData = {
				name: template.name || '',
				subject: template.subject || '',
				description: template.description || ''
			};
			if (template.htmlContent) {
				htmlContent = template.htmlContent;
			}
		}
		editing = true;
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this template?', 'Delete Template');
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/delete';
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			document.body.appendChild(form);
			form.submit();
		}
	}
</script>

{#if template}
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex justify-between items-center mb-6">
			<h2 class="text-2xl font-bold text-gray-900">Template: {template.name}</h2>
			<div class="flex gap-2">
				{#if editing}
					<button
						type="submit"
						form="template-edit-form"
						class="bg-brand-green text-white px-4 py-2 rounded-md hover:bg-primary-dark"
					>
						Save Changes
					</button>
					<button
						type="button"
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
					>
						Back
					</button>
				{:else}
					<button
						type="button"
						on:click|preventDefault={startEditing}
						class="bg-brand-green text-white px-4 py-2 rounded-md hover:bg-primary-dark"
					>
						Edit
					</button>
					<button
						type="button"
						on:click={handleDelete}
						class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form id="template-edit-form" method="POST" action="?/update" use:enhance>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<FormField label="Template Name" name="name" bind:value={formData.name} required />
				<FormField label="Description" name="description" bind:value={formData.description} />
				<FormField label="Subject" name="subject" bind:value={formData.subject} />
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-1">HTML Content</label>
					{#key editing}
						<HtmlEditor bind:value={htmlContent} name="htmlContent" showPlaceholders={true} showImagePicker={true} />
					{/key}
				</div>
			</form>
		{:else}
			<dl class="grid grid-cols-1 gap-4">
				<div>
					<dt class="text-sm font-medium text-gray-500">Name</dt>
					<dd class="mt-1 text-sm text-gray-900">{template.name}</dd>
				</div>
				{#if template.description}
					<div>
						<dt class="text-sm font-medium text-gray-500">Description</dt>
						<dd class="mt-1 text-sm text-gray-900">{template.description}</dd>
					</div>
				{/if}
				{#if template.subject}
					<div>
						<dt class="text-sm font-medium text-gray-500">Subject</dt>
						<dd class="mt-1 text-sm text-gray-900">{template.subject}</dd>
					</div>
				{/if}
				{#if template.htmlContent}
					<div>
						<dt class="text-sm font-medium text-gray-500">Content Preview</dt>
						<dd class="mt-1 text-sm text-gray-900 prose max-w-none">
							<div class="newsletter-preview">{@html template.htmlContent}</div>
						</dd>
					</div>
				{/if}
			</dl>
		{/if}

	</div>
{/if}

