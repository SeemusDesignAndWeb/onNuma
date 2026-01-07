<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: contact = $page.data?.contact;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Show notifications from form results
	$: if (formResult?.success) {
		notifications.success('Contact updated successfully');
	}
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let editing = false;
	let formData = {
		email: contact?.email || '',
		firstName: contact?.firstName || '',
		lastName: contact?.lastName || '',
		phone: contact?.phone || '',
		addressLine1: contact?.addressLine1 || '',
		addressLine2: contact?.addressLine2 || '',
		city: contact?.city || '',
		county: contact?.county || '',
		postcode: contact?.postcode || '',
		country: contact?.country || 'United Kingdom',
		membershipStatus: contact?.membershipStatus || '',
		dateJoined: contact?.dateJoined || '',
		baptismDate: contact?.baptismDate || '',
		servingAreas: contact?.servingAreas || [],
		giftings: contact?.giftings || [],
		notes: contact?.notes || '',
		subscribed: contact?.subscribed !== false // Default to true if not set
	};

	$: if (contact) {
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
			subscribed: contact.subscribed !== false // Default to true if not set
		};
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
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
					>
						Cancel
					</button>
				{:else}
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
			<form method="POST" action="?/update" use:enhance>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="servingAreas" value={JSON.stringify(formData.servingAreas)} />
				<input type="hidden" name="giftings" value={JSON.stringify(formData.giftings)} />
				
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
				<FormField label="Email" name="email" type="email" bind:value={formData.email} required />
				<FormField label="First Name" name="firstName" bind:value={formData.firstName} />
				<FormField label="Last Name" name="lastName" bind:value={formData.lastName} />
				<FormField label="Phone" name="phone" bind:value={formData.phone} />
				
				<div class="mb-4">
					<label class="flex items-center">
						<input
							type="checkbox"
							name="subscribed"
							bind:checked={formData.subscribed}
							class="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-500 focus:ring-green-500"
						/>
						<span class="ml-2 text-sm text-gray-700">Subscribed to newsletters</span>
					</label>
				</div>
				
				<h3 class="text-lg font-semibold text-gray-900 mb-4 mt-6">Address</h3>
				<FormField label="Address Line 1" name="addressLine1" bind:value={formData.addressLine1} />
				<FormField label="Address Line 2" name="addressLine2" bind:value={formData.addressLine2} />
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="City" name="city" bind:value={formData.city} />
					<FormField label="County" name="county" bind:value={formData.county} />
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Postcode" name="postcode" bind:value={formData.postcode} />
					<FormField label="Country" name="country" bind:value={formData.country} />
				</div>
				
				<h3 class="text-lg font-semibold text-gray-900 mb-4 mt-6">Church Membership</h3>
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-1">Membership Status</label>
					<select name="membershipStatus" bind:value={formData.membershipStatus} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-green-500 focus:ring-green-500 py-3 px-4">
						<option value="">Select status</option>
						<option value="member">Member</option>
						<option value="regular-attender">Regular Attender</option>
						<option value="visitor">Visitor</option>
						<option value="former-member">Former Member</option>
					</select>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<FormField label="Date Joined" name="dateJoined" type="date" bind:value={formData.dateJoined} />
					<FormField label="Baptism Date" name="baptismDate" type="date" bind:value={formData.baptismDate} />
				</div>
				
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-1">Serving Areas</label>
					<div class="flex gap-2 mb-2">
						<input
							type="text"
							bind:value={servingAreaInput}
							placeholder="Add serving area"
							class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
							on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addServingArea())}
						/>
						<button type="button" on:click={addServingArea} class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
							Add
						</button>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each formData.servingAreas as area, i}
							<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
								{area}
								<button type="button" on:click={() => removeServingArea(i)} class="ml-2 text-green-600 hover:text-green-800">×</button>
							</span>
						{/each}
					</div>
				</div>
				
				<div class="mb-4">
					<label class="block text-sm font-medium text-gray-700 mb-1">Giftings</label>
					<div class="flex gap-2 mb-2">
						<input
							type="text"
							bind:value={giftingInput}
							placeholder="Add gifting"
							class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
							on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addGifting())}
						/>
						<button type="button" on:click={addGifting} class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">
							Add
						</button>
					</div>
					<div class="flex flex-wrap gap-2">
						{#each formData.giftings as gifting, i}
							<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
								{gifting}
								<button type="button" on:click={() => removeGifting(i)} class="ml-2 text-blue-600 hover:text-blue-800">×</button>
							</span>
						{/each}
					</div>
				</div>
				
				<FormField label="Notes" name="notes" type="textarea" rows="5" bind:value={formData.notes} />
				<button type="submit" class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
					Save Changes
				</button>
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
										<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">{area}</span>
									{/each}
								</dd>
							</div>
						{/if}
						{#if contact.giftings && contact.giftings.length > 0}
							<div class="sm:col-span-2">
								<dt class="text-sm font-medium text-gray-500">Giftings</dt>
								<dd class="mt-1 flex flex-wrap gap-2">
									{#each contact.giftings as gifting}
										<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">{gifting}</span>
									{/each}
								</dd>
							</div>
						{/if}
						<div>
							<dt class="text-sm font-medium text-gray-500">Newsletter Subscription</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{#if contact.subscribed !== false}
									<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">Subscribed</span>
								{:else}
									<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800">Unsubscribed</span>
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

