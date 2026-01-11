<script>
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: member = $page.data?.member || $page.data?.contact;
	$: contact = $page.data?.contact || member;
	$: memberData = $page.data?.memberData || null;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;

	// Show notifications from form results
	$: if (formResult?.success) {
		notifications.success('Member information updated successfully');
	} else if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let editing = false;
	let formData = {
		// Personal information
		title: (memberData && memberData.title) || '',
		dateOfBirth: (memberData && memberData.dateOfBirth) || '',
		placeOfBirth: (memberData && memberData.placeOfBirth) || '',
		maritalStatus: (memberData && memberData.maritalStatus) || '',
		spouseName: (memberData && memberData.spouseName) || '',
		childrenNamesAndAges: (memberData && memberData.childrenNamesAndAges) || '',
		// Previous church
		previousChurch: (memberData && memberData.previousChurch) || '',
		previousChurchFeelings: (memberData && memberData.previousChurchFeelings) || '',
		// Faith journey - use string values for radio buttons
		isChristFollower: (memberData && memberData.isChristFollower) ? 'yes' : ((memberData && memberData.isChristFollower === false) ? 'no' : ''),
		becameChristFollowerDate: (memberData && memberData.becameChristFollowerDate) || '',
		wantsHelpBecomingChristFollower: (memberData && memberData.wantsHelpBecomingChristFollower) || false,
		hasBeenWaterBaptised: (memberData && memberData.hasBeenWaterBaptised) ? 'yes' : ((memberData && memberData.hasBeenWaterBaptised === false) ? 'no' : ''),
		wantsToTalkAboutBaptism: (memberData && memberData.wantsToTalkAboutBaptism) || false,
		hasBeenFilledWithHolySpirit: (memberData && memberData.hasBeenFilledWithHolySpirit) ? 'yes' : ((memberData && memberData.hasBeenFilledWithHolySpirit === false) ? 'no' : ''),
		wantsToKnowMoreAboutHolySpirit: (memberData && memberData.wantsToKnowMoreAboutHolySpirit) || false,
		// Membership reflections
		membershipReflections: (memberData && memberData.membershipReflections) || '',
		// Community involvement
		attendingCommunityGroup: (memberData && memberData.attendingCommunityGroup) ? 'yes' : ((memberData && memberData.attendingCommunityGroup === false) ? 'no' : ''),
		wantsCommunityGroupInfo: (memberData && memberData.wantsCommunityGroupInfo) || false,
		// Serving
		currentlyServing: (memberData && memberData.currentlyServing) ? 'yes' : ((memberData && memberData.currentlyServing === false) ? 'no' : ''),
		servingArea: (memberData && memberData.servingArea) || '',
		desiredServingArea: (memberData && memberData.desiredServingArea) || '',
		// Additional information
		additionalInfo: (memberData && memberData.additionalInfo) || '',
		prayerSupportNeeds: (memberData && memberData.prayerSupportNeeds) || '',
		// Meeting availability
		elderMeetingAvailability: (memberData && memberData.elderMeetingAvailability) || ''
	};

	// Initialize formData when memberData loads
	$: if (memberData && !editing) {
		formData = {
			title: memberData.title || '',
			dateOfBirth: memberData.dateOfBirth || '',
			placeOfBirth: memberData.placeOfBirth || '',
			maritalStatus: memberData.maritalStatus || '',
			spouseName: memberData.spouseName || '',
			childrenNamesAndAges: memberData.childrenNamesAndAges || '',
			previousChurch: memberData.previousChurch || '',
			previousChurchFeelings: memberData.previousChurchFeelings || '',
			isChristFollower: memberData.isChristFollower ? 'yes' : (memberData.isChristFollower === false ? 'no' : ''),
			becameChristFollowerDate: memberData.becameChristFollowerDate || '',
			wantsHelpBecomingChristFollower: memberData.wantsHelpBecomingChristFollower || false,
			hasBeenWaterBaptised: memberData.hasBeenWaterBaptised ? 'yes' : (memberData.hasBeenWaterBaptised === false ? 'no' : ''),
			wantsToTalkAboutBaptism: memberData.wantsToTalkAboutBaptism || false,
			hasBeenFilledWithHolySpirit: memberData.hasBeenFilledWithHolySpirit ? 'yes' : (memberData.hasBeenFilledWithHolySpirit === false ? 'no' : ''),
			wantsToKnowMoreAboutHolySpirit: memberData.wantsToKnowMoreAboutHolySpirit || false,
			membershipReflections: memberData.membershipReflections || '',
			attendingCommunityGroup: memberData.attendingCommunityGroup ? 'yes' : (memberData.attendingCommunityGroup === false ? 'no' : ''),
			wantsCommunityGroupInfo: memberData.wantsCommunityGroupInfo || false,
			currentlyServing: memberData.currentlyServing ? 'yes' : (memberData.currentlyServing === false ? 'no' : ''),
			servingArea: memberData.servingArea || '',
			desiredServingArea: memberData.desiredServingArea || '',
			additionalInfo: memberData.additionalInfo || '',
			prayerSupportNeeds: memberData.prayerSupportNeeds || '',
			elderMeetingAvailability: memberData.elderMeetingAvailability || ''
		};
	}
</script>

{#if member}
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Member Details</h2>
			<div class="flex flex-wrap gap-2">
				{#if editing}
					<button
						type="submit"
						form="member-edit-form"
						class="bg-hub-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-hub-green-700 text-sm sm:text-base"
					>
						Save Changes
					</button>
					<button
						type="button"
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-gray-700 text-sm sm:text-base"
					>
						Back
					</button>
				{:else}
					<a
						href="/hub/contacts/{member.id}"
						class="bg-gray-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-gray-700 inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
					>
						<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
						View Contact Details
					</a>
					<button
						on:click={() => editing = true}
						class="bg-hub-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-hub-green-700 text-sm sm:text-base"
					>
						Edit
					</button>
					<a
						href="/hub/members"
						class="bg-gray-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-md hover:bg-gray-700 inline-flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
					>
						<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
						</svg>
						Back to Members
					</a>
				{/if}
			</div>
		</div>

		{#if editing}
			<form id="member-edit-form" method="POST" action="?/update" use:enhance={({ formData: fd, cancel }) => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						editing = false;
						await update({ reset: false });
					}
				};
			}}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Getting to Know You -->
					<div class="bg-white border-2 border-hub-blue-200 rounded-lg shadow-md overflow-hidden">
						<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 px-6 py-3">
							<h3 class="text-lg font-semibold text-white">Getting to Know You</h3>
						</div>
						<div class="p-6 space-y-4">
							<div class="grid grid-cols-2 gap-4">
								<FormField label="Title" name="title" bind:value={formData.title} placeholder="Mr, Mrs, Miss" />
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
									<select name="maritalStatus" bind:value={formData.maritalStatus} class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3 text-sm">
										<option value="">Select</option>
										<option value="single">Single</option>
										<option value="married">Married</option>
										<option value="divorced">Divorced</option>
										<option value="widowed">Widowed</option>
									</select>
								</div>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<FormField label="Date of Birth" name="dateOfBirth" type="date" bind:value={formData.dateOfBirth} />
								<FormField label="Place of Birth" name="placeOfBirth" bind:value={formData.placeOfBirth} />
							</div>
							<FormField label="Name of Spouse" name="spouseName" bind:value={formData.spouseName} />
							<FormField label="Children Names and Ages" name="childrenNamesAndAges" type="textarea" rows="2" bind:value={formData.childrenNamesAndAges} placeholder="e.g., John (12), Sarah (8)" />
						</div>
					</div>

					<!-- Previous Church -->
					<div class="bg-white border-2 border-hub-green-200 rounded-lg shadow-md overflow-hidden lg:col-span-2">
						<div class="bg-gradient-to-r from-hub-green-500 to-hub-green-600 px-6 py-3">
							<h3 class="text-lg font-semibold text-white">Previous Church</h3>
						</div>
						<div class="p-6 space-y-4">
							<FormField label="Previous Church" name="previousChurch" bind:value={formData.previousChurch} />
							<FormField label="How did they feel about your move?" name="previousChurchFeelings" type="textarea" rows="3" bind:value={formData.previousChurchFeelings} />
						</div>
					</div>

					<!-- Faith Journey, Community Involvement, and Membership Reflections - One Row -->
					<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:col-span-2">
						<!-- Faith Journey -->
						<div class="bg-white border-2 border-hub-yellow-200 rounded-lg shadow-md overflow-hidden">
							<div class="bg-gradient-to-r from-hub-yellow-500 to-hub-yellow-600 px-6 py-3">
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
									<FormField label="When did you become one?" name="becameChristFollowerDate" type="date" bind:value={formData.becameChristFollowerDate} />
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
						<div class="bg-white border-2 border-hub-red-200 rounded-lg shadow-md overflow-hidden">
							<div class="bg-gradient-to-r from-hub-red-500 to-hub-red-600 px-6 py-3">
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
									<FormField label="Serving Area" name="servingArea" bind:value={formData.servingArea} />
								{:else if formData.currentlyServing === 'no'}
									<FormField label="Desired Serving Area" name="desiredServingArea" bind:value={formData.desiredServingArea} placeholder="e.g., Kids, Worship" />
								{/if}
								<div>
									<label class="block text-sm font-medium text-gray-700 mb-1">Elder Meeting Availability</label>
									<select name="elderMeetingAvailability" bind:value={formData.elderMeetingAvailability} class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-3 text-sm">
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
						<div class="bg-white border-2 border-hub-blue-200 rounded-lg shadow-md overflow-hidden">
							<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 px-6 py-3">
								<h3 class="text-lg font-semibold text-white">Membership Reflections</h3>
							</div>
							<div class="p-6">
								<FormField 
									label="After reading through the Membership booklet, what are your initial reflections or questions?" 
									name="membershipReflections" 
									type="textarea" 
									rows="8" 
									bind:value={formData.membershipReflections} 
								/>
							</div>
						</div>
					</div>

					<!-- Additional Information -->
					<div class="bg-white border-2 border-hub-yellow-200 rounded-lg shadow-md overflow-hidden lg:col-span-2">
						<div class="bg-gradient-to-r from-hub-yellow-500 to-hub-yellow-600 px-6 py-3">
							<h3 class="text-lg font-semibold text-white">Additional Information</h3>
						</div>
						<div class="p-6 space-y-4">
							<FormField 
								label="Is there anything else about yourself that you feel would be helpful for us to know? (hobbies, talents, life experiences, areas where you feel called to serve)" 
								name="additionalInfo" 
								type="textarea" 
								rows="3" 
								bind:value={formData.additionalInfo} 
							/>
							<FormField 
								label="Is there anything in your life where you feel you could benefit from prayer, guidance, or specific support?" 
								name="prayerSupportNeeds" 
								type="textarea" 
								rows="3" 
								bind:value={formData.prayerSupportNeeds} 
							/>
						</div>
					</div>
				</div>
			</form>
		{:else}
			<!-- View Mode -->
			<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<!-- Contact Information Panel -->
				<div class="bg-white border-2 border-hub-blue-200 rounded-lg shadow-md overflow-hidden">
					<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 px-6 py-3">
						<h3 class="text-lg font-semibold text-white">Contact Information</h3>
					</div>
					<div class="p-6">
						<dl class="grid grid-cols-1 gap-4">
							<div>
								<dt class="text-sm font-medium text-gray-500">Name</dt>
								<dd class="mt-1 text-sm text-gray-900 font-medium">
									{member.firstName || ''} {member.lastName || ''}
								</dd>
							</div>
							<div>
								<dt class="text-sm font-medium text-gray-500">Email</dt>
								<dd class="mt-1 text-sm text-gray-900">{member.email}</dd>
							</div>
							{#if member.phone}
								<div>
									<dt class="text-sm font-medium text-gray-500">Phone</dt>
									<dd class="mt-1 text-sm text-gray-900">{member.phone}</dd>
								</div>
							{/if}
							{#if member.dateJoined}
								<div>
									<dt class="text-sm font-medium text-gray-500">Date Joined</dt>
									<dd class="mt-1 text-sm text-gray-900">{formatDateUK(member.dateJoined)}</dd>
								</div>
							{/if}
						</dl>
					</div>
				</div>

				<!-- Getting to Know You Panel -->
				{#if memberData && (memberData.title || memberData.dateOfBirth || memberData.placeOfBirth || memberData.maritalStatus || memberData.spouseName || memberData.childrenNamesAndAges)}
					<div class="bg-white border-2 border-hub-blue-200 rounded-lg shadow-md overflow-hidden">
						<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 px-6 py-3">
							<h3 class="text-lg font-semibold text-white">Getting to Know You</h3>
						</div>
						<div class="p-6">
							<dl class="grid grid-cols-1 gap-4">
								{#if memberData.title}
									<div>
										<dt class="text-sm font-medium text-gray-500">Title</dt>
										<dd class="mt-1 text-sm text-gray-900">{memberData.title}</dd>
									</div>
								{/if}
								{#if memberData.dateOfBirth}
									<div>
										<dt class="text-sm font-medium text-gray-500">Date of Birth</dt>
										<dd class="mt-1 text-sm text-gray-900">{formatDateUK(memberData.dateOfBirth)}</dd>
									</div>
								{/if}
								{#if memberData.placeOfBirth}
									<div>
										<dt class="text-sm font-medium text-gray-500">Place of Birth</dt>
										<dd class="mt-1 text-sm text-gray-900">{memberData.placeOfBirth}</dd>
									</div>
								{/if}
								{#if memberData.maritalStatus}
									<div>
										<dt class="text-sm font-medium text-gray-500">Marital Status</dt>
										<dd class="mt-1 text-sm text-gray-900 capitalize">{memberData.maritalStatus}</dd>
									</div>
								{/if}
								{#if memberData.spouseName}
									<div>
										<dt class="text-sm font-medium text-gray-500">Spouse Name</dt>
										<dd class="mt-1 text-sm text-gray-900">{memberData.spouseName}</dd>
									</div>
								{/if}
								{#if memberData.childrenNamesAndAges}
									<div>
										<dt class="text-sm font-medium text-gray-500">Children</dt>
										<dd class="mt-1 text-sm text-gray-900">{memberData.childrenNamesAndAges}</dd>
									</div>
								{/if}
							</dl>
						</div>
					</div>
				{/if}

				<!-- Previous Church Panel -->
				{#if memberData && (memberData.previousChurch || memberData.previousChurchFeelings)}
					<div class="bg-white border-2 border-hub-green-200 rounded-lg shadow-md overflow-hidden lg:col-span-2">
						<div class="bg-gradient-to-r from-hub-green-500 to-hub-green-600 px-6 py-3">
							<h3 class="text-lg font-semibold text-white">Previous Church</h3>
						</div>
						<div class="p-6">
							<dl class="grid grid-cols-1 gap-4">
								{#if memberData.previousChurch}
									<div>
										<dt class="text-sm font-medium text-gray-500">Previous Church</dt>
										<dd class="mt-1 text-sm text-gray-900">{memberData.previousChurch}</dd>
									</div>
								{/if}
								{#if memberData.previousChurchFeelings}
									<div>
										<dt class="text-sm font-medium text-gray-500">Feelings About Move</dt>
										<dd class="mt-1 text-sm text-gray-900">{memberData.previousChurchFeelings}</dd>
									</div>
								{/if}
							</dl>
						</div>
					</div>
				{/if}

				<!-- Faith Journey, Community Involvement, and Membership Reflections - One Row -->
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:col-span-2">
					<!-- Faith Journey Panel -->
					{#if memberData && (memberData.isChristFollower !== undefined || memberData.hasBeenWaterBaptised !== undefined || memberData.hasBeenFilledWithHolySpirit !== undefined)}
						<div class="bg-white border-2 border-hub-yellow-200 rounded-lg shadow-md overflow-hidden">
							<div class="bg-gradient-to-r from-hub-yellow-500 to-hub-yellow-600 px-6 py-3">
								<h3 class="text-lg font-semibold text-white">Faith Journey</h3>
							</div>
							<div class="p-6">
								<dl class="grid grid-cols-1 gap-4">
									{#if memberData.isChristFollower !== undefined}
										<div>
											<dt class="text-sm font-medium text-gray-500">Christ-Follower</dt>
											<dd class="mt-1">
												<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {memberData.isChristFollower ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
													{memberData.isChristFollower ? 'Yes' : 'No'}
												</span>
											</dd>
										</div>
									{/if}
									{#if memberData.becameChristFollowerDate}
										<div>
											<dt class="text-sm font-medium text-gray-500">Became Christ-Follower</dt>
											<dd class="mt-1 text-sm text-gray-900">{formatDateUK(memberData.becameChristFollowerDate)}</dd>
										</div>
									{/if}
									{#if memberData.hasBeenWaterBaptised !== undefined}
										<div>
											<dt class="text-sm font-medium text-gray-500">Water Baptised</dt>
											<dd class="mt-1">
												<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {memberData.hasBeenWaterBaptised ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
													{memberData.hasBeenWaterBaptised ? 'Yes' : 'No'}
												</span>
											</dd>
										</div>
									{/if}
									{#if memberData.hasBeenFilledWithHolySpirit !== undefined}
										<div>
											<dt class="text-sm font-medium text-gray-500">Filled with Holy Spirit</dt>
											<dd class="mt-1">
												<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {memberData.hasBeenFilledWithHolySpirit ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
													{memberData.hasBeenFilledWithHolySpirit ? 'Yes' : 'No'}
												</span>
											</dd>
										</div>
									{/if}
								</dl>
							</div>
						</div>
					{/if}

					<!-- Community Involvement Panel -->
					{#if memberData && (memberData.attendingCommunityGroup !== undefined || memberData.currentlyServing !== undefined || memberData.servingArea || memberData.desiredServingArea || memberData.elderMeetingAvailability)}
						<div class="bg-white border-2 border-hub-red-200 rounded-lg shadow-md overflow-hidden">
							<div class="bg-gradient-to-r from-hub-red-500 to-hub-red-600 px-6 py-3">
								<h3 class="text-lg font-semibold text-white">Community Involvement</h3>
							</div>
							<div class="p-6">
								<dl class="grid grid-cols-1 gap-4">
									{#if memberData.attendingCommunityGroup !== undefined}
										<div>
											<dt class="text-sm font-medium text-gray-500">Attending Community Group</dt>
											<dd class="mt-1">
												<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {memberData.attendingCommunityGroup ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
													{memberData.attendingCommunityGroup ? 'Yes' : 'No'}
												</span>
											</dd>
										</div>
									{/if}
									{#if memberData.currentlyServing !== undefined}
										<div>
											<dt class="text-sm font-medium text-gray-500">Currently Serving</dt>
											<dd class="mt-1">
												<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {memberData.currentlyServing ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
													{memberData.currentlyServing ? 'Yes' : 'No'}
												</span>
											</dd>
										</div>
									{/if}
									{#if memberData.servingArea}
										<div>
											<dt class="text-sm font-medium text-gray-500">Serving Area</dt>
											<dd class="mt-1 text-sm text-gray-900">{memberData.servingArea}</dd>
										</div>
									{/if}
									{#if memberData.desiredServingArea}
										<div>
											<dt class="text-sm font-medium text-gray-500">Desired Serving Area</dt>
											<dd class="mt-1 text-sm text-gray-900">{memberData.desiredServingArea}</dd>
										</div>
									{/if}
									{#if memberData.elderMeetingAvailability}
										<div>
											<dt class="text-sm font-medium text-gray-500">Elder Meeting Availability</dt>
											<dd class="mt-1 text-sm text-gray-900 capitalize">{memberData.elderMeetingAvailability}</dd>
										</div>
									{/if}
								</dl>
							</div>
						</div>
					{/if}

					<!-- Membership Reflections Panel -->
					{#if memberData && memberData.membershipReflections}
						<div class="bg-white border-2 border-hub-blue-200 rounded-lg shadow-md overflow-hidden">
							<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 px-6 py-3">
								<h3 class="text-lg font-semibold text-white">Membership Reflections</h3>
							</div>
							<div class="p-6">
								<p class="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{memberData.membershipReflections}</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- Additional Information Panel -->
				{#if memberData && (memberData.additionalInfo || memberData.prayerSupportNeeds)}
					<div class="bg-white border-2 border-hub-yellow-200 rounded-lg shadow-md overflow-hidden lg:col-span-2">
						<div class="bg-gradient-to-r from-hub-yellow-500 to-hub-yellow-600 px-6 py-3">
							<h3 class="text-lg font-semibold text-white">Additional Information</h3>
						</div>
						<div class="p-6 space-y-6">
							{#if memberData.additionalInfo}
								<div>
									<dt class="text-sm font-medium text-gray-500 mb-2">Additional Info</dt>
									<dd class="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{memberData.additionalInfo}</dd>
								</div>
							{/if}
							{#if memberData.prayerSupportNeeds}
								<div>
									<dt class="text-sm font-medium text-gray-500 mb-2">Prayer/Support Needs</dt>
									<dd class="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{memberData.prayerSupportNeeds}</dd>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if !memberData}
					<div class="bg-blue-50 border border-blue-200 rounded-lg p-6 lg:col-span-2">
						<p class="text-sm text-blue-800">
							No member-specific information has been added yet. Click "Edit" to add information from the membership form.
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}
