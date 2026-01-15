<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: uploadResult = $page.form;
	
	// Show notifications from form results
	$: if (uploadResult?.error) {
		notifications.error(uploadResult.error);
	}

	let step = 'upload'; // 'upload', 'map', 'preview', 'complete'
	let fileText = ''; // For CSV files
	let fileData = ''; // Base64 for Excel files
	let fileType = 'csv'; // 'csv' or 'excel'
	let csvHeaders = [];
	let csvRows = [];
	let totalRows = 0;
	let fieldMapping = {};
	let importResults = null;

	const contactFields = [
		{ value: 'skip', label: 'Skip this column' },
		{ value: 'email', label: 'Email *' },
		{ value: 'firstName', label: 'First Name' },
		{ value: 'lastName', label: 'Last Name' },
		{ value: 'phone', label: 'Phone' },
		{ value: 'addressLine1', label: 'Address Line 1' },
		{ value: 'addressLine2', label: 'Address Line 2' },
		{ value: 'city', label: 'City' },
		{ value: 'county', label: 'County' },
		{ value: 'postcode', label: 'Postcode' },
		{ value: 'country', label: 'Country' },
		{ value: 'membershipStatus', label: 'Membership Status' },
		{ value: 'dateJoined', label: 'Date Joined' },
		{ value: 'baptismDate', label: 'Baptism Date' },
		{ value: 'servingAreas', label: 'Serving Areas (comma-separated)' },
		{ value: 'giftings', label: 'Giftings (comma-separated)' },
		{ value: 'notes', label: 'Notes' }
	];

	$: if (uploadResult?.success) {
		csvHeaders = uploadResult.headers || [];
		csvRows = uploadResult.rows || [];
		totalRows = uploadResult.totalRows || 0;
		fieldMapping = uploadResult.fieldMapping || {};
		fileType = uploadResult.fileType || 'csv';
		fileData = uploadResult.fileData || '';
		fileText = uploadResult.fileData || ''; // For CSV, fileData is the text
		step = 'map';
	}

	$: if (uploadResult?.results) {
		importResults = uploadResult.results;
		step = 'complete';
	}

	async function handleFileSelect(event) {
		const file = event.target.files?.[0];
		if (!file) return;

		const fileName = file.name.toLowerCase();
		const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
		
		if (isExcel) {
			// For Excel files, we'll read as array buffer and convert to base64
			const arrayBuffer = await file.arrayBuffer();
			const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
			fileData = base64;
			fileType = 'excel';
		} else {
			// For CSV files, read as text
			fileText = await file.text();
			fileData = fileText;
			fileType = 'csv';
		}
	}

	async function proceedToPreview() {
		// Validate that email is mapped
		const emailMapped = Object.values(fieldMapping).includes('email');
		if (!emailMapped) {
			await dialog.alert('Please map at least the Email field to continue', 'Validation Error');
			return;
		}
		step = 'preview';
	}

	async function handleImport() {
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/import';
		
		const csrfInput = document.createElement('input');
		csrfInput.type = 'hidden';
		csrfInput.name = '_csrf';
		csrfInput.value = csrfToken;
		form.appendChild(csrfInput);
		
		const fileDataInput = document.createElement('input');
		fileDataInput.type = 'hidden';
		fileDataInput.name = 'fileData';
		fileDataInput.value = fileData;
		form.appendChild(fileDataInput);
		
		const fileTypeInput = document.createElement('input');
		fileTypeInput.type = 'hidden';
		fileTypeInput.name = 'fileType';
		fileTypeInput.value = fileType;
		form.appendChild(fileTypeInput);
		
		const mappingInput = document.createElement('input');
		mappingInput.type = 'hidden';
		mappingInput.name = 'fieldMapping';
		mappingInput.value = JSON.stringify(fieldMapping);
		form.appendChild(mappingInput);
		
		document.body.appendChild(form);
		form.submit();
	}
</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="mb-6">
		<h2 class="text-2xl font-bold text-gray-900">Import Contacts</h2>
		<p class="text-gray-600 mt-2">Upload a CSV file to import contacts in bulk</p>
	</div>

	<!-- Step 1: Upload -->
	{#if step === 'upload'}
		<form method="POST" action="?/upload" use:enhance enctype="multipart/form-data">
			<input type="hidden" name="_csrf" value={csrfToken} />
			
			<div class="mb-4">
				<label class="block text-sm font-medium text-gray-700 mb-2">Import File</label>
				<input
					type="file"
					name="file"
					accept=".csv,.xlsx,.xls"
					required
					on:change={handleFileSelect}
					class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-hub-green-600 file:text-white hover:file:bg-hub-green-700"
				/>
				<p class="mt-2 text-xs text-gray-500">
					Upload a CSV or Excel (.xlsx, .xls) file with contact information. The first row should contain column headers.
				</p>
			</div>

			<div class="bg-hub-blue-50 border border-hub-blue-200 rounded-md p-4 mb-4">
				<p class="text-sm font-medium text-hub-blue-800 mb-2">Expected File Format:</p>
				<p class="text-xs text-hub-blue-700">
					The file should include columns like: Email, First Name, Last Name, Phone, Address, City, etc.
					Column names will be automatically detected and mapped to contact fields.
					Supports CSV and Excel (.xlsx, .xls) formats.
				</p>
			</div>

			<div class="bg-gray-50 border border-gray-200 rounded-md p-4 mb-4">
				<p class="text-sm font-medium text-gray-800 mb-3">Available Contact Fields:</p>
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
					<div>
						<p class="font-semibold text-gray-700 mb-1">Personal Information:</p>
						<ul class="list-disc list-inside text-gray-600 space-y-0.5">
							<li><strong>Email</strong> * (required)</li>
							<li>First Name</li>
							<li>Last Name</li>
							<li>Phone</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-gray-700 mb-1">Address:</p>
						<ul class="list-disc list-inside text-gray-600 space-y-0.5">
							<li>Address Line 1</li>
							<li>Address Line 2</li>
							<li>City</li>
							<li>County</li>
							<li>Postcode</li>
							<li>Country</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-gray-700 mb-1">Church Membership:</p>
						<ul class="list-disc list-inside text-gray-600 space-y-0.5">
							<li>Membership Status</li>
							<li>Date Joined</li>
							<li>Baptism Date</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-gray-700 mb-1">Additional:</p>
						<ul class="list-disc list-inside text-gray-600 space-y-0.5">
							<li>Serving Areas (comma-separated)</li>
							<li>Giftings (comma-separated)</li>
							<li>Notes</li>
						</ul>
					</div>
				</div>
				<p class="text-xs text-gray-500 mt-3">
					<strong>Note:</strong> Fields marked with * are required. All other fields are optional.
				</p>
			</div>

			<button type="submit" class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700">
				Upload and Map Fields
			</button>
			<a href="/hub/contacts" class="ml-2 bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700 inline-block">
				Cancel
			</a>
		</form>

	{/if}

	<!-- Step 2: Map Fields -->
	{#if step === 'map'}
		<div class="mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-2">Map CSV Columns to Contact Fields</h3>
			<p class="text-sm text-gray-600">Match each CSV column to a contact field. Email is required.</p>
		</div>

		<div class="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
			<details class="cursor-pointer">
				<summary class="text-sm font-medium text-gray-800 mb-2">View Available Contact Fields</summary>
				<div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
					<div>
						<p class="font-semibold text-gray-700 mb-1">Personal Information:</p>
						<ul class="list-disc list-inside text-gray-600 space-y-0.5">
							<li><strong>Email</strong> * (required)</li>
							<li>First Name</li>
							<li>Last Name</li>
							<li>Phone</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-gray-700 mb-1">Address:</p>
						<ul class="list-disc list-inside text-gray-600 space-y-0.5">
							<li>Address Line 1</li>
							<li>Address Line 2</li>
							<li>City</li>
							<li>County</li>
							<li>Postcode</li>
							<li>Country</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-gray-700 mb-1">Church Membership:</p>
						<ul class="list-disc list-inside text-gray-600 space-y-0.5">
							<li>Membership Status</li>
							<li>Date Joined</li>
							<li>Baptism Date</li>
						</ul>
					</div>
					<div>
						<p class="font-semibold text-gray-700 mb-1">Additional:</p>
						<ul class="list-disc list-inside text-gray-600 space-y-0.5">
							<li>Serving Areas (comma-separated)</li>
							<li>Giftings (comma-separated)</li>
							<li>Notes</li>
						</ul>
					</div>
				</div>
			</details>
		</div>

		<div class="overflow-x-auto mb-6">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CSV Column</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Map To</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sample Value</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each csvHeaders as header}
						<tr>
							<td class="px-4 py-3 text-sm font-medium text-gray-900">{header}</td>
							<td class="px-4 py-3">
								<select
									bind:value={fieldMapping[header]}
									class="block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3 text-sm"
								>
									{#each contactFields as field}
										<option value={field.value}>{field.label}</option>
									{/each}
								</select>
							</td>
							<td class="px-4 py-3 text-sm text-gray-500">
								{csvRows[0]?.[header] || '-'}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="bg-hub-yellow-50 border border-hub-yellow-200 rounded-md p-4 mb-6">
			<p class="text-sm text-hub-yellow-800">
				<strong>Preview:</strong> Showing first {csvRows.length} of {totalRows} rows. 
				All {totalRows} rows will be imported when you proceed.
			</p>
		</div>

		<div class="flex gap-2">
			<button
				type="button"
				on:click={proceedToPreview}
				class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700"
			>
				Preview Import
			</button>
			<button
				type="button"
				on:click={() => step = 'upload'}
				class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700"
			>
				Back
			</button>
		</div>
	{/if}

	<!-- Step 3: Preview -->
	{#if step === 'preview'}
		<div class="mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-2">Preview Import</h3>
			<p class="text-sm text-gray-600">Review the mapped data before importing {totalRows} contacts.</p>
		</div>

		<div class="overflow-x-auto mb-6">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Name</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each csvRows.slice(0, 10) as row}
						{@const emailField = Object.keys(fieldMapping).find(k => fieldMapping[k] === 'email')}
						{@const firstNameField = Object.keys(fieldMapping).find(k => fieldMapping[k] === 'firstName')}
						{@const lastNameField = Object.keys(fieldMapping).find(k => fieldMapping[k] === 'lastName')}
						{@const phoneField = Object.keys(fieldMapping).find(k => fieldMapping[k] === 'phone')}
						{@const cityField = Object.keys(fieldMapping).find(k => fieldMapping[k] === 'city')}
						<tr>
							<td class="px-4 py-3 text-sm text-gray-900">{row[firstNameField] || '-'}</td>
							<td class="px-4 py-3 text-sm text-gray-900">{row[lastNameField] || '-'}</td>
							<td class="px-4 py-3 text-sm text-gray-900">{row[emailField] || '-'}</td>
							<td class="px-4 py-3 text-sm text-gray-500">{row[phoneField] || '-'}</td>
							<td class="px-4 py-3 text-sm text-gray-500">{row[cityField] || '-'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if totalRows > 10}
				<p class="text-xs text-gray-500 mt-2 px-4">... and {totalRows - 10} more rows</p>
			{/if}
		</div>

		<div class="flex gap-2">
			<button
				type="button"
				on:click={handleImport}
				class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700"
			>
				Import {totalRows} Contacts
			</button>
			<button
				type="button"
				on:click={() => step = 'map'}
				class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700"
			>
				Back to Mapping
			</button>
		</div>
	{/if}

	<!-- Step 4: Complete -->
	{#if step === 'complete' && importResults}
		<div class="mb-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-2">Import Complete</h3>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
			<div class="bg-hub-green-50 border border-hub-green-200 rounded-lg p-4">
				<div class="text-2xl font-bold text-hub-green-800">{importResults.success.length}</div>
				<div class="text-sm text-hub-green-700">Successfully Imported</div>
			</div>
			<div class="bg-hub-red-50 border border-hub-red-200 rounded-lg p-4">
				<div class="text-2xl font-bold text-hub-red-800">{importResults.errors.length}</div>
				<div class="text-sm text-hub-red-700">Errors</div>
			</div>
		</div>

		{#if importResults.errors.length > 0}
			<div class="mb-6">
				<h4 class="text-md font-semibold text-gray-900 mb-2">Errors</h4>
				<div class="bg-hub-red-50 border border-hub-red-200 rounded-md p-4 max-h-60 overflow-y-auto">
					<ul class="space-y-1">
						{#each importResults.errors as error}
							<li class="text-sm text-hub-red-800">Row {error.row}: {error.error}</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}


		<div class="flex gap-2">
			<a href="/hub/contacts" class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700">
				View Contacts
			</a>
			<button
				type="button"
				on:click={() => { step = 'upload'; fileText = ''; fileData = ''; fileType = 'csv'; csvHeaders = []; csvRows = []; fieldMapping = {}; importResults = null; }}
				class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700"
			>
				Import Another File
			</button>
		</div>
	{/if}
</div>

