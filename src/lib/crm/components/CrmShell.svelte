<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { hasRouteAccess, isSuperAdmin } from '$lib/crm/permissions.js';
	
	export let admin = null;
	/** @type {{ logoPath?: string; primaryColor?: string; brandColor?: string } | null} */
	export let theme = null;
	/** Effective super admin email (from hub_settings when set by MultiOrg) */
	export let superAdminEmail = null;
	/** Org's allowed areas from MultiOrg (null = no restriction). Restricts navbar and access per user. */
	export let organisationAreaPermissions = null;

	$: isAuthPage = $page.url.pathname.startsWith('/hub/auth/');
	$: accessDenied = $page.url.searchParams.get('error') === 'access_denied';

	// Check permissions: user permissions intersected with org's allowed areas (MultiOrg)
	$: canAccessContacts = admin && hasRouteAccess(admin, '/hub/contacts', superAdminEmail, organisationAreaPermissions);
	$: canAccessLists = admin && hasRouteAccess(admin, '/hub/lists', superAdminEmail, organisationAreaPermissions);
	$: canAccessMembers = admin && hasRouteAccess(admin, '/hub/members', superAdminEmail, organisationAreaPermissions);
	$: canAccessNewsletters = admin && hasRouteAccess(admin, '/hub/emails', superAdminEmail, organisationAreaPermissions);
	$: canAccessEvents = admin && hasRouteAccess(admin, '/hub/events', superAdminEmail, organisationAreaPermissions);
	$: canAccessMeetingPlanners = admin && hasRouteAccess(admin, '/hub/meeting-planners', superAdminEmail, organisationAreaPermissions);
	$: canAccessRotas = admin && hasRouteAccess(admin, '/hub/rotas', superAdminEmail, organisationAreaPermissions);
	$: canAccessForms = admin && hasRouteAccess(admin, '/hub/forms', superAdminEmail, organisationAreaPermissions);
	$: canAccessUsers = admin && isSuperAdmin(admin, superAdminEmail);
	$: canAccessVideos = admin && isSuperAdmin(admin, superAdminEmail);
	/** Hide video nav items in navbar for now; set true to show Video Tutorials + Manage Videos */
	const showVideoInNav = false;

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
	
	$: isSettingsActive = $page.url.pathname.startsWith('/hub/users') || $page.url.pathname.startsWith('/hub/profile') || $page.url.pathname.startsWith('/hub/videos') || $page.url.pathname.startsWith('/hub/images') || $page.url.pathname.startsWith('/hub/audit-logs') || $page.url.pathname.startsWith('/hub/settings');
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

<div class="min-h-screen bg-theme-panel flex flex-col">
	<!-- Header: logo and colours from theme (Hub Settings) -->
	{#if !isAuthPage}
		<header
			class="shadow-lg border-b flex-shrink-0"
			style="background-color: {(() => {
				const bgColor = theme?.navbarBackgroundColor;
				if (typeof bgColor === 'string' && bgColor.trim() && /^#[0-9A-Fa-f]{6}$/.test(bgColor.trim()) && bgColor.trim().toUpperCase() !== '#FFFFFF') {
					return bgColor.trim();
				}
				return '#4A97D2';
			})()} !important; border-color: color-mix(in srgb, {(() => {
				const bgColor = theme?.navbarBackgroundColor;
				if (typeof bgColor === 'string' && bgColor.trim() && /^#[0-9A-Fa-f]{6}$/.test(bgColor.trim()) && bgColor.trim().toUpperCase() !== '#FFFFFF') {
					return bgColor.trim();
				}
				return '#4A97D2';
			})()} 75%, black);"
		>
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between h-16">
					<!-- Logo/Brand (from theme, fallback to current Hub logo) -->
					<div class="flex items-center gap-4">
						<a href="/hub" class="flex items-center gap-2">
							<img
								src={theme?.logoPath?.trim() || '/images/OnNuma-Icon.png'}
								alt="EGCC"
								class="h-8 w-auto"
							/>
							<span class="text-xl font-bold text-white">TheHUB</span>
						</a>
						{#if !accessDenied}
							<nav class="hub-main-nav ml-8 hidden md:flex space-x-1">
								<!-- Dashboard (Home Icon) -->
								<a href="/hub" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {($page.url.pathname === '/hub' || $page.url.pathname === '/hub/') ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center" aria-label="Dashboard">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
									</svg>
								</a>
								<!-- Contacts Dropdown -->
								{#if showContactsDropdown}
									<div class="relative" bind:this={contactsDropdownElement}>
										<button
											on:click|stopPropagation={() => contactsDropdownOpen = !contactsDropdownOpen}
											class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isContactsActive ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center"
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
													<a href="/hub/contacts" on:click={() => contactsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/contacts') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Contacts</a>
												{/if}
												{#if canAccessLists}
													<a href="/hub/lists" on:click={() => contactsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/lists') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Lists</a>
												{/if}
												{#if canAccessMembers}
													<a href="/hub/members" on:click={() => contactsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/members') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Members</a>
												{/if}
											</div>
										{/if}
									</div>
								{/if}
								<!-- Events Dropdown -->
								{#if showEventsDropdown}
									<div class="relative" bind:this={eventsDropdownElement}>
										<button
											on:click|stopPropagation={() => eventsDropdownOpen = !eventsDropdownOpen}
											class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isEventsActive ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center"
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
													<a href="/hub/events/calendar" on:click={() => eventsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/events') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Events</a>
												{/if}
												{#if canAccessMeetingPlanners}
													<a href="/hub/meeting-planners" on:click={() => eventsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/meeting-planners') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Meeting Planners</a>
												{/if}
											</div>
										{/if}
									</div>
								{/if}
								{#if canAccessRotas}
									<a href="/hub/rotas" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/rotas') ? 'hub-nav-selected' : 'hub-nav-link'}">Rotas</a>
								{/if}
								{#if canAccessNewsletters}
									<a href="/hub/emails" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/emails') ? 'hub-nav-selected' : 'hub-nav-link'}">Emails</a>
								{/if}
								{#if canAccessForms}
									<a href="/hub/forms" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/forms') ? 'hub-nav-selected' : 'hub-nav-link'}">Forms</a>
								{/if}
								{#if showVideoInNav}
									<!-- Video Tutorials (for viewing videos) -->
									<a href="/hub/video-tutorials" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isVideoTutorialsActive ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center" aria-label="Video Tutorials">
										<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
										</svg>
									</a>
								{/if}
								<!-- Help -->
								<a href="/hub/help" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {isHelpActive ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center" aria-label="Help">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</a>
							</nav>
						{/if}
					</div>
					<div class="flex items-center space-x-4">
						<a href="/hub/auth/logout" class="hidden md:block px-4 py-2 bg-white text-theme-button-1 rounded-lg hover:bg-gray-100 transition-colors text-sm font-medium">
							Logout
						</a>
						<!-- Settings Dropdown -->
						<div class="relative hidden md:block" bind:this={settingsDropdownElement}>
							<button
								on:click|stopPropagation={() => settingsDropdownOpen = !settingsDropdownOpen}
								class="p-2 rounded-lg text-sm font-medium transition-colors {isSettingsActive ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center"
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
										<a href="/hub/profile" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/profile') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Profile</a>
									{/if}
									{#if canAccessUsers}
										<a href="/hub/users" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/users') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Admins</a>
									{/if}
									{#if canAccessUsers}
										<a href="/hub/audit-logs" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/audit-logs') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Audit Logs</a>
									{/if}
									{#if canAccessUsers}
										<a href="/hub/settings" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/settings') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Settings</a>
									{/if}
									{#if showVideoInNav && canAccessVideos}
										<a href="/hub/videos" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/videos') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Manage Videos</a>
									{/if}
									{#if canAccessVideos}
										<a href="/hub/images" on:click={() => settingsDropdownOpen = false} class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 {$page.url.pathname.startsWith('/hub/images') ? 'bg-gray-100 text-theme-button-1' : ''}" role="menuitem">Manage Images</a>
									{/if}
								</div>
							{/if}
						</div>
						<!-- Mobile menu button -->
						<button
							on:click={() => mobileMenuOpen = !mobileMenuOpen}
							class="md:hidden p-2 hub-nav-link rounded-lg transition-colors"
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
					<div class="md:hidden pb-4 pt-4 mt-4 border-t border-white/20 bg-[#3B79A8]">
						<nav class="hub-main-nav flex flex-col space-y-1">
							<a href="/hub" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {($page.url.pathname === '/hub' || $page.url.pathname === '/hub/') ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center gap-2">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
								</svg>
								<span>Dashboard</span>
							</a>
							{#if canAccessContacts}
								<a href="/hub/contacts" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/contacts') ? 'hub-nav-selected' : 'hub-nav-link'}">Contacts</a>
							{/if}
							{#if canAccessLists}
								<a href="/hub/lists" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/lists') ? 'hub-nav-selected' : 'hub-nav-link'}">Lists</a>
							{/if}
							{#if canAccessMembers}
								<a href="/hub/members" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/members') ? 'hub-nav-selected' : 'hub-nav-link'}">Members</a>
							{/if}
							{#if canAccessEvents}
								<a href="/hub/events/calendar" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/events') ? 'hub-nav-selected' : 'hub-nav-link'}">Events</a>
							{/if}
							{#if canAccessMeetingPlanners}
								<a href="/hub/meeting-planners" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/meeting-planners') ? 'hub-nav-selected' : 'hub-nav-link'}">Meeting Planners</a>
							{/if}
							{#if canAccessRotas}
								<a href="/hub/rotas" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/rotas') ? 'hub-nav-selected' : 'hub-nav-link'}">Rotas</a>
							{/if}
							{#if canAccessNewsletters}
								<a href="/hub/emails" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/emails') ? 'hub-nav-selected' : 'hub-nav-link'}">Emails</a>
							{/if}
							{#if canAccessForms}
								<a href="/hub/forms" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/forms') ? 'hub-nav-selected' : 'hub-nav-link'}">Forms</a>
							{/if}
							{#if showVideoInNav}
								<a href="/hub/video-tutorials" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/video-tutorials') ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center gap-2">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
									</svg>
									Video Tutorials
								</a>
							{/if}
							<a href="/hub/help" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/help') ? 'hub-nav-selected' : 'hub-nav-link'} flex items-center gap-2">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								Help
							</a>
							{#if admin}
								<a href="/hub/profile" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/profile') ? 'hub-nav-selected' : 'hub-nav-link'}">Profile</a>
							{/if}
							{#if canAccessUsers}
								<a href="/hub/users" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/users') ? 'hub-nav-selected' : 'hub-nav-link'}">Admins</a>
							{/if}
							{#if canAccessUsers}
								<a href="/hub/audit-logs" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/audit-logs') ? 'hub-nav-selected' : 'hub-nav-link'}">Audit Logs</a>
							{/if}
							{#if showVideoInNav && canAccessVideos}
								<a href="/hub/videos" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/videos') ? 'hub-nav-selected' : 'hub-nav-link'}">Video Tutorials</a>
							{/if}
							{#if canAccessVideos}
								<a href="/hub/images" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors {$page.url.pathname.startsWith('/hub/images') ? 'hub-nav-selected' : 'hub-nav-link'}">Manage Images</a>
							{/if}
							<a href="/hub/auth/logout" on:click={() => mobileMenuOpen = false} class="px-4 py-2 rounded-lg text-sm font-medium transition-colors hub-nav-link border-t border-white/20 pt-2 mt-2">
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
					<a href="/" class="flex items-center" aria-label="OnNuma home">
						<img
							src="/images/onnuma-logo.png"
							alt="OnNuma"
							class="h-8 w-auto"
						/>
					</a>
					<div class="text-sm text-gray-500 text-center md:text-right flex flex-col md:flex-row gap-2 md:gap-4">
						<a href="/hub/privacy" class="text-gray-600 hover:text-theme-button-1 transition-colors">Privacy Policy</a>
						<a href="https://www.onnuma.com" class="text-brand-blue hover:text-brand-blue/80 transition-colors" target="_blank" rel="noopener noreferrer">Visit Website</a>
					</div>
				</div>
			</div>
		</footer>
	{/if}
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
