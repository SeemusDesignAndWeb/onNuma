<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: event = $page.data?.event;
	$: occurrence = $page.data?.occurrence;
	$: rotas = $page.data?.rotas || [];
	$: signups = $page.data?.signups || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Show notifications from form results
	$: if (formResult?.success) {
		notifications.success('Occurrence updated successfully');
		// Reset editing mode after successful save
		setTimeout(() => {
			editing = false;
			// Reload page data to get updated occurrence
			goto($page.url, { invalidateAll: true });
		}, 100);
	}
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let editing = false;
	let formData = {
		startsAt: '',
		endsAt: '',
		location: '',
		maxSpaces: ''
	};
	let information = '';

	// Initialize form data when occurrence is loaded (avoid hydration issues)
	$: if (occurrence && !editing) {
		// Convert ISO dates to datetime-local format
		const startDate = occurrence.startsAt ? new Date(occurrence.startsAt).toISOString().slice(0, 16) : '';
		const endDate = occurrence.endsAt ? new Date(occurrence.endsAt).toISOString().slice(0, 16) : '';
		
		// Use occurrence maxSpaces if set, otherwise leave empty to show it's using event default
		formData = {
			startsAt: startDate,
			endsAt: endDate,
			location: occurrence.location || '',
			maxSpaces: occurrence.maxSpaces !== null && occurrence.maxSpaces !== undefined ? occurrence.maxSpaces.toString() : ''
		};
		information = occurrence.information || '';
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this occurrence?', 'Delete Occurrence');
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
</script>

{#if event && occurrence}
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex justify-between items-center mb-6">
			<div>
				<h2 class="text-2xl font-bold text-gray-900">Occurrence Details</h2>
				<p class="text-gray-600 mt-1">Event: {event.title}</p>
			</div>
			<div class="flex gap-2">
				{#if editing}
					<button
						type="submit"
						form="occurrence-edit-form"
						class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
					>
						Save Changes
					</button>
					<button
						type="button"
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
					>
						Back
					</button>
				{:else}
					<a
						href="/hub/events/{event.id}"
						class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
					>
						Back
					</a>
					<button
						on:click={() => editing = true}
						class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
					>
						Edit
					</button>
					<button
						on:click={handleDelete}
						class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form id="occurrence-edit-form" method="POST" action="?/update" use:enhance>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="information" value={information} />
				
				<!-- Date & Time Panel -->
				<div class="bg-gray-50 rounded-lg p-4 mb-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Date & Time</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField 
							label="Start Date & Time" 
							name="startsAt" 
							type="datetime-local" 
							bind:value={formData.startsAt} 
							required 
						/>
						<FormField 
							label="End Date & Time" 
							name="endsAt" 
							type="datetime-local" 
							bind:value={formData.endsAt} 
							required 
						/>
					</div>
				</div>
				
				<!-- Location & Capacity Panel -->
				<div class="bg-gray-50 rounded-lg p-4 mb-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Location & Capacity</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<FormField 
							label="Location" 
							name="location" 
							bind:value={formData.location} 
						/>
						<FormField 
							label="Number of Spaces (Override)" 
							name="maxSpaces" 
							type="number" 
							bind:value={formData.maxSpaces}
							help={event?.maxSpaces 
								? `Override the event default (${event.maxSpaces}). Leave empty to use event default (${event.maxSpaces}) or set a specific value for this occurrence.`
								: 'Override the event default (Unlimited). Leave empty to use event default (Unlimited) or set a specific value for this occurrence.'}
						/>
					</div>
				</div>
				
				<!-- Additional Information Panel -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
					<div class="mb-4">
						<HtmlEditor bind:value={information} name="information" />
						<p class="mt-1 text-sm text-gray-500">Additional information about this occurrence</p>
					</div>
				</div>
			</form>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Date & Time Panel -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Date & Time</h3>
					<dl class="space-y-3">
						<div>
							<dt class="text-sm font-medium text-gray-500">Start</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{occurrence.startsAt ? formatDateTimeUK(occurrence.startsAt) : '-'}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">End</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{occurrence.endsAt ? formatDateTimeUK(occurrence.endsAt) : '-'}
							</dd>
						</div>
					</dl>
				</div>
				
				<!-- Location & Capacity Panel -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Location & Capacity</h3>
					<dl class="space-y-3">
						{#if occurrence.location}
							<div>
								<dt class="text-sm font-medium text-gray-500">Location</dt>
								<dd class="mt-1 text-sm text-gray-900">{occurrence.location}</dd>
							</div>
						{/if}
						<div>
							<dt class="text-sm font-medium text-gray-500">Maximum Spaces</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{#if occurrence.maxSpaces !== null && occurrence.maxSpaces !== undefined}
									{occurrence.maxSpaces} (override)
								{:else if event.maxSpaces}
									{event.maxSpaces} (from event default)
								{:else}
									Unlimited
								{/if}
							</dd>
						</div>
					</dl>
				</div>
			</div>
			
			<!-- Additional Information Panel -->
			{#if occurrence.information}
				<div class="bg-gray-50 rounded-lg p-4 mt-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
					<div class="text-sm text-gray-900 prose prose-sm max-w-none">
						{@html occurrence.information}
					</div>
				</div>
			{/if}
		{/if}

	</div>

	<!-- Event Signups Section -->
	{#if event?.enableSignup}
		<div class="bg-white shadow rounded-lg p-6 mt-6">
			<h3 class="text-xl font-bold text-gray-900 mb-4">Event Signups</h3>
			
			{#if signups.length === 0}
				<p class="text-gray-500">No signups for this occurrence yet.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Guests</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Attendees</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Signed Up</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-200">
							{#each signups as signup}
								<tr>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{signup.contactName || signup.name || 'Unknown'}
										{#if signup.contactId}
											<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
												Contact
											</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{signup.email}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
										{signup.guestCount || 0}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
										{(signup.guestCount || 0) + 1}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
										{signup.createdAt ? formatDateTimeUK(signup.createdAt) : '-'}
									</td>
								</tr>
							{/each}
						</tbody>
						<tfoot class="bg-gray-50">
							<tr>
								<td colspan="2" class="px-6 py-3 text-sm font-medium text-gray-900">Total</td>
								<td class="px-6 py-3 text-sm font-medium text-gray-900">
									{signups.reduce((sum, s) => sum + (s.guestCount || 0), 0)}
								</td>
								<td class="px-6 py-3 text-sm font-bold text-gray-900">
									{signups.reduce((sum, s) => sum + (s.guestCount || 0) + 1, 0)}
								</td>
								<td class="px-6 py-3"></td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Rotas Section -->
	<div class="bg-white shadow rounded-lg p-6 mt-6">
		<h3 class="text-xl font-bold text-gray-900 mb-4">Rotas for this Occurrence</h3>
		
		{#if rotas.length === 0}
			<p class="text-gray-500">No rotas assigned to this occurrence.</p>
		{:else}
			<div class="space-y-6">
				{#each rotas as rota}
					<div class="border border-gray-200 rounded-lg p-4">
						<div class="flex justify-between items-start mb-3">
							<div>
								<h4 class="text-lg font-semibold text-gray-900">{rota.role}</h4>
								{#if rota.description}
									<p class="text-sm text-gray-600 mt-1">{rota.description}</p>
								{/if}
							</div>
							<div class="text-right">
								<div class="text-sm text-gray-600">
									<span class="font-medium text-brand-blue">{rota.assignedCount}</span> / <span class="text-gray-500">{rota.capacity || '∞'}</span>
								</div>
								<div class="text-xs text-gray-500 mt-1">
									{#if rota.spotsRemaining > 0}
										<span class="text-green-600">{rota.spotsRemaining} spots remaining</span>
									{:else if rota.spotsRemaining === 0}
										<span class="text-red-600">Full</span>
									{/if}
								</div>
							</div>
						</div>

						{#if rota.assigneesForOcc && rota.assigneesForOcc.length > 0}
							<div class="mt-4">
								<h5 class="text-sm font-medium text-gray-700 mb-2">Signed Up:</h5>
								<ul class="space-y-1">
									{#each rota.assigneesForOcc as assignee}
										<li class="text-sm text-gray-600 flex items-center gap-2">
											<span class="w-2 h-2 bg-brand-green rounded-full"></span>
											<span>{assignee.name}</span>
											{#if assignee.email}
												<span class="text-gray-400">({assignee.email})</span>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{:else}
							<p class="text-sm text-gray-500 mt-2">No one signed up yet.</p>
						{/if}

						<div class="mt-3">
							<a 
								href="/hub/rotas/{rota.id}" 
								class="text-sm text-brand-blue hover:text-brand-blue/80 underline"
							>
								View rota details →
							</a>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

