<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { notifications, dialog } from '$lib/crm/stores/notifications.js';
	
	export let data;
	
	$: admin = data?.admin || null;
	let settings = data?.settings || { emailRateLimitDelay: 500, calendarColours: [], meetingPlannerRotas: [] };
	let availableRoles = data?.availableRoles || [];
	
	let emailRateLimitDelay = settings?.emailRateLimitDelay || 500;
	let calendarColours = JSON.parse(JSON.stringify(settings?.calendarColours || []));
	let meetingPlannerRotas = JSON.parse(JSON.stringify(settings?.meetingPlannerRotas || []));
	let saving = false;
	let editingColourIndex = null;
	let originalColour = null; // Store original colour when editing starts
	let newColour = { value: '#9333ea', label: '' };
	let showAddColour = false;
	let activeTab = 'colours'; // 'email', 'colours', 'meeting-planner', or 'data-store'
	// Optimistic update: set when we switch so "Current mode" updates before refetch
	let storeModeOverride = null;
	$: storeMode = storeModeOverride ?? data?.storeMode ?? 'file';
	
	// Meeting Planner Rota state
	let editingRotaIndex = null;
	let originalRota = null;
	let showAddRota = false;
	let newRota = { role: '' };
	
	// Update local state when data changes (e.g. after invalidateAll)
	$: if (data?.settings) {
		settings = data.settings;
		emailRateLimitDelay = settings.emailRateLimitDelay;
		calendarColours = JSON.parse(JSON.stringify(settings.calendarColours || []));
		meetingPlannerRotas = JSON.parse(JSON.stringify(settings.meetingPlannerRotas || []));
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
					on:click={() => activeTab = 'colours'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'colours' ? 'border-hub-blue-500 text-hub-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Calendar Colours
				</button>
				<button
					on:click={() => activeTab = 'meeting-planner'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'meeting-planner' ? 'border-hub-blue-500 text-hub-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Meeting Planner
				</button>
				<button
					on:click={() => activeTab = 'email'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'email' ? 'border-hub-blue-500 text-hub-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Email Rate Limiting
				</button>
				<button
					on:click={() => activeTab = 'data-store'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'data-store' ? 'border-hub-blue-500 text-hub-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Data store
				</button>
			</nav>
		</div>
		
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
													class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-hub-blue-500 focus:border-hub-blue-500"
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
												class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-hub-blue-500 focus:border-hub-blue-500"
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
											class="px-3 py-1 text-sm text-hub-blue-600 bg-white border border-hub-blue-300 rounded-md hover:bg-hub-blue-50"
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
											class="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-hub-blue-500 focus:border-hub-blue-500"
										/>
									</div>
								</div>
								<div class="flex-1">
									<label class="block text-xs font-medium text-gray-700 mb-1">Label</label>
									<input
										type="text"
										bind:value={newColour.label}
										placeholder="Purple"
										class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-hub-blue-500 focus:border-hub-blue-500"
									/>
								</div>
							</div>
							<div class="flex gap-2 items-end">
								<button
									on:click={addColour}
									class="px-3 py-1 text-sm text-white bg-hub-green-600 rounded-md hover:bg-hub-green-700"
								>
									Add
								</button>
								<button
									on:click={cancelEdit}
									class="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{:else}
					<button
						on:click={() => { showAddColour = true; editingColourIndex = null; }}
						class="w-full px-4 py-2 text-sm text-hub-blue-600 bg-white border-2 border-dashed border-hub-blue-300 rounded-md hover:bg-hub-blue-50"
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
							class="flex items-center gap-3 p-3 border border-gray-200 rounded-md transition-all duration-200 {draggedRotaIndex === index ? 'opacity-40 grayscale' : 'bg-gray-50'} {dragOverRotaIndex === index ? 'border-hub-blue-500 border-t-4' : ''}"
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
											class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-hub-blue-500 focus:border-hub-blue-500"
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
											class="px-3 py-1 text-sm text-hub-blue-600 bg-white border border-hub-blue-300 rounded-md hover:bg-hub-blue-50"
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
										class="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-hub-blue-500 focus:border-hub-blue-500"
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
									class="px-3 py-1 text-sm text-white bg-hub-green-600 rounded-md hover:bg-hub-green-700"
								>
									Add
								</button>
								<button
									on:click={cancelEdit}
									class="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{:else}
					<button
						on:click={() => { showAddRota = true; editingRotaIndex = null; }}
						class="w-full px-4 py-2 text-sm text-hub-blue-600 bg-white border-2 border-dashed border-hub-blue-300 rounded-md hover:bg-hub-blue-50"
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
						class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-hub-blue-500 focus:border-hub-blue-500"
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
						class="px-4 py-2 bg-hub-blue-500 text-white rounded-md hover:bg-hub-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hub-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
						class="px-4 py-2 bg-hub-blue-500 text-white rounded-md hover:bg-hub-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hub-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{migrating ? 'Copying...' : 'Copy file data to database'}
					</button>
					<button
						on:click={() => setStoreMode('database')}
						disabled={switching || storeMode === 'database'}
						class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{switching ? 'Switching...' : 'Switch to database'}
					</button>
					<button
						on:click={() => setStoreMode('file')}
						disabled={switching || storeMode === 'file'}
						class="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{switching ? 'Switching...' : 'Switch to file store'}
					</button>
				</div>
			</div>
		</div>
		{/if}
	</div>
</div>
