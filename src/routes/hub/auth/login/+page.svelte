<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	
	let error = '';
	let unverifiedEmail = '';
	let showPrivacyModal = false;
	let privacyPolicyHtml = '';
	let isLoadingPrivacy = false;
	let submitting = false;
	
	$: if ($page.form?.error) {
		if ($page.form.error === 'EMAIL_NOT_VERIFIED') {
			error = 'Please verify your email address before logging in. Check your inbox for the verification link.';
			unverifiedEmail = $page.form.email || '';
		} else {
			error = $page.form.error;
			unverifiedEmail = '';
		}
	}
	
	$: message = $page.data?.message;

	async function openPrivacyModal() {
		showPrivacyModal = true;
		if (!privacyPolicyHtml && !isLoadingPrivacy) {
			isLoadingPrivacy = true;
			try {
				const response = await fetch('/hub/privacy/api');
				const data = await response.json();
				privacyPolicyHtml = data.html || '<p>Unable to load privacy policy content.</p>';
			} catch (err) {
				console.error('Error loading privacy policy:', err);
				privacyPolicyHtml = '<p>Unable to load privacy policy content.</p>';
			} finally {
				isLoadingPrivacy = false;
			}
		}
	}

	function closePrivacyModal() {
		showPrivacyModal = false;
	}

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			closePrivacyModal();
		}
	}

	function handleEscapeKey(event) {
		if (event.key === 'Escape' && showPrivacyModal) {
			closePrivacyModal();
		}
	}

	$: orgFromDomain = $page.data?.hubOrganisationFromDomain;
	$: currentOrganisation = $page.data?.currentOrganisation ?? null;
	$: theme = $page.data?.theme ?? null;
	// Organisation name: from custom domain (hub.egcc.co.uk) or from Hub's current organisation, never hardcoded
	$: organisationName = orgFromDomain?.name ?? currentOrganisation?.name ?? 'The HUB';
	$: loginLogoSrc = (theme?.loginLogoPath && theme.loginLogoPath.trim()) || (theme?.logoPath && theme.logoPath.trim()) || '/images/onnuma-logo.png';

	onMount(() => {
		document.addEventListener('keydown', handleEscapeKey);
		return () => {
			document.removeEventListener('keydown', handleEscapeKey);
		};
	});
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8 sm:py-12 sm:px-6 lg:px-8">
	<div class="max-w-md w-full space-y-6 sm:space-y-8">
		<div class="text-center">
			<img
				src={loginLogoSrc}
				alt={organisationName}
				class="w-auto max-w-full max-h-[130px] object-contain mx-auto mb-4"
			/>
			<h2 class="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
				Welcome aboard theHub
			</h2>
			<p class="mt-2 text-center text-xs sm:text-sm text-gray-600">
				{organisationName}
			</p>
		</div>
		<form
			method="POST"
			action="?/login"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}}
		>
			<input type="hidden" name="_csrf" value={$page.data?.csrfToken || ''} />
			<div class="rounded-md shadow-sm -space-y-px">
				<div>
					<label for="email" class="sr-only">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						class="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-theme-button-2 focus:border-hub-green-600 focus:z-10"
						placeholder="Email address"
					/>
				</div>
				<div>
					<label for="password" class="sr-only">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						class="appearance-none rounded-none relative block w-full px-3 py-2.5 sm:py-2 text-base sm:text-sm border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-theme-button-2 focus:border-hub-green-600 focus:z-10"
						placeholder="Password"
					/>
				</div>
			</div>

			{#if message}
				<div class="mt-4 p-3 rounded-md text-sm {message.type === 'success' ? 'bg-hub-green-50 text-hub-green-800 border border-hub-green-200' : 'bg-hub-red-50 text-hub-red-800 border border-hub-red-200'}">
					{message.text}
					{#if message.type === 'error' && (message.text.includes('verification') || message.text.includes('verify'))}
						<div class="mt-2">
							<a href="/hub/auth/resend-verification" class="text-hub-blue-600 hover:text-hub-blue-600/80 underline text-sm font-medium">
								Resend verification email
							</a>
						</div>
					{/if}
				</div>
			{/if}
			
			{#if error}
				<div class="mt-4 p-3 rounded-md text-sm bg-hub-red-50 text-hub-red-800 border border-hub-red-200">
					{error}
					{#if unverifiedEmail}
						<div class="mt-2">
							<a href="/hub/auth/resend-verification?email={encodeURIComponent(unverifiedEmail)}" class="text-hub-blue-600 hover:text-hub-blue-600/80 underline text-sm font-medium">
								Resend verification email
							</a>
						</div>
					{/if}
				</div>
			{/if}

			<div class="mt-4 text-center text-xs sm:text-sm text-gray-600 px-2">
				By signing in you agree to abide by the <button type="button" on:click={openPrivacyModal} class="text-hub-blue-600 hover:text-hub-blue-600/80 underline break-words bg-transparent border-0 p-0 cursor-pointer">privacy policy</button>.
			</div>

			{#if submitting}
				<div class="mt-4 p-3 rounded-md text-sm bg-hub-green-50 text-hub-green-800 border border-hub-green-200 flex items-center justify-center gap-2">
					<svg class="animate-spin h-4 w-4 text-hub-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					<span>Logging in securely…</span>
				</div>
			{/if}
			<div class="mt-6">
				<button
					type="submit"
					disabled={submitting}
					class="group relative w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-hub-green-600 hover:bg-hub-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-theme-button-2 disabled:opacity-70 disabled:cursor-not-allowed"
				>
					Sign in
				</button>
			</div>

			<div class="mt-4 text-center">
				<a href="/hub/auth/forgot-password" class="text-xs sm:text-sm font-medium text-hub-blue-600 hover:text-hub-blue-600/80">
					Forgot password?
				</a>
			</div>
		</form>
	</div>
</div>

<!-- Privacy Policy Modal -->
{#if showPrivacyModal}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
		on:click={handleBackdropClick}
		on:keydown={handleEscapeKey}
		role="dialog"
		aria-modal="true"
		aria-labelledby="privacy-modal-title"
	>
		<div
			class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
			on:click|stopPropagation
		>
			<!-- Header -->
			<div class="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
				<h2 id="privacy-modal-title" class="text-2xl font-bold text-gray-900">Privacy Policy</h2>
				<button
					type="button"
					on:click={closePrivacyModal}
					class="text-gray-400 hover:text-gray-600 transition-colors"
					aria-label="Close privacy policy"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			
			<!-- Scrollable Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if isLoadingPrivacy}
					<div class="text-center py-8">
						<p class="text-gray-600">Loading privacy policy...</p>
					</div>
				{:else}
					<div class="prose prose-lg max-w-none">
						{@html privacyPolicyHtml}
					</div>
				{/if}
			</div>
			
			<!-- Footer -->
			<div class="border-t border-gray-200 p-6 flex-shrink-0">
				<button
					type="button"
					on:click={closePrivacyModal}
					class="w-full sm:w-auto px-6 py-2 bg-hub-green-600 text-white rounded-md hover:bg-hub-green-700 transition-colors"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.prose) {
		color: #374151;
	}

	:global(.prose h1) {
		color: #1f2937;
		font-size: 2.25em;
		font-weight: 700;
		margin-top: 0;
		margin-bottom: 0.75em;
		border-bottom: 2px solid #e5e7eb;
		padding-bottom: 0.5em;
	}

	:global(.prose h2) {
		color: #1f2937;
		font-size: 1.875em;
		font-weight: 600;
		margin-top: 2em;
		margin-bottom: 1em;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 0.3em;
	}

	:global(.prose h3) {
		color: #374151;
		font-size: 1.5em;
		font-weight: 600;
		margin-top: 1.5em;
		margin-bottom: 0.75em;
	}

	:global(.prose h4) {
		color: #4b5563;
		font-size: 1.25em;
		font-weight: 600;
		margin-top: 1.25em;
		margin-bottom: 0.5em;
	}

	:global(.prose p) {
		margin-bottom: 1em;
		margin-top: 1em;
		line-height: 1.75;
		font-size: 1em;
	}

	:global(.prose p:first-child) {
		margin-top: 0;
	}

	:global(.prose p:last-child) {
		margin-bottom: 0;
	}

	:global(.prose h1 + p, .prose h2 + p, .prose h3 + p, .prose h4 + p) {
		margin-top: 0.5em;
	}

	:global(.prose p + ul, .prose p + ol) {
		margin-top: 0.5em;
	}

	:global(.prose ul + p, .prose ol + p) {
		margin-top: 1em;
	}

	:global(.prose ul, .prose ol) {
		margin-bottom: 1em;
		margin-top: 1em;
		padding-left: 1.625em;
		list-style-type: disc;
	}

	:global(.prose ol) {
		list-style-type: decimal;
	}

	:global(.prose li) {
		margin-bottom: 0.5em;
		line-height: 1.75;
		display: list-item;
		font-size: 1em;
	}

	:global(.prose strong) {
		color: #1f2937;
		font-weight: 600;
	}

	:global(.prose em) {
		font-style: italic;
	}

	:global(.prose a) {
		color: #2563eb;
		text-decoration: underline;
	}

	:global(.prose a:hover) {
		color: #1d4ed8;
	}

	:global(.prose code) {
		background-color: #f3f4f6;
		padding: 0.125em 0.375em;
		border-radius: 0.25em;
		font-size: 0.875em;
		font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
	}

	:global(.prose hr) {
		border: none;
		border-top: 1px solid #e5e7eb;
		margin: 2em 0;
	}

	:global(.prose blockquote) {
		border-left: 4px solid #3b82f6;
		padding-left: 1em;
		margin-left: 0;
		color: #6b7280;
		font-style: italic;
	}
</style>

