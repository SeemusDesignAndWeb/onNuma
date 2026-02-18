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
		subscribed: true,
		spouseId: '',
		sendWelcome: true
	};
</script>

<div class="space-y-6">
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">New Contact</h2>
			<div class="flex flex-wrap gap-2">
				<a href="/hub/contacts" class="bg-theme-button-3 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
					Cancel
				</a>
				<button type="submit" form="contact-create-form" class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded-md hover:opacity-90 text-xs">
					Create Contact
				</button>
			</div>
		</div>

		<form id="contact-create-form" method="POST" action="?/create" use:enhance>
			<input type="hidden" name="_csrf" value={csrfToken} />
			
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Personal Information -->
				<div class="space-y-4">
					<h3 class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Personal Information</h3>
					<FormField label="Email" name="email" type="email" bind:value={formData.email} required />
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<FormField label="First Name" name="firstName" bind:value={formData.firstName} />
						<FormField label="Last Name" name="lastName" bind:value={formData.lastName} />
					</div>
					<FormField label="Phone" name="phone" bind:value={formData.phone} />
					<div>
						<label for="spouseId" class="block text-sm font-medium text-gray-700 mb-1">Partner</label>
						<select id="spouseId" name="spouseId" bind:value={formData.spouseId} class="block w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-theme-button-1 py-2.5 px-3 text-sm">
							<option value="">None</option>
							{#each contacts as contact}
								<option value={contact.id}>
									{contact.firstName || ''} {contact.lastName || ''} {contact.email ? `(${contact.email})` : ''}
								</option>
							{/each}
						</select>
					</div>
				<label class="flex items-center">
					<input
						type="checkbox"
						name="subscribed"
						bind:checked={formData.subscribed}
						class="rounded border-gray-300 text-hub-green-600 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2"
					/>
					<span class="ml-2 text-sm text-gray-700">Subscribed to newsletters</span>
				</label>
				<label class="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md cursor-pointer">
					<input
						type="checkbox"
						name="sendWelcome"
						bind:checked={formData.sendWelcome}
						disabled={!formData.email}
						class="mt-0.5 rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
					/>
					<span class="text-sm text-blue-900">
						<span class="font-semibold">Send MyHub welcome email</span><br>
						<span class="text-blue-700">Sends a personal welcome email with a "Visit My Hub" button — no password needed.</span>
					</span>
				</label>
				</div>

				<!-- Address -->
				<div class="space-y-4">
					<h3 class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Address</h3>
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

				<!-- Status -->
				<div class="space-y-4">
					<h3 class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Status</h3>
					<div>
						<label for="membershipStatus" class="block text-sm font-medium text-gray-700 mb-1">Membership Status</label>
						<select id="membershipStatus" name="membershipStatus" bind:value={formData.membershipStatus} class="block w-full rounded-md border border-gray-300 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2.5 px-3 text-sm">
							<option value="">Select status</option>
							<option value="member">Member</option>
							<option value="regular-attender">Regular Attender</option>
							<option value="visitor">Visitor</option>
							<option value="former-member">Former Member</option>
						</select>
					</div>
					<FormField label="Date Joined" name="dateJoined" type="date" bind:value={formData.dateJoined} />
				</div>

				<!-- Notes -->
				<div class="space-y-4">
					<h3 class="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Additional Information</h3>
					<FormField label="Notes" name="notes" type="textarea" rows="4" bind:value={formData.notes} />
				</div>
			</div>
		</form>
	</div>
</div>
