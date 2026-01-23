<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidateAll, goto } from '$app/navigation';
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
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			if (formResult?.templateId) {
				notifications.success(`Template saved successfully! View it <a href="/hub/emails/templates/${formResult.templateId}" class="underline">here</a>`, 8000);
			} else {
				notifications.success('Email updated successfully');
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}
	
	// Show notification when coming from create action (only once)
	let hasShownCreatedNotification = false;
	$: if (urlParams.get('created') === 'true' && !hasShownCreatedNotification) {
		hasShownCreatedNotification = true;
				notifications.success('Email created successfully!');
		// Remove the parameter from URL without reload
		if (typeof window !== 'undefined') {
			const url = new URL(window.location.href);
			url.searchParams.delete('created');
			window.history.replaceState({}, '', url);
		}
	}

	let editing = true;
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
			'Are you sure you want to delete this email? This action cannot be undone.',
			'Delete Email'
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
		<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 shadow-lg rounded-lg p-6 text-white">
			<div class="flex justify-between items-start mb-4">
				<div class="flex-1">
					<h1 class="text-3xl font-bold mb-2 text-white">{newsletter.subject || 'Untitled Email'}</h1>
				</div>
				<div class="flex flex-col items-end gap-2">
					<a href="/hub/emails/{newsletter.id}/send" class="bg-hub-blue-500 hover:bg-hub-blue-600 text-white px-4 py-2.5 rounded-md transition-colors text-base font-semibold shadow-md flex items-center gap-1.5">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
						Send
					</a>
				</div>
			</div>
			<div class="flex flex-col sm:flex-row gap-2 mt-4 sm:justify-between">
				<div class="flex flex-wrap gap-2">
					<button
						type="submit"
						form="newsletter-form"
						class="bg-hub-green-600 hover:bg-hub-green-700 text-white px-2.5 py-1.5.5 sm:px-4 sm:py-2 rounded-md transition-colors text-xs font-semibold shadow-md flex items-center gap-1.5"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
						<span class="hidden sm:inline">Save Changes</span>
						<span class="sm:hidden">Save</span>
					</button>
					<button
						type="button"
						on:click={() => showSaveTemplateModal = true}
						class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5.5 sm:px-4 sm:py-2 rounded-md transition-colors text-xs font-semibold shadow-md flex items-center gap-1.5"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
						</svg>
						<span class="hidden sm:inline">Save as Template</span>
						<span class="sm:hidden">Template</span>
					</button>
					<a href="/hub/emails/{newsletter.id}/preview" class="bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5.5 sm:px-4 sm:py-2 rounded-md transition-colors text-xs font-semibold shadow-md flex items-center gap-1.5">
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
						</svg>
						Preview
					</a>
					<a href="/hub/emails/{newsletter.id}/export-pdf" target="_blank" class="bg-orange-600 hover:bg-orange-700 text-white px-2.5 py-1.5.5 sm:px-4 sm:py-2 rounded-md transition-colors text-xs font-semibold shadow-md flex items-center gap-1.5">
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						<span class="hidden sm:inline">Export PDF</span>
						<span class="sm:hidden">PDF</span>
					</a>
				</div>
				<div class="flex gap-2">
					<button
						type="button"
						on:click={() => goto('/hub/emails')}
						class="bg-gray-600 hover:bg-gray-700 text-white px-2.5 py-1.5.5 sm:px-4 sm:py-2 rounded-md transition-colors text-xs font-semibold shadow-md flex items-center gap-1.5"
					>
						<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
						</svg>
						Back
					</button>
					<button
						type="button"
						on:click={handleDelete}
						class="bg-hub-red-600 hover:bg-hub-red-700 text-white px-2.5 py-1.5.5 sm:px-4 sm:py-2 rounded-md transition-colors text-xs font-semibold shadow-md flex items-center gap-1.5"
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
			<form id="newsletter-form" method="POST" action="?/update" use:enhance={handleEnhance}>
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
					<p class="mt-1 text-xs text-gray-500">Selecting a template will load its content into the form (this will replace current content)</p>
				</div>
				<FormField label="Subject" name="subject" bind:value={formData.subject} required />
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-1">HTML Content</label>
					<HtmlEditor bind:value={htmlContent} name="htmlContent" showPlaceholders={true} showImagePicker={true} />
				</div>
			</form>

		{#if formResult?.success && formResult?.templateId}
			{(() => {
				notifications.success(`Template saved successfully! View it <a href="/hub/emails/templates/${formResult.templateId}" class="underline">here</a>`, 8000);
				return '';
			})()}
		{/if}
		</div>
	</div>
{/if}

<style>
	/* Ensure consistent text color in email preview unless explicitly set in editor */
	:global(.newsletter-preview) {
		color: #1f2937; /* gray-800 - consistent default color */
	}
	
	:global(.newsletter-preview p) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview span) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview div) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview li) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview td) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview th) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview h1) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview h2) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview h3) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview h4) {
		color: #1f2937;
	}
</style>

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
					class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4"
					placeholder="Enter template name"
				/>
			</div>
			<div class="mb-4">
				<label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
				<textarea
					bind:value={templateDescription}
					rows="3"
					class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4"
					placeholder="Optional description"
				></textarea>
			</div>
			<div class="flex gap-2 justify-end">
				<button
					type="button"
					on:click={() => { showSaveTemplateModal = false; templateName = ''; templateDescription = ''; }}
					class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700"
				>
					Back
				</button>
				<button
					type="button"
					on:click={handleSaveAsTemplate}
					class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700"
				>
					Save Template
				</button>
			</div>
		</div>
	</div>
{/if}

