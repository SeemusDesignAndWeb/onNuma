<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: contacts = $page.data?.contacts || [];
	
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
		notes: '',
		subscribed: true, // Default to subscribed for new contacts
		spouseId: ''
	};
</script>

<div class="space-y-6">
	<div class="hub-top-panel p-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
			<div>
				<div class="flex items-center gap-3">
					<svg class="w-6 h-6 sm:w-8 sm:h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
					</svg>
					<h2 class="text-2xl sm:text-3xl font-bold text-gray-900">New Contact</h2>
				</div>
				<p class="mt-2 text-gray-500 text-xs">Add a new contact to your database</p>
			</div>
			<div class="flex flex-wrap gap-2 sm:gap-3">
				<a href="/hub/contacts" class="hub-btn border border-gray-300 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
					Cancel
				</a>
				<button type="submit" form="contact-create-form" class="hub-btn btn-theme-2 inline-flex items-center gap-1.5">
					<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
					</svg>
					Create Contact
				</button>
			</div>
		</div>
	</div>

	<form id="contact-create-form" method="POST" action="?/create" use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
		
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Personal Information Panel -->
			<div class="hub-top-panel overflow-hidden">
				<div class="hub-top-panel-header flex items-center gap-2">
					<svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
					</svg>
					<h3 class="text-lg font-semibold text-gray-900">Personal Information</h3>
				</div>
				<div class="p-6 space-y-4">
					<FormField label="Email" name="email" type="email" bind:value={formData.email} required />
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="First Name" name="firstName" bind:value={formData.firstName} />
						<FormField label="Last Name" name="lastName" bind:value={formData.lastName} />
					</div>
					<FormField label="Phone" name="phone" bind:value={formData.phone} />
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Spouse</label>
						<select name="spouseId" bind:value={formData.spouseId} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-1 focus:ring-theme-button-1 py-3 px-4">
							<option value="">None</option>
							{#each contacts as contact}
								<option value={contact.id}>
									{contact.firstName || ''} {contact.lastName || ''} {contact.email ? `(${contact.email})` : ''}
								</option>
							{/each}
						</select>
					</div>
					<div class="mb-4">
						<label class="flex items-center">
							<input
								type="checkbox"
								name="subscribed"
								bind:checked={formData.subscribed}
								class="rounded border-gray-300 text-hub-green-600 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2"
							/>
							<span class="ml-2 text-sm text-gray-700">Subscribed to newsletters</span>
						</label>
					</div>
				</div>
			</div>

			<!-- Address Panel -->
			<div class="hub-top-panel overflow-hidden">
				<div class="hub-top-panel-header flex items-center gap-2">
					<svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
					<h3 class="text-lg font-semibold text-gray-900">Address</h3>
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
			<div class="bg-white border-2 border-hub-green-200 rounded-lg shadow-md overflow-hidden">
				<div class="bg-gradient-to-r from-hub-green-500 to-hub-green-600 px-6 py-4">
					<div class="flex items-center gap-2">
						<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
						</svg>
						<h3 class="text-lg font-semibold text-white">Status</h3>
					</div>
				</div>
				<div class="p-6 space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-1">Membership Status</label>
						<select name="membershipStatus" bind:value={formData.membershipStatus} class="mt-1 block w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-3 px-4">
							<option value="">Select status</option>
							<option value="member">Member</option>
							<option value="regular-attender">Regular Attender</option>
							<option value="visitor">Visitor</option>
							<option value="former-member">Former Member</option>
						</select>
					</div>
					<FormField label="Date Joined" name="dateJoined" type="date" bind:value={formData.dateJoined} />
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
					<FormField label="Notes" name="notes" type="textarea" rows="4" bind:value={formData.notes} />
				</div>
			</div>
		</div>
	</form>
</div>

