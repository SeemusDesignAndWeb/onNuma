<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: newsletter = $page.data?.newsletter;
	$: lists = $page.data?.lists || [];
	$: contacts = $page.data?.contacts || [];
	$: csrfToken = $page.data?.csrfToken || '';

	let selectedListId = '';
	let selectedContactIds = [];
	let sendMode = 'list'; // 'list' | 'contacts'
	let sending = false;
	let results = null;
	let contactSearch = '';

	$: filteredContacts = contactSearch.trim()
		? contacts.filter(
				c =>
					(c.email || '').toLowerCase().includes(contactSearch.toLowerCase()) ||
					(c.name || '').toLowerCase().includes(contactSearch.toLowerCase())
		  )
		: contacts;

	async function sendNewsletter() {
		const useList = sendMode === 'list' && selectedListId;
		const useContacts = sendMode === 'contacts' && selectedContactIds.length > 0;

		if (!useList && !useContacts) {
			await dialog.alert(
				sendMode === 'list'
					? 'Please select a contact list to send the email to'
					: 'Please select at least one contact',
				'No Recipients'
			);
			return;
		}

		const recipientCount = useList
			? (lists.find((l) => l.id === selectedListId)?.contactCount ?? 0)
			: selectedContactIds.length;
		const confirmed = await dialog.confirm(
			`Are you sure you want to send this email to ${recipientCount} ${recipientCount === 1 ? 'recipient' : 'recipients'}? This action cannot be undone.`,
			'Confirm Send Email'
		);

		if (!confirmed) {
			return;
		}

		sending = true;
		results = null;

		try {
			const body = {
				_csrf: csrfToken,
				...(useList ? { listId: selectedListId } : { contactIds: selectedContactIds })
			};
			const response = await fetch(`/hub/emails/${newsletter.id}/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			const data = await response.json();

			if (response.ok && data.success) {
				const sentCount = data.results?.filter((r) => r.status === 'sent').length || 0;
				const errorCount = data.results?.filter((r) => r.status === 'error').length || 0;

				if (errorCount === 0) {
					notifications.success(
						`Email sent successfully to ${sentCount} ${sentCount === 1 ? 'recipient' : 'recipients'}!`
					);
				} else {
					notifications.warning(
						`Email sent to ${sentCount} recipients, but ${errorCount} ${errorCount === 1 ? 'error' : 'errors'} occurred.`
					);
				}

				results = data;
				setTimeout(() => {
					goto(`/hub/emails/${newsletter.id}`);
				}, 3000);
			} else {
				throw new Error(data.error || 'Failed to send email');
			}
		} catch (error) {
			console.error('Error sending newsletter:', error);
			notifications.error(error.message || 'Failed to send email');
			results = { error: error.message };
		} finally {
			sending = false;
		}
	}

	function toggleContact(contactId) {
		if (selectedContactIds.includes(contactId)) {
			selectedContactIds = selectedContactIds.filter((id) => id !== contactId);
		} else {
			selectedContactIds = [...selectedContactIds, contactId];
		}
	}

	function selectAllFiltered() {
		const ids = filteredContacts.map((c) => c.id);
		selectedContactIds = [...new Set([...selectedContactIds, ...ids])];
	}

	function clearContactSelection() {
		selectedContactIds = [];
	}
</script>

{#if newsletter}
	<div class="space-y-6">
		<!-- Header Card -->
		<div class="hub-top-panel p-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold mb-2 text-gray-900">Send Email</h1>
					<p class="text-gray-600">Send "{newsletter.subject || 'Untitled Email'}" to a contact list or specific contacts</p>
				</div>
				<a
					href="/hub/emails/{newsletter.id}"
					class="hub-btn border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					Back
				</a>
			</div>
		</div>

		<!-- Send Form -->
		<div class="bg-white shadow rounded-lg p-6">
			<div class="space-y-6">
				<!-- Email Info -->
				<div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
					<h3 class="text-sm font-semibold text-gray-700 mb-2">Email Details</h3>
					<p class="text-gray-900 font-medium">{newsletter.subject || 'Untitled Email'}</p>
					{#if newsletter.htmlContent}
						<p class="text-sm text-gray-600 mt-1">Content: {newsletter.htmlContent.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
					{/if}
				</div>

				<!-- Send mode: List vs Manual contacts -->
				<div>
					<span class="block text-sm font-medium text-gray-700 mb-2">Send to</span>
					<div class="flex gap-4 mb-3">
						<label class="inline-flex items-center gap-2 cursor-pointer">
							<input type="radio" name="sendMode" bind:group={sendMode} value="list" class="rounded border-gray-500 text-theme-button-2 focus:ring-theme-button-2" />
							<span class="text-sm">Contact list</span>
						</label>
						<label class="inline-flex items-center gap-2 cursor-pointer">
							<input type="radio" name="sendMode" bind:group={sendMode} value="contacts" class="rounded border-gray-500 text-theme-button-2 focus:ring-theme-button-2" />
							<span class="text-sm">Specific contacts</span>
						</label>
					</div>

					{#if sendMode === 'list'}
						{#if lists.length === 0}
							<div class="bg-hub-yellow-50 border border-hub-yellow-200 rounded-lg p-4">
								<p class="text-hub-yellow-800 text-sm">
									No contact lists available. <a href="/hub/lists/new" class="underline font-medium">Create a list</a> first.
								</p>
							</div>
						{:else}
							<select
								bind:value={selectedListId}
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-3 px-4"
								disabled={sending}
							>
								<option value="">-- Select a contact list --</option>
								{#each lists as list}
									<option value={list.id}>
										{list.name} ({list.contactCount || 0} {list.contactCount === 1 ? 'contact' : 'contacts'})
									</option>
								{/each}
							</select>
							<p class="mt-1 text-xs text-gray-500">
								All contacts in the selected list will receive the email.
							</p>
						{/if}
					{:else}
						<div>
							{#if contacts.length === 0}
								<div class="bg-hub-yellow-50 border border-hub-yellow-200 rounded-lg p-4">
									<p class="text-hub-yellow-800 text-sm">No contacts with email and subscription. Add contacts first.</p>
								</div>
							{:else}
								<div class="mb-2">
									<input
										type="text"
										bind:value={contactSearch}
										placeholder="Search contacts by name or email..."
										class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
									/>
								</div>
								<div class="flex gap-2 mb-2">
									<button
										type="button"
										on:click={selectAllFiltered}
										class="text-sm text-theme-button-2 hover:underline"
									>
										Select all (filtered)
									</button>
									<button
										type="button"
										on:click={clearContactSelection}
										class="text-sm text-gray-600 hover:underline"
									>
										Clear selection
									</button>
								</div>
								<div class="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
									{#each filteredContacts as contact}
										<label class="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer">
											<input
												type="checkbox"
												checked={selectedContactIds.includes(contact.id)}
												on:change={() => toggleContact(contact.id)}
												class="rounded border-gray-500 text-theme-button-2 focus:ring-theme-button-2"
											/>
											<span class="text-sm text-gray-900">{contact.name || contact.email}</span>
											<span class="text-xs text-gray-500 truncate">{contact.email}</span>
										</label>
									{/each}
								</div>
								<p class="mt-1 text-xs text-gray-500">
									{selectedContactIds.length} {selectedContactIds.length === 1 ? 'contact' : 'contacts'} selected.
								</p>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Send Button -->
				<div class="flex gap-3">
					<button
						on:click={sendNewsletter}
						disabled={sending || (sendMode === 'list' ? !selectedListId || lists.length === 0 : selectedContactIds.length === 0)}
						class="hub-btn btn-theme-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
					>
						{#if sending}
							<svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Sending...
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
							Send Email
						{/if}
					</button>
					<a
						href="/hub/emails/{newsletter.id}"
						class="hub-btn btn-theme-3 inline-flex items-center gap-2"
					>
						Cancel
					</a>
				</div>

				<!-- Detailed Results -->
				{#if results}
					<div class="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
						<h3 class="font-bold text-gray-900 mb-3">Send Results</h3>
						{#if results.error && !results.results}
							<p class="text-hub-red-600">{results.error}</p>
						{:else if results.results && results.results.length > 0}
							<div class="space-y-2 mb-3">
								<p class="text-hub-green-600 font-medium">
									✓ Sent: {results.results.filter((r) => r.status === 'sent').length}
								</p>
								{#if results.results.some((r) => r.status === 'error')}
									<p class="text-hub-red-600 font-medium">
										✕ Errors: {results.results.filter((r) => r.status === 'error').length}
									</p>
								{/if}
							</div>
							<div class="max-h-60 overflow-y-auto border border-gray-200 rounded-md bg-white">
								<table class="w-full text-sm">
									<thead class="bg-gray-100 sticky top-0">
										<tr>
											<th class="text-left py-2 px-3">Email</th>
											<th class="text-left py-2 px-3">Status</th>
											<th class="text-left py-2 px-3">Details</th>
										</tr>
									</thead>
									<tbody>
										{#each results.results as result}
											<tr class="border-t border-gray-100">
												<td class="py-2 px-3 text-gray-900">{result.email}</td>
												<td class="py-2 px-3">
													{#if result.status === 'sent'}
														<span class="text-hub-green-600 font-medium">Sent</span>
													{:else}
														<span class="text-hub-red-600 font-medium">Error</span>
													{/if}
												</td>
												<td class="py-2 px-3 text-gray-600">
													{#if result.status === 'sent' && result.messageId}
														<span class="text-xs">ID: {result.messageId}</span>
													{:else if result.status === 'error' && result.error}
														<span class="text-hub-red-700 text-xs">{result.error}</span>
													{:else}
														—
													{/if}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
