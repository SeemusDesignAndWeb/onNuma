<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

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
		subscribed: true // Default to subscribed for new contacts
	};

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
</script>

<div class="space-y-6">
	<div class="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg rounded-lg p-6 text-white">
		<div class="flex items-center gap-3">
			<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
			</svg>
			<h2 class="text-3xl font-bold text-white">New Contact</h2>
		</div>
		<p class="mt-2 text-blue-100">Add a new contact to your database</p>
	</div>

	<form method="POST" action="?/create" use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
		<input type="hidden" name="servingAreas" value={JSON.stringify(formData.servingAreas)} />
		<input type="hidden" name="giftings" value={JSON.stringify(formData.giftings)} />
		
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Personal Information Panel -->
			<div class="bg-white border-2 border-blue-200 rounded-lg shadow-md overflow-hidden">
				<div class="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
					<div class="flex items-center gap-2">
						<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
						<h3 class="text-lg font-semibold text-white">Personal Information</h3>
					</div>
				</div>
				<div class="p-6 space-y-4">
					<FormField label="Email" name="email" type="email" bind:value={formData.email} required />
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="First Name" name="firstName" bind:value={formData.firstName} />
						<FormField label="Last Name" name="lastName" bind:value={formData.lastName} />
					</div>
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
				</div>
			</div>

			<!-- Address Panel -->
			<div class="bg-white border-2 border-purple-200 rounded-lg shadow-md overflow-hidden">
				<div class="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
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
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="City" name="city" bind:value={formData.city} />
						<FormField label="County" name="county" bind:value={formData.county} />
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="Postcode" name="postcode" bind:value={formData.postcode} />
						<FormField label="Country" name="country" bind:value={formData.country} />
					</div>
				</div>
			</div>

			<!-- Church Membership Panel -->
			<div class="bg-white border-2 border-green-200 rounded-lg shadow-md overflow-hidden">
				<div class="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
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
				</div>
			</div>

			<!-- Additional Information Panel -->
			<div class="bg-white border-2 border-orange-200 rounded-lg shadow-md overflow-hidden">
				<div class="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
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
								class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2"
								on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addServingArea())}
							/>
							<button type="button" on:click={addServingArea} class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
								Add
							</button>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each formData.servingAreas as area, i}
								<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 border border-green-300">
									{area}
									<button type="button" on:click={() => removeServingArea(i)} class="ml-2 text-green-600 hover:text-green-800 font-bold">×</button>
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
								class="flex-1 rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 px-4 py-2"
								on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addGifting())}
							/>
							<button type="button" on:click={addGifting} class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
								Add
							</button>
						</div>
						<div class="flex flex-wrap gap-2">
							{#each formData.giftings as gifting, i}
								<span class="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 border border-blue-300">
									{gifting}
									<button type="button" on:click={() => removeGifting(i)} class="ml-2 text-blue-600 hover:text-blue-800 font-bold">×</button>
								</span>
							{/each}
						</div>
					</div>
					
					<FormField label="Notes" name="notes" type="textarea" rows="4" bind:value={formData.notes} />
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="bg-white border-2 border-gray-200 rounded-lg shadow-md p-6">
			<div class="flex gap-3 justify-end">
				<a href="/hub/contacts" class="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 font-medium inline-flex items-center gap-2">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
					Cancel
				</a>
				<button type="submit" class="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 font-medium inline-flex items-center gap-2">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					Create Contact
				</button>
			</div>
		</div>
	</form>
</div>

