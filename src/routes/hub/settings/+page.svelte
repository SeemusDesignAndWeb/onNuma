<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	
	export let data;
	
	$: admin = data?.admin || null;
	$: settings = data?.settings || { emailRateLimitDelay: 500, calendarColours: [] };
	
	let emailRateLimitDelay = settings?.emailRateLimitDelay || 500;
	let calendarColours = settings?.calendarColours || [];
	let saving = false;
	let saved = false;
	let error = null;
	let editingColourIndex = null;
	let originalColour = null; // Store original colour when editing starts
	let newColour = { value: '#9333ea', label: '' };
	let showAddColour = false;
	let activeTab = 'colours'; // 'email' or 'colours'
	
	// Update emailRateLimitDelay when settings change
	$: if (settings?.emailRateLimitDelay !== undefined) {
		emailRateLimitDelay = settings.emailRateLimitDelay;
	}
	
	// Update calendarColours when settings change
	$: if (settings?.calendarColours !== undefined) {
		calendarColours = JSON.parse(JSON.stringify(settings.calendarColours));
	}
	
	async function saveSettings() {
		saving = true;
		saved = false;
		error = null;
		
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
			saved = true;
			setTimeout(() => (saved = false), 3000);
			
			// Update local settings
			if (result.settings) {
				settings = result.settings;
			}
		} catch (err) {
			error = err.message || 'Failed to save settings';
			console.error('Error saving settings:', err);
		} finally {
			saving = false;
		}
	}
	
	async function saveCalendarColours() {
		saving = true;
		saved = false;
		error = null;
		
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
			saved = true;
			setTimeout(() => (saved = false), 3000);
			
			// Update local settings
			if (result.settings) {
				settings = result.settings;
				calendarColours = JSON.parse(JSON.stringify(result.settings.calendarColours));
			}
			
			// Reset editing state
			editingColourIndex = null;
			showAddColour = false;
			newColour = { value: '#9333ea', label: '' };
		} catch (err) {
			error = err.message || 'Failed to save calendar colours';
			console.error('Error saving calendar colours:', err);
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
		editingColourIndex = null;
		originalColour = null;
		showAddColour = false;
		newColour = { value: '#9333ea', label: '' };
	}
	
	async function addColour() {
		if (!newColour.value || !newColour.label.trim()) {
			error = 'Please provide both a colour and a label';
			return;
		}
		
		// Validate hex colour
		if (!/^#[0-9A-Fa-f]{6}$/.test(newColour.value)) {
			error = 'Invalid colour format. Please use a hex colour (e.g., #9333ea)';
			return;
		}
		
		calendarColours = [...calendarColours, { value: newColour.value, label: newColour.label.trim() }];
		newColour = { value: '#9333ea', label: '' };
		showAddColour = false;
		error = null;
		
		// Automatically save all calendar colours
		await saveCalendarColours();
	}
	
	async function removeColour(index) {
		if (confirm('Are you sure you want to remove this colour?')) {
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
			error = 'Please provide both a colour and a label';
			return;
		}
		
		// Validate hex colour
		if (!/^#[0-9A-Fa-f]{6}$/.test(colour.value)) {
			error = 'Invalid colour format. Please use a hex colour (e.g., #9333ea)';
			return;
		}
		
		error = null;
		editingColourIndex = null;
		originalColour = null;
		
		// Automatically save all calendar colours
		await saveCalendarColours();
	}
	
	function calculateRequestsPerSecond() {
		if (emailRateLimitDelay <= 0) return 'Invalid';
		return (1000 / emailRateLimitDelay).toFixed(2);
	}
</script>

<svelte:head>
	<title>Settings - TheHUB</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-4 py-8">
	<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
		<p class="text-gray-600 mb-6">Manage system settings (Superadmin only)</p>
		
		{#if saved}
			<div class="mb-4 bg-green-50 border-l-4 border-green-400 p-4">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm text-green-700">Settings saved successfully!</p>
					</div>
				</div>
			</div>
		{/if}
		
		{#if error}
			<div class="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
				<div class="flex">
					<div class="flex-shrink-0">
						<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="ml-3">
						<p class="text-sm text-red-700">{error}</p>
					</div>
				</div>
			</div>
		{/if}
		
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
					on:click={() => activeTab = 'email'}
					class="py-4 px-1 border-b-2 font-medium text-sm transition-colors {activeTab === 'email' ? 'border-hub-blue-500 text-hub-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
				>
					Email Rate Limiting
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
						on:click={() => { showAddColour = true; editingColourIndex = null; error = null; }}
						class="w-full px-4 py-2 text-sm text-hub-blue-600 bg-white border-2 border-dashed border-hub-blue-300 rounded-md hover:bg-hub-blue-50"
					>
						+ Add New Colour
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
	</div>
</div>
