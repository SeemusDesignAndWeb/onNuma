<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { isSuperAdmin, HUB_AREAS } from '$lib/crm/server/permissions.js';
	
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: availableAreas = $page.data?.availableAreas || [];
	$: currentAdmin = $page.data?.admin || null;
	$: isCurrentUserSuperAdmin = currentAdmin && isSuperAdmin(currentAdmin);
	$: superAdminEmail = $page.data?.superAdminEmail || 'john.watson@egcc.co.uk';
	
	// Get URL parameters for pre-filling form
	$: urlParams = $page.url.searchParams;
	$: prefillName = urlParams.get('name') || '';
	$: prefillEmail = urlParams.get('email') || '';
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let formData = {
		email: prefillEmail,
		password: '',
		name: prefillName,
		permissions: []
	};
	
	/**
	 * Generate a random password that meets all requirements:
	 * - At least 12 characters
	 * - Contains uppercase letter
	 * - Contains lowercase letter
	 * - Contains number
	 * - Contains special character
	 */
	function generateRandomPassword() {
		const lowercase = 'abcdefghijklmnopqrstuvwxyz';
		const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
		const numbers = '0123456789';
		const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
		const allChars = lowercase + uppercase + numbers + special;
		
		// Ensure at least one of each required character type
		let password = '';
		password += lowercase[Math.floor(Math.random() * lowercase.length)];
		password += uppercase[Math.floor(Math.random() * uppercase.length)];
		password += numbers[Math.floor(Math.random() * numbers.length)];
		password += special[Math.floor(Math.random() * special.length)];
		
		// Fill the rest to make it at least 16 characters (more secure)
		const minLength = 16;
		for (let i = password.length; i < minLength; i++) {
			password += allChars[Math.floor(Math.random() * allChars.length)];
		}
		
		// Shuffle the password to avoid predictable pattern
		return password.split('').sort(() => Math.random() - 0.5).join('');
	}
	
	// Generate password when page loads
	onMount(() => {
		if (!formData.password) {
			formData.password = generateRandomPassword();
		}
	});
	
	// Update formData when URL params change
	$: if (prefillName || prefillEmail) {
		formData.name = prefillName || formData.name;
		formData.email = prefillEmail || formData.email;
	}
	
	function togglePermission(area) {
		// If toggling SUPER_ADMIN permission, handle specially
		if (area === HUB_AREAS.SUPER_ADMIN) {
			if (formData.permissions.includes(area)) {
				// Unchecking super admin - remove it
				formData.permissions = formData.permissions.filter(p => p !== area);
			} else {
				// Checking super admin - add it and all other permissions
				const allRegularPermissions = Object.values(HUB_AREAS).filter(p => p !== HUB_AREAS.SUPER_ADMIN);
				formData.permissions = [...allRegularPermissions, HUB_AREAS.SUPER_ADMIN];
			}
		} else {
			// Regular permission toggle
			if (formData.permissions.includes(area)) {
				formData.permissions = formData.permissions.filter(p => p !== area);
			} else {
				formData.permissions = [...formData.permissions, area];
			}
		}
	}
	
	// Check if email is super admin email
	$: isSuperAdminEmailMatch = formData.email && formData.email.toLowerCase() === superAdminEmail.toLowerCase();
	
	// Check if super admin permission is selected
	$: hasSuperAdminPermission = formData.permissions.includes(HUB_AREAS.SUPER_ADMIN);
	
	// Separate regular areas from super admin permission
	$: regularAreas = availableAreas.filter(a => a.value !== HUB_AREAS.SUPER_ADMIN);
	$: superAdminArea = availableAreas.find(a => a.value === HUB_AREAS.SUPER_ADMIN);

	let showPassword = false;
</script>

<div class="bg-white shadow rounded-lg p-6">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h2 class="text-xl sm:text-2xl font-bold text-gray-900">New Admin</h2>
		<div class="flex flex-wrap gap-2">
			<a href="/hub/users" class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs">
				Cancel
			</a>
			<button type="submit" form="user-create-form" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs">
				<span class="hidden sm:inline">Create Admin</span>
				<span class="sm:hidden">Create</span>
			</button>
		</div>
	</div>

	<form id="user-create-form" method="POST" action="?/create" use:enhance>
		<input type="hidden" name="_csrf" value={csrfToken} />
		
		<div class="space-y-4">
			<FormField 
				label="Name" 
				name="name" 
				type="text" 
				bind:value={formData.name} 
				required 
				placeholder="Full name"
			/>
			
			<FormField 
				label="Email" 
				name="email" 
				type="email" 
				bind:value={formData.email} 
				required 
				placeholder="admin@example.com"
			/>
			
			<div>
				<label class="block text-sm font-medium text-gray-700 mb-3">
					Hub Area Permissions
				</label>
				{#if isSuperAdminEmailMatch}
					<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<p class="text-sm text-blue-800">
							<strong>Super Admin:</strong> This user will have full access to all areas automatically.
						</p>
					</div>
				{:else}
					<p class="text-sm text-gray-600 mb-4">
						Select the areas of the hub this admin can access.
					</p>
				{/if}
				
				<!-- Super Admin Permission (only visible to super admins) -->
				{#if isCurrentUserSuperAdmin && superAdminArea}
					<div class="mb-4 p-4 border-2 border-purple-300 rounded-lg bg-purple-50">
						<label class="flex items-start cursor-pointer">
							<input
								type="checkbox"
								name="permissions"
								value={superAdminArea.value}
								checked={hasSuperAdminPermission || isSuperAdminEmailMatch}
								disabled={isSuperAdminEmailMatch}
								on:change={() => !isSuperAdminEmailMatch && togglePermission(superAdminArea.value)}
								class="mt-1 mr-3 h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
							/>
							<div class="flex-1">
								<div class="text-sm font-bold text-purple-900">{superAdminArea.label}</div>
								<div class="text-xs text-purple-700 mt-1">{superAdminArea.description}</div>
								{#if hasSuperAdminPermission || isSuperAdminEmailMatch}
									<div class="text-xs text-purple-600 mt-2 font-medium">
										All permissions will be granted automatically.
									</div>
								{/if}
							</div>
						</label>
					</div>
				{/if}
				
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					{#each regularAreas as area}
						<label class="flex items-start p-3 border rounded-lg {(isSuperAdminEmailMatch || hasSuperAdminPermission) ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'} {formData.permissions.includes(area.value) || isSuperAdminEmailMatch || hasSuperAdminPermission ? 'border-hub-green-500 bg-hub-green-50' : 'border-gray-300'}">
							<input
								type="checkbox"
								name="permissions"
								value={area.value}
								checked={isSuperAdminEmailMatch || hasSuperAdminPermission || formData.permissions.includes(area.value)}
								disabled={isSuperAdminEmailMatch || hasSuperAdminPermission}
								on:change={() => !isSuperAdminEmailMatch && !hasSuperAdminPermission && togglePermission(area.value)}
								class="mt-1 mr-3 h-4 w-4 text-hub-green-600 focus:ring-hub-green-500 border-gray-300 rounded"
							/>
							<div class="flex-1">
								<div class="text-sm font-semibold text-gray-900">{area.label}</div>
								<div class="text-xs text-gray-600 mt-1">{area.description}</div>
							</div>
						</label>
					{/each}
				</div>
				<!-- Hidden inputs for form submission -->
				{#if isSuperAdminEmailMatch}
					<!-- Super admin gets all permissions -->
					{#each regularAreas as area}
						<input type="hidden" name="permissions" value={area.value} />
					{/each}
				{:else}
					{#each formData.permissions as permission}
						<input type="hidden" name="permissions" value={permission} />
					{/each}
				{/if}
			</div>
			
			<div>
				<label for="password" class="block text-sm font-medium text-gray-700 mb-1">
					Password
				</label>
				<div class="relative">
					{#if showPassword}
						<input
							type="text"
							id="password"
							name="password"
							bind:value={formData.password}
							required
							placeholder="Minimum 12 characters with uppercase, lowercase, number, and special character"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-4 pr-10"
						/>
					{:else}
						<input
							type="password"
							id="password"
							name="password"
							bind:value={formData.password}
							required
							placeholder="Minimum 12 characters with uppercase, lowercase, number, and special character"
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-4 pr-10"
						/>
					{/if}
					<button
						type="button"
						on:click={() => showPassword = !showPassword}
						class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
					>
						{#if showPassword}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
							</svg>
						{:else}
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
							</svg>
						{/if}
					</button>
				</div>
				<p class="mt-1 text-xs text-gray-500">
					Must be at least 12 characters with uppercase, lowercase, number, and special character
				</p>
			</div>
		</div>
	</form>
</div>

