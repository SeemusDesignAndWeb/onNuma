<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { notifications, dialog } from '$lib/crm/stores/notifications.js';
	
	export let data;
	
	$: admin = data?.admin || null;
	let settings = data?.settings || { emailRateLimitDelay: 500, calendarColours: [], meetingPlannerRotas: [], theme: {} };
	let availableRoles = data?.availableRoles || [];
	
	let emailRateLimitDelay = settings?.emailRateLimitDelay || 500;
	let calendarColours = JSON.parse(JSON.stringify(settings?.calendarColours || []));
	let meetingPlannerRotas = JSON.parse(JSON.stringify(settings?.meetingPlannerRotas || []));
	const defaultButtonColors = ['#4A97D2', '#4BB170', '#3B79A8', '#3C8E5A', '#E6A324'];
	const defaultPanelHeadColors = ['#4A97D2', '#3B79A8', '#2C5B7E'];
	let themeLogoPath = settings?.theme?.logoPath ?? '';
	let themePrimaryColor = settings?.theme?.primaryColor ?? '#4BB170';
	let themeBrandColor = settings?.theme?.brandColor ?? '#4A97D2';
	let themeNavbarBackgroundColor = settings?.theme?.navbarBackgroundColor ?? '#4A97D2';
	let themeButtonColors = JSON.parse(JSON.stringify(settings?.theme?.buttonColors ?? defaultButtonColors));
	let themePanelHeadColors = JSON.parse(JSON.stringify(settings?.theme?.panelHeadColors ?? defaultPanelHeadColors));
	let themePanelBackgroundColor = settings?.theme?.panelBackgroundColor ?? '#E8F2F9';
	let themeExternalPagesLayout = settings?.theme?.externalPagesLayout ?? 'integrated';
	let themePublicPagesBranding = settings?.theme?.publicPagesBranding ?? 'egcc';
	// Ensure arrays have correct length
	if (themeButtonColors.length < 5) themeButtonColors = [...themeButtonColors, ...defaultButtonColors.slice(themeButtonColors.length)];
	if (themePanelHeadColors.length < 3) themePanelHeadColors = [...themePanelHeadColors, ...defaultPanelHeadColors.slice(themePanelHeadColors.length)];
	themeButtonColors = themeButtonColors.slice(0, 5);
	themePanelHeadColors = themePanelHeadColors.slice(0, 3);
	let saving = false;
	let editingColourIndex = null;
	let originalColour = null; // Store original colour when editing starts
	let newColour = { value: '#9333ea', label: '' };
	let showAddColour = false;
	let activeTab = 'theme'; // 'theme', 'email', 'colours', 'meeting-planner', or 'data-store'
	// Optimistic update: set when we switch so "Current mode" updates before refetch
	let storeModeOverride = null;
	$: storeMode = storeModeOverride ?? data?.storeMode ?? 'file';
	
	// Meeting Planner Rota state
	let editingRotaIndex = null;
	let originalRota = null;
	let showAddRota = false;
	let newRota = { role: '' };

	// Theme logo image browser
	let showImageBrowser = false;
	let browseImages = [];
	let browseImagesLoading = false;
	let browseImagesUploading = false;
	let browseImagesUploadError = '';
	
	async function openImageBrowser() {
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
		themeLogoPath = path || '';
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
					themeLogoPath = result.image.path;
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
		calendarColours = JSON.parse(JSON.stringify(settings.calendarColours || []));
		meetingPlannerRotas = JSON.parse(JSON.stringify(settings.meetingPlannerRotas || []));
		if (settings.theme) {
			themeLogoPath = settings.theme.logoPath ?? '';
			themePrimaryColor = settings.theme.primaryColor ?? '#4BB170';
			themeBrandColor = settings.theme.brandColor ?? '#4A97D2';
			themeNavbarBackgroundColor = settings.theme.navbarBackgroundColor ?? '#4A97D2';
			themeButtonColors = JSON.parse(JSON.stringify(settings.theme.buttonColors ?? defaultButtonColors));
			themePanelHeadColors = JSON.parse(JSON.stringify(settings.theme.panelHeadColors ?? defaultPanelHeadColors));
			themePanelBackgroundColor = settings.theme.panelBackgroundColor ?? '#E8F2F9';
			themeExternalPagesLayout = settings.theme.externalPagesLayout ?? 'integrated';
			themePublicPagesBranding = settings.theme.publicPagesBranding ?? 'egcc';
			if (themeButtonColors.length < 5) themeButtonColors = [...themeButtonColors, ...defaultButtonColors.slice(themeButtonColors.length)];
			if (themePanelHeadColors.length < 3) themePanelHeadColors = [...themePanelHeadColors, ...defaultPanelHeadColors.slice(themePanelHeadColors.length)];
			themeButtonColors = themeButtonColors.slice(0, 5);
			themePanelHeadColors = themePanelHeadColors.slice(0, 3);
		}
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
		calendarColours[index] = { ...calendarColours[index], [field]: value };
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
			</nav>
		</div>
		
		<!-- Theme Settings -->
		{#if activeTab === 'theme'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Theme</h2>
			<p class="text-sm text-gray-600 mb-4">
				Set colours and logo used on the website and external pages (e.g. signup, sundays). Leave logo blank to use the default.
			</p>
			<div class="space-y-4 max-w-xl">
				<div>
					<label for="theme-logo-path" class="block text-sm font-medium text-gray-700 mb-1">Logo path or URL</label>
					<div class="flex gap-2">
						<input
							id="theme-logo-path"
							type="text"
							bind:value={themeLogoPath}
							placeholder="/images/egcc-color.png"
							class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1"
						/>
						<button
							type="button"
							on:click={openImageBrowser}
							class="px-3 py-2 text-sm font-medium btn-theme-light-1 rounded-md whitespace-nowrap"
						>
							Select from library
						</button>
					</div>
					<p class="mt-1 text-xs text-gray-500">Select from the main images library above, or enter a path/URL (e.g. /images/logo.png). Leave empty for default logo.</p>
				</div>
				<div>
					<label for="theme-primary-color" class="block text-sm font-medium text-gray-700 mb-1">Primary colour (green)</label>
					<div class="flex items-center gap-2">
						<input
							id="theme-primary-color"
							type="color"
							bind:value={themePrimaryColor}
							class="h-10 w-14 border border-gray-300 rounded-md cursor-pointer"
						/>
						<input
							aria-label="Primary colour hex"
							type="text"
							bind:value={themePrimaryColor}
							class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1 font-mono"
							placeholder="#4BB170"
						/>
					</div>
				</div>
				<div>
					<label for="theme-brand-color" class="block text-sm font-medium text-gray-700 mb-1">Brand colour (blue)</label>
					<div class="flex items-center gap-2">
						<input
							id="theme-brand-color"
							type="color"
							bind:value={themeBrandColor}
							class="h-10 w-14 border border-gray-300 rounded-md cursor-pointer"
						/>
						<input
							aria-label="Brand colour hex"
							type="text"
							bind:value={themeBrandColor}
							class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-theme-button-1 focus:border-theme-button-1 font-mono"
							placeholder="#4A97D2"
						/>
					</div>
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
					<label class="block text-sm font-medium text-gray-700 mb-2">External pages layout</label>
					<p class="text-xs text-gray-500 mb-2">Signup, event links, forms, unsubscribe and view-rotas can use the full site navbar or a minimal header.</p>
					<div class="flex gap-6">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="radio" name="external-layout" value="integrated" bind:group={themeExternalPagesLayout} class="text-theme-button-1 focus:ring-theme-button-1" />
							<span class="text-sm">Integrated</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="radio" name="external-layout" value="standalone" bind:group={themeExternalPagesLayout} class="text-theme-button-1 focus:ring-theme-button-1" />
							<span class="text-sm">Standalone</span>
						</label>
					</div>
					<p class="mt-1 text-xs text-gray-500">Integrated = full site navbar. Standalone = minimal header with logo and “Back to site” link.</p>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2">Hub public pages branding</label>
					<p class="text-xs text-gray-500 mb-2">Choose how Hub public pages appear (signup links, event signup, forms, unsubscribe, view-rotas). The main EGCC website (home, church, events, etc.) always uses EGCC branding and is never affected.</p>
					<div class="flex gap-6">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="radio" name="public-branding" value="egcc" bind:group={themePublicPagesBranding} class="text-theme-button-1 focus:ring-theme-button-1" />
							<span class="text-sm">EGCC branding</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="radio" name="public-branding" value="hub" bind:group={themePublicPagesBranding} class="text-theme-button-1 focus:ring-theme-button-1" />
							<span class="text-sm">Hub branding</span>
						</label>
					</div>
					<p class="mt-1 text-xs text-gray-500">EGCC = use church logo and colours on Hub public pages. Hub = use the theme logo and colours above on Hub public pages only.</p>
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
													value={colour.value}
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
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Meeting Planner Rotas</h2>
			<p class="text-sm text-gray-600 mb-4">
				Manage the default rotas that are automatically created and attached to new meeting planners.
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
		
		
		<!-- Email Rate Limiting Settings -->
		{#if activeTab === 'email'}
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

		<!-- Data store -->
		{#if activeTab === 'data-store'}
		<div class="border-b border-gray-200 pb-6 mb-6">
			<h2 class="text-xl font-semibold text-gray-900 mb-4">Data store</h2>
			<p class="text-sm text-gray-600 mb-4">
				CRM data can be stored in JSON files (default) or in a PostgreSQL database. Admins and sessions always stay in files so you can log in if the database is unavailable.
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
						<h3 class="text-lg font-semibold text-gray-900">Select from images library</h3>
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
