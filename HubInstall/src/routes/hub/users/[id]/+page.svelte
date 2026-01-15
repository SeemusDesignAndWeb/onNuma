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
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			notifications.success(formResult.message || 'Admin user updated successfully');
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	let editing = false;
	let resettingPassword = false;
	let formData = {
		email: '',
		name: ''
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
		formData = {
			email: admin.email || '',
			name: admin.name || ''
		};
	}

	function isAccountLocked() {
		if (!admin?.accountLockedUntil) return false;
		return new Date(admin.accountLockedUntil) > new Date();
	}

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this admin user? This action cannot be undone.', 'Delete Admin User');
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
		const confirmed = await dialog.confirm('Mark this admin user\'s email as verified?', 'Verify Email');
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
		<div class="flex justify-between items-center mb-6">
			<h2 class="text-2xl font-bold text-gray-900">Admin User Details</h2>
			<div class="flex gap-2">
				{#if editing}
					<button
						on:click={() => editing = false}
						class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700"
					>
						Back
					</button>
				{:else}
					<button
						on:click={() => editing = true}
						class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700"
					>
						Edit
					</button>
					{#if !admin.emailVerified}
						<button
							on:click={handleVerify}
							class="bg-hub-blue-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-blue-700"
						>
							Verify Email
						</button>
					{/if}
					{#if isAccountLocked()}
						<button
							on:click={handleUnlock}
							class="bg-hub-yellow-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-yellow-700"
						>
							Unlock Account
						</button>
					{/if}
					<button
						on:click={handleDelete}
						class="bg-hub-red-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-red-700"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form method="POST" action="?/update" use:enhance={(e) => {
				return async ({ update, result }) => {
					isSubmitting = true;
					try {
						if (result.type === 'success') {
							notifications.success(result.data?.message || 'Admin user updated successfully');
							editing = false;
							// Update data but don't reset form
							await update({ reset: false });
						} else if (result.type === 'failure') {
							notifications.error(result.data?.error || 'Failed to update admin user');
						}
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
				</div>

				<div class="flex gap-2 mt-6">
					<button type="submit" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
						Save Changes
					</button>
					<button
						type="button"
						on:click={() => {
							editing = false;
							// Reset formData when canceling
							if (admin) {
								formData = {
									email: admin.email || '',
									name: admin.name || ''
								};
							}
						}}
						class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700"
					>
						Back
					</button>
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
						<button type="submit" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
							Reset Password
						</button>
						<button
							type="button"
							on:click={() => {
								resettingPassword = false;
								passwordData = { newPassword: '', confirmPassword: '' };
							}}
							class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700"
						>
							Back
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}

