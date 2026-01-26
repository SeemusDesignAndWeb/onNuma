<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: contact = $page.data?.contact;
	$: spouse = $page.data?.spouse;
	$: contacts = $page.data?.contacts || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			notifications.success('Contact updated successfully');
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	let editing = false;
	let initialized = false;
	let formData = {
		email: '',
		firstName: '',
		lastName: '',
		phone: '',
		addressLine1: '',
		addressLine2: '',
		city: '',
		county: '',
		postcode: '',
		country: 'United Kingdom',
		membershipStatus: '',
		dateJoined: '',
		baptismDate: '',
		servingAreas: [],
		giftings: [],
		notes: '',
		subscribed: true,
		spouseId: ''
	};

	// Only initialize formData when contact loads and not currently editing
	$: if (contact && !editing && !initialized) {
		formData = {
			email: contact.email || '',
			firstName: contact.firstName || '',
			lastName: contact.lastName || '',
			phone: contact.phone || '',
			addressLine1: contact.addressLine1 || '',
			addressLine2: contact.addressLine2 || '',
			city: contact.city || '',
			county: contact.county || '',
			postcode: contact.postcode || '',
			country: contact.country || 'United Kingdom',
			membershipStatus: contact.membershipStatus || '',
			dateJoined: contact.dateJoined || '',
			baptismDate: contact.baptismDate || '',
			servingAreas: Array.isArray(contact.servingAreas) ? contact.servingAreas : [],
			giftings: Array.isArray(contact.giftings) ? contact.giftings : [],
			notes: contact.notes || '',
			subscribed: contact.subscribed !== false, // Default to true if not set
			spouseId: contact.spouseId || ''
		};
		initialized = true;
	}

	// Reset initialized flag when exiting edit mode
	$: if (!editing && initialized) {
		initialized = false;
	}

	let servingAreaInput = '';
	let giftingInput = '';

	function addServingArea() {
		if (servingAreaInput.trim()) {
			formData.servingAreas = [...formData.servingAreas, servingAreaInput.trim()];
			servingAreaInput = '';
		}
	}

	function removeServingArea(index) {
		formData.servingAreas = formData.servingAreas.filter((_, i) => i !== index);
	}

	function addGifting() {
		if (giftingInput.trim()) {
			formData.giftings = [...formData.giftings, giftingInput.trim()];
			giftingInput = '';
		}
	}

	function removeGifting(index) {
		formData.giftings = formData.giftings.filter((_, i) => i !== index);
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this contact?', 'Delete Contact');
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

{#if contact}
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex justify-between items-center mb-6">
			<h2 class="text-2xl font-bold text-gray-900">Contact Details</h2>
			<div class="flex gap-2">
				{#if editing}
					<button
						type="submit"
						form="contact-edit-form"
						class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700"
					>
						Save Changes
					</button>
					<button
						type="button"
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700"
					>
						Back
					</button>
				{:else}
					<button
						on:click={() => editing = true}
						class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700"
					>
						Edit
					</button>
					<button
						on:click={handleDelete}
						class="bg-hub-red-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-red-700"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form id="contact-edit-form" method="POST" action="?/update" use:enhance>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="servingAreas" value={JSON.stringify(formData.servingAreas)} />
				<input type="hidden" name="giftings" value={JSON.stringify(formData.giftings)} />
				
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Personal Information Panel -->
					<div class="bg-white border-2 border-hub-blue-200 rounded-lg shadow-md overflow-hidden">
						<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 px-6 py-4">
							<div class="flex items-center gap-2">
								<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
								</svg>
								<h3 class="text-lg font-semibold text-white">Personal Information</h3>
							</div>
						</div>
						<div class="p-6 space-y-4">
							<FormField label="Email" name="email" type="email" bind:value={formData.email} required />
							<FormField label="First Name" name="firstName" bind:value={formData.firstName} />
							<FormField label="Last Name" name="lastName" bind:value={formData.lastName} />
							<FormField label="Phone" name="phone" bind:value={formData.phone} />
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Spouse</label>
								<select name="spouseId" bind:value={formData.spouseId} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-blue-500 focus:ring-hub-blue-500 py-3 px-4">
									<option value="">None</option>
									{#each contacts as contactOption}
										<option value={contactOption.id}>
											{contactOption.firstName || ''} {contactOption.lastName || ''} {contactOption.email ? `(${contactOption.email})` : ''}
										</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="flex items-center cursor-pointer">
									<input
										type="checkbox"
										name="subscribed"
										bind:checked={formData.subscribed}
										class="w-3 h-3 rounded border-gray-300 text-hub-green-600 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 cursor-pointer"
									/>
									<span class="ml-2 text-sm text-gray-700">Subscribed to newsletters</span>
								</label>
							</div>
						</div>
					</div>

					<!-- Address Panel -->
					<div class="bg-white border-2 border-hub-blue-200 rounded-lg shadow-md overflow-hidden">
						<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 px-6 py-4">
							<div class="flex items-center gap-2">
								<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<h3 class="text-lg font-semibold text-white">Address</h3>
							</div>
						</div>
						<div class="p-6 space-y-4">
							<FormField label="Address Line 1" name="addressLine1" bind:value={formData.addressLine1} />
							<FormField label="Address Line 2" name="addressLine2" bind:value={formData.addressLine2} />
							<FormField label="City" name="city" bind:value={formData.city} />
							<FormField label="County" name="county" bind:value={formData.county} />
							<FormField label="Postcode" name="postcode" bind:value={formData.postcode} />
							<FormField label="Country" name="country" bind:value={formData.country} />
						</div>
					</div>

					<!-- Church Membership Panel -->
					<div class="bg-white border-2 border-hub-green-200 rounded-lg shadow-md overflow-hidden">
						<div class="bg-gradient-to-r from-hub-green-500 to-hub-green-600 px-6 py-4">
							<div class="flex items-center gap-2">
								<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
								</svg>
								<h3 class="text-lg font-semibold text-white">Church Membership</h3>
							</div>
						</div>
						<div class="p-6 space-y-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Membership Status</label>
								<select name="membershipStatus" bind:value={formData.membershipStatus} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-3 px-4">
									<option value="">Select status</option>
									<option value="member">Member</option>
									<option value="regular-attender">Regular Attender</option>
									<option value="visitor">Visitor</option>
									<option value="former-member">Former Member</option>
								</select>
							</div>
							<FormField label="Date Joined" name="dateJoined" type="date" bind:value={formData.dateJoined} />
							<FormField label="Baptism Date" name="baptismDate" type="date" bind:value={formData.baptismDate} />
						</div>
					</div>

					<!-- Additional Information Panel -->
					<div class="bg-white border-2 border-hub-yellow-200 rounded-lg shadow-md overflow-hidden">
						<div class="bg-gradient-to-r from-hub-yellow-500 to-hub-yellow-600 px-6 py-4">
							<div class="flex items-center gap-2">
								<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
								<h3 class="text-lg font-semibold text-white">Additional Information</h3>
							</div>
						</div>
						<div class="p-6 space-y-4">
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Serving Areas</label>
								<div class="flex gap-2 mb-2">
									<input
										type="text"
										bind:value={servingAreaInput}
										placeholder="Add serving area"
										class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-2.5 py-1.5"
										on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addServingArea())}
									/>
									<button type="button" on:click={addServingArea} class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
										Add
									</button>
								</div>
								<div class="flex flex-wrap gap-2">
									{#each formData.servingAreas as area, i}
										<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-hub-green-100 text-hub-green-800 border border-hub-green-300">
											{area}
											<button type="button" on:click={() => removeServingArea(i)} class="ml-2 text-hub-green-600 hover:text-hub-green-800 font-bold">×</button>
										</span>
									{/each}
								</div>
							</div>
							
							<div>
								<label class="block text-sm font-medium text-gray-700 mb-1">Giftings</label>
								<div class="flex gap-2 mb-2">
									<input
										type="text"
										bind:value={giftingInput}
										placeholder="Add gifting"
										class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 px-2.5 py-1.5"
										on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addGifting())}
									/>
									<button type="button" on:click={addGifting} class="bg-hub-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-blue-700">
										Add
									</button>
								</div>
								<div class="flex flex-wrap gap-2">
									{#each formData.giftings as gifting, i}
										<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-hub-blue-100 text-hub-blue-800 border border-hub-blue-300">
											{gifting}
											<button type="button" on:click={() => removeGifting(i)} class="ml-2 text-hub-blue-600 hover:text-hub-blue-800 font-bold">×</button>
										</span>
									{/each}
								</div>
							</div>
							
							<FormField label="Notes" name="notes" type="textarea" rows="4" bind:value={formData.notes} />
						</div>
					</div>
				</div>
			</form>
		{:else}
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
					<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<dt class="text-sm font-medium text-gray-500">Email</dt>
							<dd class="mt-1 text-sm text-gray-900">{contact.email}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">First Name</dt>
							<dd class="mt-1 text-sm text-gray-900">{contact.firstName || '-'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Last Name</dt>
							<dd class="mt-1 text-sm text-gray-900">{contact.lastName || '-'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Phone</dt>
							<dd class="mt-1 text-sm text-gray-900">{contact.phone || '-'}</dd>
						</div>
						{#if spouse}
							<div>
								<dt class="text-sm font-medium text-gray-500">Spouse</dt>
								<dd class="mt-1 text-sm text-gray-900">
									<a href="/hub/contacts/{spouse.id}" class="text-hub-blue-600 hover:text-hub-blue-800 underline">
										{spouse.firstName || ''} {spouse.lastName || ''} {spouse.email ? `(${spouse.email})` : ''}
									</a>
								</dd>
							</div>
						{/if}
					</dl>
				</div>
				
				{#if contact.addressLine1 || contact.city || contact.postcode}
					<div>
						<h3 class="text-lg font-semibold text-gray-900 mb-4">Address</h3>
						<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{#if contact.addressLine1}
								<div class="sm:col-span-2">
									<dt class="text-sm font-medium text-gray-500">Address</dt>
									<dd class="mt-1 text-sm text-gray-900">
										{contact.addressLine1}
										{#if contact.addressLine2}<br>{contact.addressLine2}{/if}
									</dd>
								</div>
							{/if}
							{#if contact.city}
								<div>
									<dt class="text-sm font-medium text-gray-500">City</dt>
									<dd class="mt-1 text-sm text-gray-900">{contact.city}</dd>
								</div>
							{/if}
							{#if contact.county}
								<div>
									<dt class="text-sm font-medium text-gray-500">County</dt>
									<dd class="mt-1 text-sm text-gray-900">{contact.county}</dd>
								</div>
							{/if}
							{#if contact.postcode}
								<div>
									<dt class="text-sm font-medium text-gray-500">Postcode</dt>
									<dd class="mt-1 text-sm text-gray-900">{contact.postcode}</dd>
								</div>
							{/if}
							{#if contact.country}
								<div>
									<dt class="text-sm font-medium text-gray-500">Country</dt>
									<dd class="mt-1 text-sm text-gray-900">{contact.country}</dd>
								</div>
							{/if}
						</dl>
					</div>
				{/if}
				
				<div>
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Church Membership</h3>
					<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{#if contact.membershipStatus}
							<div>
								<dt class="text-sm font-medium text-gray-500">Membership Status</dt>
								<dd class="mt-1 text-sm text-gray-900 capitalize">{contact.membershipStatus.replace('-', ' ')}</dd>
							</div>
						{/if}
						{#if contact.dateJoined}
							<div>
								<dt class="text-sm font-medium text-gray-500">Date Joined</dt>
								<dd class="mt-1 text-sm text-gray-900">{formatDateUK(contact.dateJoined)}</dd>
							</div>
						{/if}
						{#if contact.baptismDate}
							<div>
								<dt class="text-sm font-medium text-gray-500">Baptism Date</dt>
								<dd class="mt-1 text-sm text-gray-900">{formatDateUK(contact.baptismDate)}</dd>
							</div>
						{/if}
						{#if contact.servingAreas && contact.servingAreas.length > 0}
							<div class="sm:col-span-2">
								<dt class="text-sm font-medium text-gray-500">Serving Areas</dt>
								<dd class="mt-1 flex flex-wrap gap-2">
									{#each contact.servingAreas as area}
										<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-hub-green-100 text-hub-green-800">{area}</span>
									{/each}
								</dd>
							</div>
						{/if}
						{#if contact.giftings && contact.giftings.length > 0}
							<div class="sm:col-span-2">
								<dt class="text-sm font-medium text-gray-500">Giftings</dt>
								<dd class="mt-1 flex flex-wrap gap-2">
									{#each contact.giftings as gifting}
										<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-hub-blue-100 text-hub-blue-800">{gifting}</span>
									{/each}
								</dd>
							</div>
						{/if}
						<div>
							<dt class="text-sm font-medium text-gray-500">Newsletter Subscription</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{#if contact.subscribed !== false}
									<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-hub-green-100 text-hub-green-800">Subscribed</span>
								{:else}
									<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-hub-red-100 text-hub-red-800">Unsubscribed</span>
								{/if}
							</dd>
						</div>
					</dl>
				</div>
				
				{#if contact.notes}
					<div>
						<h3 class="text-lg font-semibold text-gray-900 mb-4">Notes</h3>
						<p class="text-sm text-gray-900">{contact.notes}</p>
					</div>
				{/if}
				
				<div>
					<dt class="text-sm font-medium text-gray-500">Created</dt>
					<dd class="mt-1 text-sm text-gray-900">
						{contact.createdAt ? formatDateTimeUK(contact.createdAt) : '-'}
					</dd>
				</div>
			</div>
		{/if}

	</div>
{/if}

