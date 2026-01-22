<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import Table from '$lib/crm/components/Table.svelte';
	import { goto } from '$app/navigation';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	let tableContainer;

	$: form = $page.data?.form;
	$: registers = $page.data?.registers || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: canDelete = $page.data?.canDelete ?? false;
	
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
					if (browser && typeof window !== 'undefined') {
						window.location.reload();
					}
				}, 500);
			} else {
				notifications.success('Form updated successfully');
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	let editing = false;
	let formData = {
		name: form?.name || '',
		description: form?.description || '',
		isSafeguarding: form?.isSafeguarding || false
	};

	let fields = form?.fields || [];
	let editingField = null;
	let fieldForm = {
		type: 'text',
		label: '',
		name: '',
		required: false,
		placeholder: '',
		options: []
	};

	$: if (form) {
		formData = {
			name: form.name || '',
			description: form.description || '',
			isSafeguarding: form.isSafeguarding || false
		};
		fields = form.fields || [];
	}

	const fieldTypes = [
		{ value: 'text', label: 'Text' },
		{ value: 'email', label: 'Email' },
		{ value: 'tel', label: 'Phone' },
		{ value: 'date', label: 'Date' },
		{ value: 'number', label: 'Number' },
		{ value: 'textarea', label: 'Textarea' },
		{ value: 'select', label: 'Select' },
		{ value: 'checkbox', label: 'Checkbox' },
		{ value: 'radio', label: 'Radio' }
	];

	async function addField() {
		if (!fieldForm.label || !fieldForm.name) {
			await dialog.alert('Field label and name are required', 'Validation Error');
			return;
		}

		const field = {
			id: Date.now().toString(),
			type: fieldForm.type,
			label: fieldForm.label,
			name: fieldForm.name,
			required: fieldForm.required,
			placeholder: fieldForm.placeholder || '',
			options: fieldForm.type === 'select' || fieldForm.type === 'radio' || fieldForm.type === 'checkbox' 
				? fieldForm.options.filter(o => o.trim()) 
				: []
		};

		if (editingField !== null) {
			fields[editingField] = field;
			editingField = null;
		} else {
			fields = [...fields, field];
		}

		fieldForm = {
			type: 'text',
			label: '',
			name: '',
			required: false,
			placeholder: '',
			options: []
		};
	}

	function editField(index) {
		editingField = index;
		fieldForm = { ...fields[index] };
	}

	function removeField(index) {
		fields = fields.filter((_, i) => i !== index);
	}

	function moveField(index, direction) {
		if (direction === 'up' && index > 0) {
			[fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
		} else if (direction === 'down' && index < fields.length - 1) {
			[fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
		}
		fields = [...fields];
	}

	let optionInput = '';
	function addOption() {
		if (optionInput.trim()) {
			fieldForm.options = [...fieldForm.options, optionInput.trim()];
			optionInput = '';
		}
	}

	function removeOption(index) {
		fieldForm.options = fieldForm.options.filter((_, i) => i !== index);
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

	// Handle delete button clicks in the table
	let clickHandler = null;
	
	$: if (tableContainer && canDelete && !clickHandler) {
		// Add handler
		clickHandler = (e) => {
			const deleteButton = e.target.closest('[data-delete-submission]');
			if (deleteButton) {
				e.preventDefault();
				e.stopPropagation();
				const submissionId = deleteButton.getAttribute('data-delete-submission');
				handleDeleteSubmission(submissionId);
			}
		};
		
		tableContainer.addEventListener('click', clickHandler);
	}
	
	$: if (tableContainer && !canDelete && clickHandler) {
		// Remove handler when canDelete becomes false
		tableContainer.removeEventListener('click', clickHandler);
		clickHandler = null;
	}
	
	onMount(() => {
		return () => {
			// Cleanup on unmount
			if (tableContainer && clickHandler) {
				tableContainer.removeEventListener('click', clickHandler);
			}
		};
	});

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this form? All submissions will also be deleted.', 'Delete Form');
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

	async function handleExport() {
		try {
			const response = await fetch(`/hub/forms/${form.id}/export`);
			if (!response.ok) {
				const error = await response.json();
				notifications.error(error.error || 'Failed to export form');
				return;
			}
			
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `form-${form.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
			notifications.success('Form exported successfully');
		} catch (error) {
			console.error('Export error:', error);
			notifications.error('Failed to export form');
		}
	}

	$: registerColumns = [
		{ 
			key: 'submittedAt', 
			label: 'Submitted',
			render: (val) => val ? formatDateTimeUK(val) : ''
		},
		{ 
			key: 'data', 
			label: 'Preview',
			render: (val) => {
				if (!val || typeof val !== 'object') return '-';
				const keys = Object.keys(val);
				return keys.length > 0 ? `${keys[0]}: ${String(val[keys[0]]).substring(0, 30)}...` : '-';
			}
		},
		// Add actions column if user can delete
		...(canDelete ? [{
			key: 'actions',
			label: '',
			render: (val, row) => {
				return `<button 
					class="text-red-600 hover:text-red-800 font-bold text-lg w-6 h-6 flex items-center justify-center"
					data-delete-submission="${row.id}"
					type="button"
					title="Delete submission"
				>×</button>`;
			}
		}] : [])
	];
</script>

{#if form}
	<div class="bg-white shadow rounded-lg p-6 mb-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Form Details</h2>
			<div class="flex flex-wrap gap-2">
				{#if editing}
					<button
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs"
					>
						Back
					</button>
				{:else}
					<a href="/forms/{form.id}" target="_blank" class="bg-hub-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-blue-700 text-xs">
						<span class="hidden sm:inline">View Public Form</span>
						<span class="sm:hidden">View Form</span>
					</a>
					<button
						on:click={handleExport}
						class="bg-hub-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-blue-700 text-xs"
					>
						Export
					</button>
					<button
						on:click={() => editing = true}
						class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs"
					>
						Edit
					</button>
					<button
						on:click={handleDelete}
						class="bg-hub-red-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-red-700 text-xs"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form method="POST" action="?/update" use:enhance>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="fields" value={JSON.stringify(fields)} />
				
				<FormField label="Form Name" name="name" bind:value={formData.name} required />
				<FormField label="Description" name="description" type="textarea" rows="3" bind:value={formData.description} />
				<div class="mb-4">
					<label class="flex items-center">
						<input type="checkbox" name="isSafeguarding" bind:checked={formData.isSafeguarding} class="mr-2" />
						<span class="text-sm font-medium text-gray-700">Safeguarding Form</span>
					</label>
				</div>

				<h3 class="text-lg font-semibold text-gray-900 mb-4 mt-6">Form Fields</h3>
				
				{#if fields.length > 0}
					<div class="mb-4 space-y-2">
						{#each fields as field, i}
							<div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
								<div class="flex-1">
									<span class="font-medium">{field.label}</span>
									<span class="text-sm text-gray-500 ml-2">({field.type})</span>
									{#if field.required}<span class="text-hub-red-500 ml-2">*</span>{/if}
								</div>
								<div class="flex gap-2">
									<button type="button" on:click={() => moveField(i, 'up')} disabled={i === 0} class="text-gray-600 hover:text-gray-900 disabled:opacity-50">↑</button>
									<button type="button" on:click={() => moveField(i, 'down')} disabled={i === fields.length - 1} class="text-gray-600 hover:text-gray-900 disabled:opacity-50">↓</button>
									<button type="button" on:click={() => editField(i)} class="text-hub-blue-600 hover:text-hub-blue-900">Edit</button>
									<button type="button" on:click={() => removeField(i)} class="text-hub-red-600 hover:text-hub-red-900">Remove</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<div class="border border-gray-200 rounded-lg p-4 mb-4">
					<h4 class="font-medium text-gray-900 mb-4">{editingField !== null ? 'Edit Field' : 'Add Field'}</h4>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Field Type</label>
							<select bind:value={fieldForm.type} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4">
								{#each fieldTypes as type}
									<option value={type.value}>{type.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Field Label</label>
							<input type="text" bind:value={fieldForm.label} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
							<input type="text" bind:value={fieldForm.name} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4" />
						</div>
						<div>
							<label class="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
							<input type="text" bind:value={fieldForm.placeholder} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4" />
						</div>
					</div>
					<div class="mt-4">
						<label class="flex items-center">
							<input type="checkbox" bind:checked={fieldForm.required} class="mr-2" />
							<span class="text-sm font-medium text-gray-700">Required</span>
						</label>
					</div>
					
					{#if fieldForm.type === 'select' || fieldForm.type === 'radio' || fieldForm.type === 'checkbox'}
						<div class="mt-4">
							<label class="block text-sm font-medium text-gray-700 mb-1">Options</label>
							<div class="flex gap-2 mb-2">
								<input
									type="text"
									bind:value={optionInput}
									placeholder="Add option"
									class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500"
									on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
								/>
								<button type="button" on:click={addOption} class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700">
									Add
								</button>
							</div>
							<div class="flex flex-wrap gap-2">
								{#each fieldForm.options as option, i}
									<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800">
										{option}
										<button type="button" on:click={() => removeOption(i)} class="ml-2 text-gray-600 hover:text-gray-800">×</button>
									</span>
								{/each}
							</div>
						</div>
					{/if}
					
					<button type="button" on:click={addField} class="mt-4 bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700">
						{editingField !== null ? 'Update Field' : 'Add Field'}
					</button>
					{#if editingField !== null}
						<button type="button" on:click={() => { editingField = null; fieldForm = { type: 'text', label: '', name: '', required: false, placeholder: '', options: [] }; }} class="mt-4 ml-2 bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700">
							Back
						</button>
					{/if}
				</div>

				<button type="submit" class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700">
					Save Changes
				</button>
			</form>
		{:else}
			<dl class="grid grid-cols-1 gap-4">
				<div>
					<dt class="text-sm font-medium text-gray-500">Name</dt>
					<dd class="mt-1 text-sm text-gray-900">{form.name}</dd>
				</div>
				{#if form.description}
					<div>
						<dt class="text-sm font-medium text-gray-500">Description</dt>
						<dd class="mt-1 text-sm text-gray-900">{form.description}</dd>
					</div>
				{/if}
				<div>
					<dt class="text-sm font-medium text-gray-500">Safeguarding</dt>
					<dd class="mt-1 text-sm text-gray-900">{form.isSafeguarding ? 'Yes' : 'No'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Fields</dt>
					<dd class="mt-1 text-sm text-gray-900">{form.fields?.length || 0}</dd>
				</div>
			</dl>
		{/if}

	</div>

	<div class="bg-white shadow rounded-lg p-6">
		<h3 class="text-xl font-bold text-gray-900 mb-4">Form Submissions ({registers.length})</h3>
		<div bind:this={tableContainer}>
			<Table columns={registerColumns} rows={registers} onRowClick={(row) => goto(`/hub/forms/${form.id}/submissions/${row.id}`)} />
		</div>
	</div>
{/if}

