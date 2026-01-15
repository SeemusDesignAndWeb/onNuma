<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import FormField from '$lib/crm/components/FormField.svelte';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: admin = $page.data?.admin;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

	// Show notifications from form results
	$: if (formResult && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			notifications.success(formResult.message || 'Profile updated successfully');
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	let editingEmail = false;
	let changingPassword = false;
	
	let emailData = {
		email: admin?.email || ''
	};

	let passwordData = {
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	};

	let showCurrentPassword = false;
	let showNewPassword = false;

	$: if (admin && !editingEmail) {
		emailData = {
			email: admin.email || ''
		};
	}
</script>

{#if admin}
	<div class="bg-white shadow rounded-lg p-6 mb-6">
		<h2 class="text-2xl font-bold text-gray-900 mb-6">My Profile</h2>

		<div class="space-y-6">
			<!-- Account Information -->
			<div>
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
				<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">Name</dt>
						<dd class="mt-1 text-sm text-gray-900">{admin.name || '-'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Email</dt>
						<dd class="mt-1 text-sm text-gray-900">{admin.email}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Role</dt>
						<dd class="mt-1 text-sm text-gray-900 capitalize">{admin.role || 'admin'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Email Verified</dt>
						<dd class="mt-1">
							{#if admin.emailVerified}
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-hub-green-100 text-hub-green-800">
									Verified
								</span>
							{:else}
								<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-hub-yellow-100 text-hub-yellow-800">
									Unverified
								</span>
							{/if}
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
					<div>
						<dt class="text-sm font-medium text-gray-500">Account Created</dt>
						<dd class="mt-1 text-sm text-gray-900">
							{admin.createdAt ? formatDateTimeUK(admin.createdAt) : '-'}
						</dd>
					</div>
				</dl>
			</div>

			<!-- Update Email Section -->
			<div class="border-t border-gray-200 pt-6">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold text-gray-900">Email Address</h3>
					<button
						on:click={() => {
							editingEmail = !editingEmail;
							if (!editingEmail && admin) {
								emailData = { email: admin.email || '' };
							}
						}}
						class="text-sm text-hub-blue-600 hover:text-hub-blue-800"
					>
						{editingEmail ? 'Cancel' : 'Change Email'}
					</button>
				</div>

				{#if editingEmail}
					<form method="POST" action="?/updateEmail" use:enhance={(e) => {
						return async ({ update, result }) => {
							if (result.type === 'success') {
								notifications.success(result.data?.message || 'Email updated successfully');
								editingEmail = false;
								await update();
							} else if (result.type === 'failure') {
								notifications.error(result.data?.error || 'Failed to update email');
							}
						};
					}}>
						<input type="hidden" name="_csrf" value={csrfToken} />
						
						<FormField 
							label="New Email Address" 
							name="email" 
							type="email" 
							bind:value={emailData.email} 
							required 
						/>

						<div class="flex gap-2 mt-4">
							<button type="submit" class="bg-hub-green-600 text-white px-2.5 py-1.5 rounded-md hover:bg-hub-green-700">
								Update Email
							</button>
							<button
								type="button"
								on:click={() => {
									editingEmail = false;
									if (admin) {
										emailData = { email: admin.email || '' };
									}
								}}
								class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700"
							>
								Cancel
							</button>
						</div>
					</form>
				{:else}
					<p class="text-sm text-gray-600">{admin.email}</p>
				{/if}
			</div>

			<!-- Change Password Section -->
			<div class="border-t border-gray-200 pt-6">
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold text-gray-900">Password</h3>
					<button
						on:click={() => {
							changingPassword = !changingPassword;
							if (!changingPassword) {
								passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
							}
						}}
						class="text-sm text-hub-blue-600 hover:text-hub-blue-800"
					>
						{changingPassword ? 'Cancel' : 'Change Password'}
					</button>
				</div>

				{#if changingPassword}
					<form method="POST" action="?/updatePassword" use:enhance={(e) => {
						return async ({ update, result }) => {
							if (result.type === 'success') {
								notifications.success(result.data?.message || 'Password updated successfully');
								changingPassword = false;
								passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
								await update();
							} else if (result.type === 'failure') {
								notifications.error(result.data?.error || 'Failed to update password');
							}
						};
					}}>
						<input type="hidden" name="_csrf" value={csrfToken} />
						
						<div class="space-y-4">
							<div>
								<label for="currentPassword" class="block text-sm font-medium text-gray-700 mb-1">
									Current Password
								</label>
								<div class="relative">
									{#if showCurrentPassword}
										<input
											type="text"
											id="currentPassword"
											name="currentPassword"
											bind:value={passwordData.currentPassword}
											required
											class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-4 pr-10"
										/>
									{:else}
										<input
											type="password"
											id="currentPassword"
											name="currentPassword"
											bind:value={passwordData.currentPassword}
											required
											class="w-full rounded-md border-gray-300 shadow-sm focus:border-hub-green-500 focus:ring-hub-green-500 py-2 px-4 pr-10"
										/>
									{/if}
									<button
										type="button"
										on:click={() => showCurrentPassword = !showCurrentPassword}
										class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
									>
										{#if showCurrentPassword}
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
							</div>

							<div>
								<label for="newPassword" class="block text-sm font-medium text-gray-700 mb-1">
									New Password
								</label>
								<div class="relative">
									{#if showNewPassword}
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
										on:click={() => showNewPassword = !showNewPassword}
										class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
									>
										{#if showNewPassword}
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
									Confirm New Password
								</label>
								{#if showNewPassword}
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
								Update Password
							</button>
							<button
								type="button"
								on:click={() => {
									changingPassword = false;
									passwordData = { currentPassword: '', newPassword: '', confirmPassword: '' };
								}}
								class="bg-gray-600 text-white px-2.5 py-1.5 rounded-md hover:bg-gray-700"
							>
								Cancel
							</button>
						</div>
					</form>
				{:else}
					<p class="text-sm text-gray-600">Last changed: {admin.passwordChangedAt ? formatDateTimeUK(admin.passwordChangedAt) : 'Never'}</p>
				{/if}
			</div>
		</div>
	</div>
{/if}

