<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import MultiOrgSidebar from './MultiOrgSidebar.svelte';
	import { multiOrgSidebarCollapsed, MULTI_ORG_SIDEBAR_COLLAPSED_KEY } from '$lib/crm/stores/sidebar.js';

	export let base = '/multi-org';

	$: isAuthPage = $page.url.pathname.startsWith('/multi-org/auth/') || $page.url.pathname === '/auth/login' || $page.url.pathname === '/auth/forgot-password' || $page.url.pathname === '/auth/reset-password';

	let mobileSidebarOpen = false;
	let prevPath = '';

	$: if ($page.url.pathname !== prevPath) {
		prevPath = $page.url.pathname;
		mobileSidebarOpen = false;
	}

	function closeMobileSidebar() {
		mobileSidebarOpen = false;
	}

	onMount(() => {
		try {
			const stored = localStorage.getItem(MULTI_ORG_SIDEBAR_COLLAPSED_KEY);
			if (stored !== null) multiOrgSidebarCollapsed.set(stored === 'true');
		} catch (_) {}
		function handleResize() {
			if (window.innerWidth >= 1024) mobileSidebarOpen = false;
		}
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>

<div class="crm-shell min-h-screen bg-theme-panel flex flex-col">
	{#if !isAuthPage}
		<!-- Mobile: column (header on top, main full width). Desktop: fixed sidebar full height, then main + footer with pl. -->
		<div class="crm-shell-desktop flex flex-col lg:flex-row flex-1 min-h-0 overflow-x-hidden {$multiOrgSidebarCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[16rem]'}">
			<div class="hidden lg:block crm-shell-sidebar-wrap crm-shell-multiorg-sidebar-fixed" class:crm-shell-multiorg-sidebar-fixed--collapsed={$multiOrgSidebarCollapsed}>
				<MultiOrgSidebar {base} />
			</div>

			<!-- Mobile: fixed top bar so it does not move when scrolling -->
			<div class="lg:hidden crm-shell-mobile-header fixed top-0 left-0 right-0 z-20 safe-area-top w-full">
				<div class="crm-shell-mobile-header-inner flex items-center min-h-14 h-14 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
					<div class="flex items-center flex-shrink-0 w-12">
						<button
							type="button"
							class="multi-org-mobile-menu-btn flex items-center justify-center min-w-12 min-h-12 -ml-1 rounded-xl text-white hover:bg-[#6b5344] touch-manipulation transition-colors"
							aria-label="Open menu"
							on:click={() => (mobileSidebarOpen = true)}
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
							</svg>
						</button>
					</div>
					<div class="absolute left-0 right-0 flex justify-center items-center pointer-events-none">
						<a href="{base}/organisations" class="multi-org-mobile-brand flex items-center gap-2 pointer-events-auto text-white hover:opacity-90 font-bold no-underline" aria-label="OnNuma Admin">
							<img src="/assets/OnNuma-Icon.png" alt="" class="h-8 w-auto" width="32" height="32" />
							<span class="text-lg font-bold">OnNuma</span>
						</a>
					</div>
					<div class="w-12 flex-shrink-0" aria-hidden="true"></div>
				</div>
			</div>

			{#if mobileSidebarOpen}
				<button
					type="button"
					class="lg:hidden fixed inset-0 z-30 bg-black/50"
					aria-label="Close menu"
					on:click={closeMobileSidebar}
				></button>
				<div class="lg:hidden fixed inset-y-0 left-0 z-40 w-[16rem] max-w-[85vw] shadow-xl crm-shell-mobile-drawer safe-area-left">
					<MultiOrgSidebar {base} onClose={closeMobileSidebar} />
				</div>
			{/if}

			<main class="crm-shell-main flex-1 flex flex-col min-w-0 w-full overflow-x-hidden crm-shell-main-mobile-pt" class:crm-shell-main--sidebar-collapsed={$multiOrgSidebarCollapsed}>
				<div class="crm-shell-main-inner flex-1 min-w-0 max-w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
					<slot />
				</div>
			</main>
		</div>

		<footer class="crm-shell-footer flex-shrink-0 w-full bg-white border-t border-gray-200 {$multiOrgSidebarCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[16rem]'}">
			<div class="crm-shell-footer-inner max-w-7xl mx-auto px-4 py-6" class:crm-shell-footer-inner--full-width={$multiOrgSidebarCollapsed}>
				<div class="flex flex-col md:flex-row justify-center md:justify-between items-center gap-4">
					<a href="/" class="flex items-center" aria-label="OnNuma home">
						<img src="/assets/onnuma-logo.png" alt="OnNuma" class="h-8 w-auto" />
					</a>
					<div class="text-sm text-gray-500 flex flex-wrap justify-center gap-2 md:gap-4">
						<a href="/hub/privacy" class="text-gray-600 hover:text-theme-button-1 transition-colors">Privacy Policy</a>
						<a href="https://www.onnuma.com" class="text-theme-button-1 hover:opacity-80 transition-colors" target="_blank" rel="noopener noreferrer">Visit Website</a>
					</div>
				</div>
			</div>
		</footer>
	{:else}
		<main class="flex-1 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-8">
			<slot />
		</main>
	{/if}
</div>

<style>
	/* Desktop: multiorg sidebar fixed from top to bottom of viewport */
	@media (min-width: 1024px) {
		.crm-shell-multiorg-sidebar-fixed {
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			width: 16rem;
			height: 100vh;
			height: 100dvh;
			z-index: 20;
			display: flex;
			flex-direction: column;
		}
		.crm-shell-multiorg-sidebar-fixed.crm-shell-multiorg-sidebar-fixed--collapsed {
			width: 4.5rem;
		}
	}
	.crm-shell-main {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	/* Wide screens with collapsed sidebar: main content and footer use full available width */
	@media (min-width: 1024px) {
		.crm-shell-main.crm-shell-main--sidebar-collapsed .crm-shell-main-inner {
			max-width: none;
			width: 100%;
		}
		.crm-shell-footer-inner.crm-shell-footer-inner--full-width {
			max-width: none;
		}
	}
	.safe-area-top {
		padding-top: env(safe-area-inset-top, 0);
	}
	.safe-area-left {
		padding-left: env(safe-area-inset-left, 0);
	}
	.crm-shell-mobile-drawer {
		display: flex;
		flex-direction: column;
		height: 100%;
		height: 100dvh;
		max-height: 100dvh;
		overflow: hidden;
	}
	/* Mobile header: same warm gradient as multiorg sidebar */
	.crm-shell-mobile-header-inner {
		background: linear-gradient(180deg, #5c4033 0%, #4a3728 100%);
		border-bottom: 1px solid #6b5344;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
	}
	.multi-org-mobile-brand {
		transform: translateX(calc(-1 * (2rem + 0.5rem) / 2));
	}
	/* Mobile: reserve space for fixed navbar so content is not hidden */
	@media (max-width: 1023px) {
		.crm-shell-main-mobile-pt {
			padding-top: calc(3.5rem + env(safe-area-inset-top, 0));
		}
	}
</style>
