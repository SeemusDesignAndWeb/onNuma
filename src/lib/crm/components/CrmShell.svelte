<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import HubSidebar from './HubSidebar.svelte';
	import { hubSidebarCollapsed, HUB_SIDEBAR_COLLAPSED_KEY } from '$lib/crm/stores/sidebar.js';

	export let admin = null;
	/** @type {{ logoPath?: string; primaryColor?: string; brandColor?: string } | null} */
	export let theme = null;
	export let superAdminEmail = null;
	export let organisationAreaPermissions = null;
	export let sundayPlannersLabel = 'Meeting Planners';
	export let showBilling = false;
	export let showBillingPortal = false;
	/** For multi-org: list of { id, name }; empty = single org (no switcher). */
	export let organisations = [];
	export let currentOrganisation = null;

	$: isAuthPage = $page.url.pathname.startsWith('/hub/auth/');

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
			const stored = localStorage.getItem(HUB_SIDEBAR_COLLAPSED_KEY);
			if (stored !== null) hubSidebarCollapsed.set(stored === 'true');
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
		<!-- Mobile: column (header on top, main full width). Desktop: row (sidebar | main). Sidebar fixed full height on desktop. -->
		<div class="crm-shell-desktop flex flex-col lg:flex-row flex-1 min-h-0 overflow-x-hidden {$hubSidebarCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[16rem]'}">
			<div class="hidden lg:block crm-shell-sidebar-wrap crm-shell-sidebar-fixed" class:crm-shell-sidebar-fixed--collapsed={$hubSidebarCollapsed}>
				<HubSidebar
					{admin}
					{theme}
					{superAdminEmail}
					{organisationAreaPermissions}
					{sundayPlannersLabel}
					{showBilling}
					organisations={organisations || []}
					currentOrganisation={currentOrganisation}
				/>
			</div>

			<!-- Mobile: top bar full width when in column (same blue as sidebar) -->
			<div class="lg:hidden crm-shell-mobile-header sticky top-0 z-10 flex-shrink-0 safe-area-top w-full">
				<div class="crm-shell-mobile-header-inner relative flex items-center min-h-14 h-14 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
					<div class="flex items-center w-12 flex-shrink-0">
						<button
							type="button"
							class="crm-mobile-menu-btn flex items-center justify-center min-w-12 min-h-12 -ml-1 rounded-lg text-[#94a3b8] hover:bg-[#334155] hover:text-[#f1f5f9] touch-manipulation transition-colors"
							aria-label="Open menu"
							on:click={() => (mobileSidebarOpen = true)}
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
							</svg>
						</button>
					</div>
					<div class="absolute left-0 right-0 flex justify-center items-center pointer-events-none">
						<a href="/hub" class="crm-mobile-brand flex items-center gap-2 pointer-events-auto text-white hover:opacity-90 font-bold" aria-label="TheHUB home">
							<img
								src={theme?.logoPath?.trim() || '/assets/OnNuma-Icon.png'}
								alt=""
								class="h-8 w-auto"
								width="32"
								height="32"
							/>
							<span class="text-lg font-bold">TheHUB</span>
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
					<HubSidebar
						{admin}
						{theme}
						{superAdminEmail}
						{organisationAreaPermissions}
						{sundayPlannersLabel}
						{showBilling}
						organisations={organisations || []}
						currentOrganisation={currentOrganisation}
						onClose={closeMobileSidebar}
					/>
				</div>
			{/if}

			<!-- Main content area: full width on mobile (column), min-w-0 + overflow-x-hidden -->
			<main class="crm-shell-main flex-1 flex flex-col min-w-0 w-full overflow-x-hidden">
				<slot name="top" />
				<div class="flex-1 min-w-0 max-w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
					<slot />
				</div>
			</main>
		</div>

		<footer class="crm-shell-footer flex-shrink-0 w-full bg-white border-t border-gray-200 {$hubSidebarCollapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-[16rem]'}">
			<div class="max-w-7xl mx-auto px-4 py-6">
				<div class="flex flex-col md:flex-row justify-center md:justify-between items-center gap-4">
					<a href="/" class="flex items-center flex-shrink-0" aria-label="OnNuma home">
						<img src="/assets/onnuma-logo.png" alt="OnNuma" class="h-8 w-auto" />
					</a>
					{#if currentOrganisation?.name}
						<p class="text-sm font-light text-gray-500 md:flex-1 md:text-center">
							{currentOrganisation.name}
						</p>
					{/if}
					<div class="text-sm text-gray-500 flex flex-wrap justify-center gap-2 md:gap-4 flex-shrink-0">
						<a href="/hub/privacy" class="text-gray-600 hover:text-theme-button-1 transition-colors">Privacy Policy</a>
						<a href="https://www.onnuma.com" class="text-theme-button-1 hover:opacity-80 transition-colors" target="_blank" rel="noopener noreferrer">Visit Website</a>
					</div>
				</div>
			</div>
		</footer>
	{:else}
		<!-- Auth pages: center login in middle of screen -->
		<main class="flex-1 flex items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 py-8">
			<slot />
		</main>
	{/if}
</div>

<style>
	/* Desktop: sidebar fixed from top to bottom of viewport */
	@media (min-width: 1024px) {
		.crm-shell-sidebar-fixed {
			position: fixed;
			top: 0;
			left: 0;
			bottom: 0;
			width: 16rem;
			height: 100vh;
			height: 100dvh;
			z-index: 20;
			flex-shrink: 0;
			display: flex;
			flex-direction: column;
			transition: width 0.25s ease;
		}
		.crm-shell-sidebar-fixed.crm-shell-sidebar-fixed--collapsed {
			width: 4.5rem;
		}
	}
	.crm-shell-main {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.safe-area-top {
		padding-top: env(safe-area-inset-top, 0);
	}
	/* Mobile top bar: same blue as hub sidebar */
	.crm-shell-mobile-header-inner {
		background: linear-gradient(180deg, #1e3a5f 0%, #1e293b 100%);
		border-bottom: 1px solid #334155;
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
	/* Shift logo+text left by half the icon (and gap) so the text "TheHUB" sits in the true center */
	.crm-mobile-brand {
		transform: translateX(calc(-1 * (2rem + 0.5rem) / 2));
	}
</style>
