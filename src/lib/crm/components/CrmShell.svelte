<script>
	import { page } from '$app/stores';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';
	import ConfirmDialog from '$lib/crm/components/ConfirmDialog.svelte';
	
	export let title = 'TheHUB';
	export let admin = null;
	
	$: isAuthPage = $page.url.pathname.startsWith('/hub/auth/');
	
	let mobileMenuOpen = false;
</script>

<div class="min-h-screen bg-gray-50 flex flex-col">
	<!-- Header -->
	{#if !isAuthPage}
		<header class="bg-blue-500 shadow-lg border-b border-blue-600 flex-shrink-0">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between h-16">
					<!-- Logo/Brand -->
					<div class="flex items-center gap-4">
						<a href="/hub" class="flex items-center gap-2">
							<img
								src="/images/egcc-logo.png"
								alt="EGCC"
								class="h-8 w-auto"
							/>
							<span class="text-xl font-bold text-white">TheHUB</span>
						</a>
						<nav class="ml-8 hidden md:flex space-x-1">
							<a href="/hub" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {($page.url.pathname === '/hub' || $page.url.pathname === '/hub/') ? 'bg-blue-600' : ''}">Dashboard</a>
							<a href="/hub/contacts" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/contacts') ? 'bg-blue-600' : ''}">Contacts</a>
							<a href="/hub/lists" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/lists') ? 'bg-blue-600' : ''}">Lists</a>
							<a href="/hub/newsletters" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/newsletters') ? 'bg-blue-600' : ''}">Newsletters</a>
							<a href="/hub/events/calendar" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/events') ? 'bg-blue-600' : ''}">Events</a>
							<a href="/hub/rotas" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/rotas') ? 'bg-blue-600' : ''}">Rotas</a>
							<a href="/hub/forms" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/forms') ? 'bg-blue-600' : ''}">Forms</a>
							<a href="/hub/users" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/users') ? 'bg-blue-600' : ''}">Users</a>
							<a href="/hub/help" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/help') ? 'bg-blue-600' : ''}">Help</a>
						</nav>
					</div>
					<div class="flex items-center space-x-4">
						{#if admin}
							<a href="/hub/profile" class="text-sm text-white hidden sm:block hover:underline">{admin.name || admin.email}</a>
						{/if}
						<a href="/hub/auth/logout" class="hidden md:block px-4 py-2 bg-white text-blue-500 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium">
							Logout
						</a>
						<!-- Mobile menu button -->
						<button
							on:click={() => mobileMenuOpen = !mobileMenuOpen}
							class="md:hidden p-2 text-white hover:bg-blue-600 rounded-lg"
							aria-label="Toggle menu"
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d={mobileMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}
								></path>
							</svg>
						</button>
					</div>
				</div>
				
				<!-- Mobile menu -->
				{#if mobileMenuOpen}
					<div class="md:hidden pb-4 border-t border-blue-400 mt-4 pt-4">
						<nav class="flex flex-col space-y-2">
							<a href="/hub" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {($page.url.pathname === '/hub' || $page.url.pathname === '/hub/') ? 'bg-blue-600' : ''}">Dashboard</a>
							<a href="/hub/contacts" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/contacts') ? 'bg-blue-600' : ''}">Contacts</a>
							<a href="/hub/lists" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/lists') ? 'bg-blue-600' : ''}">Lists</a>
							<a href="/hub/newsletters" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/newsletters') ? 'bg-blue-600' : ''}">Newsletters</a>
							<a href="/hub/events/calendar" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/events') ? 'bg-blue-600' : ''}">Events</a>
							<a href="/hub/rotas" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/rotas') ? 'bg-blue-600' : ''}">Rotas</a>
							<a href="/hub/forms" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/forms') ? 'bg-blue-600' : ''}">Forms</a>
							<a href="/hub/users" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/users') ? 'bg-blue-600' : ''}">Users</a>
							<a href="/hub/help" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 {$page.url.pathname.startsWith('/hub/help') ? 'bg-blue-600' : ''}">Help</a>
							{#if admin}
								<a href="/hub/profile" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600">Profile</a>
							{/if}
							<a href="/hub/auth/logout" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-blue-600 border-t border-blue-400 pt-2 mt-2">
								Logout
							</a>
						</nav>
					</div>
				{/if}
			</div>
		</header>
	{/if}

	<!-- Main Content -->
	<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full box-border flex-grow">
		<slot />
	</main>

	<!-- Footer -->
	{#if !isAuthPage}
		<footer class="bg-white border-t border-gray-200 mt-12 flex-shrink-0">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<div class="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
					<div class="flex items-center space-x-3">
						<img
							src="/images/egcc-logo.png"
							alt="Eltham Green Community Church"
							class="h-8 w-auto"
						/>
						<div class="text-sm text-gray-600">
							<div class="font-semibold text-gray-900">Eltham Green Community Church</div>
							<div class="text-xs">542 Westhorne Avenue, Eltham, London, SE9 6RR</div>
						</div>
					</div>
					<div class="text-sm text-gray-500">
						<a href="/" class="text-brand-blue hover:text-brand-blue/80 transition-colors">Visit Website</a>
					</div>
				</div>
			</div>
		</footer>
	{/if}

	<!-- Global Notification Popups -->
	<NotificationPopup />
	
	<!-- Global Dialog/Confirm -->
	<ConfirmDialog />
</div>

<style>
	main {
		width: 100%;
		max-width: 80rem;
		margin-left: auto;
		margin-right: auto;
		box-sizing: border-box;
	}
</style>
