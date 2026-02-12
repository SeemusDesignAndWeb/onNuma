<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: theme = $page.data?.theme ?? null;
	$: loginLogoSrc = (theme?.loginLogoPath && theme.loginLogoPath.trim()) || (theme?.logoPath && theme.logoPath.trim()) || '/assets/onnuma-logo.png';
	
	// Show notifications from form results
	$: if (formResult?.success) {
		notifications.success(formResult.message || 'Password reset email sent');
	}
	$: if (formResult?.error) {
		notifications.error(formResult.error);
	}

	let email = '';
	let submitted = false;
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-8">
		<div class="text-center">
			<img
				src={loginLogoSrc}
				alt="Eltham Green Community Church"
				class="w-auto max-w-full max-h-[130px] object-contain mx-auto mb-4"
			/>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
				Forgot Password
			</h2>
			<p class="mt-2 text-center text-sm text-gray-600">
				Enter your email address and we'll send you a link to reset your password
			</p>
		</div>

		{#if !submitted}
			<form method="POST" action="?/requestReset" use:enhance={(e) => {
				return async ({ update, result }) => {
					if (result.type === 'success') {
						submitted = true;
						notifications.success(result.data?.message || 'Password reset email sent');
					} else if (result.type === 'failure') {
						notifications.error(result.data?.error || 'Failed to send reset email');
					}
				};
			}}>
				<input type="hidden" name="_csrf" value={csrfToken} />
				
				<div>
					<label for="email" class="sr-only">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						class="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-theme-button-2 focus:border-hub-green-600 focus:z-10 sm:text-sm"
						placeholder="Email address"
					/>
				</div>

				<div class="mt-6">
					<button
						type="submit"
						class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-hub-green-600 hover:bg-hub-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-button-2"
					>
						Send Reset Link
					</button>
				</div>
			</form>
		{:else}
			<div class="bg-hub-green-50 border border-hub-green-200 rounded-md p-4">
				<p class="text-sm text-hub-green-800">
					If an account with that email exists, a password reset link has been sent. Please check your email and follow the instructions.
				</p>
			</div>
		{/if}

		<div class="text-center space-y-2">
			<a href="/hub/auth/login" class="block text-sm text-hub-blue-600 hover:text-hub-blue-600/80">
				← Back to Login
			</a>
			<p class="text-xs text-gray-500 pt-2">
				No email? From the project root run: <code class="bg-gray-100 px-1 rounded">node scripts/reset-password.js your@email.com "NewPass123!"</code>
			</p>
		</div>
	</div>
</div>

