<script>
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import Table from '$lib/crm/components/Table.svelte';
	import Pager from '$lib/crm/components/Pager.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: data = $page.data || {};
	$: forms = data.forms || [];
	$: latestSubmissions = data.latestSubmissions || [];
	$: currentPage = data.currentPage || 1;
	$: totalPages = data.totalPages || 1;
	$: search = data.search || '';
	$: canDelete = data.canDelete ?? false;
	$: hasMembershipForm = data.hasMembershipForm ?? false;
	$: csrfToken = data.csrfToken || '';
	$: formResult = $page.form;

	let searchInput = search;

	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult && browser) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			if (formResult?.type === 'deleteSubmission') {
				notifications.success('Submission deleted successfully');
				// Reload page to refresh the list
				setTimeout(() => {
					if (browser) {
						invalidateAll();
					}
				}, 500);
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	async function handleDeleteSubmission(submissionId) {
		const confirmed = await dialog.confirm(
			'Are you sure you want to delete this submission? This action cannot be undone and the data will be permanently removed.',
			'Delete Submission'
		);
		if (confirmed) {
			const formEl = document.createElement('form');
			formEl.method = 'POST';
			formEl.action = '?/deleteSubmission';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			formEl.appendChild(csrfInput);
			
			const submissionIdInput = document.createElement('input');
			submissionIdInput.type = 'hidden';
			submissionIdInput.name = 'submissionId';
			submissionIdInput.value = submissionId;
			formEl.appendChild(submissionIdInput);
			
			document.body.appendChild(formEl);
			formEl.submit();
		}
	}

	function handleSearch() {
		const params = new URLSearchParams();
		if (searchInput) {
			params.set('search', searchInput);
		}
		params.set('page', '1');
		goto(`/hub/forms?${params.toString()}`);
	}

	function handlePageChange(page) {
		const params = new URLSearchParams();
		if (search) {
			params.set('search', search);
		}
		params.set('page', page.toString());
		goto(`/hub/forms?${params.toString()}`);
	}

	async function handleExportAll() {
		try {
			const response = await fetch('/hub/forms/export');
			if (!response.ok) {
				const error = await response.json();
				notifications.error(error.error || 'Failed to export forms');
				return;
			}
			
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'forms-export.json';
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
			notifications.success('Forms exported successfully');
		} catch (error) {
			console.error('Export error:', error);
			notifications.error('Failed to export forms');
		}
	}

	async function handleImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = async (e) => {
			const file = e.target.files?.[0];
			if (!file) return;

			try {
				const formData = new FormData();
				formData.append('file', file);
				formData.append('_csrf', csrfToken);

				const response = await fetch('/hub/forms/import', {
					method: 'POST',
					body: formData
				});

				const result = await response.json();

				if (!response.ok) {
					notifications.error(result.error || 'Failed to import forms');
					if (result.details) {
						console.error('Import errors:', result.details);
					}
					return;
				}

				if (result.failed > 0) {
					notifications.warning(
						`Imported ${result.imported} form(s), ${result.failed} failed. Check console for details.`
					);
					console.log('Import results:', result.results);
				} else {
					notifications.success(`Successfully imported ${result.imported} form(s)`);
				}

				// Reload the page to show the new forms
				setTimeout(() => {
					if (browser) {
						invalidateAll();
					}
				}, 500);
			} catch (error) {
				console.error('Import error:', error);
				notifications.error('Failed to import forms');
			}
		};
		input.click();
	}

	const columns = [
		{ key: 'name', label: 'Name' },
		{ 
			key: 'description', 
			label: 'Description',
			render: (val) => val ? (val.length > 50 ? val.substring(0, 50) + '...' : val) : ''
		},
		{ 
			key: 'fields', 
			label: 'Fields',
			render: (val) => Array.isArray(val) ? val.length : 0
		},
		{ 
			key: 'isSafeguarding', 
			label: 'Safeguarding',
			render: (val) => val ? 'Yes' : 'No'
		},
		{ 
			key: 'createdAt', 
			label: 'Created',
			render: (val) => val ? formatDateUK(val) : ''
		}
	];
	/** Mobile view: only form name */
	const mobileColumns = [
		{ key: 'name', label: 'Form', render: (val) => val || '—' }
	];
</script>

<div class="mb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
	<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Forms</h2>
	<div class="flex flex-wrap gap-2">
		<button
			on:click={handleImport}
			class="btn-theme-1 px-2.5 py-1.5 rounded-md text-xs"
		>
			Import
		</button>
		<button
			on:click={handleExportAll}
			class="btn-theme-1 px-2.5 py-1.5 rounded-md text-xs"
		>
			Export All
		</button>
		{#if !hasMembershipForm}
			<form method="POST" action="?/createMembershipForm" class="inline">
				<input type="hidden" name="_csrf" value={csrfToken} />
				<button
					type="submit"
					class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-md text-xs"
				>
					Create Membership Form
				</button>
			</form>
		{/if}
		<a href="/hub/forms/new" class="btn-theme-2 px-2.5 py-1.5 rounded-md text-xs">
			New Form
		</a>
	</div>
</div>

<div class="mb-4">
	<form on:submit|preventDefault={handleSearch} class="flex gap-2">
		<input
			type="text"
			bind:value={searchInput}
			placeholder="Search forms..."
			class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-4"
		/>
		<button type="submit" class="btn-theme-3 px-2.5 py-1.5 rounded-md text-xs">
			Search
		</button>
	</form>
</div>

<Table {columns} {mobileColumns} rows={forms} emptyMessage="No forms yet. Create your first form above." onRowClick={(row) => goto(`/hub/forms/${row.id}`)} />

<Pager {currentPage} {totalPages} onPageChange={handlePageChange} />

<!-- Latest Form Submissions: tighter spacing on mobile -->
<div class="mt-4 md:mt-8 bg-white shadow rounded-lg p-4 md:p-6">
	<div class="flex justify-between items-center mb-3 md:mb-4">
		<h3 class="text-base md:text-lg font-semibold text-gray-900">Latest Form Submissions</h3>
	</div>
	{#if latestSubmissions.length === 0}
		<p class="text-sm text-gray-500">No form submissions yet</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-3 py-2 md:px-[18px] md:py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Form</th>
						<th class="px-3 py-2 md:px-[18px] md:py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
						<th class="px-3 py-2 md:px-[18px] md:py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</th>
						{#if canDelete}
							<th class="px-3 py-2 md:px-[18px] md:py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-14 md:w-20"></th>
						{/if}
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each latestSubmissions as submission}
						<tr 
							class="hover:bg-gray-50 cursor-pointer"
							on:click={(e) => {
								// Don't trigger row click if clicking on delete button
								if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
									goto(`/hub/forms/${submission.formId}/submissions/${submission.id}`);
								}
							}}
						>
							<td class="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
								{submission.formName}
							</td>
							<td class="px-3 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
								{submission.submittedAt ? formatDateTimeUK(submission.submittedAt) : '-'}
							</td>
							<td class="px-3 py-2 md:px-6 md:py-4 text-sm text-gray-500">
								{#if submission.encryptedData}
									<span class="text-hub-yellow-600 font-medium">🔒 Encrypted (Safeguarding)</span>
								{:else if submission.data && typeof submission.data === 'object'}
									{@const keys = Object.keys(submission.data)}
									{#if keys.length > 0}
										{@const firstKey = keys[0]}
										{@const firstValue = String(submission.data[firstKey])}
										{firstKey}: {firstValue.length > 50 ? firstValue.substring(0, 50) + '...' : firstValue}
									{:else}
										-
									{/if}
								{:else}
									-
								{/if}
							</td>
							{#if canDelete}
								<td class="px-2 py-2 md:px-6 md:py-4 whitespace-nowrap text-sm text-gray-500">
									<button
										class="text-red-600 hover:text-red-800 font-bold text-lg w-6 h-6 flex items-center justify-center"
										data-delete-submission={submission.id}
										type="button"
										title="Delete submission"
										on:click|stopPropagation={() => handleDeleteSubmission(submission.id)}
									>×</button>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

