<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	
	$: status = $page.data?.status || 'loading';
	$: message = $page.data?.message || '';
	$: email = $page.data?.email || '';
	$: expired = $page.data?.expired || false;
	$: theme = $page.data?.theme ?? null;
	$: loginLogoSrc = (theme?.loginLogoPath && theme.loginLogoPath.trim()) || (theme?.logoPath && theme.logoPath.trim()) || '/assets/onnuma-logo.png';
	
	let redirectTimer;
	
	onMount(() => {
		// Auto-redirect to login after 5 seconds if successful
		if (status === 'success' || status === 'already_verified') {
			redirectTimer = setTimeout(() => {
				goto('/hub/auth/login?verified=true');
			}, 5000);
		}
		
		return () => {
			if (redirectTimer) {
				clearTimeout(redirectTimer);
			}
		};
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-6">
		<div class="text-center">
			<img
				src={loginLogoSrc}
				alt="OnNuma"
				class="w-auto max-w-full max-h-[130px] object-contain mx-auto mb-4"
			/>
		</div>
		
		<div class="bg-white rounded-lg shadow-md p-6 sm:p-8">
			{#if status === 'loading'}
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-hub-green-600 mb-4"></div>
					<h2 class="text-xl font-semibold text-gray-900 mb-2">Verifying your email address...</h2>
					<p class="text-sm text-gray-600">Please wait while we verify your email.</p>
				</div>
			{:else if status === 'success'}
				<div class="text-center">
					<div class="inline-block rounded-full bg-hub-green-100 p-3 mb-4">
						<svg class="w-8 h-8 text-hub-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
						</svg>
					</div>
					<h2 class="text-xl font-semibold text-gray-900 mb-2">Email Verified Successfully!</h2>
					<p class="text-sm text-gray-600 mb-4">{message}</p>
					<p class="text-xs text-gray-500 mb-4">Use the button below to log in on this page (your organisation's Hub). If login fails, use the login link from your welcome email so you're on the correct address.</p>
					<a
						href="/hub/auth/login?verified=true"
						class="inline-block bg-hub-green-600 text-white px-6 py-2 rounded-md hover:bg-hub-green-700 transition-colors font-medium"
					>
						Continue to Login
					</a>
					<p class="text-xs text-gray-500 mt-4">You will be redirected automatically in a few seconds...</p>
				</div>
			{:else if status === 'already_verified'}
				<div class="text-center">
					<div class="inline-block rounded-full bg-hub-blue-100 p-3 mb-4">
						<svg class="w-8 h-8 text-hub-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
					</div>
					<h2 class="text-xl font-semibold text-gray-900 mb-2">Already Verified</h2>
					<p class="text-sm text-gray-600 mb-6">{message}</p>
					<a
						href="/hub/auth/login"
						class="inline-block bg-hub-green-600 text-white px-6 py-2 rounded-md hover:bg-hub-green-700 transition-colors font-medium"
					>
						Go to Login
					</a>
					<p class="text-xs text-gray-500 mt-4">You will be redirected automatically in a few seconds...</p>
				</div>
			{:else}
				<div class="text-center">
					<div class="inline-block rounded-full bg-hub-red-100 p-3 mb-4">
						<svg class="w-8 h-8 text-hub-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
						</svg>
					</div>
					<h2 class="text-xl font-semibold text-gray-900 mb-2">Verification Failed</h2>
					<p class="text-sm text-gray-600 mb-6">{message}</p>
					
					{#if expired || email}
						<div class="mt-6 space-y-3">
							<a
								href="/hub/auth/resend-verification?email={encodeURIComponent(email)}"
								class="block w-full bg-theme-button-1 text-white px-6 py-2 rounded-md hover:opacity-90 transition-colors font-medium text-center"
							>
								Request New Verification Email
							</a>
							<a
								href="/hub/auth/login"
								class="block w-full text-hub-blue-600 hover:text-hub-blue-700 text-sm font-medium text-center"
							>
								Back to Login
							</a>
						</div>
					{:else}
						<a
							href="/hub/auth/login"
							class="inline-block bg-hub-green-600 text-white px-6 py-2 rounded-md hover:bg-hub-green-700 transition-colors font-medium"
						>
							Back to Login
						</a>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

