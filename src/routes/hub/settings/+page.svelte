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
	let settings = data?.settings || { emailRateLimitDelay: 500, calendarColours: [], meetingPlannerRotas: [], theme: {} };
	let availableRoles = data?.availableRoles || [];
	
	const defaultButtonColors = ['#4A97D2', '#4BB170', '#3B79A8', '#3C8E5A', '#E6A324'];
	const defaultPanelHeadColors = ['#4A97D2', '#3B79A8', '#2C5B7E'];
	function toHex(val, fallback) {
		return (typeof val === 'string' && val.trim() && /^#[0-9A-Fa-f]{6}$/.test(val.trim())) ? val.trim() : fallback;
	}
	function normalizeCalendarColour(c) {
		return { value: toHex(c?.value, '#9333ea'), label: (c?.label != null && typeof c.label === 'string') ? c.label : '' };
	}

	let emailRateLimitDelay = settings?.emailRateLimitDelay || 500;
	let rotaReminderDaysAhead = settings?.rotaReminderDaysAhead ?? 3;
	let calendarColours = (JSON.parse(JSON.stringify(settings?.calendarColours || []))).map(normalizeCalendarColour);
	// meetingPlannerRotas is already filtered server-side to only roles that exist in this org
	let meetingPlannerRotas = JSON.parse(JSON.stringify(settings?.meetingPlannerRotas || []));

	let themeLogoPath = settings?.theme?.logoPath ?? '';
	let themeLoginLogoPath = settings?.theme?.loginLogoPath ?? '';
	let themePrimaryColor = toHex(settings?.theme?.primaryColor, '#4BB170');
	let themeBrandColor = toHex(settings?.theme?.brandColor, '#4A97D2');
	let themeNavbarBackgroundColor = toHex(settings?.theme?.navbarBackgroundColor, '#4A97D2');
	let themeButtonColors = JSON.parse(JSON.stringify(settings?.theme?.buttonColors ?? defaultButtonColors));
	let themePanelHeadColors = JSON.parse(JSON.stringify(settings?.theme?.panelHeadColors ?? defaultPanelHeadColors));
	let themePanelBackgroundColor = toHex(settings?.theme?.panelBackgroundColor, '#E8F2F9');
	let themeExternalPagesLayout = settings?.theme?.externalPagesLayout ?? 'integrated';
	let themePublicPagesBranding = settings?.theme?.publicPagesBranding ?? 'hub';
	// Ensure arrays have correct length and no empty/invalid hex (type="color" requires #rrggbb)
	if (themeButtonColors.length < 5) themeButtonColors = [...themeButtonColors, ...defaultButtonColors.slice(themeButtonColors.length)];
	if (themePanelHeadColors.length < 3) themePanelHeadColors = [...themePanelHeadColors, ...defaultPanelHeadColors.slice(themePanelHeadColors.length)];
	themeButtonColors = themeButtonColors.slice(0, 5).map((c, i) => toHex(c, defaultButtonColors[i]));
	themePanelHeadColors = themePanelHeadColors.slice(0, 3).map((c, i) => toHex(c, defaultPanelHeadColors[i]));
	let saving = false;
	let editingColourIndex = null;
	let originalColour = null; // Store original colour when editing starts
	let newColour = { value: '#9333ea', label: '' };
	let showAddColour = false;
	// Set to true to show Email Rate Limiting and Data store tabs (code kept for later use)
	const SHOW_EMAIL_AND_DATA_STORE_TABS = false;
	const validTabs = ['theme', 'colours', 'meeting-planner', 'billing', 'email', 'data-store', 'advanced'];
	let activeTab = 'theme'; // 'theme', 'colours', 'meeting-planner', 'billing', 'email', 'data-store', or 'advanced'
	// Deep link: open specific tab from URL (e.g. /hub/settings?tab=billing for plan confirmation link)
	onMount(() => {
		const params = typeof window !== 'undefined' && window.location?.search ? new URLSearchParams(window.location.search) : null;
		const tab = params?.get('tab');
		if (tab && validTabs.includes(tab)) activeTab = tab;
		if (!SHOW_EMAIL_AND_DATA_STORE_TABS && (activeTab === 'email' || activeTab === 'data-store')) activeTab = 'theme';
	});
	$: if (!SHOW_EMAIL_AND_DATA_STORE_TABS && (activeTab === 'email' || activeTab === 'data-store')) activeTab = 'theme';
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
	
	// Meeting Planner Rota state
	let editingRotaIndex = null;
	let originalRota = null;
	let showAddRota = false;
	let newRota = { role: '' };

	// Sunday planner–specific settings
	$: events = data?.events || [];
	let sundayPlannerEventId = data?.settings?.sundayPlannerEventId ?? null;
	let sundayPlannersLabel = data?.settings?.sundayPlannersLabel ?? 'Sunday Planners';
	let savingSundayPlanner = false;

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
	
	// Track last synced settings so we only overwrite theme fields when server data actually changes (e.g. after save)
	let lastSyncedSettings = null;
	$: if (data?.settings && data.settings !== lastSyncedSettings) {
		lastSyncedSettings = data.settings;
		settings = data.settings;
		emailRateLimitDelay = settings.emailRateLimitDelay;
		rotaReminderDaysAhead = settings.rotaReminderDaysAhead ?? 3;
		calendarColours = (JSON.parse(JSON.stringify(settings.calendarColours || []))).map(normalizeCalendarColour);
		meetingPlannerRotas = JSON.parse(JSON.stringify(settings.meetingPlannerRotas || []));
		if (settings.theme) {
			themeLogoPath = settings.theme.logoPath ?? '';
			themeLoginLogoPath = settings.theme.loginLogoPath ?? '';
			themePrimaryColor = toHex(settings.theme.primaryColor, '#4BB170');
			themeBrandColor = toHex(settings.theme.brandColor, '#4A97D2');
			themeNavbarBackgroundColor = toHex(settings.theme.navbarBackgroundColor, '#4A97D2');
			themeButtonColors = JSON.parse(JSON.stringify(settings.theme.buttonColors ?? defaultButtonColors));
			themePanelHeadColors = JSON.parse(JSON.stringify(settings.theme.panelHeadColors ?? defaultPanelHeadColors));
			if (themeButtonColors.length < 5) themeButtonColors = [...themeButtonColors, ...defaultButtonColors.slice(themeButtonColors.length)];
			if (themePanelHeadColors.length < 3) themePanelHeadColors = [...themePanelHeadColors, ...defaultPanelHeadColors.slice(themePanelHeadColors.length)];
			themeButtonColors = themeButtonColors.slice(0, 5).map((c, i) => toHex(c, defaultButtonColors[i]));
			themePanelHeadColors = themePanelHeadColors.slice(0, 3).map((c, i) => toHex(c, defaultPanelHeadColors[i]));
			themePanelBackgroundColor = toHex(settings.theme.panelBackgroundColor, '#E8F2F9');
			themeExternalPagesLayout = settings.theme.externalPagesLayout ?? 'integrated';
			themePublicPagesBranding = settings.theme.publicPagesBranding ?? 'hub';
		}
		sundayPlannerEventId = settings.sundayPlannerEventId ?? null;
		sundayPlannersLabel = (typeof settings.sundayPlannersLabel === 'string' && settings.sundayPlannersLabel.trim() !== '') ? settings.sundayPlannersLabel.trim() : 'Sunday Planners';
	}
	
	$: availableRoles = data?.availableRoles || [];
	
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

	function validateHex(val, name) {
		return typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val);
	}
	async function saveTheme() {
		saving = true;
		try {
			if (!validateHex(themePrimaryColor, 'Primary')) {
				notifications.error('Primary colour must be a hex colour (e.g. #4BB170)');
				saving = false;
				return;
			}
			if (!validateHex(themeBrandColor, 'Brand')) {
				notifications.error('Brand colour must be a hex colour (e.g. #4A97D2)');
				saving = false;
				return;
			}
			if (!validateHex(themeNavbarBackgroundColor, 'Navbar')) {
				notifications.error('Navbar background must be a hex colour');
				saving = false;
				return;
			}
			const buttonColours = themeButtonColors.slice(0, 5).map((c) => (validateHex(c, 'Button') ? c : defaultButtonColors[0]));
			const panelColours = themePanelHeadColors.slice(0, 3).map((c) => (validateHex(c, 'Panel') ? c : defaultPanelHeadColors[0]));
			if (!validateHex(themePanelBackgroundColor, 'Panel Background')) {
				notifications.error('Panel background must be a hex colour');
				saving = false;
				return;
			}
			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						theme: {
							logoPath: themeLogoPath.trim(),
							loginLogoPath: themeLoginLogoPath.trim(),
							primaryColor: themePrimaryColor,
							brandColor: themeBrandColor,
							navbarBackgroundColor: themeNavbarBackgroundColor,
							buttonColors: buttonColours,
							panelHeadColors: panelColours,
							panelBackgroundColor: themePanelBackgroundColor,
							externalPagesLayout: themeExternalPagesLayout,
							publicPagesBranding: themePublicPagesBranding
						}
					})
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'Failed to save theme' }));
				throw new Error(errorData.message || 'Failed to save theme');
			}
			notifications.success('Theme saved successfully!');
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Failed to save theme');
			console.error('Error saving theme:', err);
		} finally {
			saving = false;
		}
	}

	async function saveMeetingPlannerRotas() {
		saving = true;
		
		try {
			// Ensure all rotas have a capacity of 1 for validation
			const rotasToSave = meetingPlannerRotas.map(r => ({
				...r,
				capacity: r.capacity || 1
			}));

			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					meetingPlannerRotas: rotasToSave
				})
			});
			
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'Failed to save meeting planner rotas' }));
				throw new Error(errorData.message || 'Failed to save meeting planner rotas');
			}
			
			const result = await response.json();
			notifications.success('Meeting planner rotas saved successfully!');
			
			await invalidateAll();
			
			// Reset editing state
			editingRotaIndex = null;
			showAddRota = false;
			newRota = { role: '' };
		} catch (err) {
			notifications.error(err.message || 'Failed to save meeting planner rotas');
			console.error('Error saving meeting planner rotas:', err);
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
		// Restore original colour if we were editing
		if (editingColourIndex !== null && originalColour) {
			calendarColours[editingColourIndex] = { ...originalColour };
		}
		// Restore original rota if we were editing
		if (editingRotaIndex !== null && originalRota) {
			meetingPlannerRotas[editingRotaIndex] = { ...originalRota };
		}
		editingColourIndex = null;
		originalColour = null;
		showAddColour = false;
		newColour = { value: '#9333ea', label: '' };
		
		editingRotaIndex = null;
		originalRota = null;
		showAddRota = false;
		newRota = { role: '' };
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

	function startEditRota(index) {
		editingRotaIndex = index;
		originalRota = { ...meetingPlannerRotas[index] };
		showAddRota = false;
	}

	function updateRota(index, field, value) {
		meetingPlannerRotas[index] = { ...meetingPlannerRotas[index], [field]: value };
	}

	async function saveRotaEdit() {
		const rota = meetingPlannerRotas[editingRotaIndex];
		if (!rota.role.trim()) {
			notifications.error('Please provide a role name');
			return;
		}
		
		editingRotaIndex = null;
		originalRota = null;
		
		await saveMeetingPlannerRotas();
	}

	async function saveRotaReminderSettings() {
		saving = true;
		try {
			const n = Math.min(90, Math.max(0, parseInt(String(rotaReminderDaysAhead), 10)));
			if (isNaN(n)) {
				notifications.error('Please enter a number between 0 and 90');
				return;
			}
			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rotaReminderDaysAhead: n })
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: 'Failed to save' }));
				throw new Error(errorData.message || 'Failed to save');
			}
			rotaReminderDaysAhead = n;
			notifications.success('Rota reminder setting saved.');
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Failed to save rota reminder setting');
		} finally {
			saving = false;
		}
	}

	async function addRota() {
		if (!newRota.role.trim()) {
			notifications.error('Please select a rota');
			return;
		}
		
		meetingPlannerRotas = [...meetingPlannerRotas, { role: newRota.role.trim() }];
		newRota = { role: '' };
		showAddRota = false;
		
		await saveMeetingPlannerRotas();
	}

	async function removeRota(index) {
		const confirmed = await dialog.confirm('Are you sure you want to remove this rota? New meeting planners will no longer include this role.');
		if (confirmed) {
			meetingPlannerRotas = meetingPlannerRotas.filter((_, i) => i !== index);
			await saveMeetingPlannerRotas();
		}
	}

	async function saveSundayPlannerSettings() {
		savingSundayPlanner = true;
		try {
			const response = await fetch('/hub/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sundayPlannerEventId: sundayPlannerEventId || null,
					sundayPlannersLabel: (typeof sundayPlannersLabel === 'string' && sundayPlannersLabel.trim() !== '') ? sundayPlannersLabel.trim() : 'Sunday Planners'
				})
			});
			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				throw new Error(err.message || 'Failed to save');
			}
			notifications.success('Sunday planner settings saved.');
			await invalidateAll();
		} catch (err) {
			notifications.error(err.message || 'Failed to save Sunday planner settings');
		} finally {
			savingSundayPlanner = false;
		}
	}

	// Drag and Drop for Rotas
	let draggedRotaIndex = null;
	let dragOverRotaIndex = null;

	function handleRotaDragStart(index) {
		draggedRotaIndex = index;
	}

	function handleRotaDragOver(e, index) {
		e.preventDefault();
		dragOverRotaIndex = index;
	}

	async function handleRotaDrop(e, index) {
		e.preventDefault();
		if (draggedRotaIndex === null || draggedRotaIndex === index) return;

		const updatedRotas = [...meetingPlannerRotas];
		const [draggedItem] = updatedRotas.splice(draggedRotaIndex, 1);
		updatedRotas.splice(index, 0, draggedItem);

		meetingPlannerRotas = updatedRotas;
		draggedRotaIndex = null;
		dragOverRotaIndex = null;

		await saveMeetingPlannerRotas();
	}

	function handleRotaDragEnd() {
		draggedRotaIndex = null;
		dragOverRotaIndex = null;
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

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
		<p class="text-gray-600 mb-6">Manage system settings (Superadmin only)</p>

		<!-- Tabs -->
		<div class="border-b border-gray-200 mb-6">
			<nav class="-mb-px flex space-x-8" aria-label="Tabs">
				<button
					on:click={() => activeTab = 'theme'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'theme' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Theme
				</button>
				<button
					on:click={() => activeTab = 'colours'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'colours' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Calendar Colours
				</button>
				<button
					on:click={() => activeTab = 'meeting-planner'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'meeting-planner' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Meeting Planner
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
					on:click={() => activeTab = 'advanced'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'advanced' ? 'border-theme-button-1 text-theme-button-1' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Advanced
				</button>
			</nav>
		</div>
		
		<!-- Theme Settings -->
		{#if activeTab === 'theme'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Theme</h2>
			<p class="text-sm text-gray-600 mb-4">
				Set colours and logo used on the public pages (e.g. signup). Leave logo blank to use the default.
			</p>
			<div class="space-y-4 max-w-xl">
				<div>
					<label for="theme-logo-path" class="block text-sm font-medium text-gray-700 mb-1">Navbar logo (path or URL)</label>
					<div class="flex gap-2">
						<input
							id="theme-logo-path"
							type="text"
							bind:value={themeLogoPath}
							placeholder="/assets/egcc-color.png"
							class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
						/>
						<button
							type="button"
							on:click={() => openImageBrowser('navbar')}
							class="px-3 py-2 text-sm font-medium btn-theme-light-1 rounded-md whitespace-nowrap"
						>
							Select from library
						</button>
					</div>
					<p class="mt-1 text-xs text-gray-500">Logo shown in the Hub navbar and on external pages. Leave empty for default.</p>
				</div>
				<div>
					<label for="theme-login-logo-path" class="block text-sm font-medium text-gray-700 mb-1">Login screen logo (path or URL)</label>
					<div class="flex gap-2">
						<input
							id="theme-login-logo-path"
							type="text"
							bind:value={themeLoginLogoPath}
							placeholder="/assets/egcc-color.png"
							class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
						/>
						<button
							type="button"
							on:click={() => openImageBrowser('login')}
							class="px-3 py-2 text-sm font-medium btn-theme-light-1 rounded-md whitespace-nowrap"
						>
							Select from library
						</button>
					</div>
					<p class="mt-1 text-xs text-gray-500">Logo shown on the Hub login screen only. Leave empty to use the navbar logo or default.</p>
				</div>
				<div>
					<label for="theme-navbar-bg" class="block text-sm font-medium text-gray-700 mb-1">Navbar background</label>
					<div class="flex items-center gap-2">
						<input
							id="theme-navbar-bg"
							type="color"
							bind:value={themeNavbarBackgroundColor}
							class="h-10 w-14 border border-gray-300 rounded-md cursor-pointer"
						/>
						<input
							aria-label="Navbar background hex"
							type="text"
							bind:value={themeNavbarBackgroundColor}
							class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1 font-mono"
							placeholder="#4A97D2"
						/>
					</div>
					<p class="mt-1 text-xs text-gray-500">Website navbar and Hub header when menu open.</p>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">Button colours (up to 5)</label>
					<p class="text-xs text-gray-500 mb-2">Used for primary and secondary buttons across the site. Button 1 = main CTA.</p>
					<div class="space-y-2">
						{#each themeButtonColors as _, i}
							<div class="flex items-center gap-2">
								<input
									type="color"
									bind:value={themeButtonColors[i]}
									class="h-9 w-12 border border-gray-300 rounded-md cursor-pointer"
								/>
								<input
									type="text"
									bind:value={themeButtonColors[i]}
									class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 font-mono"
									placeholder="#hex"
								/>
								<span class="text-xs text-gray-500 w-6">{(i + 1)}</span>
							</div>
						{/each}
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">Panel head colours (up to 3)</label>
					<p class="text-xs text-gray-500 mb-2">Used for section/panel headers and gradients (e.g. contact cards, form headers).</p>
					<div class="space-y-2">
						{#each themePanelHeadColors as _, i}
							<div class="flex items-center gap-2">
								<input
									type="color"
									bind:value={themePanelHeadColors[i]}
									class="h-9 w-12 border border-gray-300 rounded-md cursor-pointer"
								/>
								<input
									type="text"
									bind:value={themePanelHeadColors[i]}
									class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 font-mono"
									placeholder="#hex"
								/>
								<span class="text-xs text-gray-500 w-6">{(i + 1)}</span>
							</div>
						{/each}
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">Panel background colour</label>
					<p class="text-xs text-gray-500 mb-2">Background colour for all panels (lighter shade recommended).</p>
					<div class="flex items-center gap-2">
						<input
							type="color"
							bind:value={themePanelBackgroundColor}
							class="h-9 w-12 border border-gray-300 rounded-md cursor-pointer"
						/>
						<input
							type="text"
							bind:value={themePanelBackgroundColor}
							class="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 font-mono"
							placeholder="#hex"
						/>
					</div>
				</div>
				<button
					on:click={saveTheme}
					disabled={saving}
					class="px-4 py-2 text-sm font-medium btn-theme-1 rounded-md disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Save theme'}
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

		<!-- Meeting Planner Settings -->
		{#if activeTab === 'meeting-planner'}
		<!-- Sunday planner–specific settings -->
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Sunday planner</h2>
			<p class="text-sm text-gray-600 mb-4">
				Choose which event to use as the &quot;Sunday planner&quot; event and the label shown in the Hub (e.g. &quot;Sunday Planners&quot;). Use singular form for one item (e.g. &quot;Sunday Planner&quot;).
			</p>
			<div class="space-y-4 max-w-xl mb-4">
				<div>
					<label for="sunday-planner-event" class="block text-sm font-medium text-gray-700 mb-1">Sunday planner event</label>
					<select
						id="sunday-planner-event"
						bind:value={sundayPlannerEventId}
						class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:ring-theme-button-1 focus:border-theme-button-1 py-2 px-3 text-sm"
					>
						<option value="">None</option>
						{#each events as ev}
							<option value={ev.id}>{ev.title || 'Untitled'}</option>
						{/each}
					</select>
					<p class="mt-1 text-xs text-gray-500">Event whose occurrences are used for the Sunday planner section. Leave as &quot;None&quot; to disable.</p>
				</div>
				<div>
					<label for="sunday-planners-label" class="block text-sm font-medium text-gray-700 mb-1">Section name</label>
					<input
						id="sunday-planners-label"
						type="text"
						bind:value={sundayPlannersLabel}
						placeholder="Sunday Planners"
						class="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:ring-theme-button-1 focus:border-theme-button-1 py-2 px-3 text-sm"
					/>
					<p class="mt-1 text-xs text-gray-500">Label used in the Hub nav and headings (e.g. &quot;Sunday Planners&quot;). Use singular &quot;Sunday Planner&quot; for one item where needed.</p>
				</div>
				<button
					type="button"
					on:click={saveSundayPlannerSettings}
					disabled={savingSundayPlanner}
					class="px-4 py-2 text-sm font-medium bg-hub-green-600 hover:bg-hub-green-700 text-white rounded-md disabled:opacity-50"
				>
					{savingSundayPlanner ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Meeting Planner Rotas</h2>
			<p class="text-sm text-gray-600 mb-4">
				Manage the default rotas that are attached to new meeting planners. Only rotas that exist in this organisation are shown; create rotas from Meeting Planners or Rotas first if the list is empty.
			</p>
			
			<div class="space-y-4">
				<!-- Existing Rotas -->
				<div class="space-y-2">
					{#each meetingPlannerRotas as rota, index}
						<div 
							class="flex items-center gap-3 p-3 border border-gray-200 rounded-md transition-all duration-200 {draggedRotaIndex === index ? 'opacity-40 grayscale' : 'bg-gray-50'} {dragOverRotaIndex === index ? 'border-theme-button-1 border-t-4' : ''}"
							draggable={editingRotaIndex === null}
							on:dragstart={() => handleRotaDragStart(index)}
							on:dragover={(e) => handleRotaDragOver(e, index)}
							on:drop={(e) => handleRotaDrop(e, index)}
							on:dragend={handleRotaDragEnd}
						>
							{#if editingRotaIndex === index}
								<!-- Edit Mode -->
								<div class="flex-1 flex items-center gap-3">
									<div class="flex-1">
										<label class="block text-xs font-medium text-gray-700 mb-1">Rota Name</label>
										<select
											value={rota.role}
											on:change={(e) => updateRota(index, 'role', e.target.value)}
											class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
										>
											<option value="">-- Select a rota --</option>
											{#each availableRoles as role}
												<option value={role}>{role}</option>
											{/each}
										</select>
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
											on:click={saveRotaEdit}
											class="p-2 btn-theme-light-2 rounded-md"
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
								<div class="flex items-center gap-2 cursor-move text-gray-400 hover:text-gray-600" title="Drag to reorder">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
									</svg>
								</div>
								<div class="flex-1 flex items-center gap-3">
									<div class="flex-1">
										<div class="font-medium text-gray-900">{rota.role}</div>
									</div>
									<div class="flex gap-2">
										<button
											on:click={() => startEditRota(index)}
											class="px-3 py-1 text-sm btn-theme-light-1 rounded-md"
										>
											Edit
										</button>
										<button
											on:click={() => removeRota(index)}
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
				
				<!-- Add New Rota -->
				{#if showAddRota}
					<div class="p-4 border-2 border-dashed border-gray-300 rounded-md bg-gray-50">
						<div class="flex items-center gap-3">
								<div class="flex-1">
									<label class="block text-xs font-medium text-gray-700 mb-1">Rota Name</label>
									<select
										bind:value={newRota.role}
										class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
									>
									<option value="">-- Select a rota --</option>
									{#each availableRoles as role}
										<option value={role}>{role}</option>
									{/each}
								</select>
							</div>
							<div class="flex gap-2 items-end">
								<button
									on:click={addRota}
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
						on:click={() => { showAddRota = true; editingRotaIndex = null; }}
						class="w-full px-4 py-2 text-sm btn-theme-light-1 rounded-md border-2 border-dashed"
					>
						+ Add New Rota
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

		<!-- Advanced -->
		{#if activeTab === 'advanced'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Advanced</h2>

			<!-- Rota reminder emails -->
			<div class="p-4 rounded-lg bg-gray-50 border border-gray-200 mb-4">
				<h3 class="text-sm font-semibold text-gray-700 mb-2">Rota reminder emails</h3>
				<p class="text-sm text-gray-600 mb-3">
					Contacts on the rota receive an email reminder a set number of days before the event. Run the reminder job automatically (e.g. daily) on Railway using a cron job that calls <code class="bg-white px-1 rounded text-xs">/api/cron/rota-reminders?secret=YOUR_SECRET</code>.
				</p>
				<div class="flex flex-wrap items-end gap-3">
					<div>
						<label for="rota-reminder-days" class="block text-xs font-medium text-gray-700 mb-1">Days before event to send reminder</label>
						<input
							id="rota-reminder-days"
							type="number"
							min="0"
							max="90"
							bind:value={rotaReminderDaysAhead}
							class="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
						/>
					</div>
					<button
						type="button"
						on:click={saveRotaReminderSettings}
						disabled={saving}
						class="px-3 py-1.5 text-sm btn-theme-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
				</div>
				<p class="mt-2 text-xs text-gray-500">0 = day of event; 1 = one day before; 3 = three days before (default).</p>
			</div>

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

		<!-- Image browser modal for Theme logo -->
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
