<script>
	import { page } from '$app/stores';
	import { invalidateAll, goto } from '$app/navigation';
	import MySidebar from './MySidebar.svelte';

	export let data = {};
	$: member = data?.member ?? null;
	$: theme = data?.theme ?? null;
	$: csrfToken = data?.csrfToken ?? '';
	$: path = $page.url.pathname;
	$: logoPath = theme?.logoPath?.trim() || '/assets/OnNuma-Icon.png';
	$: loginBgLogoUrl = logoPath ? `url(${logoPath})` : 'none';

	let mobileMenuOpen = false;
	let loginName = '';
	let loginEmail = '';
	let loginError = '';
	let loginSubmitting = false;

	async function handleLoginSubmit(e) {
		e.preventDefault();
		loginError = '';
		if (!loginName.trim() || !loginEmail.trim()) {
			loginError = 'Name and email are required.';
			return;
		}
		loginSubmitting = true;
		try {
			const formData = new FormData();
			formData.set('name', loginName.trim());
			formData.set('email', loginEmail.trim());
			formData.set('_csrf', csrfToken);
			const res = await fetch('/myhub/login', {
				method: 'POST',
				body: formData,
				credentials: 'same-origin'
			});
			if (res.ok) {
				const body = await res.json().catch(() => ({}));
				await invalidateAll();
				goto(body.redirectTo || '/myhub');
				return;
			}
			const body = await res.json().catch(() => ({}));
			loginError = body.error || 'Something went wrong. Please try again.';
		} catch (err) {
			loginError = 'Something went wrong. Please try again.';
		} finally {
			loginSubmitting = false;
		}
	}
</script>

<div class="my-layout min-h-screen bg-[#f5f5f7]">
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
				<a href="/myhub" class="my-login-screen-logo flex items-center gap-2 mb-8" aria-label="myHub home">
					<img src={logoPath} alt="" class="h-12 w-12 object-contain" width="48" height="48" />
					<span class="text-xl font-bold text-white drop-shadow-sm">myHub</span>
				</a>
				<div class="my-login-card w-full max-w-sm rounded-2xl bg-white shadow-xl border border-gray-200/80 p-6">
				<h1 class="text-lg font-semibold text-gray-900 mb-1">Sign in</h1>
				<p class="text-gray-600 text-sm mb-6">Enter your name and email to access your volunteering.</p>
				<form on:submit={handleLoginSubmit} class="space-y-4">
					<input type="hidden" name="_csrf" value={csrfToken} />
					<div>
						<label for="my-login-name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
						<input
							id="my-login-name"
							type="text"
							autocomplete="name"
							bind:value={loginName}
							class="my-login-input w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#4A97D2] focus:ring-2 focus:ring-[#4A97D2]/20"
							placeholder="Your full name"
							required
						/>
					</div>
					<div>
						<label for="my-login-email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
						<input
							id="my-login-email"
							type="email"
							autocomplete="email"
							bind:value={loginEmail}
							class="my-login-input w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-[#4A97D2] focus:ring-2 focus:ring-[#4A97D2]/20"
							placeholder="you@example.com"
							required
						/>
					</div>
					{#if loginError}
						<p class="text-sm text-red-600" role="alert">{loginError}</p>
					{/if}
					<button
						type="submit"
						disabled={loginSubmitting}
						class="my-login-btn w-full rounded-xl text-white font-medium py-3 px-4 disabled:opacity-50 disabled:pointer-events-none transition-colors"
					>
						{loginSubmitting ? 'Signing in…' : 'Sign in'}
					</button>
				</form>
				</div>
			</div>
		</div>
	{:else}
		<!-- Desktop: sidebar + main -->
		<div class="my-layout-desktop flex min-h-screen">
			<div class="hidden lg:block my-sidebar-wrap min-h-screen flex-shrink-0">
				<MySidebar {theme} />
			</div>

			<!-- Mobile: top bar with menu -->
			<div class="lg:hidden my-mobile-header flex-shrink-0 sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
				<div class="flex items-center justify-between gap-4 px-4 py-3 min-h-[56px]">
					<button
						type="button"
						class="p-3 -ml-2 rounded-xl text-gray-600 hover:bg-gray-100 min-h-[48px] min-w-[48px] flex items-center justify-center"
						aria-label="Open menu"
						on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>
					<a href="/myhub" class="flex items-center gap-2 shrink-0" aria-label="myHub volunteering home">
						<img src={logoPath} alt="" class="h-8 w-8 object-contain" width="32" height="32" />
						<span class="text-lg font-bold text-gray-900 hover:text-gray-700">myHub</span>
					</a>
					<div class="w-12" aria-hidden="true"></div>
				</div>
				{#if mobileMenuOpen}
					<div class="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
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

			<main class="my-main flex-1 min-w-0">
				<div class="my-main-inner">
					<slot />
				</div>
			</main>
		</div>
	{/if}
</div>

<style>
	/* Over 60s: readable base size, generous spacing */
	.my-layout {
		font-size: 1.0625rem; /* 17px base */
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
	/* Blue headings in main content */
	.my-main h1,
	.my-main h2 {
		color: #0284c7 !important;
	}
	.my-main-inner {
		max-width: 42rem;
		margin-left: auto;
		margin-right: auto;
		padding: 1.5rem 1.25rem 2rem;
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
		color: #374151;
		text-decoration: none;
	}
	.my-mobile-nav-link:hover {
		background: #e5e7eb;
		color: #111827;
	}
	.my-mobile-nav-link.active {
		background: #1f2937;
		color: #fff;
	}
	.my-login-btn {
		background: #4A97D2;
	}
	.my-login-btn:hover:not(:disabled) {
		background: #3d82b8;
	}
</style>
