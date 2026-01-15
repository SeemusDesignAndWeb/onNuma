<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	
	export let data;
	
	$: admin = data?.admin || null;
	$: settings = data?.settings || { emailRateLimitDelay: 500 };
	
	let emailRateLimitDelay = settings?.emailRateLimitDelay || 500;
	let saving = false;
	let saved = false;
	let error = null;
	
	// Update emailRateLimitDelay when settings change
	$: if (settings?.emailRateLimitDelay !== undefined) {
		emailRateLimitDelay = settings.emailRateLimitDelay;
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
		
		<!-- Email Rate Limiting Settings -->
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
	</div>
</div>
