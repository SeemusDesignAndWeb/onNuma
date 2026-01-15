<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: availableAreas = $page.data?.availableAreas || [];
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let formData = {
		email: '',
		password: '',
		name: '',
		permissions: []
	};
	
	function togglePermission(area) {
		if (formData.permissions.includes(area)) {
			formData.permissions = formData.permissions.filter(p => p !== area);
		} else {
			formData.permissions = [...formData.permissions, area];
		}
	}
	
	// Check if email is super admin email
	$: isSuperAdminEmail = formData.email && formData.email.toLowerCase() === 'john.watson@egcc.co.uk';

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
				{#if isSuperAdminEmail}
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
				<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
					{#each availableAreas as area}
						<label class="flex items-start p-3 border rounded-lg {isSuperAdminEmail ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'} {formData.permissions.includes(area.value) || isSuperAdminEmail ? 'border-hub-green-500 bg-hub-green-50' : 'border-gray-300'}">
							<input
								type="checkbox"
								name="permissions"
								value={area.value}
								checked={isSuperAdminEmail || formData.permissions.includes(area.value)}
								disabled={isSuperAdminEmail}
								on:change={() => !isSuperAdminEmail && togglePermission(area.value)}
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
				{#if isSuperAdminEmail}
					<!-- Super admin gets all permissions -->
					{#each availableAreas as area}
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

