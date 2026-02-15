<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import MultiOrgSidebar from './MultiOrgSidebar.svelte';

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
		function handleResize() {
			if (window.innerWidth >= 1024) mobileSidebarOpen = false;
		}
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});
</script>

<div class="crm-shell min-h-screen bg-theme-panel flex flex-col">
	{#if !isAuthPage}
		<div class="crm-shell-desktop flex flex-1 min-h-0">
			<div class="hidden lg:block crm-shell-sidebar-wrap">
				<MultiOrgSidebar {base} />
			</div>

			<div class="lg:hidden crm-shell-mobile-header flex-shrink-0">
				<div class="flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200">
					<button
						type="button"
						class="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
						aria-label="Open menu"
						on:click={() => (mobileSidebarOpen = true)}
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>
					<a href="{base}/organisations" class="flex items-center gap-2" aria-label="OnNuma Admin">
						<img
							src="/assets/OnNuma-Icon.png"
							alt=""
							class="h-8 w-auto"
							width="32"
							height="32"
						/>
					</a>
					<div class="w-10" aria-hidden="true"></div>
				</div>
			</div>

			{#if mobileSidebarOpen}
				<button
					type="button"
					class="lg:hidden fixed inset-0 z-30 bg-black/50"
					aria-label="Close menu"
					on:click={closeMobileSidebar}
				></button>
				<div class="lg:hidden fixed inset-y-0 left-0 z-40 w-[16rem] max-w-[85vw] shadow-xl">
					<MultiOrgSidebar {base} />
				</div>
			{/if}

			<main class="crm-shell-main flex-1 flex flex-col min-w-0">
				<div class="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
					<slot />
				</div>
			</main>
		</div>

		<footer class="crm-shell-footer flex-shrink-0 w-full bg-white border-t border-gray-200">
			<div class="max-w-7xl mx-auto px-4 py-6">
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
	.crm-shell-main {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
</style>
