<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: allContacts = $page.data?.contacts || [];
	$: formResult = $page.form;
	
	function handleEnhance() {
		return async ({ update, result }) => {
			if (result.type === 'failure') {
				const errorMessage = result.data?.error || 'Failed to create list';
				notifications.error(errorMessage);
			}
			await update();
		};
	}
	
	$: if (formResult?.type === 'failure' && formResult?.data?.error) {
		notifications.error(formResult.data.error);
	}

	let formData = {
		name: '',
		description: ''
	};

	let searchTerm = '';
	let selectedContactIds = new Set();

	function sortContacts(contacts) {
		return [...contacts].sort((a, b) => {
			const aFirst = (a.firstName || '').toLowerCase();
			const bFirst = (b.firstName || '').toLowerCase();
			const aLast = (a.lastName || '').toLowerCase();
			const bLast = (b.lastName || '').toLowerCase();
			if (aFirst !== bFirst) return aFirst.localeCompare(bFirst);
			return aLast.localeCompare(bLast);
		});
	}

	$: filteredContacts = (() => {
		const filtered = searchTerm
			? allContacts.filter(c =>
				(c.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
				(c.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
				(c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
			)
			: allContacts;
		return sortContacts(filtered);
	})();

	function toggleContact(id) {
		if (selectedContactIds.has(id)) {
			selectedContactIds.delete(id);
		} else {
			selectedContactIds.add(id);
		}
		selectedContactIds = selectedContactIds;
	}

	$: selectedContactIdsJson = JSON.stringify([...selectedContactIds]);
</script>

<div class="space-y-6">
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">New List</h2>
			<div class="flex flex-wrap gap-2">
				<a href="/hub/lists" class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
					Cancel
				</a>
				<button type="submit" form="list-create-form" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
					<span class="hidden sm:inline">Create List{selectedContactIds.size > 0 ? ` with ${selectedContactIds.size} contact${selectedContactIds.size !== 1 ? 's' : ''}` : ''}</span>
					<span class="sm:hidden">Create</span>
				</button>
			</div>
		</div>

		<form id="list-create-form" method="POST" action="?/create" use:enhance={handleEnhance}>
			<input type="hidden" name="_csrf" value={csrfToken} />
			<input type="hidden" name="contactIds" value={selectedContactIdsJson} />
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
				<FormField label="Name" name="name" bind:value={formData.name} required />
				<FormField label="Description" name="description" bind:value={formData.description} />
			</div>
		</form>
	</div>

	<!-- Contact selection -->
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
			<h3 class="text-base font-semibold text-gray-900">
				Add contacts
				{#if selectedContactIds.size > 0}
					<span class="text-sm font-normal text-gray-500">({selectedContactIds.size} selected)</span>
				{/if}
			</h3>
			<div class="flex-1 max-w-xs">
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="Search contacts..."
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 px-3 py-1.5 text-sm"
				/>
			</div>
		</div>

		{#if filteredContacts.length === 0}
			<p class="text-sm text-gray-500 py-4">
				{searchTerm ? 'No contacts found matching your search.' : 'No contacts available.'}
			</p>
		{:else}
			<div class="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50 sticky top-0">
						<tr>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-10">
								<input
									type="checkbox"
									checked={selectedContactIds.size === filteredContacts.length && filteredContacts.length > 0}
									on:change={(e) => {
										if (e.target.checked) {
											selectedContactIds = new Set(filteredContacts.map(c => c.id));
										} else {
											selectedContactIds = new Set();
										}
									}}
									class="rounded border-gray-300 text-hub-green-600 focus:ring-theme-button-2"
								/>
							</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">First Name</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Name</th>
							<th class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Email</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredContacts as contact (contact.id)}
							<tr
								class="hover:bg-gray-50 cursor-pointer {selectedContactIds.has(contact.id) ? 'bg-blue-50' : ''}"
								on:click={() => toggleContact(contact.id)}
							>
								<td class="px-3 py-2">
									<input
										type="checkbox"
										checked={selectedContactIds.has(contact.id)}
										on:change={() => toggleContact(contact.id)}
										on:click|stopPropagation
										class="rounded border-gray-300 text-hub-green-600 focus:ring-theme-button-2"
									/>
								</td>
								<td class="px-3 py-2 text-sm text-gray-900">{contact.firstName || '—'}</td>
								<td class="px-3 py-2 text-sm text-gray-900">{contact.lastName || '—'}</td>
								<td class="px-3 py-2 text-sm text-gray-500 hidden sm:table-cell">{contact.email || '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
