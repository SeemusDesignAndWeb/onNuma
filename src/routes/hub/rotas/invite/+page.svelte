<script>
	import { page } from '$app/stores';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: data = $page.data || {};
	$: events = data.events || [];
	$: rotas = data.rotas || [];
	$: lists = data.lists || [];
	$: csrfToken = data.csrfToken || '';

	let selectedEventId = '';
	let selectedRotaIds = [];
	let selectedListId = '';
	let customMessage = '';
	let sending = false;
	let results = null;

	$: filteredRotas = selectedEventId 
		? rotas.filter(r => r.eventId === selectedEventId)
		: [];

	function selectAllRotas() {
		selectedRotaIds = filteredRotas.map(r => r.id);
	}

	function deselectAllRotas() {
		selectedRotaIds = [];
	}

	async function sendInvites() {
		if (!selectedEventId || selectedRotaIds.length === 0 || !selectedListId) {
			await dialog.alert('Please select an event, at least one rota, and a contact list', 'Validation Error');
			return;
		}

		sending = true;
		results = null;

		try {
			const response = await fetch('/hub/rotas/invite/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					_csrf: csrfToken,
					eventId: selectedEventId,
					rotaIds: selectedRotaIds,
					occurrenceIds: [], // Occurrences will be selected on the signup page
					listId: selectedListId,
					customMessage: customMessage
				})
			});

			const data = await response.json();
			results = data;
		} catch (error) {
			results = { error: error.message };
		} finally {
			sending = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Header with Title and Action Buttons -->
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex justify-between items-center">
			<h2 class="text-2xl font-bold text-gray-900">Bulk Rota Invitations</h2>
			<div class="flex gap-3">
				<a
					href="/hub/rotas"
					class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700 flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					Back
				</a>
				<button
					on:click={sendInvites}
					disabled={sending || !selectedEventId || selectedRotaIds.length === 0 || !selectedListId}
					class="bg-hub-green-600 text-white px-6 py-2 rounded-md hover:bg-hub-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
				>
					{#if sending}
						<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Sending...
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
						Send Invitations
					{/if}
				</button>
			</div>
		</div>
	</div>

	<!-- Selection Panel: Event and Contact List in one row -->
	<div class="bg-white shadow rounded-lg p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Selection</h3>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Event <span class="text-hub-red-500">*</span></label>
				<select bind:value={selectedEventId} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3">
					<option value="">Select an event</option>
					{#each events as event}
						<option value={event.id}>{event.title}</option>
					{/each}
				</select>
			</div>
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-1">Contact List <span class="text-hub-red-500">*</span></label>
				<select bind:value={selectedListId} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3">
					<option value="">Select a list</option>
					{#each lists as list}
						<option value={list.id}>{list.name}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Custom Message Panel -->
	<div class="bg-white shadow rounded-lg p-6">
		<h3 class="text-lg font-semibold text-gray-900 mb-4">Email Message</h3>
		<div>
			<label class="block text-sm font-medium text-gray-700 mb-1">Custom Message</label>
			<p class="text-xs text-gray-500 mb-2">The email will start with "Hi {'{{firstname}}'}," followed by your message below, then the list of rotas.</p>
			<textarea
				bind:value={customMessage}
				placeholder="Enter your custom message here..."
				rows="4"
				class="w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3"
			></textarea>
		</div>
	</div>

	<!-- Rotas Panel -->
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-lg font-semibold text-gray-900">Rotas <span class="text-hub-red-500">*</span></h3>
			{#if filteredRotas.length > 0}
				<div class="flex gap-2">
					<button
						on:click={selectAllRotas}
						class="text-xs text-hub-green-600 hover:text-hub-green-800 underline"
					>
						Select All
					</button>
					<button
						on:click={deselectAllRotas}
						class="text-xs text-gray-600 hover:text-gray-800 underline"
					>
						Deselect All
					</button>
				</div>
			{/if}
		</div>
		{#if !selectedEventId}
			<p class="text-sm text-gray-500 italic">Select an event to see available rotas</p>
		{:else if filteredRotas.length === 0}
			<p class="text-sm text-gray-500 italic">No rotas available for this event</p>
		{:else}
			<div class="space-y-2 max-h-[400px] overflow-y-auto">
				{#each filteredRotas as rota}
					<label class="flex items-center p-2 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer">
						<input 
							type="checkbox" 
							bind:group={selectedRotaIds} 
							value={rota.id} 
							class="mr-3 h-4 w-4 text-hub-green-600 focus:ring-hub-green-500 border-gray-300 rounded" 
						/>
						<div class="flex-1">
							<div class="font-medium text-sm text-gray-900">{rota.role}</div>
							<div class="text-xs text-gray-500">Capacity: {rota.capacity}</div>
						</div>
					</label>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Results Panel -->
	{#if results}
		<div class="bg-white shadow rounded-lg p-6">
			<h3 class="text-lg font-semibold text-gray-900 mb-4">Results</h3>
			{#if results.error}
				<div class="p-4 bg-hub-red-50 border border-hub-red-200 rounded-md">
					<p class="text-hub-red-800 font-medium">{results.error}</p>
				</div>
			{:else if results.results}
				<div class="space-y-3">
					<div class="p-4 bg-hub-green-50 border border-hub-green-200 rounded-md">
						<p class="text-hub-green-800 font-medium">
							✓ Sent {results.results.filter(r => r.status === 'sent').length} invitation{results.results.filter(r => r.status === 'sent').length !== 1 ? 's' : ''} successfully
						</p>
					</div>
					{#if results.results.some(r => r.status === 'error')}
						<div class="p-4 bg-hub-yellow-50 border border-hub-yellow-200 rounded-md">
							<p class="text-hub-yellow-800 font-medium">
								⚠ {results.results.filter(r => r.status === 'error').length} invitation{results.results.filter(r => r.status === 'error').length !== 1 ? 's' : ''} failed
							</p>
							<ul class="mt-2 space-y-1 text-sm text-hub-yellow-700">
								{#each results.results.filter(r => r.status === 'error') as result}
									<li>• {result.contact?.email || 'Unknown'}: {result.error || 'Unknown error'}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

