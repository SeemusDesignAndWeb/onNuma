<script>
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { notifications, dialog } from '$lib/crm/stores/notifications.js';
	
	export let data;
	/** @type {Record<string, string>} - Route params from SvelteKit (accepted to avoid unknown-prop warning) */
	export const params = {};

	$: admin = data?.admin || null;
	let settings = data?.settings || { emailRateLimitDelay: 500, calendarColours: [], theme: {} };
	
	function toHex(val, fallback) {
		return (typeof val === 'string' && val.trim() && /^#[0-9A-Fa-f]{6}$/.test(val.trim())) ? val.trim() : fallback;
	}
	function normalizeCalendarColour(c) {
		return { value: toHex(c?.value, '#9333ea'), label: (c?.label != null && typeof c.label === 'string') ? c.label : '' };
	}

	let emailRateLimitDelay = settings?.emailRateLimitDelay || 500;
	let calendarColours = (JSON.parse(JSON.stringify(settings?.calendarColours || []))).map(normalizeCalendarColour);

	// Theme: logos and layout only (colours are set in multi-org Settings)
	let themeLogoPath = settings?.theme?.logoPath ?? '';
	let themeLoginLogoPath = settings?.theme?.loginLogoPath ?? '';
	let themeExternalPagesLayout = settings?.theme?.externalPagesLayout ?? 'integrated';
	let themePublicPagesBranding = settings?.theme?.publicPagesBranding ?? 'hub';
	let saving = false;
	let editingColourIndex = null;
	let originalColour = null; // Store original colour when editing starts
	let newColour = { value: '#9333ea', label: '' };
	let showAddColour = false;
	// Set to true to show Email Rate Limiting and Data store tabs (code kept for later use)
	const SHOW_EMAIL_AND_DATA_STORE_TABS = false;
	const validTabs = ['theme', 'colours', 'terminology', 'billing', 'email', 'data-store', 'privacy', 'advanced'];
	let activeTab = 'theme';
	// Deep link: open specific tab from URL (e.g. /hub/settings?tab=billing for plan confirmation link)
	onMount(() => {
		const params = typeof window !== 'undefined' && window.location?.search ? new URLSearchParams(window.location.search) : null;
		const tab = params?.get('tab');
		if (tab && validTabs.includes(tab)) activeTab = tab;
		if (!SHOW_EMAIL_AND_DATA_STORE_TABS && (activeTab === 'email' || activeTab === 'data-store')) activeTab = 'theme';
	});
	$: if (!SHOW_EMAIL_AND_DATA_STORE_TABS && (activeTab === 'email' || activeTab === 'data-store')) activeTab = 'theme';
	// Tab options for mobile dropdown (only visible tabs)
	$: mobileTabOptions = (() => {
		const opts = [
			{ value: 'theme', label: 'Branding' },
			{ value: 'colours', label: 'Calendar Colours' },
			{ value: 'terminology', label: 'Terminology' }
		];
		if (SHOW_EMAIL_AND_DATA_STORE_TABS) {
			opts.push({ value: 'email', label: 'Email Rate Limiting' }, { value: 'data-store', label: 'Data store' });
		}
		if (showBilling || showBillingPortal) opts.push({ value: 'billing', label: 'Billing' });
		opts.push({ value: 'privacy', label: 'Privacy' });
		opts.push({ value: 'advanced', label: 'Advanced' });
		return opts;
	})();
	// Billing data from server
	$: plan = data?.plan ?? 'free';
	$: subscriptionStatus = data?.subscriptionStatus ?? null;
	$: currentPeriodEnd = data?.currentPeriodEnd ?? null;
	$: cancelAtPeriodEnd = !!data?.cancelAtPeriodEnd;
	$: hasPaddleCustomer = !!data?.hasPaddleCustomer;
	$: showBilling = !!data?.showBilling;
	$: showBillingPortal = !!data?.showBillingPortal;
	let billingCheckoutLoading = false;
	let billingPortalLoading = false;
	// When returning from Paddle with ?billing=success, show billing tab and success message
	$: billingSuccess = typeof window !== 'undefined' && $page?.url?.searchParams?.get('billing') === 'success';
	// Optimistic update: set when we switch so "Current mode" updates before refetch
	let storeModeOverride = null;
	$: storeMode = storeModeOverride ?? data?.storeMode ?? 'file';
	$: currentOrganisationId = data?.currentOrganisationId ?? null;
	$: currentOrganisation = data?.currentOrganisation ?? null;

	// Privacy policy contact (shown in Hub Privacy Policy "Who We Are"; fallback = Super admin)
	let privacyContactName = currentOrganisation?.privacyContactName ?? '';
	let privacyContactEmail = currentOrganisation?.privacyContactEmail ?? '';
	let privacyContactPhone = currentOrganisation?.privacyContactPhone ?? '';
	let savingPrivacyContact = false;

	// Contact data (GDPR): download / delete all data for a contact (Super admin only)
	let contactLookupQuery = '';
	let lookedUpContact = null; // { id, firstName, lastName, email } or null
	let contactLookupLoading = false;
	let contactLookupError = '';
	let contactDownloading = false;
	let contactDeleteConfirm = false; // show confirm before delete
	let contactDeleting = false;

	async function lookupContact() {
		const q = (contactLookupQuery || '').trim();
		if (!q) {
			contactLookupError = 'Enter an email or contact ID';
			lookedUpContact = null;
			return;
		}
		contactLookupLoading = true;
		contactLookupError = '';
		lookedUpContact = null;
		try {
			const res = await fetch(`/hub/settings/contact-data/lookup?q=${encodeURIComponent(q)}`);
			const data = await res.json();
			if (data.contact) {
				lookedUpContact = data.contact;
			} else {
				contactLookupError = 'Contact not found';
			}
		} catch (err) {
			contactLookupError = err.message || 'Lookup failed';
		} finally {
			contactLookupLoading = false;
		}
	}

	function contactDisplayName() {
		if (!lookedUpContact) return '';
		const n = [lookedUpContact.firstName, lookedUpContact.lastName].filter(Boolean).join(' ').trim();
		return n || lookedUpContact.email || lookedUpContact.id;
	}

	async function downloadContactData() {
		if (!lookedUpContact?.id) return;
		contactDownloading = true;
		try {
			const res = await fetch(`/hub/settings/contact-data/export?contactId=${encodeURIComponent(lookedUpContact.id)}`);
			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: res.statusText }));
				throw new Error(err.message || 'Download failed');
			}
			const blob = await res.blob();
			const disposition = res.headers.get('Content-Disposition');
			const match = disposition && disposition.match(/filename="([^"]+)"/);
			const filename = match ? match[1] : `contact-data-${lookedUpContact.id}.json`;
			const a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = filename;
			a.click();
			URL.revokeObjectURL(a.href);
			notifications.success('Download started');
		} catch (err) {
			notifications.error(err.message || 'Download failed');
		} finally {
			contactDownloading = false;
		}
	}

	async function deleteContactData() {
		if (!lookedUpContact?.id) return;
		contactDeleting = true;
		try {
			const res = await fetch('/hub/settings/contact-data/delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contactId: lookedUpContact.id })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data?.error || data?.message || res.statusText || 'Delete failed');
			}
			notifications.success('Contact and all related data have been deleted.');
			contactDeleteConfirm = false;
			lookedUpContact = null;
			contactLookupQuery = '';
			contactLookupError = '';
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Delete failed');
		} finally {
			contactDeleting = false;
		}
	}
	
	// Terminology settings
	const TERMINOLOGY_DEFAULTS = {
		hub_name: 'TheHUB',
		organisation: 'Organisation',
		coordinator: 'Coordinator',
		team_leader: 'Team Leader',
		volunteer: 'Volunteer',
		team: 'Team',
		role: 'Role',
		event: 'Event',
		rota: 'Schedule',
		sign_up: 'Sign Up',
		session: 'Session',
		group: 'Group',
		multi_site: 'Multi-Site',
		meeting_planner: 'Meeting Planner'
	};
	const TERMINOLOGY_CHURCH_DEFAULTS = {
		hub_name: 'TheHUB',
		organisation: 'Parish',
		coordinator: 'Parish Administrator',
		team_leader: 'Team Leader',
		volunteer: 'Volunteer',
		team: 'Ministry Team',
		role: 'Ministry Role',
		event: 'Service',
		sign_up: 'Sign Up',
		session: 'Service',
		group: 'Congregation Group',
		multi_site: 'Multi-Site',
		meeting_planner: 'Service Planner'
	};
	// rota (Schedule) is fixed and not user-editable
	const TERMINOLOGY_FIELDS = [
		{ key: 'hub_name', label: 'Hub name', description: 'The name shown in the sidebar and browser title.' },
		{ key: 'organisation', label: 'Organisation', description: 'What you call your organisation.' },
		{ key: 'coordinator', label: 'Coordinator', description: 'The person who manages schedules and events.' },
		{ key: 'team_leader', label: 'Team leader', description: 'A devolved leader who manages their own team.' },
		{ key: 'volunteer', label: 'Volunteer', description: 'The people who fill roles on your schedules.' },
		{ key: 'team', label: 'Team', description: 'A named group of volunteers with defined roles.' },
		{ key: 'role', label: 'Role', description: 'A position or job within a team or schedule.' },
		{ key: 'event', label: 'Event', description: 'A scheduled event (e.g. Sunday service, match day, meeting).' },
		{ key: 'sign_up', label: 'Sign up', description: 'When a volunteer opts in to a schedule slot.' },
		{ key: 'session', label: 'Session', description: 'A single occurrence of a recurring event.' },
		{ key: 'group', label: 'Group', description: 'A subset or sub-group within the organisation.' },
		{ key: 'multi_site', label: 'Multi-site', description: 'When an organisation operates across more than one location.' },
		{ key: 'meeting_planner', label: 'Meeting Planner', description: 'The single-event overview showing all teams and assignments.' }
	];
	let terminologyValues = { ...TERMINOLOGY_DEFAULTS, ...(data?.settings?.terminology ?? {}) };
	let savingTerminology = false;

	async function saveTerminology() {
		savingTerminology = true;
		try {
			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ terminology: terminologyValues })
			});
			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				throw new Error(err.message || 'Failed to save terminology');
			}
			notifications.success('Terminology saved.');
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Failed to save terminology');
		} finally {
			savingTerminology = false;
		}
	}

	function resetTerminologyField(key) {
		terminologyValues = { ...terminologyValues, [key]: TERMINOLOGY_DEFAULTS[key] };
	}

	function applyChurchDefaults() {
		// Merge church defaults but keep rota from DEFAULTS (Schedule is fixed, not editable)
		terminologyValues = { ...TERMINOLOGY_DEFAULTS, ...TERMINOLOGY_CHURCH_DEFAULTS };
	}

	// Theme logo image browser ('navbar' | 'login')
	let logoPickerMode = 'navbar';
	let showImageBrowser = false;
	let browseImages = [];
	let browseImagesLoading = false;
	let browseImagesUploading = false;
	let browseImagesUploadError = '';
	
	async function openImageBrowser(mode = 'navbar') {
		logoPickerMode = mode;
		showImageBrowser = true;
		browseImagesUploadError = '';
		browseImagesLoading = true;
		browseImages = [];
		try {
			const response = await fetch('/hub/api/images');
			if (response.ok) {
				browseImages = await response.json();
			}
		} catch (err) {
			console.error('Failed to load images:', err);
		} finally {
			browseImagesLoading = false;
		}
	}
	function closeImageBrowser() {
		showImageBrowser = false;
		browseImagesUploadError = '';
	}
	function selectImageForLogo(path) {
		if (logoPickerMode === 'login') {
			themeLoginLogoPath = path || '';
		} else {
			themeLogoPath = path || '';
		}
		closeImageBrowser();
	}
	async function uploadImageForLogo(event) {
		const input = event.target;
		const file = input.files?.[0];
		if (!file) return;
		browseImagesUploading = true;
		browseImagesUploadError = '';
		try {
			const formData = new FormData();
			formData.append('file', file);
			const response = await fetch('/hub/api/images', { method: 'POST', body: formData });
			if (response.ok) {
				const result = await response.json();
				if (result.image) {
					browseImages = [result.image, ...browseImages];
					const path = result.image.path;
					if (logoPickerMode === 'login') {
						themeLoginLogoPath = path;
					} else {
						themeLogoPath = path;
					}
					closeImageBrowser();
				}
			} else {
				const err = await response.json().catch(() => ({}));
				browseImagesUploadError = err.error || 'Upload failed';
			}
		} catch (err) {
			browseImagesUploadError = err?.message || 'Upload failed';
		} finally {
			browseImagesUploading = false;
			input.value = '';
		}
	}
	
	let lastSyncedSettings = null;
	$: if (data?.settings && data.settings !== lastSyncedSettings) {
		lastSyncedSettings = data.settings;
		settings = data.settings;
		emailRateLimitDelay = settings.emailRateLimitDelay;
		calendarColours = (JSON.parse(JSON.stringify(settings.calendarColours || []))).map(normalizeCalendarColour);
		if (settings.theme) {
			themeLogoPath = settings.theme.logoPath ?? '';
			themeLoginLogoPath = settings.theme.loginLogoPath ?? '';
			themeExternalPagesLayout = settings.theme.externalPagesLayout ?? 'integrated';
			themePublicPagesBranding = settings.theme.publicPagesBranding ?? 'hub';
		}
		terminologyValues = { ...TERMINOLOGY_DEFAULTS, ...(settings.terminology ?? {}) };
		if (data.currentOrganisation) {
			privacyContactName = data.currentOrganisation.privacyContactName ?? '';
			privacyContactEmail = data.currentOrganisation.privacyContactEmail ?? '';
			privacyContactPhone = data.currentOrganisation.privacyContactPhone ?? '';
		}
	}
	
	async function saveSettings() {
		saving = true;
		
		try {
			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					emailRateLimitDelay: emailRateLimitDelay
				})
			});
			
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'Failed to save settings' }));
				throw new Error(errorData.message || 'Failed to save settings');
			}
			
			const result = await response.json();
			notifications.success('Settings saved successfully!');
			
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Failed to save settings');
			console.error('Error saving settings:', err);
		} finally {
			saving = false;
		}
	}
	
	async function saveCalendarColours() {
		saving = true;
		
		try {
			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					calendarColours: calendarColours
				})
			});
			
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'Failed to save calendar colours' }));
				throw new Error(errorData.message || 'Failed to save calendar colours');
			}
			
			const result = await response.json();
			notifications.success('Calendar colours saved successfully!');
			
			await invalidateAll();
			
			// Reset editing state
			editingColourIndex = null;
			showAddColour = false;
			newColour = { value: '#9333ea', label: '' };
		} catch (err) {
			notifications.error(err.message || 'Failed to save calendar colours');
			console.error('Error saving calendar colours:', err);
		} finally {
			saving = false;
		}
	}

	async function saveTheme() {
		saving = true;
		try {
			// Only logos and layout (colours are set in multi-org Settings)
			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					theme: {
						logoPath: themeLogoPath.trim(),
						loginLogoPath: themeLoginLogoPath.trim(),
						externalPagesLayout: themeExternalPagesLayout,
						publicPagesBranding: themePublicPagesBranding
					}
				})
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'Failed to save branding' }));
				throw new Error(errorData.message || 'Failed to save branding');
			}
			notifications.success('Branding saved successfully.');
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Failed to save branding');
			console.error('Error saving branding:', err);
		} finally {
			saving = false;
		}
	}

	function startEditColour(index) {
		editingColourIndex = index;
		// Store original colour values for cancel
		originalColour = { ...calendarColours[index] };
		showAddColour = false;
	}
	
	function cancelEdit() {
		if (editingColourIndex !== null && originalColour) {
			calendarColours[editingColourIndex] = { ...originalColour };
		}
		editingColourIndex = null;
		originalColour = null;
		showAddColour = false;
		newColour = { value: '#9333ea', label: '' };
	}
	
	async function addColour() {
		if (!newColour.value || !newColour.label.trim()) {
			notifications.error('Please provide both a colour and a label');
			return;
		}
		
		// Validate hex colour
		if (!/^#[0-9A-Fa-f]{6}$/.test(newColour.value)) {
			notifications.error('Invalid colour format. Please use a hex colour (e.g., #9333ea)');
			return;
		}
		
		calendarColours = [...calendarColours, { value: newColour.value, label: newColour.label.trim() }];
		newColour = { value: '#9333ea', label: '' };
		showAddColour = false;
		
		// Automatically save all calendar colours
		await saveCalendarColours();
	}
	
	async function removeColour(index) {
		const confirmed = await dialog.confirm('Are you sure you want to remove this colour?');
		if (confirmed) {
			calendarColours = calendarColours.filter((_, i) => i !== index);
			// Automatically save all calendar colours
			await saveCalendarColours();
		}
	}
	
	function updateColour(index, field, value) {
		const next = { ...calendarColours[index], [field]: value };
		if (field === 'value' && (!value || !/^#[0-9A-Fa-f]{6}$/.test(String(value).trim()))) {
			next.value = toHex(next.value, '#9333ea');
		}
		calendarColours[index] = next;
	}
	
	async function saveColourEdit() {
		// Validate the colour before saving
		const colour = calendarColours[editingColourIndex];
		if (!colour.value || !colour.label.trim()) {
			notifications.error('Please provide both a colour and a label');
			return;
		}
		
		// Validate hex colour
		if (!/^#[0-9A-Fa-f]{6}$/.test(colour.value)) {
			notifications.error('Invalid colour format. Please use a hex colour (e.g., #9333ea)');
			return;
		}
		
		editingColourIndex = null;
		originalColour = null;
		
		// Automatically save all calendar colours
		await saveCalendarColours();
	}

	async function savePrivacyContact() {
		savingPrivacyContact = true;
		try {
			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					privacyContactName: (privacyContactName || '').trim() || null,
					privacyContactEmail: (privacyContactEmail || '').trim() || null,
					privacyContactPhone: (privacyContactPhone || '').trim() || null
				})
			});
			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				throw new Error(err.message || 'Failed to save');
			}
			notifications.success('Privacy policy contact saved.');
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Failed to save privacy contact');
		} finally {
			savingPrivacyContact = false;
		}
	}

	// Billing: checkout and portal
	async function goToCheckout(planName) {
		billingCheckoutLoading = true;
		try {
			const res = await fetch(`/hub/api/checkout?plan=${encodeURIComponent(planName)}`, { credentials: 'include' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				notifications.error(json.error || 'Failed to start checkout');
				return;
			}
			if (json.url) {
				window.location.href = json.url;
			} else {
				notifications.error('No checkout URL returned');
			}
		} catch (err) {
			notifications.error(err.message || 'Checkout failed');
		} finally {
			billingCheckoutLoading = false;
		}
	}
	async function openBillingPortal() {
		billingPortalLoading = true;
		try {
			const res = await fetch('/hub/api/billing-portal', { credentials: 'include' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				notifications.error(json.error || 'Failed to open billing portal');
				return;
			}
			if (json.url) {
				window.open(json.url, '_blank', 'noopener,noreferrer');
			} else {
				notifications.error('No portal URL returned');
			}
		} catch (err) {
			notifications.error(err.message || 'Failed to open portal');
		} finally {
			billingPortalLoading = false;
		}
	}
	
	function calculateRequestsPerSecond() {
		if (emailRateLimitDelay <= 0) return 'Invalid';
		return (1000 / emailRateLimitDelay).toFixed(2);
	}

	// Data store: migrate and switch
	let migrating = false;
	let copyingToFiles = false;
	let switching = false;

	async function migrateToDatabase() {
		migrating = true;
		try {
			const res = await fetch('/hub/settings/api/migrate-to-database', {
				method: 'POST',
				credentials: 'include'
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				notifications.error(data.error || 'Migration failed');
				return;
			}
			const { results } = data;
			const total = (results?.migrated || []).reduce((n, r) => n + (r.count || 0), 0);
			const numCollections = (results?.migrated || []).length;
			if (results?.errors?.length) {
				const errMsg = results.errors.map((e) => `${e.collection}: ${e.error}`).join('; ');
				notifications.error(`Migration had errors: ${errMsg}`);
			}
			notifications.success(
				numCollections
					? `Copied ${numCollections} collections (${total} records) to database.`
					: total === 0
						? 'No file data to copy (files empty or missing).'
						: 'Data copied to database.'
			);
			// After a successful copy, switch the app to use the database so the site runs off DB
			if (numCollections > 0 && storeMode !== 'database') {
				const switchRes = await fetch('/hub/settings/api/store-mode', {
					method: 'POST',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ dataStore: 'database' })
				});
				if (switchRes.ok) {
					storeModeOverride = 'database';
					notifications.success('Switched to database. The site now uses PostgreSQL.');
				}
			}
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Migration failed');
		} finally {
			migrating = false;
		}
	}

	async function copyDatabaseToFiles() {
		copyingToFiles = true;
		try {
			const res = await fetch('/hub/settings/api/copy-database-to-files', {
				method: 'POST',
				credentials: 'include'
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				notifications.error(data.error || 'Copy to files failed');
				return;
			}
			const { results } = data;
			const total = (results?.copied || []).reduce((n, r) => n + (r.count || 0), 0);
			const numCollections = (results?.copied || []).length;
			const backupCount = (results?.backedUp || []).length;
			if (results?.errors?.length) {
				const errMsg = results.errors.map((e) => `${e.collection}: ${e.error}`).join('; ');
				notifications.error(`Copy had errors: ${errMsg}`);
			}
			notifications.success(
				numCollections
					? `Backed up ${backupCount} file(s), copied ${numCollections} collections (${total} records) to NDJSON files.`
					: 'No database data to copy (or database unavailable).'
			);
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Copy to files failed');
		} finally {
			copyingToFiles = false;
		}
	}

	async function setStoreMode(mode) {
		switching = true;
		try {
			const res = await fetch('/hub/settings/api/store-mode', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dataStore: mode })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				notifications.error(data.error || 'Failed to switch');
				return;
			}
			storeModeOverride = mode;
			notifications.success(mode === 'database' ? 'Switched to database.' : 'Switched to file store.');
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Failed to switch');
		} finally {
			switching = false;
		}
	}
</script>

<svelte:head>
	<title>Settings - TheHUB</title>
</svelte:head>

<div class="w-full min-w-0 max-w-full px-3 py-4 sm:px-4 sm:py-8">
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
		<h1 class="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Settings</h1>
		<p class="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Manage system settings (Superadmin only)</p>

		<!-- Mobile: dropdown submenu so all tabs fit on one screen -->
		<div class="md:hidden mb-4">
			<label for="settings-tab-select" class="sr-only">Settings section</label>
			<select
				id="settings-tab-select"
				class="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-3 pr-8 text-base text-gray-900 focus:border-theme-button-1 focus:ring-theme-button-1"
				bind:value={activeTab}
				aria-label="Choose settings section"
			>
				{#each mobileTabOptions as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<!-- Desktop: horizontal tabs -->
		<div class="hidden md:block border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8" aria-label="Tabs">
				<button
					on:click={() => activeTab = 'theme'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'theme' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Branding
				</button>
				<button
					on:click={() => activeTab = 'colours'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'colours' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Calendar Colours
				</button>
				<button
					on:click={() => activeTab = 'terminology'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'terminology' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Terminology
				</button>
				{#if SHOW_EMAIL_AND_DATA_STORE_TABS}
				<button
					on:click={() => activeTab = 'email'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'email' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Email Rate Limiting
				</button>
				<button
					on:click={() => activeTab = 'data-store'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'data-store' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Data store
				</button>
				{/if}
				{#if showBilling || showBillingPortal}
				<button
					on:click={() => activeTab = 'billing'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'billing' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Billing
				</button>
				{/if}
				<button
					on:click={() => activeTab = 'privacy'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'privacy' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Privacy
				</button>
				<button
					on:click={() => activeTab = 'advanced'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'advanced' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Advanced
				</button>
			</nav>
		</div>
		
		<!-- Branding (logos only; colours set in multi-org Settings) -->
		{#if activeTab === 'theme'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Branding</h2>
			<p class="text-sm text-gray-600 mb-4">
				Set logos used in the Hub and on public pages (e.g. signup). Branding colours are set in <a href="/multi-org/settings" class="text-theme-button-1 hover:underline">multi-org Settings</a>.
			</p>
			<div class="space-y-4 max-w-xl">
				<div>
					<span class="block text-sm font-medium text-gray-700 mb-2">Navbar logo</span>
					<div class="flex items-center gap-4">
						{#if themeLogoPath}
							<div class="relative group flex-shrink-0">
								<div class="w-24 h-16 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
									<img src={themeLogoPath} alt="Navbar logo" class="max-w-full max-h-full object-contain" />
								</div>
							</div>
							<div class="flex flex-col gap-1.5">
								<button
									type="button"
									on:click={() => openImageBrowser('navbar')}
									class="px-3 py-1.5 text-sm font-medium btn-theme-light-1 rounded-md whitespace-nowrap"
								>
									Change
								</button>
								<button
									type="button"
									on:click={() => themeLogoPath = ''}
									class="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap"
								>
									Remove
								</button>
							</div>
						{:else}
							<button
								type="button"
								on:click={() => openImageBrowser('navbar')}
								class="w-24 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-theme-button-1 flex items-center justify-center transition-colors cursor-pointer group"
							>
								<svg class="w-6 h-6 text-gray-400 group-hover:text-theme-button-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
							</button>
							<button
								type="button"
								on:click={() => openImageBrowser('navbar')}
								class="px-3 py-1.5 text-sm font-medium btn-theme-light-1 rounded-md whitespace-nowrap"
							>
								Select from library
							</button>
						{/if}
					</div>
					<p class="mt-1.5 text-xs text-gray-500">Logo shown in the Hub navbar and on external pages. Leave empty for default.</p>
				</div>
				<div>
					<span class="block text-sm font-medium text-gray-700 mb-2">Login screen logo</span>
					<div class="flex items-center gap-4">
						{#if themeLoginLogoPath}
							<div class="relative group flex-shrink-0">
								<div class="w-24 h-16 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center">
									<img src={themeLoginLogoPath} alt="Login logo" class="max-w-full max-h-full object-contain" />
								</div>
							</div>
							<div class="flex flex-col gap-1.5">
								<button
									type="button"
									on:click={() => openImageBrowser('login')}
									class="px-3 py-1.5 text-sm font-medium btn-theme-light-1 rounded-md whitespace-nowrap"
								>
									Change
								</button>
								<button
									type="button"
									on:click={() => themeLoginLogoPath = ''}
									class="px-3 py-1.5 text-sm font-medium text-gray-500 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors whitespace-nowrap"
								>
									Remove
								</button>
							</div>
						{:else}
							<button
								type="button"
								on:click={() => openImageBrowser('login')}
								class="w-24 h-16 rounded-lg border-2 border-dashed border-gray-300 hover:border-theme-button-1 flex items-center justify-center transition-colors cursor-pointer group"
							>
								<svg class="w-6 h-6 text-gray-400 group-hover:text-theme-button-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
							</button>
							<button
								type="button"
								on:click={() => openImageBrowser('login')}
								class="px-3 py-1.5 text-sm font-medium btn-theme-light-1 rounded-md whitespace-nowrap"
							>
								Select from library
							</button>
						{/if}
					</div>
					<p class="mt-1.5 text-xs text-gray-500">Logo shown on the Hub login screen only. Leave empty to use the navbar logo or default.</p>
				</div>
				<button
					on:click={saveTheme}
					disabled={saving}
					class="px-4 py-2 text-sm font-medium btn-theme-1 rounded-md disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Save branding'}
				</button>
			</div>
		</div>
		{/if}

		<!-- Calendar Colours Settings -->
		{#if activeTab === 'colours'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Calendar Colours</h2>
			<p class="text-sm text-gray-600 mb-4">
				Manage the colours available for events on the calendar. These colours will appear in the colour picker when creating or editing events.
			</p>
			
			<div class="space-y-4">
				<!-- Existing Colours -->
				<div class="space-y-2">
					{#each calendarColours as colour, index}
						<div class="flex items-center gap-3 p-3 border border-gray-200 rounded-md bg-gray-50">
							{#if editingColourIndex === index}
								<!-- Edit Mode -->
								<div class="flex-1 flex items-center gap-3">
									<div class="w-12 h-12 rounded border border-gray-300 flex-shrink-0" style="background-color: {colour.value};"></div>
									<div class="flex-1 flex gap-2">
										<div class="flex-1">
											<label class="block text-xs font-medium text-gray-700 mb-1">Colour</label>
											<div class="flex gap-2">
												<input
													type="color"
													value={colour.value && /^#[0-9A-Fa-f]{6}$/.test(colour.value) ? colour.value : '#9333ea'}
													on:input={(e) => updateColour(index, 'value', e.target.value)}
													class="h-9 w-20 border border-gray-300 rounded-md cursor-pointer"
												/>
												<input
													type="text"
													value={colour.value}
													on:input={(e) => updateColour(index, 'value', e.target.value)}
													placeholder="#9333ea"
													class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
												/>
											</div>
										</div>
										<div class="flex-1">
											<label class="block text-xs font-medium text-gray-700 mb-1">Label</label>
											<input
												type="text"
												value={colour.label}
												on:input={(e) => updateColour(index, 'label', e.target.value)}
												placeholder="Purple"
												class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
											/>
										</div>
									</div>
									<div class="flex gap-2">
										<button
											on:click={cancelEdit}
											class="p-2 text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
											title="Cancel"
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
										<button
											on:click={saveColourEdit}
											class="p-2 text-green-600 bg-white border border-green-300 rounded-md hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500"
											title="Save"
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
											</svg>
										</button>
									</div>
								</div>
							{:else}
								<!-- View Mode -->
								<div class="flex-1 flex items-center gap-3">
									<div class="w-12 h-12 rounded border border-gray-300 flex-shrink-0" style="background-color: {colour.value};"></div>
									<div class="flex-1">
										<div class="font-medium text-gray-900">{colour.label}</div>
										<div class="text-sm text-gray-500 font-mono">{colour.value}</div>
									</div>
									<div class="flex gap-2">
										<button
											on:click={() => startEditColour(index)}
											class="px-3 py-1 text-sm btn-theme-light-1 rounded-md"
										>
											Edit
										</button>
										<button
											on:click={() => removeColour(index)}
											class="px-3 py-1 text-sm text-red-600 bg-white border border-red-300 rounded-md hover:bg-red-50"
										>
											Remove
										</button>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
				
				<!-- Add New Colour -->
				{#if showAddColour}
					<div class="p-4 border-2 border-dashed border-gray-300 rounded-md bg-gray-50">
						<div class="flex items-center gap-3">
							<div class="w-12 h-12 rounded border border-gray-300 flex-shrink-0" style="background-color: {newColour.value};"></div>
							<div class="flex-1 flex gap-2">
								<div class="flex-1">
									<label class="block text-xs font-medium text-gray-700 mb-1">Colour</label>
									<div class="flex gap-2">
										<input
											type="color"
											bind:value={newColour.value}
											class="h-9 w-20 border border-gray-300 rounded-md cursor-pointer"
										/>
										<input
											type="text"
											bind:value={newColour.value}
											placeholder="#9333ea"
											class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
										/>
									</div>
								</div>
								<div class="flex-1">
									<label class="block text-xs font-medium text-gray-700 mb-1">Label</label>
									<input
										type="text"
										bind:value={newColour.label}
										placeholder="Purple"
										class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
									/>
								</div>
							</div>
							<div class="flex gap-2 items-end">
								<button
									on:click={addColour}
									class="px-3 py-1 text-sm btn-theme-2 rounded-md"
								>
									Add
								</button>
								<button
									on:click={cancelEdit}
									class="px-3 py-1 text-sm btn-theme-light-3 rounded-md"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{:else}
					<button
						on:click={() => { showAddColour = true; editingColourIndex = null; }}
						class="w-full px-4 py-2 text-sm btn-theme-light-1 rounded-md border-2 border-dashed"
					>
						+ Add New Colour
					</button>
				{/if}
			</div>
		</div>
		{/if}

		<!-- Billing -->
		{#if (showBilling || showBillingPortal) && activeTab === 'billing'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Billing &amp; account</h2>
			{#if billingSuccess}
				<div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
					Payment successful. Your plan will update shortly. If you don’t see the change, refresh the page.
				</div>
			{/if}
			<p class="text-sm text-gray-600 mb-4">
				You can view and manage your subscription (including cancellation) here in billing/account settings or via the link provided in your plan confirmation. Your plan determines which Hub areas and limits you have.
			</p>
			<div class="space-y-4">
				<div class="p-4 bg-gray-50 border border-gray-200 rounded-md">
					<p class="text-sm font-medium text-gray-700">Current plan</p>
					<p class="text-lg font-semibold text-gray-900 capitalize">{plan}</p>
					{#if subscriptionStatus === 'active' && currentPeriodEnd}
						<p class="text-sm text-gray-500 mt-1">Next billing date: {new Date(currentPeriodEnd).toLocaleDateString()}</p>
					{/if}
					{#if cancelAtPeriodEnd}
						<p class="text-sm text-amber-700 mt-1">Subscription will cancel at the end of the current period.</p>
					{/if}
				</div>
				{#if showBilling}
					<div>
						<p class="text-sm font-medium text-gray-700 mb-2">Upgrade plan</p>
						<div class="flex flex-wrap gap-2">
							{#if plan !== 'professional'}
								<button
									type="button"
									disabled={billingCheckoutLoading}
									on:click={() => goToCheckout('professional')}
									class="px-4 py-2 text-sm font-medium btn-theme-1 rounded-md disabled:opacity-50"
								>
									{billingCheckoutLoading ? 'Opening…' : 'Subscribe to Professional'}
								</button>
							{/if}
							{#if plan !== 'enterprise'}
								<button
									type="button"
									disabled={billingCheckoutLoading}
									on:click={() => goToCheckout('enterprise')}
									class="px-4 py-2 text-sm font-medium btn-theme-2 rounded-md disabled:opacity-50"
								>
									{billingCheckoutLoading ? 'Opening…' : 'Subscribe to Enterprise'}
								</button>
							{/if}
						</div>
					</div>
				{/if}
				{#if showBillingPortal}
					<div>
						<p class="text-sm font-medium text-gray-700 mb-2">Manage subscription &amp; billing</p>
						<p class="text-xs text-gray-500 mb-2">Update payment method, view invoices, or cancel your subscription.</p>
						<button
							type="button"
							disabled={billingPortalLoading || !hasPaddleCustomer}
							on:click={openBillingPortal}
							class="px-4 py-2 text-sm font-medium btn-theme-light-1 rounded-md disabled:opacity-50"
							title={!hasPaddleCustomer ? 'Available after your first subscription' : 'Open billing portal (manage payment, cancel, etc.)'}
						>
							{billingPortalLoading ? 'Opening…' : 'Manage subscription'}
						</button>
						{#if !hasPaddleCustomer}
							<p class="text-xs text-gray-500 mt-1">Manage subscription is available after you subscribe.</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
		{/if}
		
		
		<!-- Email Rate Limiting Settings (hidden when SHOW_EMAIL_AND_DATA_STORE_TABS is false) -->
		{#if SHOW_EMAIL_AND_DATA_STORE_TABS && activeTab === 'email'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Email Rate Limiting</h2>
			<p class="text-sm text-gray-600 mb-4">
				Configure the delay between email sends to comply with your email provider's rate limits.
			</p>
			
			<div class="space-y-4">
				<div>
					<label for="email-rate-limit-delay" class="block text-sm font-medium text-gray-700 mb-2">
						Delay Between Emails (milliseconds)
					</label>
					<input
						id="email-rate-limit-delay"
						type="number"
						min="100"
						max="10000"
						step="50"
						bind:value={emailRateLimitDelay}
						class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
					/>
					<p class="mt-1 text-xs text-gray-500">
						Minimum: 100ms, Maximum: 10000ms (10 seconds)
					</p>
				</div>
				
				<div class="bg-blue-50 border border-blue-200 rounded-md p-4">
					<div class="flex">
						<div class="flex-shrink-0">
							<svg class="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
							</svg>
						</div>
						<div class="ml-3">
							<h3 class="text-sm font-medium text-blue-800">Current Rate</h3>
							<div class="mt-2 text-sm text-blue-700">
								<p>
									<strong>{calculateRequestsPerSecond()}</strong> requests per second
								</p>
								<p class="mt-1">
									Delay: <strong>{emailRateLimitDelay}ms</strong> between each email send
								</p>
							</div>
						</div>
					</div>
				</div>
				
				<div class="flex justify-end">
					<button
						on:click={saveSettings}
						disabled={saving}
						class="px-4 py-2 btn-theme-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? 'Saving...' : 'Save Settings'}
					</button>
				</div>
			</div>
		</div>
		{/if}

		<!-- Data store (hidden when SHOW_EMAIL_AND_DATA_STORE_TABS is false) -->
		{#if SHOW_EMAIL_AND_DATA_STORE_TABS && activeTab === 'data-store'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Data store</h2>
			<p class="text-sm text-gray-600 mb-4">
				CRM data can be stored in JSON files or in a PostgreSQL database. When using the database, all data (including admins, sessions, and organisations) is in the database; NDJSON files are deprecated for the Hub.
			</p>
			<p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
				<strong>Using database:</strong> Click &quot;Copy file data to database&quot; then the app will switch to the database automatically. Or click &quot;Switch to database&quot; to use the DB without copying. If you set <code class="bg-white px-1 rounded">DATA_STORE=database</code> in <code class="bg-white px-1 rounded">.env</code>, restart the app for it to take effect.
			</p>
			<p class="text-sm text-gray-600 mb-4">
				<strong>Copy data to files:</strong> When using the database, this backs up existing NDJSON files to <code class="bg-gray-100 px-1 rounded">data/backup/&lt;timestamp&gt;</code>, then overwrites NDJSON files with the current database contents.
			</p>
			<div class="space-y-4">
				<div class="p-4 bg-gray-50 border border-gray-200 rounded-md">
					<p class="text-sm font-medium text-gray-700">Current mode:</p>
					<p class="text-lg font-semibold {storeMode === 'database' ? 'text-green-600' : 'text-gray-800'}">
						{storeMode === 'database' ? 'Database (PostgreSQL)' : 'File (NDJSON)'}
					</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<button
						on:click={() => migrateToDatabase()}
						disabled={migrating}
						class="px-4 py-2 btn-theme-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{migrating ? 'Copying...' : 'Copy file data to database'}
					</button>
					<button
						on:click={() => copyDatabaseToFiles()}
						disabled={copyingToFiles || storeMode === 'file'}
						class="px-4 py-2 btn-theme-5 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
						title="Backs up existing NDJSON files, then copies database data into NDJSON files. Only available when using database."
					>
						{copyingToFiles ? 'Copying...' : 'Copy data to files'}
					</button>
					<button
						on:click={() => setStoreMode('database')}
						disabled={switching || storeMode === 'database'}
						class="px-4 py-2 btn-theme-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{switching ? 'Switching...' : 'Switch to database'}
					</button>
					<button
						on:click={() => setStoreMode('file')}
						disabled={switching || storeMode === 'file'}
						class="px-4 py-2 btn-theme-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{switching ? 'Switching...' : 'Switch to file store'}
					</button>
				</div>
			</div>
		</div>
		{/if}

		<!-- Terminology -->
	{#if activeTab === 'terminology'}
	<div>
		<h2 class="text-xl font-semibold text-gray-900 mb-1">Terminology</h2>
		<p class="text-sm text-gray-600 mb-4">
			Rename the key labels used throughout the Hub to match your organisation's language.
			MyHub (volunteer-facing pages) always uses plain English and is not affected.
		</p>

		{#if data?.churchBoltOn}
		<!-- Church Bolt-On: terminology starter set -->
		<div class="mb-6 p-4 rounded-lg bg-blue-50 border border-blue-200">
			<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div>
					<h3 class="text-sm font-semibold text-blue-900">Church / Parish starter set</h3>
					<p class="text-xs text-blue-700 mt-0.5">Pre-fills suggested defaults for churches and parishes. Every field remains editable after applying.</p>
				</div>
				<button
					type="button"
					on:click={applyChurchDefaults}
					class="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-blue-700 border border-blue-300 rounded-md hover:bg-blue-100 transition-colors"
				>
					Apply church defaults
				</button>
			</div>
		</div>
		{/if}

		<!-- Fields -->
		<div class="space-y-3 max-w-2xl mb-6">
			{#each TERMINOLOGY_FIELDS as field}
			<div class="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
				<div class="flex-1 min-w-0">
					<label for="term-{field.key}" class="block text-xs font-semibold text-gray-700 mb-0.5">{field.label}</label>
					<p class="text-xs text-gray-500 mb-1.5">{field.description}</p>
					<input
						id="term-{field.key}"
						type="text"
						bind:value={terminologyValues[field.key]}
						placeholder={TERMINOLOGY_DEFAULTS[field.key]}
						maxlength="50"
						class="block w-full rounded-md border border-gray-300 shadow-sm focus:ring-theme-button-1 focus:border-theme-button-1 py-1.5 px-3 text-sm"
					/>
				</div>
				<button
					type="button"
					title="Reset to default"
					on:click={() => resetTerminologyField(field.key)}
					class="flex-shrink-0 mt-6 px-2 py-1.5 text-xs text-gray-500 border border-gray-300 rounded-md hover:text-gray-700 hover:border-gray-400 transition-colors"
				>
					Reset
				</button>
			</div>
			{/each}
		</div>

		<div class="flex items-center gap-3">
			<button
				type="button"
				on:click={saveTerminology}
				disabled={savingTerminology}
				class="px-4 py-2 text-sm btn-theme-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{savingTerminology ? 'Saving...' : 'Save terminology'}
			</button>
			<button
				type="button"
				on:click={() => { terminologyValues = { ...TERMINOLOGY_DEFAULTS }; }}
				class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
			>
				Reset all to defaults
			</button>
		</div>
	</div>
	{/if}

		<!-- Privacy (GDPR & privacy policy contact) -->
		{#if activeTab === 'privacy'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Privacy</h2>
			<p class="text-sm text-gray-600 mb-4">
				Privacy policy contact details and GDPR-related tools (subject access requests and right to erasure).
			</p>

			<!-- Privacy policy contact -->
			<div class="p-4 rounded-lg bg-gray-50 border border-gray-200 mb-4">
				<h3 class="text-sm font-semibold text-gray-700 mb-2">Privacy policy contact</h3>
				<p class="text-sm text-gray-600 mb-3">
					These details appear in the <strong>Who We Are</strong> section of your <a href="/hub/privacy" class="text-theme-button-1 hover:underline" target="_blank" rel="noopener">Privacy policy</a>. Use them for data protection or privacy enquiries. If left blank, the Super admin's name and email are shown.
				</p>
				<div class="space-y-3">
					<div>
						<label for="privacy-contact-name" class="block text-xs font-medium text-gray-700 mb-1">Contact name</label>
						<input
							id="privacy-contact-name"
							type="text"
							bind:value={privacyContactName}
							placeholder="e.g. Data Protection Officer"
							class="w-full max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
						/>
					</div>
					<div>
						<label for="privacy-contact-email" class="block text-xs font-medium text-gray-700 mb-1">Email</label>
						<input
							id="privacy-contact-email"
							type="email"
							bind:value={privacyContactEmail}
							placeholder="privacy@yourorg.org"
							class="w-full max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
						/>
					</div>
					<div>
						<label for="privacy-contact-phone" class="block text-xs font-medium text-gray-700 mb-1">Phone (optional)</label>
						<input
							id="privacy-contact-phone"
							type="text"
							bind:value={privacyContactPhone}
							placeholder=""
							class="w-full max-w-md px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
						/>
					</div>
					<button
						type="button"
						on:click={savePrivacyContact}
						disabled={savingPrivacyContact}
						class="px-3 py-1.5 text-sm btn-theme-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{savingPrivacyContact ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>

			<!-- Contact data (GDPR): download or delete all data for a contact -->
			<div class="p-4 rounded-lg bg-gray-50 border border-gray-200 mb-4">
				<h3 class="text-sm font-semibold text-gray-700 mb-2">Contact data (GDPR)</h3>
				<p class="text-sm text-gray-600 mb-3">
					Download all information stored for a contact (e.g. for a subject access request) or permanently delete that contact and all related data (right to erasure). Use the contact's email or their contact ID from <a href="/hub/contacts" class="text-theme-button-1 hover:underline">Volunteers</a>.
				</p>
				<div class="space-y-3">
					<div class="flex flex-wrap items-end gap-2">
						<div class="min-w-0 flex-1 max-w-md">
							<label for="contact-data-lookup" class="block text-xs font-medium text-gray-700 mb-1">Email or contact ID</label>
							<input
								id="contact-data-lookup"
								type="text"
								bind:value={contactLookupQuery}
								placeholder="e.g. john@example.org or contact ID"
								class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
								on:keydown={(e) => e.key === 'Enter' && lookupContact()}
							/>
						</div>
						<button
							type="button"
							on:click={lookupContact}
							disabled={contactLookupLoading}
							class="px-3 py-1.5 text-sm btn-theme-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{contactLookupLoading ? 'Looking up...' : 'Look up'}
						</button>
					</div>
					{#if contactLookupError}
						<p class="text-sm text-red-600">{contactLookupError}</p>
					{/if}
					{#if lookedUpContact}
						<div class="p-3 bg-white border border-gray-200 rounded-md">
							<p class="text-sm font-medium text-gray-900 mb-2">
								Contact: {contactDisplayName()}
								{#if lookedUpContact.email}
									<span class="text-gray-500 font-normal">({lookedUpContact.email})</span>
								{/if}
							</p>
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									on:click={downloadContactData}
									disabled={contactDownloading}
									class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{contactDownloading ? 'Downloading...' : 'Download all data'}
								</button>
								{#if !contactDeleteConfirm}
									<button
										type="button"
										on:click={() => contactDeleteConfirm = true}
										class="px-3 py-1.5 text-sm font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-50"
									>
										Delete contact and all data
									</button>
								{:else}
									<span class="text-sm text-gray-600">Permanently delete this contact and all related data (rotas, lists, events, etc.)?</span>
									<button
										type="button"
										on:click={deleteContactData}
										disabled={contactDeleting}
										class="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{contactDeleting ? 'Deleting...' : 'Yes, delete'}
									</button>
									<button
										type="button"
										on:click={() => contactDeleteConfirm = false}
										disabled={contactDeleting}
										class="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
									>
										Cancel
									</button>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
		{/if}

		<!-- Advanced -->
		{#if activeTab === 'advanced'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Advanced</h2>

			<div class="p-4 rounded-lg bg-gray-50 border border-gray-200">
				<h3 class="text-sm font-semibold text-gray-700 mb-2">Current organisation (Hub context)</h3>
				{#if currentOrganisationId}
					<dl class="grid grid-cols-1 gap-1 text-sm">
						<div>
							<dt class="text-gray-500">Organisation ID</dt>
							<dd class="font-mono text-gray-900 break-all">{currentOrganisationId}</dd>
						</div>
						{#if currentOrganisation}
							<div>
								<dt class="text-gray-500">Name</dt>
								<dd class="text-gray-900">{currentOrganisation.name || '—'}</dd>
							</div>
							{#if currentOrganisation.contactName}
								<div>
									<dt class="text-gray-500">Contact</dt>
									<dd class="text-gray-900">{currentOrganisation.contactName}</dd>
								</div>
							{/if}
						{/if}
						{#if !currentOrganisation}
							<div>
								<dt class="text-gray-500">Name</dt>
								<dd class="text-amber-700">Organisation record not found (ID may be from another source)</dd>
							</div>
						{/if}
					</dl>
				{:else}
					<p class="text-gray-600 text-sm">No organisation set.</p>
				{/if}
			</div>
		</div>
		{/if}

		<!-- Image browser modal for Branding logo -->
		{#if showImageBrowser}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
				role="dialog"
				aria-modal="true"
				aria-label="Select logo image"
			>
				<button
					type="button"
					class="absolute inset-0 cursor-default"
					aria-label="Close"
					on:click={closeImageBrowser}
				></button>
				<div
					class="relative z-10 bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
					on:click|stopPropagation
				>
					<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">
						<h3 class="text-lg font-semibold text-gray-900">{logoPickerMode === 'login' ? 'Select logo for login screen' : 'Select logo for navbar'}</h3>
						<button
							type="button"
							on:click={closeImageBrowser}
							class="p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100"
							aria-label="Close"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					</div>
					<!-- Upload new image -->
					<div class="px-4 py-3 border-b border-gray-200 bg-gray-50">
						<label for="logo-picker-upload" class="block text-sm font-medium text-gray-700 mb-1">Upload image</label>
						<div class="flex flex-wrap items-center gap-2">
							<input
								id="logo-picker-upload"
								type="file"
								accept="image/*"
								on:change={uploadImageForLogo}
								disabled={browseImagesUploading}
								class="text-sm text-gray-600 file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-theme-button-1 file:text-white file:cursor-pointer hover:file:opacity-90 disabled:opacity-50"
							/>
							{#if browseImagesUploading}
								<span class="text-sm text-gray-500">Uploading…</span>
							{/if}
						</div>
						{#if browseImagesUploadError}
							<p class="mt-1 text-sm text-red-600">{browseImagesUploadError}</p>
						{/if}
						<p class="mt-1 text-xs text-gray-500">JPG, PNG, GIF, WebP. Max 10MB. Uploaded image will be set as logo.</p>
					</div>
					<div class="overflow-auto p-4 flex-1">
						{#if browseImagesLoading}
							<p class="text-sm text-gray-500">Loading images from library…</p>
						{:else if browseImages.length === 0}
							<p class="text-sm text-gray-500">No images in the library yet. Upload an image above, or go to <a href="/hub/images" class="text-theme-button-1 hover:underline">Manage Images</a> to upload there.</p>
						{:else}
							<div class="grid grid-cols-3 sm:grid-cols-4 gap-3">
								<button
									type="button"
									on:click={() => selectImageForLogo('')}
									class="rounded-lg border-2 border-dashed border-gray-300 overflow-hidden hover:border-theme-button-1 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-theme-button-1 transition-colors flex flex-col items-center justify-center h-24 min-h-[6rem]"
								>
									<span class="text-xs text-gray-500 font-medium">Use default logo</span>
								</button>
								{#each browseImages as image}
									<button
										type="button"
										on:click={() => selectImageForLogo(image.path)}
										class="rounded-lg border-2 border-gray-200 overflow-hidden hover:border-theme-button-1 focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-transparent transition-colors"
									>
										<img
											src={image.path}
											alt={image.originalName || 'Image'}
											class="w-full h-24 object-cover"
											loading="lazy"
										/>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
