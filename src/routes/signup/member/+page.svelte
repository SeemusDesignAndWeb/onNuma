<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';
	import Navbar from '$lib/components/Navbar.svelte';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;

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
		subscribed: true // Default to subscribed for new members
	};

	let isSubmitting = false;

	function handleEnhance() {
		return async ({ update, result }) => {
			isSubmitting = true;
			if (result.type === 'success') {
				notifications.success(result.data?.message || 'Thank you for signing up!');
				// Reset form on success
				formData = {
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
					subscribed: true
				};
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to submit form. Please try again.');
			}
			await update();
			isSubmitting = false;
		};
	}
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header with EGCC branding - matching main website -->
	<Navbar bannerVisible={false} />

	<div class="max-w-4xl mx-auto py-8 px-4 sm:py-12 sm:px-6 lg:px-8 mt-16">
		<div class="bg-white shadow rounded-lg p-6 sm:p-8">
			<div class="mb-8">
				<h1 class="text-3xl font-bold text-brand-blue mb-2">Member Sign Up</h1>
				<p class="text-gray-600">Join our church community! Please fill out the form below to become a member.</p>
			</div>

			<form method="POST" action="?/signup" use:enhance={handleEnhance}>
				<input type="hidden" name="_csrf" value={csrfToken} />

				<div class="space-y-6">
					<!-- Personal Information Section -->
					<div>
						<h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
							<svg class="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
							Personal Information
						</h2>
						<div class="bg-gray-50 rounded-lg p-4 space-y-4">
							<div>
								<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
									Email <span class="text-red-500">*</span>
								</label>
								<input
									type="email"
									id="email"
									name="email"
									bind:value={formData.email}
									required
									class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
									placeholder="your.email@example.com"
								/>
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
									<input
										type="text"
										id="firstName"
										name="firstName"
										bind:value={formData.firstName}
										class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
										placeholder="John"
									/>
								</div>
								<div>
									<label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
									<input
										type="text"
										id="lastName"
										name="lastName"
										bind:value={formData.lastName}
										class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
										placeholder="Smith"
									/>
								</div>
							</div>
							<div>
								<label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
								<input
									type="tel"
									id="phone"
									name="phone"
									bind:value={formData.phone}
									class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
									placeholder="07123 456789"
								/>
							</div>
						</div>
					</div>

					<!-- Address Section -->
					<div>
						<h2 class="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
							<svg class="w-5 h-5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							Address
						</h2>
						<div class="bg-gray-50 rounded-lg p-4 space-y-4">
							<div>
								<label for="addressLine1" class="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
								<input
									type="text"
									id="addressLine1"
									name="addressLine1"
									bind:value={formData.addressLine1}
									class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
									placeholder="123 Main Street"
								/>
							</div>
							<div>
								<label for="addressLine2" class="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
								<input
									type="text"
									id="addressLine2"
									name="addressLine2"
									bind:value={formData.addressLine2}
									class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
									placeholder="Apartment, suite, etc. (optional)"
								/>
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label for="city" class="block text-sm font-medium text-gray-700 mb-1">City</label>
									<input
										type="text"
										id="city"
										name="city"
										bind:value={formData.city}
										class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
										placeholder="London"
									/>
								</div>
								<div>
									<label for="county" class="block text-sm font-medium text-gray-700 mb-1">County</label>
									<input
										type="text"
										id="county"
										name="county"
										bind:value={formData.county}
										class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
										placeholder="Greater London"
									/>
								</div>
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label for="postcode" class="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
									<input
										type="text"
										id="postcode"
										name="postcode"
										bind:value={formData.postcode}
										class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
										placeholder="SE9 1AB"
									/>
								</div>
								<div>
									<label for="country" class="block text-sm font-medium text-gray-700 mb-1">Country</label>
									<input
										type="text"
										id="country"
										name="country"
										bind:value={formData.country}
										class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4 transition-colors"
										placeholder="United Kingdom"
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Privacy Notice and Newsletter Subscription -->
				<div class="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
					<h3 class="text-lg font-semibold text-gray-900 mb-3">Privacy Notice</h3>
					<div class="text-sm text-gray-700 space-y-3 mb-4">
						<p>
							By submitting your details, you agree to the use of your information for appropriate church purposes, including:
						</p>
						<ul class="list-disc list-inside space-y-1 ml-2">
							<li>Church administration and member management</li>
							<li>Communication about church activities and events</li>
							<li>Coordination of rotas and volunteer opportunities</li>
							<li>Other areas of church involvement you may participate in</li>
						</ul>
						<p class="font-medium">
							You will receive emails relating to church involvement in rotas and other church areas you are involved.
						</p>
						<p>
							Your personal details are not available to all the church membership but only for those who are involved in ministries where contact with you is needed for the purpose of those ministries. Should you have any questions please speak to the leadership team.
						</p>
					</div>
					<div class="border-t border-blue-200 pt-4">
						<label class="flex items-start">
							<input
								type="checkbox"
								name="subscribed"
								bind:checked={formData.subscribed}
								class="mt-1 rounded border-gray-300 text-brand-green shadow-sm focus:border-brand-green focus:ring-brand-green"
							/>
							<span class="ml-3 text-sm text-gray-700">
								<strong>Subscribe to weekly newsletter</strong>
								<br>
								<span class="text-gray-600">If checked, you will receive the weekly newsletter via email.</span>
							</span>
						</label>
					</div>
				</div>

				{#if formResult?.type === 'failure' && formResult.data?.error}
					<div class="mt-6 bg-red-50 border border-red-200 rounded-md p-4">
						<p class="text-red-800">{formResult.data.error}</p>
					</div>
				{/if}

				<div class="mt-8 flex justify-end">
					<button
						type="submit"
						disabled={isSubmitting || !formData.email}
						class="bg-brand-green text-white px-8 py-3 rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all transform hover:scale-105 disabled:transform-none flex items-center justify-center gap-2"
					>
						{#if isSubmitting}
							<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Submitting...
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							Submit
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
	
	<!-- Notification Popups -->
	<NotificationPopup />
</div>
