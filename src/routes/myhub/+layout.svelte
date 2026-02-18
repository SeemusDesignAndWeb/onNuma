<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import MySidebar from './MySidebar.svelte';

	export let data = {};
	$: member = data?.member ?? null;
	$: theme = data?.theme ?? null;
	$: csrfToken = data?.csrfToken ?? '';
	$: path = $page.url.pathname;
	$: logoPath = theme?.logoPath?.trim() || '/assets/OnNuma-Icon.png';
	$: loginBgLogoUrl = logoPath ? `url(${logoPath})` : 'none';

	let mobileMenuOpen = false;
	let prevPath = '';
	$: if (path !== prevPath) {
		prevPath = path;
		mobileMenuOpen = false;
	}

	let largeText = false;
	function toggleTextSize() {
		largeText = !largeText;
		try { localStorage.setItem('myhub-large-text', largeText ? '1' : '0'); } catch (_) {}
	}

	onMount(() => {
		try { largeText = localStorage.getItem('myhub-large-text') === '1'; } catch (_) {}
		function handleResize() {
			if (window.innerWidth >= 1024) mobileMenuOpen = false;
		}
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
	let loginEmail = '';
	let loginError = '';
	let loginSubmitting = false;
	let linkSent = false;

	$: linkExpired = !member && $page.url.searchParams.get('error') === 'link-expired';

	// Pre-fill email from ?email= query param (e.g. from a coordinator invite link).
	onMount(() => {
		const emailParam = $page.url.searchParams.get('email') || '';
		if (emailParam && !loginEmail) loginEmail = emailParam;
	});

	async function handleSendLink(e) {
		e.preventDefault();
		loginError = '';
		if (!loginEmail.trim()) {
			loginError = 'Please enter your email address.';
			return;
		}
		loginSubmitting = true;
		try {
			const formData = new FormData();
			formData.set('email', loginEmail.trim());
			formData.set('_csrf', csrfToken);
			await fetch('/myhub/login', {
				method: 'POST',
				body: formData,
				credentials: 'same-origin'
			});
			// Always show "check your email" — server never reveals whether address exists.
			linkSent = true;
		} catch {
			loginError = 'Something went wrong. Please try again.';
		} finally {
			loginSubmitting = false;
		}
	}
</script>

<div class="my-layout my-layout-theme min-h-screen" class:my-large-text={largeText}>
	{#if !member}
		<!-- Login gate: hero background image (same as front-end site top hero) -->
		<div class="my-login-screen">
			<!-- Full-screen background image + overlay -->
			<div class="absolute inset-0">
				<img
					src="/assets/hero-people.png"
					alt=""
					class="w-full h-full object-cover"
					fetchpriority="high"
					width="1920"
					height="1080"
					decoding="async"
				/>
				<div class="absolute inset-0 bg-slate-900/55" aria-hidden="true"></div>
			</div>
			<!-- Optional org logo watermark when set -->
			{#if loginBgLogoUrl !== 'none'}
				<div
					class="my-login-screen-watermark"
					style="background-image: {loginBgLogoUrl};"
					aria-hidden="true"
				></div>
			{/if}
			<!-- Content -->
			<div class="my-login-screen-content">
				<a href="/myhub" class="my-login-screen-logo flex items-center gap-2 mb-8" aria-label="MyHUB home">
					<img src={logoPath} alt="" class="h-12 w-12 object-contain" width="48" height="48" />
					<span class="text-xl font-bold text-white drop-shadow-sm">MyHUB</span>
				</a>
				<div class="my-login-card w-full max-w-sm rounded-2xl p-6">
				{#if linkSent}
					<!-- Confirmation: link sent -->
					<div class="text-center py-2">
						<div class="my-link-sent-icon" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
							</svg>
						</div>
						<h1 class="my-link-sent-heading">Check your email</h1>
						<p class="my-link-sent-body">
							We've sent a link to <strong>{loginEmail}</strong>.
							Tap the button in that email to open your hub — no password needed.
						</p>
						<p class="my-link-sent-note">The link works for 7 days.</p>
						<button
							type="button"
							class="my-link-resend-btn"
							on:click={() => { linkSent = false; loginEmail = ''; }}
						>
							Send to a different address
						</button>
					</div>
				{:else}
					<!-- Send-link form -->
					{#if linkExpired}
						<div class="my-login-expired-notice" role="alert">
							<strong>Your link has expired.</strong>
							Enter your email below and we'll send you a fresh one.
						</div>
					{/if}
					<h1 class="my-login-heading">Welcome to your hub</h1>
					<p class="my-login-sub">Enter your email and we'll send you a link to get in — no password needed.</p>
					<form on:submit={handleSendLink} class="space-y-4">
						<input type="hidden" name="_csrf" value={csrfToken} />
						<div>
							<label for="my-login-email" class="block font-medium text-gray-700 mb-1">Your email address</label>
							<input
								id="my-login-email"
								type="email"
								autocomplete="email"
								bind:value={loginEmail}
								class="my-login-input w-full rounded-xl border px-4 py-3 text-gray-900 placeholder-gray-400"
								placeholder="you@example.com"
								required
							/>
						</div>
						{#if loginError}
							<p class="text-red-600 font-medium" role="alert">{loginError}</p>
						{/if}
						<button
							type="submit"
							disabled={loginSubmitting}
							class="my-login-btn w-full rounded-xl text-white font-bold py-4 px-4 disabled:opacity-50 disabled:pointer-events-none transition-colors"
						>
							{loginSubmitting ? 'Sending…' : 'Send me a link'}
						</button>
					</form>
				{/if}
				</div>
				<footer class="my-login-footer">
					<a href="/hub/privacy" class="my-login-footer-link">
						<svg class="my-login-footer-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
						</svg>
						Click to read how we use your information
					</a>
				</footer>
			</div>
		</div>
	{:else}
		<!-- Mobile: column (header on top, main full width below). Desktop: row (sidebar | main). -->
		<div class="my-layout-desktop flex flex-col lg:flex-row min-h-screen overflow-x-hidden">
			<div class="hidden lg:block my-sidebar-wrap min-h-screen flex-shrink-0">
				<MySidebar {theme} />
			</div>

			<!-- Mobile: top bar with menu (safe-area for notched devices), full width when in column -->
			<div class="lg:hidden my-mobile-header flex-shrink-0 sticky top-0 z-20 my-mobile-header-safe w-full">
				<div class="flex items-center justify-between gap-4 py-3 min-h-[56px] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
					<button
						type="button"
						class="my-mobile-menu-btn p-3 -ml-2 rounded-xl min-h-[48px] flex items-center justify-center"
						aria-label="Menu"
						on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
					>
						<span class="text-base font-semibold">Menu</span>
					</button>
					<a href="/myhub" class="my-mobile-logo flex items-center gap-2 shrink-0" aria-label="MyHUB volunteering home">
						<img src={logoPath} alt="" class="h-8 w-8 object-contain" width="32" height="32" />
						<span class="text-lg font-bold">MyHUB</span>
					</a>
					<div class="w-12" aria-hidden="true"></div>
				</div>
				{#if mobileMenuOpen}
					<div class="my-mobile-nav-dropdown px-4 pb-4 pt-2 border-t">
						<nav class="flex flex-col gap-1" aria-label="Main">
							<a href="/myhub" class="my-mobile-nav-link" class:active={path === '/myhub'} on:click={() => (mobileMenuOpen = false)}>Overview</a>
							<a href="/myhub/rotas" class="my-mobile-nav-link" class:active={path === '/myhub/rotas'} on:click={() => (mobileMenuOpen = false)}>My rotas</a>
							<a href="/myhub/opportunities" class="my-mobile-nav-link" class:active={path === '/myhub/opportunities'} on:click={() => (mobileMenuOpen = false)}>Sign up</a>
							<a href="/myhub/profile" class="my-mobile-nav-link" class:active={path === '/myhub/profile'} on:click={() => (mobileMenuOpen = false)}>My details</a>
							<a href="/myhub/availability" class="my-mobile-nav-link" class:active={path === '/myhub/availability'} on:click={() => (mobileMenuOpen = false)}>Availability</a>
							<a href="/myhub/preferences" class="my-mobile-nav-link" class:active={path === '/myhub/preferences'} on:click={() => (mobileMenuOpen = false)}>Preferences</a>
							<a href="/myhub/logout" class="my-mobile-nav-link" on:click={() => (mobileMenuOpen = false)}>Sign out</a>
						</nav>
					</div>
				{/if}
			</div>

			<div class="my-main-wrap flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
				<main class="my-main flex-1 min-w-0 w-full overflow-x-hidden">
					<div class="my-main-inner" class:my-main-inner-full-width={path === '/myhub/privacy'}>
						<slot />
					</div>
				</main>
			<footer class="my-footer">
				<div class="my-footer-inner">
					<button
						type="button"
						class="my-text-size-btn"
						on:click={toggleTextSize}
						aria-pressed={largeText}
					>
						<svg class="my-text-size-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h10M4 14h7M4 18h4" />
						</svg>
						{largeText ? 'Make text smaller' : 'Make text bigger'}
					</button>
					<a href="/myhub/privacy" class="my-footer-link">
						<svg class="my-footer-link-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
						</svg>
						Click to read how we use your information
					</a>
				</div>
			</footer>
			</div>
		</div>
	{/if}
</div>

<style>
	/* MyHub colour theme */
	.my-layout-theme {
		--myhub-bg: #f0f4f8;
		--myhub-primary: #2563a8;
		--myhub-primary-hover: #1d4d82;
		--myhub-accent: #4A97D2;
		--myhub-accent-hover: #3d82b8;
		--myhub-sidebar-bg: linear-gradient(180deg, #1e4976 0%, #153050 50%, #0f2840 100%);
		--myhub-sidebar-active: #2563a8;
		--myhub-card-border: #e2e8f0;
		--myhub-card-hover: rgba(37, 99, 168, 0.08);
		background: var(--myhub-bg);
	}
	/* Accessible base size — spec minimum 18px */
	.my-layout {
		font-size: 1.125rem; /* 18px base */
	}
	/* Large-text mode — bumps to 22px across all MyHub pages */
	.my-large-text {
		font-size: 1.375rem; /* 22px */
	}
	/* Login screen: hero background image (same as front-end site) + optional org logo watermark */
	.my-login-screen {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem 1rem;
		overflow: auto;
	}
	.my-login-screen-watermark {
		position: absolute;
		inset: 0;
		background-size: 55vmax;
		background-position: center;
		background-repeat: no-repeat;
		opacity: 0.14;
		pointer-events: none;
	}
	.my-login-screen-content {
		position: relative;
		z-index: 10;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.my-login-screen-logo,
	.my-login-card {
		position: relative;
		z-index: 1;
	}
	/* Primary headings and links in main content (all MyHub pages, slotted content) */
	.my-main :global(h1),
	.my-main :global(h2) {
		color: var(--myhub-primary) !important;
	}
	.my-main :global(.my-heading) {
		color: var(--myhub-primary) !important;
	}
	.my-main :global(a.my-link) {
		color: var(--myhub-primary);
	}
	.my-main :global(a.my-link:hover) {
		color: var(--myhub-primary-hover);
	}
	.my-main :global(.my-btn-primary) {
		background: var(--myhub-accent);
	}
	.my-main :global(.my-btn-primary:hover:not(:disabled)) {
		background: var(--myhub-accent-hover);
	}
	.my-main :global(.my-card) {
		border-color: var(--myhub-card-border);
	}
	/* Login card */
	.my-login-card {
		background: #fff;
		box-shadow: 0 20px 40px rgba(15, 40, 64, 0.12);
		border: 1px solid var(--myhub-card-border);
	}
	/* Send-link form headings */
	.my-login-heading {
		font-size: 1.375rem;
		font-weight: 700;
		color: #1e293b;
		margin: 0 0 0.5rem 0;
	}
	.my-login-sub {
		color: #475569;
		margin: 0 0 1.5rem 0;
		line-height: 1.5;
	}
	/* Expired-link notice */
	.my-login-expired-notice {
		background: #fef3c7;
		border: 1px solid #f59e0b;
		border-radius: 0.75rem;
		padding: 0.875rem 1rem;
		margin-bottom: 1.25rem;
		color: #92400e;
		font-size: 1rem;
		line-height: 1.5;
	}
	/* Link-sent confirmation */
	.my-link-sent-icon {
		width: 3rem;
		height: 3rem;
		margin: 0 auto 1rem;
		color: var(--myhub-primary);
	}
	.my-link-sent-heading {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1e293b;
		margin: 0 0 0.75rem 0;
	}
	.my-link-sent-body {
		color: #334155;
		margin: 0 0 0.5rem 0;
		line-height: 1.6;
	}
	.my-link-sent-note {
		color: #64748b;
		font-size: 0.9375rem;
		margin: 0 0 1.5rem 0;
	}
	.my-link-resend-btn {
		background: none;
		border: none;
		color: var(--myhub-primary);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		padding: 0.5rem 0;
		text-decoration: underline;
	}
	.my-link-resend-btn:hover {
		color: var(--myhub-primary-hover);
	}
	/* Input */
	.my-login-input {
		border-color: var(--myhub-card-border);
		font-size: 1.125rem;
	}
	.my-login-input:focus {
		outline: none;
		border-color: var(--myhub-accent);
		box-shadow: 0 0 0 3px rgba(74, 151, 210, 0.2);
	}
	/* Mobile header – same blue as sidebar */
	.my-mobile-header {
		background: var(--myhub-sidebar-bg);
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}
	.my-mobile-menu-btn {
		color: rgba(255, 255, 255, 0.9);
	}
	.my-mobile-menu-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}
	.my-mobile-nav-dropdown {
		background: var(--myhub-bg);
		border-color: rgba(255, 255, 255, 0.1);
	}
	.my-main-inner {
		max-width: 42rem;
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		margin-left: auto;
		margin-right: auto;
		padding: 1.5rem 1.25rem 2rem;
	}
	.my-main-inner-full-width {
		max-width: none;
	}
	@media (min-width: 640px) {
		.my-main-inner {
			padding: 2rem 1.5rem 3rem;
		}
	}
	@media (min-width: 1024px) {
		.my-main-inner {
			padding: 2rem 2rem 3rem;
			margin-left: 0;
		}
	}
	.my-mobile-nav-link {
		display: block;
		padding: 0.875rem 1rem;
		min-height: 3rem;
		border-radius: 0.75rem;
		font-weight: 500;
		color: var(--myhub-primary);
		text-decoration: none;
	}
	.my-mobile-nav-link:hover {
		background: var(--myhub-card-hover);
		color: var(--myhub-primary-hover);
	}
	.my-mobile-nav-link.active {
		background: var(--myhub-primary);
		color: #fff;
	}
	.my-login-btn {
		background: var(--myhub-accent);
	}
	.my-login-btn:hover:not(:disabled) {
		background: var(--myhub-accent-hover);
	}
	.my-mobile-header-safe {
		padding-top: env(safe-area-inset-top, 0);
	}
	/* Logo on blue bar: white text */
	.my-mobile-logo {
		color: rgba(255, 255, 255, 0.95);
		text-decoration: none;
	}
	.my-mobile-logo:hover {
		color: #fff;
	}
	.my-mobile-logo img {
		filter: brightness(0) invert(1);
	}
	/* Text size toggle button */
	.my-text-size-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.625rem;
		color: #fff;
		font-size: 1rem;
		font-weight: 600;
		padding: 0.625rem 1rem;
		min-height: 3rem;
		cursor: pointer;
		transition: background 0.15s;
		margin-bottom: 0.75rem;
	}
	.my-text-size-btn:hover {
		background: rgba(255, 255, 255, 0.2);
	}
	.my-text-size-btn[aria-pressed="true"] {
		background: rgba(255, 255, 255, 0.22);
		border-color: rgba(255, 255, 255, 0.4);
	}
	.my-text-size-icon {
		width: 1.25rem;
		height: 1.25rem;
		flex-shrink: 0;
	}
	/* Footer (logged-in) – flows with content */
	.my-footer {
		background: var(--myhub-sidebar-bg);
		border-top: 1px solid rgba(255, 255, 255, 0.08);
	}
	.my-footer-inner {
		max-width: 42rem;
		width: 100%;
		margin: 0 auto;
		padding: 1.25rem 1.25rem 1.25rem;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 0;
	}
	@media (min-width: 640px) {
		.my-footer-inner {
			padding: 1rem 1.5rem 1.5rem;
		}
	}
	@media (min-width: 1024px) {
		.my-footer-inner {
			margin-left: 0;
			padding: 1rem 2rem 1.5rem;
		}
	}
	.my-footer-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		color: #fff;
		text-decoration: none;
	}
	.my-footer-link:hover {
		color: rgba(255, 255, 255, 0.9);
		text-decoration: underline;
	}
	.my-footer-link-icon {
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
	}
	/* Login screen footer */
	.my-login-footer {
		position: relative;
		z-index: 1;
		margin-top: 2rem;
		text-align: center;
	}
	.my-login-footer-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 1rem;
		font-weight: 700;
		color: #fff;
		text-decoration: none;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}
	.my-login-footer-link:hover {
		color: rgba(255, 255, 255, 0.95);
		text-decoration: underline;
	}
	.my-login-footer-icon {
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
	}

	/* =====================
	   PRINT — GLOBAL LAYOUT
	   Hide chrome; let page content render cleanly.
	   ===================== */
	@media print {
		:global(body) {
			background: #fff !important;
		}
		.my-sidebar-wrap,
		.my-mobile-header,
		.my-footer,
		.my-mobile-nav-dropdown,
		.my-text-size-btn {
			display: none !important;
		}
		.my-layout-desktop {
			display: block !important;
		}
		.my-main-wrap {
			width: 100% !important;
		}
		.my-main-inner {
			padding: 0 !important;
			max-width: none !important;
		}
	}
</style>
