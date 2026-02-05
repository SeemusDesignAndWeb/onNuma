<script lang="js">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let params = {};

	let openDropdown = null;
	let mobileMenuOpen = false;

	function handleLogout() {
		fetch('/admin/logout', { method: 'POST' }).then(() => {
			goto('/admin/login');
		});
	}

	$: showNavbar = $page.url.pathname !== '/admin/login';
	$: currentPath = $page.url.pathname;

	function isActive(href) {
		if (href === '/admin') return currentPath === '/admin';
		return currentPath === href || currentPath.startsWith(href + '/');
	}

	onMount(() => {
		function handleClickOutside(event) {
			if (!event.target.closest('.dropdown-container')) {
				openDropdown = null;
			}
		}
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	});

	const navItems = [
		{ href: '/admin', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
		{ href: '/admin/landing', label: 'Landing page', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
		{ href: '/admin/images', label: 'Images', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
		{ href: '/admin/settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
	];
</script>

<div class="min-h-screen bg-gray-50">
	{#if showNavbar}
		<nav class="bg-brand-blue shadow-lg border-b border-brand-blue/80">
			<div class="container mx-auto px-4">
				<div class="flex items-center justify-between h-16">
					<div class="flex items-center gap-4">
						<a href="/admin" class="flex items-center gap-2">
							<img src="/images/onnuma-logo.png" alt="OnNuma" class="h-8 w-auto brightness-0 invert" />
							<span class="text-xl font-bold text-white">Admin</span>
						</a>
					</div>

					<div class="hidden md:flex items-center gap-1">
						{#each navItems as item}
							<a
								href={item.href}
								class="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 text-white hover:bg-white/20 {isActive(item.href) ? 'bg-white/20' : ''}"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={item.icon}></path>
								</svg>
								{item.label}
							</a>
						{/each}
					</div>

					<div class="flex items-center gap-2">
						<a href="/" target="_blank" rel="noopener" class="px-3 py-2 rounded-lg text-sm text-white hover:bg-white/20">
							View site
						</a>
						<button
							on:click={handleLogout}
							class="px-4 py-2 bg-white text-brand-blue rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium flex items-center gap-2"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
							</svg>
							Logout
						</button>
						<button
							on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
							class="md:hidden px-3 py-2 rounded-lg text-white hover:bg-white/20"
							aria-label="Toggle menu"
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}></path>
							</svg>
						</button>
					</div>
				</div>

				{#if mobileMenuOpen}
					<div class="md:hidden pb-4 border-t border-white/20 mt-2 pt-4">
						<nav class="flex flex-col space-y-1">
							{#each navItems as item}
								<a
									href={item.href}
									on:click={() => (mobileMenuOpen = false)}
									class="block px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/20"
								>
									{item.label}
								</a>
							{/each}
						</nav>
					</div>
				{/if}
			</div>
		</nav>
	{/if}

	<main>
		<slot />
	</main>
</div>

<style>
	:global(.admin-page) {
		min-height: calc(100vh - 4rem);
	}
</style>
