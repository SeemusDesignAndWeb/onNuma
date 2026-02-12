<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	
	let error = '';
	let success = '';
	
	$: if ($page.form?.error) {
		error = $page.form.error;
		success = '';
	}
	
	$: if ($page.form?.success) {
		success = $page.form.message || 'Verification email has been sent.';
		error = '';
	}
	
	$: email = $page.data?.email || '';
	$: theme = $page.data?.theme ?? null;
	$: loginLogoSrc = (theme?.loginLogoPath && theme.loginLogoPath.trim()) || (theme?.logoPath && theme.logoPath.trim()) || '/assets/onnuma-logo.png';
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-6 sm:space-y-8">
		<div class="text-center">
			<img
				src={loginLogoSrc}
				alt="Eltham Green Community Church"
				class="w-auto max-w-full max-h-[130px] object-contain mx-auto mb-4"
			/>
			<h2 class="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
				Resend Verification Email
			</h2>
			<p class="mt-2 text-center text-xs sm:text-sm text-gray-600">
				Enter your email address to receive a new verification link
			</p>
		</div>
		
		<form method="POST" action="?/resend" use:enhance>
			<input type="hidden" name="_csrf" value={$page.data?.csrfToken || ''} />
			
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700 mb-1">
					Email address
				</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					value={email}
					class="appearance-none relative block w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-theme-button-2 focus:border-hub-green-600"
					placeholder="your.email@example.com"
				/>
			</div>

			{#if success}
				<div class="mt-4 p-3 rounded-md text-sm bg-hub-green-50 text-hub-green-800 border border-hub-green-200">
					{success}
				</div>
			{/if}
			
			{#if error}
				<div class="mt-4 p-3 rounded-md text-sm bg-hub-red-50 text-hub-red-800 border border-hub-red-200">
					{error}
				</div>
			{/if}

			<div class="mt-6">
				<button
					type="submit"
					class="group relative w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-hub-green-600 hover:bg-hub-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-button-2"
				>
					Send Verification Email
				</button>
			</div>

			<div class="mt-4 text-center">
				<a href="/hub/auth/login" class="text-xs sm:text-sm font-medium text-hub-blue-600 hover:text-hub-blue-600/80">
					Back to login
				</a>
			</div>
		</form>
	</div>
</div>
