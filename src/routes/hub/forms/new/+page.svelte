<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Show notifications from form results
	$: if (formResult?.success) {
		notifications.success('Form created successfully');
	}
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let formData = {
		name: '',
		description: '',
		isSafeguarding: false
	};

	let fields = [];
	let editingField = null;
	let fieldForm = {
		type: 'text',
		label: '',
		name: '',
		required: false,
		placeholder: '',
		options: [] // For select, radio, checkbox
	};

	const fieldTypes = [
		{ value: 'text', label: 'Text' },
		{ value: 'email', label: 'Email' },
		{ value: 'tel', label: 'Phone' },
		{ value: 'date', label: 'Date' },
		{ value: 'number', label: 'Number' },
		{ value: 'textarea', label: 'Textarea' },
		{ value: 'select', label: 'Select (Dropdown)' },
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

		// Reset form
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
		fields = [...fields]; // Trigger reactivity
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
</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="flex justify-between items-center mb-6">
		<h2 class="text-2xl font-bold text-gray-900">New Form</h2>
		<div class="flex gap-2">
			<a href="/hub/forms" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
				Cancel
			</a>
			<button type="submit" form="form-create-form" disabled={fields.length === 0} class="bg-hub-green-600 text-white px-4 py-2 rounded-md hover:bg-hub-green-700 disabled:opacity-50">
				Create Form
			</button>
		</div>
	</div>

	<form id="form-create-form" method="POST" action="?/create" use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="fields" value={JSON.stringify(fields)} />
		
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Form Details</h3>
		<FormField label="Form Name" name="name" bind:value={formData.name} required />
		<FormField label="Description" name="description" type="textarea" rows="3" bind:value={formData.description} />
		<div class="mb-4">
			<label class="flex items-center">
				<input type="checkbox" bind:checked={formData.isSafeguarding} class="mr-2" />
				<span class="text-sm font-medium text-gray-700">Safeguarding Form (requires encryption)</span>
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
							{#if field.required}
								<span class="text-hub-red-500 ml-2">*</span>
							{/if}
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
					<label class="block text-sm font-medium text-gray-700 mb-1">Field Name (ID)</label>
					<input type="text" bind:value={fieldForm.name} placeholder="e.g. child_name" class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4" />
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
							class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4"
							on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
						/>
						<button type="button" on:click={addOption} class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
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
			
			<button type="button" on:click={addField} class="mt-4 bg-hub-green-600 text-white px-4 py-2 rounded-md hover:bg-hub-green-700">
				{editingField !== null ? 'Update Field' : 'Add Field'}
			</button>
			{#if editingField !== null}
				<button type="button" on:click={() => { editingField = null; fieldForm = { type: 'text', label: '', name: '', required: false, placeholder: '', options: [] }; }} class="mt-4 ml-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
					Cancel
				</button>
			{/if}
		</div>
	</form>

</div>

