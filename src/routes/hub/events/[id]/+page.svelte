<script>
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import Table from '$lib/crm/components/Table.svelte';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: event = $page.data?.event;
	$: occurrences = $page.data?.occurrences || [];
	$: rotas = $page.data?.rotas || [];
	$: rotaSignupLink = $page.data?.rotaSignupLink || '';
	$: publicEventLink = $page.data?.publicEventLink || '';
	$: occurrenceLinks = $page.data?.occurrenceLinks || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	let rotaLinkCopied = false;
	let publicLinkCopied = false;
	let occurrenceLinkCopied = {};

	async function copyRotaSignupLink() {
		if (!rotaSignupLink) return;
		try {
			await navigator.clipboard.writeText(rotaSignupLink);
			rotaLinkCopied = true;
			notifications.success('Rota signup link copied to clipboard!');
			setTimeout(() => {
				rotaLinkCopied = false;
			}, 2000);
		} catch (error) {
			notifications.error('Failed to copy link');
		}
	}

	async function copyPublicEventLink() {
		if (!publicEventLink) return;
		try {
			await navigator.clipboard.writeText(publicEventLink);
			publicLinkCopied = true;
			notifications.success('Public event link copied to clipboard!');
			setTimeout(() => {
				publicLinkCopied = false;
			}, 2000);
		} catch (error) {
			notifications.error('Failed to copy link');
		}
	}
	
	// Show notifications from form results
	$: if (formResult?.success) {
		notifications.success('Event updated successfully');
	}
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let editing = false;
	let description = event?.description || '';
	let formData = {
		title: event?.title || '',
		location: event?.location || '',
		visibility: event?.visibility || 'private',
		maxSpaces: ''
	};

	$: if (event) {
		formData = {
			title: event.title || '',
			location: event.location || '',
			visibility: event.visibility || 'private',
			maxSpaces: event.maxSpaces ? event.maxSpaces.toString() : ''
		};
		description = event.description || '';
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this event? This will also delete all occurrences and rotas.', 'Delete Event');
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

	$: occurrenceColumns = [
		{ 
			key: 'startsAt', 
			label: 'Date/Time',
			render: (val, row) => {
				if (!val) return '-';
				const start = formatDateTimeUK(val);
				const end = row.endsAt ? formatDateTimeUK(row.endsAt) : '';
				return end ? `${start}<br><span class="text-gray-500 text-xs">to ${end}</span>` : start;
			}
		},
		{ 
			key: 'location', 
			label: 'Location',
			render: (val) => val || '-'
		},
		{ 
			key: 'signupStats', 
			label: 'Signups',
			render: (stats, row) => {
				if (!stats) return '-';
				const { signupCount, totalAttendees, availableSpots, isFull } = stats;
				const effectiveMaxSpaces = row.maxSpaces !== null && row.maxSpaces !== undefined 
					? row.maxSpaces 
					: (event?.maxSpaces || null);
				
				if (!effectiveMaxSpaces) {
					return `${signupCount} (${totalAttendees})`;
				}
				
				if (isFull) {
					return `<span class="text-red-600 font-medium">${signupCount} / ${effectiveMaxSpaces} Full</span>`;
				}
				return `${signupCount} / ${effectiveMaxSpaces}<br><span class="text-green-600 text-xs">${availableSpots} left</span>`;
			}
		},
		{ 
			key: 'rotaStats', 
			label: 'Rotas',
			render: (stats) => {
				if (!stats || stats.rotaCount === 0) return '-';
				const { rotaCount, totalAssigned, totalCapacity } = stats;
				if (totalCapacity === 0) return `${rotaCount}`;
				return `${rotaCount}<br><span class="text-gray-500 text-xs">${totalAssigned}/${totalCapacity}</span>`;
			}
		},
		{
			key: 'id',
			label: '',
			render: (id) => {
				const linkData = occurrenceLinks.find(l => l.occurrenceId === id);
				if (!linkData) return '-';
				const escapedLink = linkData.link.replace(/"/g, '&quot;');
				const escapedId = String(id).replace(/"/g, '&quot;');
				return `
					<div class="flex items-center gap-1" data-occurrence-id="${escapedId}" data-occurrence-link="${escapedLink}">
						<button 
							type="button"
							class="copy-occurrence-link p-1.5 rounded hover:bg-purple-100 text-purple-600"
							title="Copy link"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
						</button>
						<a 
							href="${escapedLink}" 
							target="_blank" 
							rel="noopener noreferrer"
							class="p-1.5 rounded hover:bg-purple-100 text-purple-600"
							title="Open link"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
							</svg>
						</a>
					</div>
				`;
			}
		}
	];

	onMount(() => {
		// Handle copy button clicks
		const handleCopyClick = (e) => {
			// Check if clicking on copy button or its SVG child
			const button = e.target.closest('.copy-occurrence-link');
			if (!button) return;
			
			e.stopPropagation();
			e.preventDefault();
			
			const container = button.closest('[data-occurrence-id]');
			if (!container) return;
			
			const occurrenceId = container.getAttribute('data-occurrence-id');
			const link = container.getAttribute('data-occurrence-link');
			
			if (link && occurrenceId) {
				navigator.clipboard.writeText(link).then(() => {
					occurrenceLinkCopied = { ...occurrenceLinkCopied, [occurrenceId]: true };
					notifications.success('Occurrence link copied!');
					
					// Update button icon
					button.innerHTML = `
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
						</svg>
					`;
					
					setTimeout(() => {
						occurrenceLinkCopied = { ...occurrenceLinkCopied, [occurrenceId]: false };
						button.innerHTML = `
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
						`;
					}, 2000);
				}).catch((err) => {
					console.error('Failed to copy link:', err);
					notifications.error('Failed to copy link');
				});
			}
		};
		
		// Use capture phase to catch events early
		document.addEventListener('click', handleCopyClick, true);
		
		return () => {
			document.removeEventListener('click', handleCopyClick, true);
		};
	});

	const rotaColumns = [
		{ key: 'role', label: 'Role' },
		{ key: 'capacity', label: 'Capacity' },
		{ 
			key: 'assignees', 
			label: 'Assigned',
			render: (val) => Array.isArray(val) ? val.length : 0
		}
	];
</script>

{#if event}
	<div class="bg-white shadow rounded-lg p-6 mb-6">
		<div class="flex justify-between items-center mb-6">
			<h2 class="text-2xl font-bold text-gray-900">Event Details</h2>
			<div class="flex gap-2">
				{#if editing}
					<button
						type="submit"
						form="event-edit-form"
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
						href="/hub/events/{event.id}/ics"
						class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
						download
					>
						Download ICS
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
			<form id="event-edit-form" method="POST" action="?/update" use:enhance>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="description" value={description} />
				
				<!-- Basic Information Panel -->
				<div class="bg-gray-50 rounded-lg p-4 mb-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="md:col-span-3">
							<FormField label="Title" name="title" bind:value={formData.title} required />
						</div>
						<FormField label="Location" name="location" bind:value={formData.location} />
						<div class="mb-4">
							<label class="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
							<select name="visibility" bind:value={formData.visibility} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
								<option value="private">Private</option>
								<option value="public">Public</option>
							</select>
						</div>
						<FormField 
							label="Default Number of Spaces" 
							name="maxSpaces" 
							type="number" 
							bind:value={formData.maxSpaces}
							help="Default maximum number of people who can sign up for occurrences of this event (can be overridden per occurrence, leave empty for unlimited)"
						/>
					</div>
				</div>
				
				<!-- Description Panel -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Description</h3>
					<div class="mb-4">
						<HtmlEditor bind:value={description} name="description" />
					</div>
				</div>
			</form>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Basic Information Panel -->
				<div class="bg-gray-50 rounded-lg p-4">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
					<dl class="space-y-3">
						<div>
							<dt class="text-sm font-medium text-gray-500">Title</dt>
							<dd class="mt-1 text-sm text-gray-900">{event.title}</dd>
						</div>
						{#if event.location}
							<div>
								<dt class="text-sm font-medium text-gray-500">Location</dt>
								<dd class="mt-1 text-sm text-gray-900">{event.location}</dd>
							</div>
						{/if}
						<div>
							<dt class="text-sm font-medium text-gray-500">Visibility</dt>
							<dd class="mt-1 text-sm text-gray-900 capitalize">{event.visibility || 'private'}</dd>
						</div>
						{#if event.maxSpaces !== null && event.maxSpaces !== undefined}
							<div>
								<dt class="text-sm font-medium text-gray-500">Default Maximum Spaces</dt>
								<dd class="mt-1 text-sm text-gray-900">{event.maxSpaces}</dd>
							</div>
						{/if}
					</dl>
				</div>
				
				<!-- Description Panel -->
				{#if event.description}
					<div class="bg-gray-50 rounded-lg p-4">
						<h3 class="text-lg font-semibold text-gray-900 mb-4">Description</h3>
						<div class="text-sm text-gray-900 prose prose-sm max-w-none">
							{@html event.description}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		{#if publicEventLink || rotaSignupLink || occurrenceLinks.length > 0}
			<div class="mt-6 space-y-3">
				<div class="flex flex-wrap gap-2">
					{#if publicEventLink}
						<button
							on:click={copyPublicEventLink}
							class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
						>
							{#if publicLinkCopied}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Copied!
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
								Copy Event Link (All)
							{/if}
						</button>
						<a
							href={publicEventLink}
							target="_blank"
							rel="noopener noreferrer"
							class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
							</svg>
							Open Event (All)
						</a>
					{/if}
					{#if rotaSignupLink}
						<button
							on:click={copyRotaSignupLink}
							class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
						>
							{#if rotaLinkCopied}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
								Copied!
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
								Copy Rota Link
							{/if}
						</button>
						<a
							href={rotaSignupLink}
							target="_blank"
							rel="noopener noreferrer"
							class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
							</svg>
							Open Rota Signup
						</a>
					{/if}
				</div>
			</div>
		{/if}

	</div>

	<div class="bg-white shadow rounded-lg p-6 mb-6">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-xl font-bold text-gray-900">Occurrences</h3>
			<a href="/hub/events/{event.id}/occurrences/new" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
				Add Occurrence
			</a>
		</div>
		<Table columns={occurrenceColumns} rows={occurrences} onRowClick={(row) => goto(`/hub/events/${event.id}/occurrences/${row.id}`)} />
		
		<!-- Signup Details for Each Occurrence -->
		{#if occurrences.some(occ => occ.signupStats?.signupCount > 0)}
			<div class="mt-6 pt-6 border-t border-gray-200">
				<h4 class="text-lg font-semibold text-gray-900 mb-4">Event Signups</h4>
				<div class="space-y-6">
					{#each occurrences as occ}
						{#if occ.signupStats?.signupCount > 0}
							<div class="border border-gray-200 rounded-lg p-4">
								<div class="flex justify-between items-start mb-3">
									<div>
										<h5 class="font-medium text-gray-900">
											{formatDateTimeUK(occ.startsAt)}
										</h5>
										<p class="text-sm text-gray-600 mt-1">
											{occ.signupStats.signupCount} {occ.signupStats.signupCount === 1 ? 'person has' : 'people have'} signed up
											({occ.signupStats.totalAttendees} total attendees including guests)
										</p>
										{#if occ.maxSpaces}
											<p class="text-sm text-gray-600 mt-1">
												Spots: {occ.signupStats.totalAttendees} / {occ.maxSpaces}
												{#if occ.signupStats.isFull}
													<span class="text-red-600 font-medium ml-2">(Full)</span>
												{:else}
													<span class="text-green-600 ml-2">({occ.signupStats.availableSpots} available)</span>
												{/if}
											</p>
										{/if}
									</div>
								</div>
								<div class="mt-3">
									<h6 class="text-sm font-medium text-gray-700 mb-2">Signups:</h6>
									<ul class="space-y-2">
										{#each occ.signupStats.signups as signup}
											<li class="text-sm text-gray-600 flex items-start gap-2">
												<span class="w-2 h-2 bg-green-500 rounded-full mt-2"></span>
												<div>
													<span class="font-medium">{signup.name}</span>
													<span class="text-gray-400"> ({signup.email})</span>
													{#if signup.guestCount > 0}
														<span class="text-gray-500"> - {signup.guestCount} {signup.guestCount === 1 ? 'guest' : 'guests'}</span>
													{/if}
												</div>
											</li>
										{/each}
									</ul>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-xl font-bold text-gray-900">Rotas</h3>
			<a href="/hub/rotas/new?eventId={event.id}" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
				Add Rota
			</a>
		</div>
		<Table columns={rotaColumns} rows={rotas} onRowClick={(row) => goto(`/hub/rotas/${row.id}`)} />
	</div>
{/if}

