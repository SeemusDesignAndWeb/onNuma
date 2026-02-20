<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';
	import { getPanelHeadColor } from '$lib/crm/utils/themeStyles.js';
	import { markNotificationSeen } from '$lib/crm/utils/markNotificationSeen.js';

	$: contact = $page.data?.contact;
	$: spouse = $page.data?.spouse;
	$: contacts = $page.data?.contacts || [];
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: theme = $page.data?.theme || null;
	$: panelHeadBgColor = getPanelHeadColor(theme);
	$: dbsBoltOn = $page.data?.dbsBoltOn ?? false;
	$: dbsRenewalYears = $page.data?.dbsRenewalYears ?? 3;
	$: dbsStatus = $page.data?.dbsStatus ?? null;
	$: safeguardingStatus = $page.data?.safeguardingStatus ?? null;

	function suggestedRenewalDue(dateIssued, years) {
		if (!dateIssued || (years !== 2 && years !== 3)) return null;
		const d = new Date(dateIssued);
		if (Number.isNaN(d.getTime())) return null;
		d.setFullYear(d.getFullYear() + years);
		return d.toISOString().slice(0, 10);
	}

	function suggestedSafeguardingRenewalDue(dateCompleted) {
		if (!dateCompleted) return null;
		const d = new Date(dateCompleted);
		if (Number.isNaN(d.getTime())) return null;
		d.setFullYear(d.getFullYear() + 3);
		return d.toISOString().slice(0, 10);
	}

	const SAFEGUARDING_LEVELS = [
		{ value: '', label: '—' },
		{ value: 'basic_awareness', label: 'Basic Awareness' },
		{ value: 'foundation', label: 'Foundation' },
		{ value: 'leadership', label: 'Leadership' },
		{ value: 'safer_recruitment', label: 'Safer Recruitment' },
		{ value: 'pso_induction', label: 'PSO Induction' }
	];

	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	$: thankyouMessages = $page.data?.thankyouMessages ?? [];
	$: myhubInvitations = $page.data?.myhubInvitations ?? [];

	const DBS_LEVELS = [
		{ value: '', label: '—' },
		{ value: 'basic', label: 'Basic' },
		{ value: 'standard', label: 'Standard' },
		{ value: 'enhanced', label: 'Enhanced' },
		{ value: 'enhanced_barred', label: 'Enhanced with Barred List' }
	];

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

	// Collapsible panels: only contact name/details (Personal Information) expanded by default
	const PANEL_IDS = ['personal', 'notes', 'dbs', 'safeguarding', 'coordinatorNotes', 'thankyou', 'outstanding', 'myhub'];
	let expandedPanels = new Set(['personal']);
	function togglePanel(id) {
		const next = new Set(expandedPanels);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedPanels = next;
	}

	// Pastoral care (DBS bolt-on)
	$: pastoralFlags = $page.data?.pastoralFlags ?? [];
	$: absenceEvents = $page.data?.absenceEvents ?? [];
	$: milestones = $page.data?.milestones ?? [];

	$: activePastoralFlags = pastoralFlags.filter((f) => f.status === 'active');
	$: recentAbsences = absenceEvents.slice(0, 10);

	onMount(() => {
		// Mark DBS notification seen when coordinator views a contact with amber/red DBS status
		if (contact?.id && dbsBoltOn && (dbsStatus?.status === 'amber' || dbsStatus?.status === 'red')) {
			markNotificationSeen('dbs_notification', [contact.id]);
		}
		// Mark pastoral concern seen for each active flag visible on this contact's profile
		if (contact?.id && dbsBoltOn && activePastoralFlags.length > 0) {
			markNotificationSeen('pastoral_concern', activePastoralFlags.map((f) => f.id));
		}
	});

	let showAbsenceForm = false;
	let absenceNote = '';
	let absenceDate = '';
	let absenceType = 'marked_absent';
	let pastoralWorking = false;

	// Note editor per flag: flagId -> note text
	let flagNotes = {};

	async function pastoralAction(action, params = {}) {
		if (pastoralWorking) return;
		pastoralWorking = true;
		try {
			const res = await fetch(`/hub/contacts/${contact.id}/pastoral`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action, ...params })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				notifications.error(err?.error || 'An error occurred');
			} else {
				// Reload page data to reflect changes
				window.location.reload();
			}
		} catch (e) {
			notifications.error('Network error — please try again');
		} finally {
			pastoralWorking = false;
		}
	}

	function milestoneLabel(key) {
		const map = { '1year': '1 year of service', '5years': '5 years of service', '50sessions': '50 sessions served', '100sessions': '100 sessions served' };
		return map[key] || key;
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
		const d = contact.dbs || {};
		const sg = contact.safeguarding || {};
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
			spouseId: contact.spouseId || '',
			dbs: {
				level: d.level || '',
				dateIssued: d.dateIssued || '',
				renewalDueDate: d.renewalDueDate || '',
				updateServiceRegistered: d.updateServiceRegistered === true,
				certificateRef: d.certificateRef || '',
				notes: d.notes || ''
			},
			safeguarding: {
				level: sg.level || '',
				dateCompleted: sg.dateCompleted || '',
				renewalDueDate: sg.renewalDueDate || '',
				notes: sg.notes || ''
			},
			coordinatorNotes: contact.coordinatorNotes || ''
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
							<h1 class="text-2xl sm:text-3xl font-bold crm-shell-main">
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
					<!-- Personal Information Card (includes address) -->
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
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
								<FormField label="First Name" name="firstName" bind:value={formData.firstName} />
								<FormField label="Last Name" name="lastName" bind:value={formData.lastName} />
								<FormField label="Phone" name="phone" bind:value={formData.phone} />
								<div class="sm:col-span-2 lg:col-span-1">
									<label for="spouseId" class="block text-sm font-semibold text-gray-700 mb-2">Partner</label>
									<select id="spouseId" name="spouseId" bind:value={formData.spouseId} class="w-full rounded-lg border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-2 focus:ring-theme-button-1 py-2.5 px-4 text-gray-900 transition-all">
										<option value="">None</option>
										{#each contacts as contactOption}
											<option value={contactOption.id}>
												{contactOption.firstName || ''} {contactOption.lastName || ''} {contactOption.email ? `(${contactOption.email})` : ''}
											</option>
										{/each}
									</select>
								</div>
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2 border-t border-gray-100">
								<div class="sm:col-span-2 lg:col-span-2">
									<FormField label="Address Line 1" name="addressLine1" bind:value={formData.addressLine1} />
								</div>
								<div class="sm:col-span-2 lg:col-span-2">
									<FormField label="Address Line 2" name="addressLine2" bind:value={formData.addressLine2} />
								</div>
								<FormField label="City" name="city" bind:value={formData.city} />
								<FormField label="County" name="county" bind:value={formData.county} />
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

					<!-- Additional Information (Notes, full width) -->
					<div class="hub-top-panel overflow-hidden lg:col-span-2">
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

					{#if dbsBoltOn}
					<!-- DBS record (DBS Bolt-On) -->
					<div class="hub-top-panel overflow-hidden">
						<div class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50">
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
							</div>
							<h3 class="text-lg font-bold text-gray-900 crm-shell-main">DBS record</h3>
						</div>
						<div class="p-6 space-y-5">
							<p class="text-sm text-gray-600">Record-keeping only. OnNuma does not process DBS applications.</p>
							<div>
								<label for="dbs_level" class="block text-sm font-semibold text-gray-700 mb-1">DBS level</label>
								<select id="dbs_level" name="dbs_level" bind:value={formData.dbs.level} class="w-full rounded-lg border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-2 focus:ring-theme-button-1 py-2.5 px-4 text-gray-900">
									{#each DBS_LEVELS as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
								<FormField label="Date certificate issued" name="dbs_dateIssued" type="date" bind:value={formData.dbs.dateIssued} />
								<div>
									<label for="dbs_renewalDueDate" class="block text-sm font-semibold text-gray-700 mb-1">Renewal due date</label>
									<input type="date" id="dbs_renewalDueDate" name="dbs_renewalDueDate" bind:value={formData.dbs.renewalDueDate} class="w-full rounded-lg border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-2 focus:ring-theme-button-1 py-2.5 px-4 text-gray-900" />
									{#if formData.dbs.dateIssued && suggestedRenewalDue(formData.dbs.dateIssued, dbsRenewalYears)}
										<p class="text-xs text-gray-500 mt-1">Suggested: {suggestedRenewalDue(formData.dbs.dateIssued, dbsRenewalYears)} (issued + {dbsRenewalYears} years)</p>
									{/if}
								</div>
							</div>
							<div>
								<label class="flex items-center cursor-pointer group">
									<input type="checkbox" name="dbs_updateService" bind:checked={formData.dbs.updateServiceRegistered} class="w-5 h-5 rounded border-gray-300 text-theme-button-2 shadow-sm focus:ring-2 focus:ring-theme-button-2 cursor-pointer" />
									<span class="ml-3 text-sm font-medium text-gray-700">DBS Update Service registered</span>
								</label>
							</div>
							<FormField label="Certificate reference (optional)" name="dbs_certificateRef" bind:value={formData.dbs.certificateRef} />
							<FormField label="Notes (e.g. awaiting renewal, working supervised)" name="dbs_notes" type="textarea" rows="3" bind:value={formData.dbs.notes} />
						</div>
					</div>
					<!-- Safeguarding training (DBS Bolt-On) -->
					<div class="hub-top-panel overflow-hidden">
						<div class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50">
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
								</svg>
							</div>
							<h3 class="text-lg font-bold text-gray-900 crm-shell-main">Safeguarding training</h3>
						</div>
						<div class="p-6 space-y-5">
							<p class="text-sm text-gray-600">Record-keeping only. OnNuma does not host training content.</p>
							<div>
								<label for="sg_level" class="block text-sm font-semibold text-gray-700 mb-1">Training level</label>
								<select id="sg_level" name="sg_level" bind:value={formData.safeguarding.level} class="w-full rounded-lg border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-2 focus:ring-theme-button-1 py-2.5 px-4 text-gray-900">
									{#each SAFEGUARDING_LEVELS as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							</div>
							<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
								<FormField label="Date completed" name="sg_dateCompleted" type="date" bind:value={formData.safeguarding.dateCompleted} />
								<div>
									<label for="sg_renewalDueDate" class="block text-sm font-semibold text-gray-700 mb-1">Renewal due date</label>
									<input type="date" id="sg_renewalDueDate" name="sg_renewalDueDate" bind:value={formData.safeguarding.renewalDueDate} class="w-full rounded-lg border border-gray-300 shadow-sm focus:border-theme-button-1 focus:ring-2 focus:ring-theme-button-1 py-2.5 px-4 text-gray-900" />
									{#if formData.safeguarding.dateCompleted && suggestedSafeguardingRenewalDue(formData.safeguarding.dateCompleted)}
										<p class="text-xs text-gray-500 mt-1">Suggested: {suggestedSafeguardingRenewalDue(formData.safeguarding.dateCompleted)} (completed + 3 years)</p>
									{/if}
								</div>
							</div>
							<FormField label="Notes" name="sg_notes" type="textarea" rows="3" bind:value={formData.safeguarding.notes} />
						</div>
					</div>
					<!-- Coordinator notes (DBS Bolt-On, private – not visible in MyHub) -->
					<div class="hub-top-panel overflow-hidden">
						<div class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50">
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l11.964-11.964A6 6 0 1121 9z" />
								</svg>
							</div>
							<h3 class="text-lg font-bold text-gray-900 crm-shell-main">Coordinator notes</h3>
						</div>
						<div class="p-6">
							<p class="text-sm text-gray-600 mb-3">Private notes for coordinators and team leaders only. Never visible to the volunteer in MyHub.</p>
							<FormField label="Notes" name="coordinatorNotes" type="textarea" rows="4" bind:value={formData.coordinatorNotes} placeholder="e.g. pastoral context, serving restrictions, temporary arrangements" />
						</div>
					</div>
					{/if}
				</div>
			</form>
		{:else}
			<!-- Main Content: Personal full width, then 2-column grid for other panels -->
			<div class="space-y-6">
					<!-- Personal Information (contact name/details) - only panel expanded by default -->
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
							<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
								<div>
									<dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Address</dt>
									<dd class="text-base text-gray-900">
										{#if contact.addressLine1 || contact.city || contact.postcode}
											<div class="space-y-0.5">
												{#if contact.addressLine1}
													<p>{contact.addressLine1}</p>
													{#if contact.addressLine2}<p>{contact.addressLine2}</p>{/if}
												{/if}
												<p class="text-gray-600">
													{[contact.city, contact.county, contact.postcode, contact.country].filter(Boolean).join(', ') || '—'}
												</p>
											</div>
										{:else}
											—
										{/if}
									</dd>
								</div>
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

					<!-- Other panels in 2-column grid to reduce rows -->
					<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

					{#if dbsBoltOn}
					<!-- DBS record (view) -->
					<div class="hub-top-panel overflow-hidden">
						<button type="button" class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50 w-full text-left cursor-pointer hover:opacity-90 transition-opacity" on:click={() => togglePanel('dbs')} aria-expanded={expandedPanels.has('dbs')}>
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
								</svg>
							</div>
							<h2 class="text-xl font-bold text-gray-900 crm-shell-main flex-1">DBS record</h2>
							{#if dbsStatus}
								<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium {dbsStatus.status === 'green' ? 'bg-green-100 text-green-800' : dbsStatus.status === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
									{dbsStatus.label}
								</span>
							{/if}
							<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0" class:rotate-180={expandedPanels.has('dbs')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
						</button>
						{#if expandedPanels.has('dbs')}
						<div class="p-6">
							{#if contact.dbs?.level}
								<dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Level</dt><dd class="text-base text-gray-900">{contact.dbs.level.replace(/_/g, ' ')}</dd></div>
									<div><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date issued</dt><dd class="text-base text-gray-900">{contact.dbs.dateIssued ? formatDateUK(contact.dbs.dateIssued) : '—'}</dd></div>
									<div><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Renewal due</dt><dd class="text-base text-gray-900">{contact.dbs.renewalDueDate ? formatDateUK(contact.dbs.renewalDueDate) : '—'}</dd></div>
									<div><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Update Service</dt><dd class="text-base text-gray-900">{contact.dbs.updateServiceRegistered ? 'Yes' : 'No'}</dd></div>
									{#if contact.dbs.certificateRef}<div><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Certificate ref</dt><dd class="text-base text-gray-900">{contact.dbs.certificateRef}</dd></div>{/if}
								</dl>
								{#if contact.dbs.notes}<p class="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{contact.dbs.notes}</p>{/if}
							{:else}
								<p class="text-gray-500 text-sm">No DBS record yet. Edit the contact to add one.</p>
							{/if}
						</div>
						{/if}
					</div>
					<!-- Safeguarding training (view) -->
					<div class="hub-top-panel overflow-hidden">
						<button type="button" class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50 w-full text-left cursor-pointer hover:opacity-90 transition-opacity" on:click={() => togglePanel('safeguarding')} aria-expanded={expandedPanels.has('safeguarding')}>
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
								</svg>
							</div>
							<h2 class="text-xl font-bold text-gray-900 crm-shell-main flex-1">Safeguarding training</h2>
							{#if safeguardingStatus}
								<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium {safeguardingStatus.status === 'green' ? 'bg-green-100 text-green-800' : safeguardingStatus.status === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}">
									{safeguardingStatus.label}
								</span>
							{/if}
							<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0" class:rotate-180={expandedPanels.has('safeguarding')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
						</button>
						{#if expandedPanels.has('safeguarding')}
						<div class="p-6">
							{#if contact.safeguarding?.level}
								<dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
									<div><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Training level</dt><dd class="text-base text-gray-900">{contact.safeguarding.level.replace(/_/g, ' ')}</dd></div>
									<div><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date completed</dt><dd class="text-base text-gray-900">{contact.safeguarding.dateCompleted ? formatDateUK(contact.safeguarding.dateCompleted) : '—'}</dd></div>
									<div><dt class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Renewal due</dt><dd class="text-base text-gray-900">{contact.safeguarding.renewalDueDate ? formatDateUK(contact.safeguarding.renewalDueDate) : '—'}</dd></div>
								</dl>
								{#if contact.safeguarding.notes}<p class="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{contact.safeguarding.notes}</p>{/if}
							{:else}
								<p class="text-gray-500 text-sm">No safeguarding training record yet. Edit the contact to add one.</p>
							{/if}
						</div>
						{/if}
					</div>
					<!-- Coordinator notes (view, private) -->
					<div class="hub-top-panel overflow-hidden">
						<button type="button" class="hub-top-panel-header flex items-center gap-3 bg-theme-panel-bg/50 w-full text-left cursor-pointer hover:opacity-90 transition-opacity" on:click={() => togglePanel('coordinatorNotes')} aria-expanded={expandedPanels.has('coordinatorNotes')}>
							<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
								<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l11.964-11.964A6 6 0 1121 9z" />
								</svg>
							</div>
							<h2 class="text-xl font-bold text-gray-900 crm-shell-main flex-1">Coordinator notes</h2>
							<svg class="w-5 h-5 text-gray-500 transition-transform shrink-0" class:rotate-180={expandedPanels.has('coordinatorNotes')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
						</button>
						{#if expandedPanels.has('coordinatorNotes')}
						<div class="p-6">
							{#if contact.coordinatorNotes}
								<p class="text-base text-gray-700 leading-relaxed whitespace-pre-wrap">{contact.coordinatorNotes}</p>
							{:else}
								<p class="text-gray-500 text-sm">No coordinator notes. Private — not visible to the volunteer.</p>
							{/if}
						</div>
						{/if}
					</div>
					{/if}
					</div>
			</div>
		{/if}

		{#if dbsBoltOn}
		<!-- Milestone prompts (shown when unacknowledged milestones exist) -->
		{#each milestones as milestone}
		<div class="bg-amber-50 border border-amber-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div class="flex items-start gap-3">
				<div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 text-xl" aria-hidden="true">🎉</div>
				<div>
					<p class="font-semibold text-gray-900">Long-service milestone reached</p>
					<p class="text-sm text-gray-700 mt-0.5">{contact.firstName || 'This volunteer'} has reached <strong>{milestoneLabel(milestone.milestoneKey)}</strong>. You may wish to send a personal thank-you.</p>
				</div>
			</div>
			<div class="flex gap-2 shrink-0">
				<button
					type="button"
					class="hub-btn btn-theme-1 text-sm"
					on:click={() => { showThankyouForm = true; pastoralAction('acknowledge-milestone', { milestoneId: milestone.id }); }}
				>
					Send thank-you
				</button>
				<button
					type="button"
					class="hub-btn text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
					on:click={() => pastoralAction('acknowledge-milestone', { milestoneId: milestone.id })}
					disabled={pastoralWorking}
				>
					Dismiss
				</button>
			</div>
		</div>
		{/each}

		<!-- Active pastoral care flags -->
		{#each activePastoralFlags as flag}
		<div class="bg-blue-50 border border-blue-200 rounded-xl p-5">
			<div class="flex items-start gap-3">
				<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-700" aria-hidden="true">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
				</div>
				<div class="flex-1">
					<p class="font-semibold text-gray-900">Pastoral care note</p>
					<p class="text-sm text-gray-700 mt-0.5">{flag.message}</p>
					{#if flag.pastoralNote}
						<p class="text-sm text-gray-600 mt-2 italic bg-blue-100 rounded px-3 py-2">Private note: {flag.pastoralNote}</p>
					{/if}
					<!-- Private note editor -->
					<div class="mt-3 space-y-2">
						<textarea
							bind:value={flagNotes[flag.id]}
							placeholder="Add a private pastoral note (not visible to the volunteer)…"
							rows="2"
							class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-blue-300"
						></textarea>
						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								class="hub-btn text-sm border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
								on:click={() => pastoralAction('add-note', { flagId: flag.id, note: flagNotes[flag.id] || '' })}
								disabled={pastoralWorking}
							>
								Save note
							</button>
							<button
								type="button"
								class="hub-btn text-sm border border-blue-300 bg-blue-100 text-blue-800 hover:bg-blue-200"
								on:click={() => pastoralAction('follow-up', { flagId: flag.id, note: flagNotes[flag.id] || null })}
								disabled={pastoralWorking}
							>
								Mark as followed up
							</button>
							<button
								type="button"
								class="hub-btn text-sm border border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
								on:click={() => pastoralAction('dismiss-flag', { flagId: flag.id })}
								disabled={pastoralWorking}
							>
								Dismiss
							</button>
						</div>
					</div>
				</div>
			</div>
			<p class="text-xs text-gray-400 mt-3 text-right">Raised {new Date(flag.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · Private — never shown to volunteer</p>
		</div>
		{/each}

		<!-- Absence recording + history -->
		<div class="hub-top-panel overflow-hidden">
			<div class="hub-top-panel-header flex items-center justify-between gap-3 bg-theme-panel-bg/50">
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 bg-theme-panel-bg rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-theme-button-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
						</svg>
					</div>
					<h2 class="text-xl font-bold text-gray-900 crm-shell-main">Absence record</h2>
					{#if absenceEvents.length > 0}
						<span class="text-sm font-medium text-gray-500">({absenceEvents.length})</span>
					{/if}
				</div>
				<button
					type="button"
					class="hub-btn btn-theme-1 text-sm px-4 py-2 shrink-0"
					on:click={() => { showAbsenceForm = !showAbsenceForm; }}
				>
					{showAbsenceForm ? 'Cancel' : '+ Record absence'}
				</button>
			</div>
			<div class="p-6 space-y-4">
				{#if showAbsenceForm}
					<div class="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 mb-4">
						<p class="text-sm text-gray-600">Record that {contact.firstName || 'this volunteer'} cancelled or was absent from a session. Three or more absences in eight weeks will raise a pastoral care prompt.</p>
						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-1" for="absence-type">Type</label>
								<select id="absence-type" bind:value={absenceType} class="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm">
									<option value="marked_absent">Marked absent</option>
									<option value="cancelled">Volunteer cancelled</option>
								</select>
							</div>
							<div>
								<label class="block text-sm font-semibold text-gray-700 mb-1" for="absence-date">Session date (optional)</label>
								<input type="date" id="absence-date" bind:value={absenceDate} class="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm" />
							</div>
						</div>
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-1" for="absence-notes">Notes (optional, private)</label>
							<input type="text" id="absence-notes" bind:value={absenceNote} placeholder="e.g. unwell, family commitment" class="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm" maxlength="500" />
						</div>
						<button
							type="button"
							class="hub-btn btn-theme-1 text-sm"
							on:click={() => {
								pastoralAction('record-absence', {
									type: absenceType,
									absenceDate: absenceDate || null,
									notes: absenceNote || null
								}).then(() => { showAbsenceForm = false; absenceNote = ''; absenceDate = ''; });
							}}
							disabled={pastoralWorking}
						>
							{pastoralWorking ? 'Saving…' : 'Record absence'}
						</button>
					</div>
				{/if}

				{#if recentAbsences.length > 0}
					<ul class="space-y-2">
						{#each recentAbsences as ev}
							<li class="flex items-center gap-3 text-sm py-1 border-b border-gray-100 last:border-0">
								<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {ev.type === 'cancelled' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}">
									{ev.type === 'cancelled' ? 'Cancelled' : 'Absent'}
								</span>
								<span class="text-gray-700">{ev.absenceDate ? new Date(ev.absenceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : new Date(ev.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
								{#if ev.notes}<span class="text-gray-500 truncate max-w-xs">{ev.notes}</span>{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="text-sm text-gray-500">No absences recorded. Record an absence to start tracking patterns.</p>
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
											<a href="/hub/schedules/{rota.id}" class="text-theme-button-1 hover:underline font-medium">
												{event?.title || rota?.role || 'Schedule'}
											</a>
										{:else}
											<span class="text-gray-700">Schedule (deleted or unavailable)</span>
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
										<a href="/hub/schedules/{rota.id}" class="text-sm text-theme-button-1 hover:underline shrink-0">View rota →</a>
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

		<!-- MyHub preferences (availability, about me, reminders) -->
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
			<div class="p-6">
				<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
					<div>
						<h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Times that don't work</h3>
						<div class="overflow-x-auto">
							<table class="w-full border border-gray-200 rounded-lg text-sm" role="grid" aria-label="Availability grid">
								<thead>
									<tr class="bg-gray-50">
										<th scope="col" class="text-left py-3 px-4 font-semibold text-gray-600"></th>
										{#each PREF_TIMES as time}
											<th scope="col" class="text-center py-3 px-3 font-semibold text-gray-600">{PREF_TIME_LABELS[time]}</th>
										{/each}
									</tr>
								</thead>
								<tbody>
									{#each PREF_DAYS as day}
										<tr class="border-t border-gray-100">
											<td class="py-2.5 px-4 font-medium text-gray-700">{PREF_DAY_LABELS[day]}</td>
											{#each PREF_TIMES as time}
												<td class="py-2.5 px-3 text-center">
													{#if isUnavailable(contact, day, time)}
														<span class="inline-block w-6 h-6 rounded bg-amber-100 text-amber-800 flex items-center justify-center mx-auto text-sm" title="Unavailable">✕</span>
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
						<p class="text-sm text-gray-500 mt-2">Set in MyHub. Blank = no preference.</p>
					</div>
					<div class="space-y-6">
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
							<div class="flex flex-wrap items-center gap-3 text-base">
								<span class="font-medium {contact?.reminderEmail !== false ? 'text-green-700' : 'text-gray-500'}">
									Email: {contact?.reminderEmail !== false ? 'On' : 'Off'}
								</span>
								{#if contact?.reminderEmail !== false}
									<span class="text-gray-600">· {REMINDER_TIMING_LABELS[contact?.reminderTiming || '1week'] ?? (contact?.reminderTiming || '1 week before')}</span>
								{/if}
							</div>
						</div>
					</div>
				</div>
			</div>
			{/if}
		</div>
	</div>
{/if}

