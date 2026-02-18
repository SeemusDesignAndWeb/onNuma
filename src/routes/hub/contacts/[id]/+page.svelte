<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { getPanelHeadColor } from '$lib/crm/utils/themeStyles.js';

	$: contact = $page.data?.contact;
	$: spouse = $page.data?.spouse;
	$: contacts = $page.data?.contacts || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: theme = $page.data?.theme || null;
	$: panelHeadBgColor = getPanelHeadColor(theme);
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	$: thankyouMessages = $page.data?.thankyouMessages ?? [];
	$: myhubInvitations = $page.data?.myhubInvitations ?? [];

	// MyHub preferences display (same structure as myhub/preferences)
	const PREF_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
	const PREF_DAY_LABELS = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
	const PREF_TIMES = ['morning', 'afternoon', 'evening'];
	const PREF_TIME_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' };
	const REMINDER_TIMING_LABELS = {
		'1day': '1 day before',
		'2days': '2 days before',
		'1week': '1 week before',
		'1week-and-1day': '1 week and 1 day before'
	};
	function isUnavailable(contact, day, time) {
		return !!(contact?.unavailability?.[day]?.[time]);
	}

	// Collapsible panels (all expanded by default)
	const PANEL_IDS = ['personal', 'address', 'notes', 'thankyou', 'outstanding', 'myhub'];
	let expandedPanels = new Set(PANEL_IDS);
	function togglePanel(id) {
		const next = new Set(expandedPanels);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedPanels = next;
	}

	let showThankyouForm = false;
	let thankyouText = '';
	let thankyouSubmitting = false;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;

		if (formResult?.action === 'sendThankyou') {
			if (formResult?.success) {
				notifications.success('Thank-you message sent!');
				showThankyouForm = false;
				thankyouText = '';
			} else if (formResult?.error) {
				notifications.error(formResult.error);
			}
		} else if (formResult?.success) {
			notifications.success('Contact updated successfully');
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	function handleThankyouEnhance() {
		thankyouSubmitting = true;
		return async ({ update }) => {
			await update({ reset: false });
			thankyouSubmitting = false;
		};
	}
	// Show sender name only; never show email (same as history page / personal email fix)
	function thankyouSenderDisplay(msg) {
		const n = msg?.fromName;
		return (n && typeof n === 'string' && !n.includes('@')) ? n : 'Your coordinator';
	}

	let editing = false;
	let initializedContactId = null;
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
		spouseId: ''
	};

	// Initialize formData when contact loads or changes (including after successful save)
	$: if (contact && contact.id !== initializedContactId) {
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
			notes: contact.notes || '',
			subscribed: contact.subscribed !== false, // Default to true if not set
			spouseId: contact.spouseId || ''
		};
		initializedContactId = contact.id;
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
	<div class="space-y-6">
		<!-- Header Section -->
		<div class="hub-top-panel p-6 sm:p-8">
			<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
				<div class="flex-1">
					<div class="flex items-center gap-3 mb-2">
						<div class="w-16 h-16 bg-theme-panel-bg rounded-full flex items-center justify-center">
							<svg class="w-8 h-8 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
						</div>
						<div>
							<h1 class="text-2xl sm:text-3xl font-bold text-gray-900 crm-shell-main">
								{contact.firstName || ''} {contact.lastName || ''}
								{#if !contact.firstName && !contact.lastName}
									Contact
								{/if}
							</h1>
							{#if contact.email}
								<p class="text-gray-600 text-sm sm:text-base mt-1">{contact.email}</p>
							{/if}
						</div>
					</div>
				</div>
				<div class="flex flex-wrap gap-2 sm:gap-3">
					{#if editing}
						<button
							type="submit"
							form="contact-edit-form"
							class="hub-btn btn-theme-1"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
							Save Changes
						</button>
						<button
							type="button"
							on:click={() => editing = false}
							class="hub-btn border border-gray-300 text-gray-700 hover:bg-theme-panel-bg"
						>
							Cancel
						</button>
					{:else}
						<a
							href="/hub/contacts"
							class="hub-btn border border-gray-300 text-gray-700 hover:bg-theme-panel-bg"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
							</svg>
							Back
						</a>
						<button
							on:click={() => editing = true}
							class="hub-btn btn-theme-1"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
							</svg>
							Edit
						</button>
						<button
							on:click={handleDelete}
							class="hub-btn bg-hub-red-600 text-white hover:bg-hub-red-700"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
							</svg>
							Delete
						</button>
					{/if}
				</div>
			</div>
			<div class="mt-4 text-gray-500 text-sm flex justify-end items-center gap-x-2">
				{#if contact.createdAt}
					<span>Created {formatDateTimeUK(contact.createdAt)}</span>
				{/if}
				{#if contact.createdAt && contact.updatedAt}
					<span>|</span>
				{/if}
				{#if contact.updatedAt}
					<span>Last Updated {formatDateTimeUK(contact.updatedAt)}</span>
				{/if}
			</div>
		</div>

		{#if editing}
			<form id="contact-edit-form" method="POST" action="?/update" use:enhance={({ formData: fd, cancel }) => {
				return async ({ result, update }) => {
					// After successful save, update the page data without resetting the form
					await update({ reset: false });
				};
			}}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<!-- Personal Information Card -->
					<div class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
						<div class="px-6 py-4" style="background-color: {panelHeadBgColor};">
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
									<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
									</svg>
								</div>
								<h3 class="text-lg font-bold text-white">Personal Information</h3>
							</div>
						</div>
						<div class="p-6 space-y-5">
							<FormField label="Email" name="email" type="email" bind:value={formData.email} required />
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
								<FormField label="First Name" name="firstName" bind:value={formData.firstName} />
								<FormField label="Last Name" name="lastName" bind:value={formData.lastName} />
							</div>
							<FormField label="Phone" name="phone" bind:value={formData.phone} />
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-2">Partner</label>
								<select name="spouseId" bind:value={formData.spouseId} class="w-full rounded-lg border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-2 focus:ring-theme-button-1 py-2.5 px-4 text-gray-900 transition-all">
									<option value="">None</option>
									{#each contacts as contactOption}
										<option value={contactOption.id}>
											{contactOption.firstName || ''} {contactOption.lastName || ''} {contactOption.email ? `(${contactOption.email})` : ''}
										</option>
									{/each}
								</select>
							</div>
						</div>
					</div>

					<!-- Address Card -->
					<div class="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
						<div class="bg-theme-panel-head-2 px-6 py-4">
							<div class="flex items-center gap-3">
								<div class="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
									<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								</div>
								<h3 class="text-lg font-bold text-white">Address</h3>
							</div>
						</div>
						<div class="p-6 space-y-5">
							<FormField label="Address Line 1" name="addressLine1" bind:value={formData.addressLine1} />
							<FormField label="Address Line 2" name="addressLine2" bind:value={formData.addressLine2} />
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
								<FormField label="City" name="city" bind:value={formData.city} />
								<FormField label="County" name="county" bind:value={formData.county} />
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
								<FormField label="Postcode" name="postcode" bind:value={formData.postcode} />
								<FormField label="Country" name="country" bind:value={formData.country} />
							</div>
						</div>
					</div>

					<!-- Church Membership Card -->
					<div class="hub-top-panel overflow-hidden">
						<div class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50">
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
								</svg>
							</div>
							<h3 class="text-lg font-bold text-gray-900 crm-shell-main">Status</h3>
						</div>
						<div class="p-6 space-y-5">
							<input type="hidden" name="membershipStatus" value={formData.membershipStatus} />
							<div class="pt-2">
								<label class="flex items-center cursor-pointer group">
									<input
										type="checkbox"
										name="subscribed"
										bind:checked={formData.subscribed}
										class="w-5 h-5 rounded border-gray-300 text-theme-button-2 shadow-sm focus:border-theme-button-2 focus:ring-2 focus:ring-theme-button-2 cursor-pointer transition-all"
									/>
									<span class="ml-3 text-sm font-medium text-gray-700 group-hover:text-gray-900">Subscribed to newsletters</span>
								</label>
							</div>
							<FormField label="Date Joined" name="dateJoined" type="date" bind:value={formData.dateJoined} />
						</div>
					</div>

					<!-- Additional Information Card -->
					<div class="hub-top-panel overflow-hidden">
						<div class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50">
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
								</svg>
							</div>
							<h3 class="text-lg font-bold text-gray-900 crm-shell-main">Additional Information</h3>
						</div>
						<div class="p-6">
							<FormField label="Notes" name="notes" type="textarea" rows="6" bind:value={formData.notes} />
						</div>
					</div>
				</div>
			</form>
		{:else}
			<!-- Main Content -->
			<div class="space-y-6">
					<!-- Personal Information Card -->
					<div class="hub-top-panel overflow-hidden">
						<button
							type="button"
							class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50 w-full text-left cursor-pointer hover:opacity-90 transition-opacity"
							on:click={() => togglePanel('personal')}
							aria-expanded={expandedPanels.has('personal')}
						>
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
								</svg>
							</div>
							<h2 class="text-xl font-bold text-gray-900 crm-shell-main flex-1">Personal Information</h2>
							<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0" class:rotate-180={expandedPanels.has('personal')} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</button>
						{#if expandedPanels.has('personal')}
						<div class="p-6">
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
								{#if contact.firstName || contact.lastName}
									<div>
										<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Name</dt>
										<dd class="text-base font-medium text-gray-900">
											{contact.firstName || ''} {contact.lastName || ''}
										</dd>
									</div>
								{/if}
								<div>
									<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Email</dt>
									<dd class="text-base text-gray-900">
										<a href="mailto:{contact.email}" class="text-theme-button-1 hover:opacity-90 hover:underline">
											{contact.email}
										</a>
									</dd>
								</div>
								{#if contact.phone}
									<div>
										<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</dt>
										<dd class="text-base text-gray-900">
											<a href="tel:{contact.phone}" class="text-theme-button-1 hover:opacity-90 hover:underline">
												{contact.phone}
											</a>
										</dd>
									</div>
								{/if}
								{#if spouse}
									<div>
										<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Partner</dt>
										<dd class="text-base text-gray-900">
											<a href="/hub/contacts/{spouse.id}" class="inline-flex items-center gap-2 text-theme-button-1 hover:opacity-90 hover:underline group">
												<span>{spouse.firstName || ''} {spouse.lastName || ''}</span>
												<svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
												</svg>
											</a>
										</dd>
									</div>
								{/if}
								<div>
									<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date Joined</dt>
									<dd class="text-base font-medium text-gray-900">{contact.dateJoined ? formatDateUK(contact.dateJoined) : '—'}</dd>
								</div>
								<div>
									<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Newsletter</dt>
									<dd>
										{#if contact.subscribed !== false}
											<span class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-100 text-green-800">
												<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
												</svg>
												Subscribed
											</span>
										{:else}
											<span class="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-100 text-red-800">
												<svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
												</svg>
												Unsubscribed
											</span>
										{/if}
									</dd>
								</div>
							</div>
							{#if contact.membershipStatus === 'member'}
								<div class="pt-4 mt-4 border-t border-gray-200">
									<a href="/hub/members/{contact.id}" class="hub-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 btn-theme-2 shadow-md transition-all">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										View Member Details
									</a>
								</div>
							{/if}
						</div>
						{/if}
					</div>

					<!-- Address + Notes row -->
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<!-- Address Card -->
						{#if contact.addressLine1 || contact.city || contact.postcode}
							<div class="hub-top-panel overflow-hidden">
								<button type="button" class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50 w-full text-left cursor-pointer hover:opacity-90 transition-opacity" on:click={() => togglePanel('address')} aria-expanded={expandedPanels.has('address')}>
									<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
										<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
									</div>
									<h2 class="text-xl font-bold text-gray-900 crm-shell-main flex-1">Address</h2>
									<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0" class:rotate-180={expandedPanels.has('address')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
								</button>
								{#if expandedPanels.has('address')}
								<div class="p-6">
									<div class="space-y-1">
										{#if contact.addressLine1}
											<p class="text-base text-gray-900 font-medium">
												{contact.addressLine1}
											</p>
											{#if contact.addressLine2}
												<p class="text-base text-gray-900 font-medium">
													{contact.addressLine2}
												</p>
											{/if}
										{/if}
										<div class="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-gray-600">
											{#if contact.city}
												<span>{contact.city}</span>
											{/if}
											{#if contact.county}
												<span>{contact.county}</span>
											{/if}
											{#if contact.postcode}
												<span class="font-medium">{contact.postcode}</span>
											{/if}
											{#if contact.country}
												<span>{contact.country}</span>
											{/if}
										</div>
									</div>
								</div>
								{/if}
							</div>
						{/if}

						<!-- Notes Card -->
						{#if contact.notes}
							<div class="hub-top-panel overflow-hidden">
								<button type="button" class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50 w-full text-left cursor-pointer hover:opacity-90 transition-opacity" on:click={() => togglePanel('notes')} aria-expanded={expandedPanels.has('notes')}>
									<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
										<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
										</svg>
									</div>
									<h2 class="text-xl font-bold text-gray-900 crm-shell-main flex-1">Notes</h2>
									<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0" class:rotate-180={expandedPanels.has('notes')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
								</button>
								{#if expandedPanels.has('notes')}
								<div class="p-6">
									<p class="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">{contact.notes}</p>
								</div>
								{/if}
							</div>
						{/if}
					</div>
			</div>
		{/if}

		<!-- Thank-you messages + Outstanding invites row -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Thank-you messages panel -->
			<div class="hub-top-panel overflow-hidden">
				<div class="hub-top-panel-header flex items-center justify-between gap-3 bg-theme-panel-bg/50">
					<button type="button" class="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer hover:opacity-90 transition-opacity" on:click={() => togglePanel('thankyou')} aria-expanded={expandedPanels.has('thankyou')}>
						<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center shrink-0">
							<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
							</svg>
						</div>
						<h2 class="text-xl font-bold text-gray-900 crm-shell-main">Thank-you messages</h2>
						{#if thankyouMessages.length > 0}
							<span class="text-sm font-medium text-gray-500">({thankyouMessages.length})</span>
						{/if}
						<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0 ml-auto" class:rotate-180={expandedPanels.has('thankyou')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
					</button>
					<button
						type="button"
						class="hub-btn btn-theme-1 text-sm px-4 py-2 shrink-0"
						on:click={() => { showThankyouForm = !showThankyouForm; }}
					>
						{showThankyouForm ? 'Cancel' : '+ Send a message'}
					</button>
				</div>

				{#if expandedPanels.has('thankyou')}
				<div class="p-6 space-y-4">
					{#if showThankyouForm}
						<form method="POST" action="?/sendThankyou" use:enhance={handleThankyouEnhance} class="space-y-3 pb-4 border-b border-gray-100">
							<input type="hidden" name="_csrf" value={csrfToken} />
							<label for="thankyou-msg" class="block text-sm font-semibold text-gray-700">
								Write a personal message to {contact.firstName || 'this volunteer'}
							</label>
							<textarea
								id="thankyou-msg"
								name="message"
								bind:value={thankyouText}
								rows="4"
								maxlength="1000"
								placeholder="e.g. Thank you so much for your help at the food bank last Saturday — the team really appreciated it!"
								class="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 text-base resize-y min-h-[100px] focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-transparent"
							></textarea>
							<p class="text-xs text-gray-400 text-right">{thankyouText.length}/1000</p>
							<div class="flex gap-3">
								<button
									type="submit"
									class="hub-btn btn-theme-1 px-5 py-2 text-sm font-semibold"
									disabled={thankyouSubmitting || !thankyouText.trim()}
								>
									{thankyouSubmitting ? 'Sending…' : 'Send message'}
								</button>
								<button
									type="button"
									class="hub-btn text-sm px-4 py-2 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
									on:click={() => { showThankyouForm = false; thankyouText = ''; }}
								>
									Cancel
								</button>
							</div>
						</form>
					{/if}

					{#if thankyouMessages.length > 0}
						<div class="space-y-3">
							{#each thankyouMessages as msg}
								<div class="bg-amber-50 border border-amber-200 rounded-xl p-4">
									<p class="text-base text-gray-800 leading-relaxed whitespace-pre-wrap">"{msg.message}"</p>
									<p class="mt-2 text-sm text-gray-500">
										— {thankyouSenderDisplay(msg)} ·
										{new Date(msg.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
									</p>
								</div>
							{/each}
						</div>
					{:else if !showThankyouForm}
						<p class="text-sm text-gray-500">No messages sent yet. Send a personal thank-you and it'll appear on {contact.firstName || 'their'} MyHub history page.</p>
					{/if}
				</div>
				{/if}
			</div>

			<!-- Outstanding invites (MyHub rota invitations) -->
			<div class="hub-top-panel overflow-hidden">
				<button type="button" class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50 w-full text-left cursor-pointer hover:opacity-90 transition-opacity" on:click={() => togglePanel('outstanding')} aria-expanded={expandedPanels.has('outstanding')}>
					<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
						</svg>
					</div>
					<h2 class="text-xl font-bold text-gray-900 crm-shell-main flex-1">Outstanding invites</h2>
					{#if myhubInvitations.length > 0}
						<span class="text-sm font-medium text-gray-500">({myhubInvitations.length})</span>
					{/if}
					<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0" class:rotate-180={expandedPanels.has('outstanding')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
				</button>
				{#if expandedPanels.has('outstanding')}
				<div class="p-6">
					{#if myhubInvitations.length > 0}
						<ul class="space-y-3">
							{#each myhubInvitations as { inv, rota, event, occurrence }}
								<li class="flex flex-wrap items-center gap-2 sm:gap-3 py-2 border-b border-gray-100 last:border-0">
									<div class="flex-1 min-w-0">
										{#if rota?.id}
											<a href="/hub/rotas/{rota.id}" class="text-theme-button-1 hover:underline font-medium">
												{event?.name || rota?.name || 'Rota'}
											</a>
										{:else}
											<span class="text-gray-700">Rota (deleted or unavailable)</span>
										{/if}
										{#if occurrence?.startsAt}
											<span class="text-gray-500 text-sm ml-1">
												— {formatDateUK(occurrence.startsAt)}
											</span>
										{/if}
									</div>
									<span
										class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold shrink-0
											{inv.status === 'pending'
												? 'bg-amber-100 text-amber-800'
												: inv.status === 'accepted'
													? 'bg-green-100 text-green-800'
													: inv.status === 'declined'
														? 'bg-gray-100 text-gray-700'
														: 'bg-gray-100 text-gray-600'}"
									>
										{inv.status === 'pending' ? 'Pending' : inv.status === 'accepted' ? 'Accepted' : inv.status === 'declined' ? 'Declined' : (inv.status || 'Pending')}
									</span>
									{#if rota?.id}
										<a href="/hub/rotas/{rota.id}" class="text-sm text-theme-button-1 hover:underline shrink-0">View rota →</a>
									{/if}
								</li>
							{/each}
						</ul>
				{:else}
					<p class="text-sm text-gray-500">No rota invitations for this contact. Invite them from a rota's detail page.</p>
				{/if}
				</div>
				{/if}
			</div>
		</div>

		<!-- MyHub preferences (read-only: availability, about me, reminders) -->
		<div class="hub-top-panel overflow-hidden">
			<button type="button" class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50 w-full text-left cursor-pointer hover:opacity-90 transition-opacity" on:click={() => togglePanel('myhub')} aria-expanded={expandedPanels.has('myhub')}>
				<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
					<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</div>
				<h2 class="text-xl font-bold text-gray-900 crm-shell-main flex-1">MyHub preferences</h2>
				<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0" class:rotate-180={expandedPanels.has('myhub')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
			</button>
			{#if expandedPanels.has('myhub')}
			<div class="p-6 space-y-6">
				<div>
					<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Times that don't work for them</h3>
					<div class="overflow-x-auto">
						<table class="w-full border border-gray-200 rounded-lg overflow-hidden text-sm" role="grid" aria-label="Availability grid">
							<thead>
								<tr class="bg-gray-50">
									<th scope="col" class="text-left py-2 px-3 font-semibold text-gray-600 w-14"></th>
									{#each PREF_TIMES as time}
										<th scope="col" class="text-center py-2 px-2 font-semibold text-gray-600">{PREF_TIME_LABELS[time]}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each PREF_DAYS as day}
									<tr class="border-t border-gray-100">
										<td class="py-1.5 px-3 font-medium text-gray-700">{PREF_DAY_LABELS[day]}</td>
										{#each PREF_TIMES as time}
											<td class="py-1.5 px-2 text-center">
												{#if isUnavailable(contact, day, time)}
													<span class="inline-block w-6 h-6 rounded bg-amber-100 text-amber-800 flex items-center justify-center mx-auto" title="Unavailable">✕</span>
												{:else}
													<span class="text-gray-300">—</span>
												{/if}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="text-xs text-gray-500 mt-1">Set by the volunteer in MyHub. Blank = no preference.</p>
				</div>
				<div>
					<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">About me</h3>
					{#if contact?.aboutMe?.trim()}
						<p class="text-base text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4">{contact.aboutMe.trim()}</p>
					{:else}
						<p class="text-sm text-gray-500">— Not set</p>
					{/if}
				</div>
				<div>
					<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">Shift reminders</h3>
					<div class="flex flex-wrap items-center gap-4">
						<div>
							<span class="text-xs text-gray-500 block">Email reminders</span>
							<span class="font-medium {contact?.reminderEmail !== false ? 'text-green-700' : 'text-gray-500'}">
								{contact?.reminderEmail !== false ? 'On' : 'Off'}
							</span>
						</div>
						{#if contact?.reminderEmail !== false}
							<div>
								<span class="text-xs text-gray-500 block">When</span>
								<span class="font-medium text-gray-800">{REMINDER_TIMING_LABELS[contact?.reminderTiming || '1week'] ?? (contact?.reminderTiming || '1 week before')}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
			{/if}
		</div>
	</div>
{/if}

