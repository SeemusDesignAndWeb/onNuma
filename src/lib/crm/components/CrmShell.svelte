<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';
	import ConfirmDialog from '$lib/crm/components/ConfirmDialog.svelte';
	import { hasRouteAccess, isSuperAdmin } from '$lib/crm/server/permissions.js';
	
	export let admin = null;
	
	$: isAuthPage = $page.url.pathname.startsWith('/hub/auth/');
	$: accessDenied = $page.url.searchParams.get('error') === 'access_denied';
	
	// Check permissions for various routes
	$: canAccessContacts = admin && hasRouteAccess(admin, '/hub/contacts');
	$: canAccessLists = admin && hasRouteAccess(admin, '/hub/lists');
	$: canAccessMembers = admin && hasRouteAccess(admin, '/hub/members');
	$: canAccessNewsletters = admin && hasRouteAccess(admin, '/hub/newsletters');
	$: canAccessEvents = admin && hasRouteAccess(admin, '/hub/events');
	$: canAccessMeetingPlanners = admin && hasRouteAccess(admin, '/hub/meeting-planners');
	$: canAccessRotas = admin && hasRouteAccess(admin, '/hub/rotas');
	$: canAccessForms = admin && hasRouteAccess(admin, '/hub/forms');
	$: canAccessUsers = admin && isSuperAdmin(admin);
	$: canAccessVideos = admin && isSuperAdmin(admin);
	
	// Show contacts dropdown if any contacts-related permission exists
	$: showContactsDropdown = canAccessContacts || canAccessLists || canAccessMembers;
	// Show events dropdown if any events-related permission exists
	$: showEventsDropdown = canAccessEvents || canAccessMeetingPlanners;
	
	let mobileMenuOpen = false;
	let settingsDropdownOpen = false;
	let settingsDropdownElement;
	let contactsDropdownOpen = false;
	let contactsDropdownElement;
	let eventsDropdownOpen = false;
	let eventsDropdownElement;
	
	$: isSettingsActive = $page.url.pathname.startsWith('/hub/users') || $page.url.pathname.startsWith('/hub/profile') || $page.url.pathname.startsWith('/hub/videos') || $page.url.pathname.startsWith('/hub/audit-logs');
	$: isHelpActive = $page.url.pathname.startsWith('/hub/help');
	$: isVideoTutorialsActive = $page.url.pathname.startsWith('/hub/video-tutorials');
	$: isContactsActive = $page.url.pathname.startsWith('/hub/contacts') || $page.url.pathname.startsWith('/hub/lists') || $page.url.pathname.startsWith('/hub/members');
	$: isEventsActive = $page.url.pathname.startsWith('/hub/events') || $page.url.pathname.startsWith('/hub/meeting-planners');
	
	function handleClickOutside(event) {
		if (settingsDropdownElement && !settingsDropdownElement.contains(event.target)) {
			settingsDropdownOpen = false;
		}
		if (contactsDropdownElement && !contactsDropdownElement.contains(event.target)) {
			contactsDropdownOpen = false;
		}
		if (eventsDropdownElement && !eventsDropdownElement.contains(event.target)) {
			eventsDropdownOpen = false;
		}
	}
	
	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="min-h-screen bg-gray-50 flex flex-col">
	<!-- Header -->
	{#if !isAuthPage}
		<header class="bg-hub-blue-500 shadow-lg border-b border-hub-blue-600 flex-shrink-0">
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
						{#if !accessDenied}
							<nav class="ml-8 hidden md:flex space-x-1">
								<!-- Dashboard (Home Icon) -->
								<a href="/hub" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {($page.url.pathname === '/hub' || $page.url.pathname === '/hub/') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center" aria-label="Dashboard">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
									</svg>
								</a>
								<!-- Contacts Dropdown -->
								{#if showContactsDropdown}
									<div class="relative" bind:this={contactsDropdownElement}>
										<button
											on:click|stopPropagation={() => contactsDropdownOpen = !contactsDropdownOpen}
											class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isContactsActive ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center"
											aria-label="Contacts"
											aria-expanded={contactsDropdownOpen}
											aria-haspopup="true"
										>
											Contacts
											<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</svg>
										</button>
										{#if contactsDropdownOpen}
											<div class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200" role="menu" tabindex="-1">
												{#if canAccessContacts}
													<a href="/hub/contacts" on:click={() => contactsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/contacts') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Contacts</a>
												{/if}
												{#if canAccessLists}
													<a href="/hub/lists" on:click={() => contactsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/lists') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Lists</a>
												{/if}
												{#if canAccessMembers}
													<a href="/hub/members" on:click={() => contactsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/members') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Members</a>
												{/if}
											</div>
										{/if}
									</div>
								{/if}
								{#if canAccessNewsletters}
									<a href="/hub/newsletters" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/newsletters') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Newsletters</a>
								{/if}
								<!-- Events Dropdown -->
								{#if showEventsDropdown}
									<div class="relative" bind:this={eventsDropdownElement}>
										<button
											on:click|stopPropagation={() => eventsDropdownOpen = !eventsDropdownOpen}
											class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isEventsActive ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center"
											aria-label="Events"
											aria-expanded={eventsDropdownOpen}
											aria-haspopup="true"
										>
											Events
											<svg class="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
											</svg>
										</button>
										{#if eventsDropdownOpen}
											<div class="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200" role="menu" tabindex="-1">
												{#if canAccessEvents}
													<a href="/hub/events/calendar" on:click={() => eventsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/events') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Events</a>
												{/if}
												{#if canAccessMeetingPlanners}
													<a href="/hub/meeting-planners" on:click={() => eventsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/meeting-planners') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Meeting Planners</a>
												{/if}
											</div>
										{/if}
									</div>
								{/if}
								{#if canAccessRotas}
									<a href="/hub/rotas" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/rotas') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Rotas</a>
								{/if}
								{#if canAccessForms}
									<a href="/hub/forms" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/forms') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Forms</a>
								{/if}
								<!-- Video Tutorials (for viewing videos) -->
								<a href="/hub/video-tutorials" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isVideoTutorialsActive ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center" aria-label="Video Tutorials">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
									</svg>
								</a>
								<!-- Help -->
								<a href="/hub/help" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isHelpActive ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center" aria-label="Help">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</a>
							</nav>
						{/if}
					</div>
					<div class="flex items-center space-x-4">
						<a href="/hub/auth/logout" class="hidden md:block px-4 py-2 bg-white text-hub-blue-600 rounded-lg hover:bg-hub-blue-50 transition-colors text-sm font-medium">
							Logout
						</a>
						<!-- Settings Dropdown -->
						<div class="relative hidden md:block" bind:this={settingsDropdownElement}>
							<button
								on:click|stopPropagation={() => settingsDropdownOpen = !settingsDropdownOpen}
								class="p-2 rounded-lg text-sm font-medium transition-colors {isSettingsActive ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center"
								aria-label="Settings"
								aria-expanded={settingsDropdownOpen}
								aria-haspopup="true"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</button>
							{#if settingsDropdownOpen && !accessDenied}
								<div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-50 border border-gray-200" role="menu" tabindex="-1">
									{#if admin}
										<a href="/hub/profile" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/profile') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Profile</a>
									{/if}
									{#if canAccessUsers}
										<a href="/hub/users" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/users') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Admins</a>
									{/if}
									{#if canAccessUsers}
										<a href="/hub/audit-logs" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/audit-logs') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Audit Logs</a>
									{/if}
									{#if canAccessVideos}
										<a href="/hub/videos" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-hub-blue-50 {$page.url.pathname.startsWith('/hub/videos') ? 'bg-hub-blue-50 text-hub-blue-600' : ''}" role="menuitem">Manage Videos</a>
									{/if}
								</div>
							{/if}
						</div>
						<!-- Mobile menu button -->
						<button
							on:click={() => mobileMenuOpen = !mobileMenuOpen}
							class="md:hidden p-2 text-white hover:bg-white hover:text-hub-blue-600 rounded-lg transition-colors"
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
				{#if mobileMenuOpen && !accessDenied}
					<div class="md:hidden pb-4 border-t border-hub-blue-300 mt-4 pt-4">
						<nav class="flex flex-col space-y-1">
							<a href="/hub" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {($page.url.pathname === '/hub' || $page.url.pathname === '/hub/') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center gap-2">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
								</svg>
								<span>Dashboard</span>
							</a>
							{#if canAccessContacts}
								<a href="/hub/contacts" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/contacts') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Contacts</a>
							{/if}
							{#if canAccessLists}
								<a href="/hub/lists" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/lists') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Lists</a>
							{/if}
							{#if canAccessMembers}
								<a href="/hub/members" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/members') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Members</a>
							{/if}
							{#if canAccessNewsletters}
								<a href="/hub/newsletters" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/newsletters') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Newsletters</a>
							{/if}
							{#if canAccessEvents}
								<a href="/hub/events/calendar" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/events') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Events</a>
							{/if}
							{#if canAccessMeetingPlanners}
								<a href="/hub/meeting-planners" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/meeting-planners') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Meeting Planners</a>
							{/if}
							{#if canAccessRotas}
								<a href="/hub/rotas" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/rotas') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Rotas</a>
							{/if}
							{#if canAccessForms}
								<a href="/hub/forms" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/forms') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Forms</a>
							{/if}
							<a href="/hub/video-tutorials" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/video-tutorials') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center gap-2">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
								Video Tutorials
							</a>
							<a href="/hub/help" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/help') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'} flex items-center gap-2">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Help
							</a>
							{#if admin}
								<a href="/hub/profile" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/profile') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Profile</a>
							{/if}
							{#if canAccessUsers}
								<a href="/hub/users" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/users') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Admins</a>
							{/if}
							{#if canAccessUsers}
								<a href="/hub/audit-logs" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/audit-logs') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Audit Logs</a>
							{/if}
							{#if canAccessVideos}
								<a href="/hub/videos" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/videos') ? 'bg-hub-blue-700 text-white' : 'text-white hover:bg-white hover:text-hub-blue-600'}">Video Tutorials</a>
							{/if}
							<a href="/hub/auth/logout" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors text-white hover:bg-white hover:text-hub-blue-600 border-t border-hub-blue-300 pt-2 mt-2">
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
			<div class="max-w-7xl mx-auto px-4 py-6">
				<div class="flex flex-col md:flex-row justify-center md:justify-between items-center space-y-4 md:space-y-0">
					<div class="flex flex-col md:flex-row items-center md:items-center space-y-2 md:space-y-0 md:space-x-3">
						<img
							src="/images/egcc-logo.png"
							alt="Eltham Green Community Church"
							class="h-8 w-auto"
						/>
						<div class="text-sm text-gray-600 text-center">
							<div class="font-semibold text-gray-900">Eltham Green Community Church</div>
							<div class="text-xs">542 Westhorne Avenue, Eltham, London, SE9 6DH</div>
						</div>
					</div>
					<div class="text-sm text-gray-500 text-center md:text-right flex flex-col md:flex-row gap-2 md:gap-4">
						<a href="/hub/privacy" class="text-gray-600 hover:text-hub-blue-600 transition-colors">Privacy Policy</a>
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
