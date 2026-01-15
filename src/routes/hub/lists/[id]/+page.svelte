<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';
	
	$: list = $page.data?.list;
	$: contacts = $page.data?.contacts || [];
	$: availableContacts = $page.data?.availableContacts || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: urlParams = $page.url.searchParams;
	
	// Show notification when coming from create action (only once)
	let hasShownCreatedNotification = false;
	$: if (urlParams.get('created') === 'true' && !hasShownCreatedNotification) {
		hasShownCreatedNotification = true;
		notifications.success('List created successfully!');
		// Remove the parameter from URL without reload
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.delete('created');
			window.history.replaceState({}, '', url);
		}
	}
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && browser && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			if (formResult?.type === 'addContacts' || formResult?.type === 'removeContact') {
				notifications.success(formResult.type === 'addContacts' ? 'Contacts added successfully' : 'Contact removed successfully');
				// Reload to refresh the contact list - only on client
				if (browser) {
					setTimeout(() => {
						invalidateAll();
					}, 500);
				}
			} else {
				notifications.success('List updated successfully');
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	let editing = false;
	let formData = {
		name: list?.name || '',
		description: list?.description || ''
	};

	$: if (list) {
		formData = {
			name: list.name || '',
			description: list.description || ''
		};
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this list?', 'Delete List');
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

	let showAddContacts = false;
	let searchTerm = '';
	let selectedContactIds = new Set();
	
	// Helper function to sort contacts by last name, then first name
	function sortContacts(contacts) {
		return contacts.sort((a, b) => {
			const aLastName = (a.lastName || '').toLowerCase();
			const bLastName = (b.lastName || '').toLowerCase();
			const aFirstName = (a.firstName || '').toLowerCase();
			const bFirstName = (b.firstName || '').toLowerCase();
			
			if (aLastName !== bLastName) {
				return aLastName.localeCompare(bLastName);
			}
			return aFirstName.localeCompare(bFirstName);
		});
	}
	
	$: filteredAvailableContacts = (() => {
		const filtered = searchTerm
			? availableContacts.filter(c => 
				(c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
				(c.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
				(c.lastName || '').toLowerCase().includes(searchTerm.toLowerCase())
			)
			: availableContacts;
		// Sort by last name, then first name (server already sorts, but maintain sort after filtering)
		return sortContacts([...filtered]);
	})();
	
	function toggleContactSelection(contactId) {
		if (selectedContactIds.has(contactId)) {
			selectedContactIds.delete(contactId);
		} else {
			selectedContactIds.add(contactId);
		}
		selectedContactIds = selectedContactIds; // Trigger reactivity
	}
	
	async function handleAddContacts() {
		if (selectedContactIds.size === 0) {
			await dialog.alert('Please select at least one contact to add', 'No Contacts Selected');
			return;
		}
		
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/addContacts';
		
		const csrfInput = document.createElement('input');
		csrfInput.type = 'hidden';
		csrfInput.name = '_csrf';
		csrfInput.value = csrfToken;
		form.appendChild(csrfInput);
		
		const contactIdsInput = document.createElement('input');
		contactIdsInput.type = 'hidden';
		contactIdsInput.name = 'contactIds';
		contactIdsInput.value = JSON.stringify(Array.from(selectedContactIds));
		form.appendChild(contactIdsInput);
		
		document.body.appendChild(form);
		form.submit();
	}
	
	async function handleRemoveContact(contactId, contactName) {
		const confirmed = await dialog.confirm(
			`Are you sure you want to remove ${contactName || 'this contact'} from the list?`,
			'Remove Contact'
		);
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/removeContact';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			const contactIdInput = document.createElement('input');
			contactIdInput.type = 'hidden';
			contactIdInput.name = 'contactId';
			contactIdInput.value = contactId;
			form.appendChild(contactIdInput);
			
			document.body.appendChild(form);
			form.submit();
		}
	}

</script>

{#if list}
	<div class="bg-white shadow rounded-lg p-6 mb-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">List Details</h2>
			<div class="flex flex-wrap gap-2">
				{#if editing}
					<button
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs"
					>
						Back
					</button>
				{:else}
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
				<FormField label="Name" name="name" bind:value={formData.name} required />
				<FormField label="Description" name="description" type="textarea" rows="3" bind:value={formData.description} />
				<button type="submit" class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700">
					Save Changes
				</button>
			</form>
		{:else}
			<dl class="grid grid-cols-1 gap-4">
				<div>
					<dt class="text-sm font-medium text-gray-500">Name</dt>
					<dd class="mt-1 text-sm text-gray-900">{list.name}</dd>
				</div>
				{#if list.description}
					<div>
						<dt class="text-sm font-medium text-gray-500">Description</dt>
						<dd class="mt-1 text-sm text-gray-900">{list.description}</dd>
					</div>
				{/if}
				<div>
					<dt class="text-sm font-medium text-gray-500">Contacts</dt>
					<dd class="mt-1 text-sm text-gray-900">{contacts.length}</dd>
				</div>
			</dl>
		{/if}

	</div>

	<div class="bg-white shadow rounded-lg p-6 mb-6">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-xl font-bold text-gray-900">Contacts in List ({contacts.length})</h3>
			<button
				on:click={() => {
					showAddContacts = !showAddContacts;
					selectedContactIds = new Set();
					searchTerm = '';
				}}
				class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700"
			>
				{showAddContacts ? 'Cancel' : '+ Add Contacts'}
			</button>
		</div>
		
		{#if showAddContacts}
			<div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
				<h4 class="text-lg font-semibold text-gray-900 mb-3">Add Contacts to List</h4>
				
				<div class="mb-4">
					<input
						type="text"
						bind:value={searchTerm}
						placeholder="Search contacts by name or email..."
						class="w-full px-[18px] py-2.5 border border-gray-500 rounded-md focus:border-hub-green-500 focus:ring-hub-green-500"
					/>
				</div>
				
				{#if filteredAvailableContacts.length === 0}
					<p class="text-gray-500 text-sm py-4">
						{searchTerm ? 'No contacts found matching your search.' : 'All contacts are already in this list.'}
					</p>
				{:else}
					<div class="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50 sticky top-0">
								<tr>
									<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase">
										<input
											type="checkbox"
											checked={selectedContactIds.size === filteredAvailableContacts.length && filteredAvailableContacts.length > 0}
											on:change={(e) => {
												if (e.target.checked) {
													selectedContactIds = new Set(filteredAvailableContacts.map(c => c.id));
												} else {
													selectedContactIds = new Set();
												}
											}}
											class="rounded border-gray-300 text-hub-green-600 focus:ring-hub-green-500"
										/>
									</th>
									<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
									<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Last Name</th>
									<th class="px-[18px] py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-200">
								{#each filteredAvailableContacts as contact}
									<tr class="hover:bg-gray-50">
										<td class="px-[18px] py-2.5">
											<input
												type="checkbox"
												checked={selectedContactIds.has(contact.id)}
												on:change={() => toggleContactSelection(contact.id)}
												class="rounded border-gray-300 text-hub-green-600 focus:ring-hub-green-500"
											/>
										</td>
										<td class="px-[18px] py-2.5 text-sm text-gray-900">{contact.firstName || '-'}</td>
										<td class="px-[18px] py-2.5 text-sm text-gray-900">{contact.lastName || '-'}</td>
										<td class="px-[18px] py-2.5 text-sm text-gray-900">{contact.email || '-'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					
					<div class="mt-4 flex justify-between items-center">
						<p class="text-sm text-gray-600">
							{selectedContactIds.size} contact{selectedContactIds.size !== 1 ? 's' : ''} selected
						</p>
						<button
							on:click={handleAddContacts}
							disabled={selectedContactIds.size === 0}
							class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
						>
							Add Selected Contacts
						</button>
					</div>
				{/if}
			</div>
		{/if}
		
		{#if contacts.length === 0}
			<p class="text-gray-500 text-sm py-4">No contacts in this list yet.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Name</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each contacts as contact}
							<tr class="hover:bg-gray-50">
								<td class="px-4 py-3 text-sm">
									<a href="/hub/contacts/{contact.id}" class="text-hub-blue-600 hover:text-hub-blue-800 font-medium">
										{contact.firstName || '-'}
									</a>
								</td>
								<td class="px-4 py-3 text-sm">
									<a href="/hub/contacts/{contact.id}" class="text-hub-blue-600 hover:text-hub-blue-800 font-medium">
										{contact.lastName || '-'}
									</a>
								</td>
								<td class="px-4 py-3 text-sm text-gray-900">
									<a href="/hub/contacts/{contact.id}" class="text-hub-blue-600 hover:text-hub-blue-800">
										{contact.email || '-'}
									</a>
								</td>
								<td class="px-4 py-3 text-sm">
									<button
										on:click|stopPropagation={() => handleRemoveContact(contact.id, `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email)}
										class="text-hub-red-600 hover:text-hub-red-800 font-medium"
									>
										Remove
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}

