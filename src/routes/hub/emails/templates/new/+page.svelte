<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	let htmlContent = '';
	let formData = {
		name: '',
		subject: '',
		description: ''
	};
</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h2 class="text-xl sm:text-2xl font-bold text-gray-900">New Newsletter Template</h2>
		<div class="flex flex-wrap gap-2">
			<a href="/hub/emails/templates" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs">
				Cancel
			</a>
			<button type="submit" form="template-create-form" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs">
				<span class="hidden sm:inline">Create Template</span>
				<span class="sm:hidden">Create</span>
			</button>
		</div>
	</div>

	<form id="template-create-form" method="POST" action="?/create" use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<FormField label="Template Name" name="name" bind:value={formData.name} required />
		<FormField label="Description" name="description" bind:value={formData.description} />
		<FormField label="Subject" name="subject" bind:value={formData.subject} />
		<div class="mb-4">
			<label class="block text-sm font-medium text-gray-700 mb-1">HTML Content</label>
			<div class="mb-2 p-3 bg-hub-blue-50 border border-hub-blue-200 rounded-md">
				<p class="text-sm text-hub-blue-800 font-medium mb-2">Available Placeholders:</p>
				<ul class="text-xs text-hub-blue-700 space-y-1 list-disc list-inside">
					<li><code>{'{{firstName}}'}</code> - Contact's first name</li>
					<li><code>{'{{lastName}}'}</code> - Contact's last name</li>
					<li><code>{'{{name}}'}</code> - Full name (first + last)</li>
					<li><code>{'{{email}}'}</code> - Contact's email address</li>
					<li><code>{'{{phone}}'}</code> - Contact's phone number</li>
					<li><code>{'{{rotaLinks}}'}</code> - Upcoming rotas section (next 14 days) with links</li>
					<li><code>{'{{upcomingEvents}}'}</code> - Upcoming public events section (next 7 days)</li>
				</ul>
			</div>
			<HtmlEditor bind:value={htmlContent} name="htmlContent" showPlaceholders={true} showImagePicker={true} />
		</div>
	</form>

</div>

