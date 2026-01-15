<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { formatDateUK, formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: admin = $page.data?.admin;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: availableAreas = $page.data?.availableAreas || [];
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			notifications.success(formResult.message || 'Admin updated successfully');
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}
	
	// Show creation success message
	$: if ($page.data?.created) {
		const email = $page.data?.createdEmail || '';
		const emailFailed = $page.data?.emailFailed || false;
		
		if (emailFailed) {
			notifications.warning(`Admin user created successfully, but the welcome email could not be sent to ${email}. The user will need to request a verification email manually.`);
		} else {
			notifications.success(`Admin user created successfully! A welcome email with verification link has been sent to ${email}. The user must verify their email before they can log in.`);
		}
		
		// Clear the query params to avoid showing the message again on refresh
		setTimeout(() => {
			const url = new URL(window.location.href);
			url.searchParams.delete('created');
			url.searchParams.delete('email');
			url.searchParams.delete('email_failed');
			window.history.replaceState({}, '', url);
		}, 100);
	}

	let editing = false;
	let resettingPassword = false;
	let formData = {
		email: '',
		name: '',
		permissions: []
	};

	let passwordData = {
		newPassword: '',
		confirmPassword: ''
	};

	let showPassword = false;

	// Only update formData when admin changes and we're not editing
	// Use a flag to prevent overwriting during form submission
	let isSubmitting = false;
	
	$: if (admin && !editing && !isSubmitting) {
		// Get permissions from admin object
		const permissions = admin.permissions || [];
		formData = {
			email: admin.email || '',
			name: admin.name || '',
			permissions: [...permissions] // Create a copy
		};
	}
	
	function togglePermission(area) {
		if (formData.permissions.includes(area)) {
			formData.permissions = formData.permissions.filter(p => p !== area);
		} else {
			formData.permissions = [...formData.permissions, area];
		}
	}
	
	// Check if email is super admin email
	$: isSuperAdminEmail = formData.email && formData.email.toLowerCase() === 'john.watson@egcc.co.uk';

	function isAccountLocked() {
		if (!admin?.accountLockedUntil) return false;
		return new Date(admin.accountLockedUntil) > new Date();
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this admin? This action cannot be undone.', 'Delete Admin');
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

	async function handleUnlock() {
		const confirmed = await dialog.confirm('Unlock this admin account?', 'Unlock Account');
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/unlock';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			document.body.appendChild(form);
			form.submit();
		}
	}

	async function handleVerify() {
		const confirmed = await dialog.confirm('Mark this admin\'s email as verified?', 'Verify Email');
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/verify';
			
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

{#if admin}
	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">Admin Details</h2>
			<div class="flex flex-wrap gap-2">
				<a 
					href="/hub/users" 
					class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 inline-flex items-center gap-1.5 text-xs"
				>
					<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					Back to Admins
				</a>
				{#if editing}
					<button
						type="submit"
						form="admin-edit-form"
						class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs"
					>
						Save Changes
					</button>
					<button
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700 text-xs"
					>
						Cancel
					</button>
				{:else}
					<button
						on:click={() => editing = true}
						class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700 text-xs"
					>
						Edit
					</button>
					{#if !admin.emailVerified}
						<button
							on:click={handleVerify}
							class="bg-hub-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-blue-700 text-xs"
						>
							<span class="hidden sm:inline">Verify Email</span>
							<span class="sm:hidden">Verify</span>
						</button>
					{/if}
					{#if isAccountLocked()}
						<button
							on:click={handleUnlock}
							class="bg-hub-yellow-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-yellow-700 text-xs"
						>
							<span class="hidden sm:inline">Unlock Account</span>
							<span class="sm:hidden">Unlock</span>
						</button>
					{/if}
					<button
						on:click={handleDelete}
						class="bg-hub-red-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-red-700 text-xs"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form id="admin-edit-form" method="POST" action="?/update" use:enhance={(e) => {
				return async ({ update, result }) => {
					isSubmitting = true;
					try {
						if (result.type === 'success') {
							editing = false;
							// Update data but don't reset form
							// Notification will be shown by the reactive formResult watcher
							await update({ reset: false });
						}
						// Error notification will be shown by the reactive formResult watcher
					} finally {
						isSubmitting = false;
					}
				};
			}}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				
				<div class="space-y-4">
					<FormField 
						label="Name" 
						name="name" 
						type="text" 
						bind:value={formData.name} 
						required 
					/>
					
					<FormField 
						label="Email" 
						name="email" 
						type="email" 
						bind:value={formData.email} 
						required 
					/>
					
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-3">
							Hub Area Permissions
						</label>
						{#if isSuperAdminEmail}
							<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
								<p class="text-sm text-blue-800">
									<strong>Super Admin:</strong> This user has full access to all areas automatically. Permissions cannot be modified.
								</p>
							</div>
						{:else}
							<p class="text-sm text-gray-600 mb-4">
								Select the areas of the hub this admin can access.
							</p>
						{/if}
						<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
							{#each availableAreas as area}
								<label class="flex items-start p-3 border rounded-lg {isSuperAdminEmail ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-gray-50'} {formData.permissions.includes(area.value) ? 'border-hub-green-500 bg-hub-green-50' : 'border-gray-300'}">
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
				</div>
			</form>
		{:else}
			<div class="space-y-6">
				<div>
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
					<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<dt class="text-sm font-medium text-gray-500">Email</dt>
							<dd class="mt-1 text-sm text-gray-900">{admin.email}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Name</dt>
							<dd class="mt-1 text-sm text-gray-900">{admin.name || '-'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Role</dt>
							<dd class="mt-1 text-sm text-gray-900 capitalize">{admin.role || 'admin'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Permissions</dt>
							<dd class="mt-1">
								{#if admin.email && admin.email.toLowerCase() === 'john.watson@egcc.co.uk'}
									<div class="text-sm font-medium text-gray-900">Super Admin</div>
									<div class="text-xs text-gray-500 mt-1">Full access to all areas, can create other admins</div>
								{:else}
									{@const adminPermissions = admin.permissions || []}
									{#if adminPermissions.length === 0}
										<div class="text-sm text-gray-500 italic">No permissions assigned</div>
									{:else}
										<div class="flex flex-wrap gap-2 mt-1">
											{#each availableAreas as area}
												{#if adminPermissions.includes(area.value)}
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-hub-green-100 text-hub-green-800">
														{area.label}
													</span>
												{/if}
											{/each}
										</div>
									{/if}
								{/if}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Status</dt>
							<dd class="mt-1">
								{#if isAccountLocked()}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-hub-red-100 text-hub-red-800">
										Locked
									</span>
								{:else if !admin.emailVerified}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-hub-yellow-100 text-hub-yellow-800">
										Unverified
									</span>
								{:else}
									<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-hub-green-100 text-hub-green-800">
										Active
									</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Email Verified</dt>
							<dd class="mt-1 text-sm text-gray-900">{admin.emailVerified ? 'Yes' : 'No'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Created</dt>
							<dd class="mt-1 text-sm text-gray-900">
								{admin.createdAt ? formatDateTimeUK(admin.createdAt) : '-'}
							</dd>
						</div>
						{#if admin.passwordChangedAt}
							<div>
								<dt class="text-sm font-medium text-gray-500">Password Last Changed</dt>
								<dd class="mt-1 text-sm text-gray-900">
									{formatDateTimeUK(admin.passwordChangedAt)}
								</dd>
							</div>
						{/if}
						{#if admin.failedLoginAttempts > 0}
							<div>
								<dt class="text-sm font-medium text-gray-500">Failed Login Attempts</dt>
								<dd class="mt-1 text-sm text-gray-900">{admin.failedLoginAttempts}</dd>
							</div>
						{/if}
					</dl>
				</div>
			</div>
		{/if}

		<!-- Password Reset Section -->
		<div class="mt-8 border-t border-gray-200 pt-6">
			<div class="flex justify-between items-center mb-4">
				<h3 class="text-lg font-semibold text-gray-900">Reset Password</h3>
				<button
					on:click={() => resettingPassword = !resettingPassword}
					class="text-sm text-hub-blue-600 hover:text-hub-blue-800"
				>
					{resettingPassword ? 'Cancel' : 'Reset Password'}
				</button>
			</div>

			{#if resettingPassword}
				<form method="POST" action="?/resetPassword" use:enhance>
					<input type="hidden" name="_csrf" value={csrfToken} />
					
					<div class="space-y-4">
						<div>
							<label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">
								New Password
							</label>
							<div class="relative">
								{#if showPassword}
									<input
										type="text"
										id="newPassword"
										name="newPassword"
										bind:value={passwordData.newPassword}
										required
										placeholder="Minimum 12 characters with uppercase, lowercase, number, and special character"
										class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-4 pr-10"
									/>
								{:else}
									<input
										type="password"
										id="newPassword"
										name="newPassword"
										bind:value={passwordData.newPassword}
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

						<div>
							<label for="confirmPassword" class="block text-sm font-medium text-gray-700 mb-1">
								Confirm Password
							</label>
							{#if showPassword}
								<input
									type="text"
									id="confirmPassword"
									name="confirmPassword"
									bind:value={passwordData.confirmPassword}
									required
									placeholder="Confirm new password"
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-4"
								/>
							{:else}
								<input
									type="password"
									id="confirmPassword"
									name="confirmPassword"
									bind:value={passwordData.confirmPassword}
									required
									placeholder="Confirm new password"
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-4"
								/>
							{/if}
						</div>
					</div>

					<div class="flex gap-2 mt-6">
						<button type="submit" class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700">
							Reset Password
						</button>
						<button
							type="button"
							on:click={() => {
								resettingPassword = false;
								passwordData = { newPassword: '', confirmPassword: '' };
							}}
							class="bg-gray-600 text-white px-[18px] py-2.5 rounded-md hover:bg-gray-700"
						>
							Back
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}

