<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import Navbar from '$lib/components/Navbar.svelte';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: email = $page.data?.email || '';
	$: firstName = $page.data?.firstName || '';
	$: lastName = $page.data?.lastName || '';
	$: showForm = email && email.length > 0;

	let isSubmitting = false;
	let verifyData = {
		email: email || '',
		firstName: firstName || '',
		lastName: lastName || ''
	};

	let formData = {
		// Contact fields
		email: email || '',
		firstName: firstName || '',
		lastName: lastName || '',
		phone: '',
		subscribed: true,
		// Member fields
		title: '',
		dateOfBirth: '',
		placeOfBirth: '',
		maritalStatus: '',
		spouseName: '',
		childrenNamesAndAges: '',
		previousChurch: '',
		previousChurchFeelings: '',
		isChristFollower: '',
		becameChristFollowerDate: '',
		wantsHelpBecomingChristFollower: false,
		hasBeenWaterBaptised: '',
		wantsToTalkAboutBaptism: false,
		hasBeenFilledWithHolySpirit: '',
		wantsToKnowMoreAboutHolySpirit: false,
		membershipReflections: '',
		attendingCommunityGroup: '',
		wantsCommunityGroupInfo: false,
		currentlyServing: '',
		servingArea: '',
		desiredServingArea: '',
		additionalInfo: '',
		prayerSupportNeeds: '',
		elderMeetingAvailability: ''
	};

	// Initialize formData when email is available
	$: if (email && !formData.email) {
		formData.email = email;
		formData.firstName = firstName || '';
		formData.lastName = lastName || '';
	}

	function handleVerifyEnhance() {
		return async ({ update, result }) => {
			isSubmitting = true;
			if (result.type === 'success') {
				// Redirect will happen server-side
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to verify. Please try again.');
			}
			await update();
			isSubmitting = false;
		};
	}

	function handleSubmitEnhance() {
		return async ({ update, result }) => {
			isSubmitting = true;
			if (result.type === 'success') {
				notifications.success(result.data?.message || 'Thank you for submitting your membership form!');
				// Reset form
				formData = {
					email: '',
					firstName: '',
					lastName: '',
					phone: '',
					subscribed: true,
					title: '',
					dateOfBirth: '',
					placeOfBirth: '',
					maritalStatus: '',
					spouseName: '',
					childrenNamesAndAges: '',
					previousChurch: '',
					previousChurchFeelings: '',
					isChristFollower: '',
					becameChristFollowerDate: '',
					wantsHelpBecomingChristFollower: false,
					hasBeenWaterBaptised: '',
					wantsToTalkAboutBaptism: false,
					hasBeenFilledWithHolySpirit: '',
					wantsToKnowMoreAboutHolySpirit: false,
					membershipReflections: '',
					attendingCommunityGroup: '',
					wantsCommunityGroupInfo: false,
					currentlyServing: '',
					servingArea: '',
					desiredServingArea: '',
					additionalInfo: '',
					prayerSupportNeeds: '',
					elderMeetingAvailability: ''
				};
				// Redirect to home or thank you page
				setTimeout(() => {
					goto('/');
				}, 2000);
			} else if (result.type === 'failure') {
				notifications.error(result.data?.error || 'Failed to submit form. Please try again.');
			}
			await update();
			isSubmitting = false;
		};
	}
</script>

<Navbar bannerVisible={false} />

<div class="min-h-screen bg-gray-50 pt-20">
	<div class="max-w-6xl mx-auto py-8 px-4 sm:py-12 sm:px-6 lg:px-8">
		<div class="bg-white shadow-lg rounded-lg p-6 sm:p-8">
			<div class="mb-8 text-center">
				<h1 class="text-3xl sm:text-4xl font-bold text-brand-blue mb-2">EGCC Membership Form</h1>
				<p class="text-gray-600">Please complete this form to apply for membership at Eltham Green Community Church</p>
			</div>

			{#if !showForm}
				<!-- Step 1: Verify Name and Email -->
				<div class="max-w-md mx-auto">
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
						<h2 class="text-xl font-semibold text-gray-900 mb-2">Get Started</h2>
						<p class="text-sm text-gray-700">Please provide your name and email to access the membership form.</p>
					</div>

					<form method="POST" action="?/verify" use:enhance={handleVerifyEnhance}>
						<input type="hidden" name="_csrf" value={csrfToken} />
						
						<div class="space-y-4">
							<div>
								<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
									Email <span class="text-red-500">*</span>
								</label>
								<input
									type="email"
									id="email"
									name="email"
									bind:value={verifyData.email}
									required
									class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4"
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
										bind:value={verifyData.firstName}
										class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4"
										placeholder="John"
									/>
								</div>
								<div>
									<label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
									<input
										type="text"
										id="lastName"
										name="lastName"
										bind:value={verifyData.lastName}
										class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-4"
										placeholder="Smith"
									/>
								</div>
							</div>
						</div>

						{#if formResult?.type === 'failure' && formResult.data?.error}
							<div class="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
								<p class="text-red-800 text-sm">{formResult.data.error}</p>
							</div>
						{/if}

						<div class="mt-6">
							<button
								type="submit"
								disabled={isSubmitting || !verifyData.email}
								class="w-full bg-brand-green text-white px-6 py-3 rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all"
							>
								{#if isSubmitting}
									<span class="flex items-center justify-center gap-2">
										<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Verifying...
									</span>
								{:else}
									Continue to Membership Form
								{/if}
							</button>
						</div>
					</form>
				</div>
			{:else}
				<!-- Step 2: Full Membership Form -->
				<form method="POST" action="?/submit" use:enhance={handleSubmitEnhance}>
					<input type="hidden" name="_csrf" value={csrfToken} />
					<input type="hidden" name="email" value={formData.email} />
					
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<!-- Getting to Know You -->
						<div class="bg-white border-2 border-brand-blue rounded-lg shadow-md overflow-hidden">
							<div class="bg-gradient-to-r from-brand-blue to-brand-blue/90 px-6 py-3">
								<h3 class="text-lg font-semibold text-white">Getting to Know You</h3>
							</div>
							<div class="p-6 space-y-4">
								<div class="grid grid-cols-2 gap-4">
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Title</label>
										<input type="text" name="title" bind:value={formData.title} placeholder="Mr, Mrs, Miss" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-3 text-sm" />
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
										<select name="maritalStatus" bind:value={formData.maritalStatus} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-3 text-sm">
											<option value="">Select</option>
											<option value="single">Single</option>
											<option value="married">Married</option>
											<option value="divorced">Divorced</option>
											<option value="widowed">Widowed</option>
										</select>
									</div>
								</div>
								<div class="grid grid-cols-2 gap-4">
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
										<input type="date" name="dateOfBirth" bind:value={formData.dateOfBirth} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-3 text-sm" />
									</div>
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Place of Birth</label>
										<input type="text" name="placeOfBirth" bind:value={formData.placeOfBirth} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-3 text-sm" />
									</div>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
									<input type="text" name="firstName" bind:value={formData.firstName} required readonly class="w-full rounded-md border border-gray-300 bg-gray-50 py-2 px-3 text-sm" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
									<input type="text" name="lastName" bind:value={formData.lastName} readonly class="w-full rounded-md border border-gray-300 bg-gray-50 py-2 px-3 text-sm" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
									<input type="email" name="email" bind:value={formData.email} required readonly class="w-full rounded-md border border-gray-300 bg-gray-50 py-2 px-3 text-sm" />
								</div>
							</div>
						</div>

						<!-- Family & Contact Information -->
						<div class="bg-white border-2 border-brand-green rounded-lg shadow-md overflow-hidden">
							<div class="bg-gradient-to-r from-brand-green to-brand-green/90 px-6 py-3">
								<h3 class="text-lg font-semibold text-white">Family & Contact</h3>
							</div>
							<div class="p-6 space-y-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
									<input type="tel" name="phone" bind:value={formData.phone} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-3 text-sm" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Name of Spouse</label>
									<input type="text" name="spouseName" bind:value={formData.spouseName} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-3 text-sm" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Children Names and Ages</label>
									<textarea name="childrenNamesAndAges" bind:value={formData.childrenNamesAndAges} rows="4" placeholder="e.g., John (12), Sarah (8)" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-3 text-sm"></textarea>
								</div>
							</div>
						</div>

						<!-- Previous Church -->
						<div class="bg-white border-2 border-brand-green rounded-lg shadow-md overflow-hidden lg:col-span-2">
							<div class="bg-gradient-to-r from-brand-green to-brand-green/90 px-6 py-3">
								<h3 class="text-lg font-semibold text-white">Previous Church</h3>
							</div>
							<div class="p-6 space-y-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Previous Church</label>
									<input type="text" name="previousChurch" bind:value={formData.previousChurch} placeholder="What church were you at immediately before EGCC?" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-3 text-sm" />
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">How did they feel about your move?</label>
									<textarea name="previousChurchFeelings" bind:value={formData.previousChurchFeelings} rows="3" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-3 text-sm"></textarea>
								</div>
							</div>
						</div>

						<!-- Faith Journey, Community Involvement, and Membership Reflections - One Row -->
						<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:col-span-2">
							<!-- Faith Journey -->
							<div class="bg-white border-2 border-brand-yellow rounded-lg shadow-md overflow-hidden">
								<div class="bg-gradient-to-r from-brand-yellow to-brand-yellow/90 px-6 py-3">
									<h3 class="text-lg font-semibold text-white">Faith Journey</h3>
								</div>
								<div class="p-6 space-y-4">
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-2">Christ-Follower?</label>
										<div class="flex gap-4">
											<label class="flex items-center">
												<input type="radio" name="isChristFollower" value="yes" bind:group={formData.isChristFollower} class="mr-2" />
												Yes
											</label>
											<label class="flex items-center">
												<input type="radio" name="isChristFollower" value="no" bind:group={formData.isChristFollower} class="mr-2" />
												No
											</label>
										</div>
									</div>
									{#if formData.isChristFollower === 'yes'}
										<div>
											<label class="block text-sm font-medium text-gray-700 mb-1">When did you become one?</label>
											<input type="date" name="becameChristFollowerDate" bind:value={formData.becameChristFollowerDate} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-yellow focus:ring-brand-yellow py-2 px-3 text-sm" />
										</div>
									{:else if formData.isChristFollower === 'no'}
										<div>
											<label class="flex items-center">
												<input type="checkbox" name="wantsHelpBecomingChristFollower" bind:checked={formData.wantsHelpBecomingChristFollower} class="mr-2" />
												<span class="text-sm text-gray-700">Would like help?</span>
											</label>
										</div>
									{/if}
									
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-2">Water Baptised?</label>
										<div class="flex gap-4">
											<label class="flex items-center">
												<input type="radio" name="hasBeenWaterBaptised" value="yes" bind:group={formData.hasBeenWaterBaptised} class="mr-2" />
												Yes
											</label>
											<label class="flex items-center">
												<input type="radio" name="hasBeenWaterBaptised" value="no" bind:group={formData.hasBeenWaterBaptised} class="mr-2" />
												No
											</label>
										</div>
									</div>
									{#if formData.hasBeenWaterBaptised === 'no'}
										<div>
											<label class="flex items-center">
												<input type="checkbox" name="wantsToTalkAboutBaptism" bind:checked={formData.wantsToTalkAboutBaptism} class="mr-2" />
												<span class="text-sm text-gray-700">Would like to talk?</span>
											</label>
										</div>
									{/if}

									<div>
										<label class="block text-sm font-medium text-gray-700 mb-2">Filled with Holy Spirit?</label>
										<div class="flex gap-4">
											<label class="flex items-center">
												<input type="radio" name="hasBeenFilledWithHolySpirit" value="yes" bind:group={formData.hasBeenFilledWithHolySpirit} class="mr-2" />
												Yes
											</label>
											<label class="flex items-center">
												<input type="radio" name="hasBeenFilledWithHolySpirit" value="no" bind:group={formData.hasBeenFilledWithHolySpirit} class="mr-2" />
												No
											</label>
										</div>
									</div>
									{#if formData.hasBeenFilledWithHolySpirit === 'no'}
										<div>
											<label class="flex items-center">
												<input type="checkbox" name="wantsToKnowMoreAboutHolySpirit" bind:checked={formData.wantsToKnowMoreAboutHolySpirit} class="mr-2" />
												<span class="text-sm text-gray-700">Would like to know more?</span>
											</label>
										</div>
									{/if}
								</div>
							</div>

							<!-- Community Involvement -->
							<div class="bg-white border-2 border-brand-red rounded-lg shadow-md overflow-hidden">
								<div class="bg-gradient-to-r from-brand-red to-brand-red/90 px-6 py-3">
									<h3 class="text-lg font-semibold text-white">Community Involvement</h3>
								</div>
								<div class="p-6 space-y-4">
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-2">Attending Community Group?</label>
										<div class="flex gap-4">
											<label class="flex items-center">
												<input type="radio" name="attendingCommunityGroup" value="yes" bind:group={formData.attendingCommunityGroup} class="mr-2" />
												Yes
											</label>
											<label class="flex items-center">
												<input type="radio" name="attendingCommunityGroup" value="no" bind:group={formData.attendingCommunityGroup} class="mr-2" />
												No
											</label>
										</div>
									</div>
									{#if formData.attendingCommunityGroup === 'no'}
										<div>
											<label class="flex items-center">
												<input type="checkbox" name="wantsCommunityGroupInfo" bind:checked={formData.wantsCommunityGroupInfo} class="mr-2" />
												<span class="text-sm text-gray-700">Would like more info?</span>
											</label>
										</div>
									{/if}

									<div>
										<label class="block text-sm font-medium text-gray-700 mb-2">Currently Serving?</label>
										<div class="flex gap-4">
											<label class="flex items-center">
												<input type="radio" name="currentlyServing" value="yes" bind:group={formData.currentlyServing} class="mr-2" />
												Yes
											</label>
											<label class="flex items-center">
												<input type="radio" name="currentlyServing" value="no" bind:group={formData.currentlyServing} class="mr-2" />
												No
											</label>
										</div>
									</div>
									{#if formData.currentlyServing === 'yes'}
										<div>
											<label class="block text-sm font-medium text-gray-700 mb-1">Serving Area</label>
											<input type="text" name="servingArea" bind:value={formData.servingArea} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red py-2 px-3 text-sm" />
										</div>
									{:else if formData.currentlyServing === 'no'}
										<div>
											<label class="block text-sm font-medium text-gray-700 mb-1">Desired Serving Area</label>
											<input type="text" name="desiredServingArea" bind:value={formData.desiredServingArea} placeholder="e.g., Kids, Worship" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red py-2 px-3 text-sm" />
										</div>
									{/if}
									<div>
										<label class="block text-sm font-medium text-gray-700 mb-1">Elder Meeting Availability</label>
										<select name="elderMeetingAvailability" bind:value={formData.elderMeetingAvailability} class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-red focus:ring-brand-red py-2 px-3 text-sm">
											<option value="">Select</option>
											<option value="anytime">Anytime</option>
											<option value="morning">Morning</option>
											<option value="afternoon">Afternoon</option>
											<option value="evening">Evening</option>
										</select>
									</div>
								</div>
							</div>

							<!-- Membership Reflections -->
							<div class="bg-white border-2 border-brand-blue rounded-lg shadow-md overflow-hidden">
								<div class="bg-gradient-to-r from-brand-blue to-brand-blue/90 px-6 py-3">
									<h3 class="text-lg font-semibold text-white">Membership Reflections</h3>
								</div>
								<div class="p-6">
									<label class="block text-sm font-medium text-gray-700 mb-2">After reading through the Membership booklet, what are your initial reflections or questions?</label>
									<textarea name="membershipReflections" bind:value={formData.membershipReflections} rows="8" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-blue focus:ring-brand-blue py-2 px-3 text-sm"></textarea>
								</div>
							</div>
						</div>

						<!-- Additional Information -->
						<div class="bg-white border-2 border-brand-yellow rounded-lg shadow-md overflow-hidden lg:col-span-2">
							<div class="bg-gradient-to-r from-brand-yellow to-brand-yellow/90 px-6 py-3">
								<h3 class="text-lg font-semibold text-white">Additional Information</h3>
							</div>
							<div class="p-6 space-y-4">
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">Is there anything else about yourself that you feel would be helpful for us to know? (hobbies, talents, life experiences, areas where you feel called to serve)</label>
									<textarea name="additionalInfo" bind:value={formData.additionalInfo} rows="3" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-yellow focus:ring-brand-yellow py-2 px-3 text-sm"></textarea>
								</div>
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-2">Is there anything in your life where you feel you could benefit from prayer, guidance, or specific support?</label>
									<textarea name="prayerSupportNeeds" bind:value={formData.prayerSupportNeeds} rows="3" class="w-full rounded-md border border-gray-300 shadow-sm focus:border-brand-yellow focus:ring-brand-yellow py-2 px-3 text-sm"></textarea>
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
							disabled={isSubmitting}
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
								Submit Membership Form
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
	
	<!-- Notification Popups -->
	<NotificationPopup />
</div>
