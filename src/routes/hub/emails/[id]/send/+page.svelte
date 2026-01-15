<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: newsletter = $page.data?.newsletter;
	$: lists = $page.data?.lists || [];
	$: csrfToken = $page.data?.csrfToken || '';

	let selectedListId = '';
	let sending = false;
	let results = null;

	async function sendNewsletter() {
		if (!selectedListId) {
			await dialog.alert('Please select a contact list to send the email to', 'No List Selected');
			return;
		}

		const confirmed = await dialog.confirm(
			`Are you sure you want to send this email to the selected list? This action cannot be undone.`,
			'Confirm Send Email'
		);

		if (!confirmed) {
			return;
		}

		sending = true;
		results = null;

		try {
			const response = await fetch(`/hub/emails/${newsletter.id}/send`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					_csrf: csrfToken,
					listId: selectedListId
				})
			});

			const data = await response.json();
			
			if (response.ok && data.success) {
				const sentCount = data.results?.filter(r => r.status === 'sent').length || 0;
				const errorCount = data.results?.filter(r => r.status === 'error').length || 0;
				
				if (errorCount === 0) {
					notifications.success(`Email sent successfully to ${sentCount} ${sentCount === 1 ? 'recipient' : 'recipients'}!`);
				} else {
					notifications.warning(`Email sent to ${sentCount} recipients, but ${errorCount} ${errorCount === 1 ? 'error' : 'errors'} occurred.`);
				}
				
				results = data;
				// Redirect back to newsletter detail page after a short delay
				setTimeout(() => {
					goto(`/hub/emails/${newsletter.id}`);
				}, 2000);
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
</script>

{#if newsletter}
	<div class="space-y-6">
		<!-- Header Card -->
		<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 shadow-lg rounded-lg p-6 text-white">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold mb-2 text-white">Send Email</h1>
					<p class="text-hub-blue-100">Send "{newsletter.subject || 'Untitled Email'}" to a contact list</p>
				</div>
				<a 
					href="/hub/emails/{newsletter.id}" 
					class="bg-white/20 hover:bg-white/30 text-white px-[18px] py-2.5 rounded-md transition-colors font-medium border border-white/30 flex items-center gap-2"
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

				<!-- List Selection -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Select Contact List <span class="text-hub-red-500">*</span>
					</label>
					{#if lists.length === 0}
						<div class="bg-hub-yellow-50 border border-hub-yellow-200 rounded-lg p-4">
							<p class="text-hub-yellow-800 text-sm">
								No contact lists available. <a href="/hub/lists/new" class="underline font-medium">Create a list</a> first.
							</p>
						</div>
					{:else}
						<select 
							bind:value={selectedListId} 
							class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4"
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
							Select the contact list you want to send this email to. All contacts in the selected list will receive the email.
						</p>
					{/if}
				</div>

				<!-- Send Button -->
				<div class="flex gap-3">
					<button
						on:click={sendNewsletter}
						disabled={sending || !selectedListId || lists.length === 0}
						class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center gap-2 transition-colors"
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
						class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700 font-medium inline-flex items-center gap-2 transition-colors"
					>
						Cancel
					</a>
				</div>

				<!-- Results -->
				{#if results}
					<div class="mt-6 p-4 bg-gray-50 rounded-md border border-gray-200">
						<h3 class="font-bold text-gray-900 mb-3">Send Results</h3>
						{#if results.error}
							<p class="text-hub-red-600">{results.error}</p>
						{:else if results.results}
							<div class="space-y-2">
								<p class="text-hub-green-600 font-medium">
									✓ Sent to {results.results.filter(r => r.status === 'sent').length} {results.results.filter(r => r.status === 'sent').length === 1 ? 'recipient' : 'recipients'}
								</p>
								{#if results.results.some(r => r.status === 'error')}
									<p class="text-hub-red-600 font-medium">
										✕ {results.results.filter(r => r.status === 'error').length} {results.results.filter(r => r.status === 'error').length === 1 ? 'error' : 'errors'} occurred
									</p>
									<div class="mt-3 max-h-40 overflow-y-auto">
										{#each results.results.filter(r => r.status === 'error') as result}
											<div class="text-sm text-hub-red-700 py-1">
												{result.email}: {result.error || 'Unknown error'}
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

