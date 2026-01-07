<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: token = $page.data?.token;
	$: email = $page.data?.email;
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	
	// Show notifications from form results
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let passwordData = {
		newPassword: '',
		confirmPassword: ''
	};

	let showNewPassword = false;
	let showConfirmPassword = false;
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<img
				src="/images/egcc-color.png"
				alt="Eltham Green Community Church"
				class="h-16 w-auto mx-auto mb-4"
			/>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
				Reset Password
			</h2>
			<p class="mt-2 text-center text-sm text-gray-600">
				Enter your new password below
			</p>
		</div>

		{#if token && email}
			<form method="POST" action="?/reset" use:enhance>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="email" value={email} />
				
				<div class="space-y-4">
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
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-4 pr-10"
								/>
							{:else}
								<input
									type="password"
									id="newPassword"
									name="newPassword"
									bind:value={passwordData.newPassword}
									required
									placeholder="Minimum 12 characters with uppercase, lowercase, number, and special character"
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-4 pr-10"
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
						<div class="relative">
							{#if showConfirmPassword}
								<input
									type="text"
									id="confirmPassword"
									name="confirmPassword"
									bind:value={passwordData.confirmPassword}
									required
									placeholder="Confirm new password"
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-4 pr-10"
								/>
							{:else}
								<input
									type="password"
									id="confirmPassword"
									name="confirmPassword"
									bind:value={passwordData.confirmPassword}
									required
									placeholder="Confirm new password"
									class="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green py-2 px-4 pr-10"
								/>
							{/if}
							<button
								type="button"
								on:click={() => showConfirmPassword = !showConfirmPassword}
								class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
							>
								{#if showConfirmPassword}
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
				</div>

				<div class="mt-6">
					<button
						type="submit"
						class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-green hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
					>
						Reset Password
					</button>
				</div>
			</form>
		{:else}
			<div class="bg-red-50 border border-red-200 rounded-md p-4">
				<p class="text-sm text-red-800 font-medium mb-2">
					Invalid or expired reset link
				</p>
				<p class="text-sm text-red-700 mb-3">
					This password reset link may have expired (links are valid for 24 hours) or has already been used. Please request a new password reset link.
				</p>
				<div class="text-center">
					<a href="/hub/auth/forgot-password" class="inline-block text-sm text-brand-blue hover:text-brand-blue/80 font-medium">
						Request New Reset Link →
					</a>
				</div>
			</div>
		{/if}

		<div class="text-center">
			<a href="/hub/auth/login" class="text-sm text-brand-blue hover:text-brand-blue/80">
				← Back to Login
			</a>
		</div>
	</div>
</div>

