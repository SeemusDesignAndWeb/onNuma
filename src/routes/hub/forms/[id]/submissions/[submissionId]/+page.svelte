<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: form = $page.data?.form;
	$: register = $page.data?.register;
	$: data = $page.data?.data || {};
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: isArchived = register?.archived || false;
	$: canDelete = $page.data?.canDelete || false;

	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			if (formResult?.archived) {
				notifications.success('Submission archived successfully');
				// Redirect back to form after a short delay
				setTimeout(() => {
					goto(`/hub/forms/${form.id}`);
				}, 1000);
			} else if (formResult?.deleted) {
				notifications.success('Submission deleted successfully');
			} else {
				notifications.success('Submission unarchived successfully');
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	async function handleArchive() {
		const confirmed = await dialog.confirm(
			'Are you sure you want to archive this submission? It will be hidden from view but still available on the server.',
			'Archive Submission'
		);
		if (confirmed) {
			const formEl = document.createElement('form');
			formEl.method = 'POST';
			formEl.action = '?/archive';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			formEl.appendChild(csrfInput);
			
			document.body.appendChild(formEl);
			formEl.submit();
		}
	}

	async function handleUnarchive() {
		const confirmed = await dialog.confirm(
			'Are you sure you want to unarchive this submission? It will be visible again in the submissions list.',
			'Unarchive Submission'
		);
		if (confirmed) {
			const formEl = document.createElement('form');
			formEl.method = 'POST';
			formEl.action = '?/unarchive';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			formEl.appendChild(csrfInput);
			
			document.body.appendChild(formEl);
			formEl.submit();
		}
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm(
			'Are you sure you want to delete this submission? This action cannot be undone and the data will be permanently removed.',
			'Delete Submission'
		);
		if (confirmed) {
			const formEl = document.createElement('form');
			formEl.method = 'POST';
			formEl.action = '?/delete';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			formEl.appendChild(csrfInput);
			
			document.body.appendChild(formEl);
			formEl.submit();
		}
	}
</script>

{#if form && register}
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<h2 class="text-2xl font-bold text-gray-900">Form Submission</h2>
			<div class="flex flex-wrap gap-2 items-center">
				<a href="/hub/forms/{form.id}" class="text-sm font-medium text-hub-green-600 hover:text-hub-green-800 hover:underline">
					← Back to Form
				</a>
				{#if isArchived}
					<button
						on:click={handleUnarchive}
						class="hub-btn bg-theme-button-2 text-white"
					>
						Unarchive
					</button>
				{:else}
					<button
						on:click={handleArchive}
						class="hub-btn bg-theme-button-3 text-white"
					>
						Archive
					</button>
				{/if}
				{#if canDelete}
					<button
						on:click={handleDelete}
						class="hub-btn bg-hub-red-600 text-white hover:bg-hub-red-700"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		<div class="mb-6">
			<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<dt class="text-sm font-medium text-gray-500">Form</dt>
					<dd class="mt-1 text-sm text-gray-900">{form.name}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Submitted</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{register.submittedAt ? formatDateTimeUK(register.submittedAt) : '-'}
					</dd>
				</div>
				{#if isArchived}
					<div class="sm:col-span-2">
						<div class="bg-gray-50 border border-gray-200 rounded-md p-3">
							<p class="text-sm text-gray-800">
								<strong>📦 Archived:</strong> This submission is archived and hidden from the main submissions list.
							</p>
						</div>
					</div>
				{/if}
				{#if form.isSafeguarding}
					<div class="sm:col-span-2">
						<div class="bg-hub-yellow-50 border border-hub-yellow-200 rounded-md p-3">
							<p class="text-sm text-hub-yellow-800">
								<strong>⚠️ Safeguarding Form:</strong> This submission is encrypted for security.
							</p>
						</div>
					</div>
				{/if}
			</dl>
		</div>

		<div>
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Submission Data</h3>
			<dl class="grid grid-cols-1 gap-4">
				{#each form.fields as field}
					<div>
						<dt class="text-sm font-medium text-gray-500">{field.label}</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{#if data[field.name] !== undefined && data[field.name] !== null && data[field.name] !== ''}
								{#if Array.isArray(data[field.name])}
									{data[field.name].join(', ')}
								{:else}
									{String(data[field.name])}
								{/if}
							{:else}
								<span class="text-gray-400">-</span>
							{/if}
						</dd>
					</div>
				{/each}
			</dl>
		</div>
	</div>
{/if}

