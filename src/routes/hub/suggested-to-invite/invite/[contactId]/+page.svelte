<script>
	import { page } from '$app/stores';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: data = $page.data || {};
	$: contact = data.contact || {};
	$: organisationName = data.organisationName || 'Organisation';
	$: rotas = data.rotas || [];
	$: csrfToken = data.csrfToken || '';

	let selectedRotaIds = [];
	let customMessage = '';
	let sending = false;
	let result = null;

	// Group rotas by event for display
	$: rotasByEvent = rotas.reduce((acc, r) => {
		const key = r.eventId || 'none';
		if (!acc[key]) acc[key] = { eventTitle: r.eventTitle, rotas: [] };
		acc[key].rotas.push(r);
		return acc;
	}, {});

	function selectAllRotas() {
		selectedRotaIds = rotas.map((r) => r.id);
	}

	function deselectAllRotas() {
		selectedRotaIds = [];
	}

	async function sendInvite() {
		if (selectedRotaIds.length === 0) {
			await dialog.alert('Please select at least one rota', 'Validation');
			return;
		}

		sending = true;
		result = null;

		try {
			const res = await fetch('/hub/suggested-to-invite/invite/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					_csrf: csrfToken,
					contactId: contact.id,
					rotaIds: selectedRotaIds,
					customMessage: customMessage.trim()
				})
			});

			const body = await res.json();
			result = body;

			if (body.error) {
				notifications.error(body.error || 'Failed to send invitation');
			} else if (body.success) {
				notifications.success('Invitation email sent successfully');
			}
		} catch (err) {
			result = { error: err.message };
			notifications.error(err.message || 'Failed to send invitation');
		} finally {
			sending = false;
		}
	}
</script>

<svelte:head>
	<title>Invite {(contact.firstName || contact.email || 'Contact')} – {organisationName}</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-6 space-y-6">
	<nav class="flex items-center gap-2 text-sm">
		<a href="/hub/suggested-to-invite" class="text-theme-button-1 hover:underline">← Suggested to invite</a>
	</nav>

	<div class="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
		<div class="px-5 py-4 border-b border-gray-100">
			<h1 class="text-xl font-semibold text-gray-900">Send rota invitation</h1>
			<p class="text-sm text-gray-500 mt-0.5">Choose rotas and add a message. The email will include signup links and a link to MyHUB for other rotas.</p>
		</div>
		<div class="p-5 space-y-5">
			<!-- Contact -->
			<div>
				<h2 class="text-sm font-medium text-gray-700 mb-1">Sending to</h2>
				<p class="font-medium text-gray-900">{(contact.firstName || '') + (contact.lastName ? ' ' + contact.lastName : '') || contact.email}</p>
				<p class="text-sm text-gray-500">{contact.email}</p>
			</div>

			<!-- Message -->
			<div>
				<label for="message" class="block text-sm font-medium text-gray-700 mb-1">Your message</label>
				<p class="text-xs text-gray-500 mb-1">The email will start with "Hi {'{{firstname}}'}," then your message below. Use {'{{firstname}}'} to insert their first name.</p>
				<textarea
					id="message"
					bind:value={customMessage}
					placeholder="e.g. We'd love to have you join one of these rotas when you're free..."
					rows="4"
					class="w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
				></textarea>
			</div>

			<!-- Rotas -->
			<div>
				<div class="flex justify-between items-center mb-3">
					<span class="block text-sm font-medium text-gray-700">Select rotas <span class="text-red-500">*</span></span>
					{#if rotas.length > 0}
						<div class="flex gap-2">
							<button
								type="button"
								on:click={selectAllRotas}
								class="text-xs text-green-600 hover:text-green-800 underline"
							>
								Select all
							</button>
							<button
								type="button"
								on:click={deselectAllRotas}
								class="text-xs text-gray-600 hover:text-gray-800 underline"
							>
								Clear
							</button>
						</div>
					{/if}
				</div>
				{#if rotas.length === 0}
					<p class="text-sm text-gray-500 italic">No rotas available. Create events and rotas first.</p>
				{:else}
					<div class="space-y-4 max-h-[320px] overflow-y-auto pr-1">
						{#each Object.entries(rotasByEvent) as [eventId, group]}
							<div>
								<p class="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">{group.eventTitle}</p>
								<ul class="space-y-1.5">
									{#each group.rotas as rota}
										<li>
											<label class="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer">
												<input
													type="checkbox"
													bind:group={selectedRotaIds}
													value={rota.id}
													class="h-4 w-4 text-theme-button-2 focus:ring-theme-button-2 border-gray-300 rounded"
												/>
												<span class="font-medium text-sm text-gray-900">{rota.role}</span>
												<span class="text-xs text-gray-500">Capacity: {rota.capacity}</span>
											</label>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Send -->
			<div class="flex flex-wrap items-center gap-3 pt-2">
				<button
					type="button"
					on:click={sendInvite}
					disabled={sending || selectedRotaIds.length === 0}
					class="hub-btn bg-theme-button-2 text-white px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
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
						Send invitation email
					{/if}
				</button>
				<a href="/hub/suggested-to-invite" class="text-sm text-gray-600 hover:text-gray-900">Cancel</a>
			</div>
		</div>
	</div>

	{#if result?.success}
		<div class="rounded-xl bg-green-50 border border-green-200 p-4">
			<p class="text-green-800 font-medium">Invitation sent to {contact.email}</p>
			<a href="/hub/suggested-to-invite" class="inline-block mt-2 text-sm font-medium text-green-700 hover:underline">Back to Suggested to invite</a>
		</div>
	{/if}
</div>
