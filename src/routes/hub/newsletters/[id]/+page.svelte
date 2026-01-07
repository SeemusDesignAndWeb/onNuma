<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	$: newsletter = $page.data?.newsletter;
	$: templates = $page.data?.templates || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: urlParams = $page.url.searchParams;
	
	// Show notifications from form results
	$: if (formResult?.success && !formResult?.templateId) {
		notifications.success('Newsletter updated successfully');
	}
	$: if (formResult?.success && formResult?.templateId) {
		notifications.success(`Template saved successfully! View it <a href="/hub/newsletters/templates/${formResult.templateId}" class="underline">here</a>`, 8000);
	}
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}
	
	// Show notification when coming from create action (only once)
	let hasShownCreatedNotification = false;
	$: if (urlParams.get('created') === 'true' && !hasShownCreatedNotification) {
		hasShownCreatedNotification = true;
		notifications.success('Newsletter created successfully!');
		// Remove the parameter from URL without reload
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.delete('created');
			window.history.replaceState({}, '', url);
		}
	}

	let editing = false;
	let htmlContent = '';
	let selectedTemplateId = '';
	let showSaveTemplateModal = false;
	let templateName = '';
	let templateDescription = '';
	let formData = {
		subject: ''
	};
	let lastNewsletterId = null;
	let isSubmitting = false;

	$: if (newsletter) {
		const isNewNewsletter = newsletter.id !== lastNewsletterId;
		lastNewsletterId = newsletter.id;
		
		// Only update formData if:
		// 1. This is a new newsletter (initial load), OR
		// 2. We're not currently editing AND not submitting (so we can refresh after save, but not during)
		if (isNewNewsletter || (!editing && !isSubmitting)) {
			// Don't auto-open in edit mode - always show detail view first
			// User can click "Edit" button to edit
			
			// Populate form data from newsletter
			formData = {
				subject: newsletter.subject || ''
			};
			htmlContent = newsletter.htmlContent || '';
		}
	}

	// Custom enhance function that prevents data invalidation during submission
	function handleEnhance({ form, submitter, cancel }) {
		return async ({ update, result }) => {
			isSubmitting = true;
			try {
				await update({ reset: false, invalidateAll: false });
				if (result.type === 'success') {
					// Manually invalidate only after a short delay to allow form state to settle
					setTimeout(() => {
						invalidateAll();
						isSubmitting = false;
					}, 100);
				} else {
					isSubmitting = false;
				}
			} catch (error) {
				isSubmitting = false;
				throw error;
			}
		};
	}

	async function loadTemplate() {
		if (!selectedTemplateId) return;
		
		const confirmed = await dialog.confirm('Loading a template will replace your current content. Continue?', 'Load Template');
		if (!confirmed) {
			selectedTemplateId = '';
			return;
		}
		
		try {
			const response = await fetch(`/hub/newsletters/templates/${selectedTemplateId}/load`);
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

	async function handleSaveAsTemplate() {
		if (!templateName.trim()) {
			await dialog.alert('Please enter a template name', 'Validation Error');
			return;
		}

		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/saveAsTemplate';
		const csrfInput = document.createElement('input');
		csrfInput.type = 'hidden';
		csrfInput.name = '_csrf';
		csrfInput.value = csrfToken;
		form.appendChild(csrfInput);
		
		const nameInput = document.createElement('input');
		nameInput.type = 'hidden';
		nameInput.name = 'templateName';
		nameInput.value = templateName;
		form.appendChild(nameInput);
		
		const descInput = document.createElement('input');
		descInput.type = 'hidden';
		descInput.name = 'templateDescription';
		descInput.value = templateDescription;
		form.appendChild(descInput);
		
		document.body.appendChild(form);
		form.submit();
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm(
			'Are you sure you want to delete this newsletter? This action cannot be undone.',
			'Delete Newsletter'
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
			
			document.body.appendChild(form);
			form.submit();
		}
	}
</script>

{#if newsletter}
	<div class="space-y-6">
		<!-- Header Card -->
		<div class="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg rounded-lg p-6 text-white">
			<div class="flex justify-between items-start mb-4">
				<div class="flex-1">
					<h1 class="text-3xl font-bold mb-2 text-white">{newsletter.subject || 'Untitled Newsletter'}</h1>
					<div class="flex items-center gap-4 mt-3 text-white">
						{#if newsletter.createdAt}
							<span class="text-sm flex items-center gap-1">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Created: {formatDateTimeUK(newsletter.createdAt)}
							</span>
						{/if}
						{#if newsletter.updatedAt && newsletter.updatedAt !== newsletter.createdAt}
							<span class="text-sm flex items-center gap-1">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								Updated: {formatDateTimeUK(newsletter.updatedAt)}
							</span>
						{/if}
					</div>
				</div>
				<div class="flex flex-col items-end gap-2">
					<span class="px-3 py-1 rounded-full text-sm font-semibold border-2 bg-white/20 text-white border-white/30">
						{newsletter.status ? newsletter.status.charAt(0).toUpperCase() + newsletter.status.slice(1) : 'Draft'}
					</span>
					{#if newsletter.logs && newsletter.logs.length > 0}
						<span class="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white border border-white/30">
							{newsletter.logs.length} {newsletter.logs.length === 1 ? 'send' : 'sends'}
						</span>
					{/if}
				</div>
			</div>
			<div class="flex gap-2 mt-4 justify-between">
				<div class="flex gap-2">
					{#if editing}
						<button
							type="submit"
							form="newsletter-form"
							class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition-colors font-medium border border-green-500/50 flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							Save Changes
						</button>
						<button
							type="button"
							on:click={() => showSaveTemplateModal = true}
							class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md transition-colors font-medium border border-purple-500/50 flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
							</svg>
							Save as Template
						</button>
					{:else}
						<button
							type="button"
							on:click|preventDefault={() => editing = true}
							class="bg-yellow-500/80 hover:bg-yellow-600/90 text-white px-4 py-2 rounded-md transition-colors font-medium border border-yellow-400/50 flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
							Edit
						</button>
						<a href="/hub/newsletters/{newsletter.id}/preview" class="bg-indigo-500/80 hover:bg-indigo-600/90 text-white px-4 py-2 rounded-md transition-colors font-medium border border-indigo-400/50 flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
							</svg>
							Preview
						</a>
						<a href="/hub/newsletters/{newsletter.id}/export-pdf" target="_blank" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors font-medium border border-red-500/50 flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							Export PDF
						</a>
						<a href="/hub/newsletters/{newsletter.id}/send" class="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-md transition-colors font-medium border border-white/30 flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
							Send
						</a>
					{/if}
				</div>
				<div class="flex gap-2">
					{#if editing}
						<button
							type="button"
							on:click={() => editing = false}
							class="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-md transition-colors font-medium border border-white/30 flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
							Back
						</button>
					{/if}
					<button
						type="button"
						on:click={handleDelete}
						class="bg-red-500/80 hover:bg-red-600/90 text-white px-4 py-2 rounded-md transition-colors font-medium border border-red-400/50 flex items-center gap-2"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
						</svg>
						Delete
					</button>
				</div>
			</div>
		</div>

		<div class="bg-white shadow rounded-lg p-6">

		{#if editing}
			<form id="newsletter-form" method="POST" action="?/update" use:enhance={handleEnhance}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-1">Load Template (optional)</label>
					<select
						bind:value={selectedTemplateId}
						on:change={handleTemplateChange}
						class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4"
					>
						<option value="">-- Select a template --</option>
						{#each templates as template}
							<option value={template.id}>{template.name}</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-gray-500">Selecting a template will load its content into the form (this will replace current content)</p>
				</div>
				<FormField label="Subject" name="subject" bind:value={formData.subject} required />
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-1">HTML Content</label>
					<HtmlEditor bind:value={htmlContent} name="htmlContent" showPlaceholders={true} showImagePicker={true} />
				</div>
			</form>
		{:else}
			<!-- Info Cards Grid -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
				<!-- Status Card -->
				<div class="bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-400 rounded-lg p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs font-medium text-white uppercase tracking-wide mb-1">Status</p>
							<span class="px-3 py-1 rounded-full text-sm font-semibold border-2 {newsletter.status === 'sent' ? 'bg-green-100 text-green-800 border-green-300' : newsletter.status === 'scheduled' ? 'bg-white/20 text-white border-white/30' : 'bg-gray-100 text-gray-800 border-gray-300'}">
								{newsletter.status ? newsletter.status.charAt(0).toUpperCase() + newsletter.status.slice(1) : 'Draft'}
							</span>
						</div>
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
				</div>

				<!-- Stats Card -->
				<div class="bg-gradient-to-br from-green-500 to-green-600 border-2 border-green-400 rounded-lg p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs font-medium text-white uppercase tracking-wide mb-1">Sends</p>
							<p class="text-2xl font-bold text-white">
								{newsletter.logs?.length || 0}
							</p>
						</div>
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
					</div>
				</div>

				<!-- Date Card -->
				<div class="bg-gradient-to-br from-purple-500 to-purple-600 border-2 border-purple-400 rounded-lg p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-xs font-medium text-white uppercase tracking-wide mb-1">Created</p>
							<p class="text-sm font-semibold text-white">
								{#if newsletter.createdAt}
									{formatDateTimeUK(newsletter.createdAt)}
								{:else}
									Unknown
								{/if}
							</p>
						</div>
						<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
				</div>
			</div>

			<!-- Subject Card -->
			<div class="bg-white border-2 border-gray-200 rounded-lg p-5 mb-6">
				<div class="flex items-start gap-3">
					<div class="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
						</svg>
					</div>
					<div class="flex-1">
						<p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Subject Line</p>
						<p class="text-lg font-semibold text-gray-900">{newsletter.subject || 'Untitled Newsletter'}</p>
					</div>
				</div>
			</div>

			<!-- Content Preview Card -->
			{#if newsletter.htmlContent}
				<div class="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
					<div class="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-6 py-4">
						<div class="flex items-center justify-between">
							<h3 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
								<svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								Content Preview
							</h3>
							<a href="/hub/newsletters/{newsletter.id}/preview" class="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
								Full Preview
							</a>
						</div>
					</div>
					<div class="p-6 bg-gray-50">
						<div class="max-w-2xl mx-auto bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
							<div class="newsletter-preview p-6 max-h-96 overflow-y-auto">{@html newsletter.htmlContent}</div>
						</div>
					</div>
				</div>
			{/if}
		{/if}

		{#if formResult?.success && formResult?.templateId}
			{(() => {
				notifications.success(`Template saved successfully! View it <a href="/hub/newsletters/templates/${formResult.templateId}" class="underline">here</a>`, 8000);
				return '';
			})()}
		{/if}
		</div>
	</div>
{/if}

<!-- Save as Template Modal -->
{#if showSaveTemplateModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
		<div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
			<h3 class="text-xl font-bold text-gray-900 mb-4">Save as Template</h3>
			<div class="mb-4">
				<label class="block text-sm font-medium text-gray-700 mb-1">Template Name *</label>
				<input
					type="text"
					bind:value={templateName}
					class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4"
					placeholder="Enter template name"
				/>
			</div>
			<div class="mb-4">
				<label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
				<textarea
					bind:value={templateDescription}
					rows="3"
					class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4"
					placeholder="Optional description"
				></textarea>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					type="button"
					on:click={() => { showSaveTemplateModal = false; templateName = ''; templateDescription = ''; }}
					class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
				>
					Cancel
				</button>
				<button
					type="button"
					on:click={handleSaveAsTemplate}
					class="bg-brand-green text-white px-4 py-2 rounded-md hover:bg-primary-dark"
				>
					Save Template
				</button>
			</div>
		</div>
	</div>
{/if}

