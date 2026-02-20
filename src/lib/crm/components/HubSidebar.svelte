<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { hasRouteAccess, isSuperAdmin } from '$lib/crm/permissions.js';
	import { hubSidebarCollapsed, HUB_SIDEBAR_COLLAPSED_KEY } from '$lib/crm/stores/sidebar.js';
	import { terminology } from '$lib/crm/stores/terminology.js';
	import { badgeCounts } from '$lib/crm/stores/badgeCounts.js';
	import NotificationBadge from './NotificationBadge.svelte';

	export let admin = null;
	/** @type {{ logoPath?: string } | null} */
	export let theme = null;
	export let superAdminEmail = null;
	export let organisationAreaPermissions = null;
	export let sundayPlannersLabel = 'Meeting Planner';
	export let showBilling = false;
	/** Multi-org: list of { id, name } to switch org; empty = single org */
	export let organisations = [];
	export let currentOrganisation = null;
	/** DBS Bolt-On enabled: show DBS, Safeguarding, Pastoral links */
	export let dbsBoltOn = false;
	/** Callback when user selects another org (e.g. navigate to multi-org with org id) */
	export let onOrganisationSwitch = null;
	/** When set (e.g. mobile overlay), show close button and call on nav/close */
	export let onClose = null;

	const SIDEBAR_COLLAPSED_KEY = HUB_SIDEBAR_COLLAPSED_KEY;
	/** Set to true to show Manage Videos in Settings; hidden for now but code kept. */
	const SHOW_MANAGE_VIDEOS = false;

	$: accessDenied = $page.url.searchParams.get('error') === 'access_denied';

	$: canAccessContacts = admin && hasRouteAccess(admin, '/hub/contacts', superAdminEmail, organisationAreaPermissions);
	$: canAccessLists = admin && hasRouteAccess(admin, '/hub/lists', superAdminEmail, organisationAreaPermissions);
	$: canAccessMembers = admin && hasRouteAccess(admin, '/hub/members', superAdminEmail, organisationAreaPermissions);
	$: canAccessNewsletters = admin && hasRouteAccess(admin, '/hub/emails', superAdminEmail, organisationAreaPermissions);
	$: canAccessEvents = admin && hasRouteAccess(admin, '/hub/events', superAdminEmail, organisationAreaPermissions);
	$: canAccessMeetingPlanners = admin && hasRouteAccess(admin, '/hub/planner', superAdminEmail, organisationAreaPermissions);
	$: canAccessRotas = admin && hasRouteAccess(admin, '/hub/schedules', superAdminEmail, organisationAreaPermissions);
	$: canAccessForms = admin && hasRouteAccess(admin, '/hub/forms', superAdminEmail, organisationAreaPermissions);
	$: canAccessUsers = admin && isSuperAdmin(admin, superAdminEmail);
	$: canAccessVideos = admin && isSuperAdmin(admin, superAdminEmail);
	$: canAccessTeams = admin && (
		isSuperAdmin(admin, superAdminEmail) ||
		(Array.isArray(admin.permissions) && admin.permissions.includes('teams')) ||
		(Array.isArray(admin.teamLeaderForTeamIds) && admin.teamLeaderForTeamIds.length > 0)
	);
	$: canAccessServicePlanner = admin && (
		canAccessTeams ||
		hasRouteAccess(admin, '/hub/schedules', superAdminEmail, organisationAreaPermissions)
	);
	$: canAccessDbs = admin && hasRouteAccess(admin, '/hub/dbs', superAdminEmail, organisationAreaPermissions);

	let collapsed = false;
	let settingsOpen = false;
	const SETTINGS_OPEN_KEY = 'hub_sidebar_settings_open';
	let volunteersOpen = false;
	const VOLUNTEERS_OPEN_KEY = 'hub_sidebar_volunteers_open';

	onMount(() => {
		try {
			const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
			if (stored !== null) {
				collapsed = stored === 'true';
				hubSidebarCollapsed.set(collapsed);
			}
			const openStored = localStorage.getItem(SETTINGS_OPEN_KEY);
			if (openStored !== null) settingsOpen = openStored === '1';
			else if ($page.url && isSettingsActive) settingsOpen = true; // first load on a settings page: expand
			const volStored = localStorage.getItem(VOLUNTEERS_OPEN_KEY);
			if (volStored !== null) volunteersOpen = volStored === '1';
			else if ($page.url && isContactsActive) volunteersOpen = true;
		} catch (_) {}
	});

	function setCollapsed(value) {
		collapsed = value;
		hubSidebarCollapsed.set(value);
		try {
			localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
		} catch (_) {}
	}

	function toggleCollapsed() {
		setCollapsed(!collapsed);
	}
	function handleNavClick() {
		if (onClose) onClose();
	}
	function toggleSettings() {
		settingsOpen = !settingsOpen;
		try {
			localStorage.setItem(SETTINGS_OPEN_KEY, settingsOpen ? '1' : '0');
		} catch (_) {}
	}
	function toggleVolunteers() {
		volunteersOpen = !volunteersOpen;
		try {
			localStorage.setItem(VOLUNTEERS_OPEN_KEY, volunteersOpen ? '1' : '0');
		} catch (_) {}
	}

	$: isDashboard = $page.url.pathname === '/hub' || $page.url.pathname === '/hub/';
	$: isContactsActive = $page.url.pathname.startsWith('/hub/contacts') || $page.url.pathname.startsWith('/hub/members') || $page.url.pathname.startsWith('/hub/volunteers');
	$: isListsActive = $page.url.pathname.startsWith('/hub/lists');
	// When user navigates to a dropdown sub-page while sidebar is collapsed, expand once (so sub-item is visible). Don't re-expand when user clicks collapse.
	let _lastPathForExpand = '';
	$: pathname = $page.url?.pathname ?? '';
	$: if (pathname && pathname !== _lastPathForExpand) {
		_lastPathForExpand = pathname;
		if (collapsed && (pathname.startsWith('/hub/contacts') || pathname.startsWith('/hub/members') || pathname.startsWith('/hub/volunteers') || pathname.startsWith('/hub/users') || pathname.startsWith('/hub/profile') || pathname.startsWith('/hub/billing') || pathname.startsWith('/hub/audit-logs') || pathname.startsWith('/hub/settings') || pathname.startsWith('/hub/images') || pathname.startsWith('/hub/videos'))) {
			setCollapsed(false);
		}
	}
	$: isEventsActive = $page.url.pathname.startsWith('/hub/events');
	$: isSettingsActive = $page.url.pathname.startsWith('/hub/users') || $page.url.pathname.startsWith('/hub/profile') || $page.url.pathname.startsWith('/hub/billing') || $page.url.pathname.startsWith('/hub/audit-logs') || $page.url.pathname.startsWith('/hub/settings') || $page.url.pathname.startsWith('/hub/images') || $page.url.pathname.startsWith('/hub/videos');
</script>

<aside
	class="hub-sidebar"
	class:collapsed={collapsed && !onClose}
	role="navigation"
	aria-label="Main navigation"
>
	<!-- Top: logo + collapse (or close when mobile overlay) -->
	<div class="hub-sidebar-top">
		<a
			href="/hub"
			class="hub-sidebar-brand"
			aria-label={collapsed ? 'Expand sidebar' : 'Dashboard home'}
			on:click={(e) => {
				if (collapsed) {
					e.preventDefault();
					toggleCollapsed();
				}
				if (onClose) onClose();
			}}
		>
			<img
				src={theme?.logoPath?.trim() || '/assets/OnNuma-Icon.png'}
				alt=""
				class="hub-sidebar-logo"
				width="32"
				height="32"
			/>
			{#if !collapsed || onClose}
				<span class="hub-sidebar-brand-text">{$terminology.hub_name}</span>
			{/if}
		</a>
		{#if onClose}
			<button
				type="button"
				class="hub-sidebar-toggle hub-sidebar-close"
				aria-label="Close menu"
				on:click={onClose}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{:else}
			<button
				type="button"
				class="hub-sidebar-toggle"
				on:click={() => {
					if (!collapsed) setCollapsed(true);
				}}
				aria-label={collapsed ? 'Sidebar collapsed; click logo to expand' : 'Collapse sidebar'}
				aria-expanded={!collapsed}
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					{#if collapsed}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 12h14" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
					{/if}
				</svg>
			</button>
		{/if}
	</div>

	<!-- Main nav -->
	{#if !accessDenied}
		<nav class="hub-sidebar-nav">
		<a href="/hub" class="hub-sidebar-item" class:active={isDashboard} title="Dashboard" on:click={handleNavClick}>
			<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
			</svg>
			{#if !collapsed || onClose}<span class="hub-sidebar-label">Dashboard</span>{/if}
		</a>

			{#if canAccessContacts || canAccessLists || canAccessMembers}
				{#if collapsed && !onClose}
					<a href="/hub/contacts" class="hub-sidebar-item" class:active={isContactsActive} title="{$terminology.volunteer}s" on:click={handleNavClick}>
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					</a>
				{:else}
					<div class="hub-sidebar-accordion">
						<button
							type="button"
							class="hub-sidebar-item hub-sidebar-accordion-trigger"
							class:active={isContactsActive}
							title="{$terminology.volunteer}s"
							aria-expanded={volunteersOpen}
							aria-controls="hub-volunteers-panel"
							id="hub-volunteers-trigger"
							on:click={toggleVolunteers}
						>
							<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<span class="hub-sidebar-label">{$terminology.volunteer}s</span>
							<svg class="hub-sidebar-accordion-chevron w-4 h-4 flex-shrink-0" class:rotate-180={volunteersOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</button>
						<div
							id="hub-volunteers-panel"
							class="hub-sidebar-accordion-panel"
							class:open={volunteersOpen}
							role="region"
							aria-labelledby="hub-volunteers-trigger"
							hidden={!volunteersOpen}
						>
							<a href="/hub/contacts" class="hub-sidebar-item hub-sidebar-subitem" class:active={$page.url.pathname.startsWith('/hub/contacts') && !$page.url.pathname.startsWith('/hub/volunteers')} title="{$terminology.volunteer}s" on:click={handleNavClick}>
								<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								<span class="hub-sidebar-label">{$terminology.volunteer}s</span>
							</a>
							{#if canAccessRotas || canAccessContacts}
								<a href="/hub/volunteers" class="hub-sidebar-item hub-sidebar-subitem" class:active={$page.url.pathname.startsWith('/hub/volunteers')} title="Pending volunteers" on:click={handleNavClick}>
									<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
									</svg>
									<span class="hub-sidebar-label">Pending volunteers</span>
									<NotificationBadge count={$badgeCounts.pendingVolunteers} />
								</a>
							{/if}
						</div>
					</div>
				{/if}
			{/if}

			{#if canAccessLists}
				<a href="/hub/lists" class="hub-sidebar-item" class:active={isListsActive} title="Lists" on:click={handleNavClick}>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
					</svg>
				{#if !collapsed || onClose}<span class="hub-sidebar-label">Lists</span>{/if}
				</a>
			{/if}

		{#if canAccessEvents || canAccessMeetingPlanners}
			<a href="/hub/events" class="hub-sidebar-item" class:active={isEventsActive} title="{$terminology.event}s" on:click={handleNavClick}>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
			{#if !collapsed || onClose}<span class="hub-sidebar-label">{$terminology.event}s</span>{/if}
			</a>
		{/if}

		{#if canAccessRotas}
			<a href="/hub/schedules" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/schedules')} title="{$terminology.rota}s" on:click={handleNavClick}>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
				</svg>
			{#if !collapsed || onClose}<span class="hub-sidebar-label">{$terminology.rota}s</span>{/if}
			</a>
		{/if}

	{#if canAccessTeams}
			<a href="/hub/teams" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/teams')} title="{$terminology.team}s" on:click={handleNavClick}>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
				</svg>
			{#if !collapsed || onClose}<span class="hub-sidebar-label">{$terminology.team}s</span>{/if}
			</a>
		{/if}

	{#if canAccessServicePlanner}
		<a href="/hub/planner" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/planner')} title="{$terminology.meeting_planner}" on:click={handleNavClick}>
			<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
			</svg>
		{#if !collapsed || onClose}<span class="hub-sidebar-label">{$terminology.meeting_planner}</span>{/if}
		</a>
	{/if}

			{#if canAccessNewsletters}
				<a href="/hub/emails" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/emails')} title="Messages" on:click={handleNavClick}>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
				{#if !collapsed || onClose}<span class="hub-sidebar-label">Messages</span>{/if}
				</a>
			{/if}

			{#if canAccessForms}
				<a href="/hub/forms" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/forms')} title="Forms" on:click={handleNavClick}>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
					</svg>
					{#if !collapsed || onClose}<span class="hub-sidebar-label">Forms</span>{/if}
					<NotificationBadge count={$badgeCounts.formSubmissions} />
				</a>
			{/if}

			{#if dbsBoltOn && (canAccessContacts || canAccessTeams || canAccessDbs)}
				<a href="/hub/dbs" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/dbs')} title="DBS Compliance" on:click={handleNavClick}>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					{#if !collapsed || onClose}<span class="hub-sidebar-label">DBS Compliance</span>{/if}
					<NotificationBadge count={$badgeCounts.dbsNotifications} />
				</a>
				<a href="/hub/pastoral" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/pastoral')} title="Pastoral Care" on:click={handleNavClick}>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
					</svg>
					{#if !collapsed || onClose}<span class="hub-sidebar-label">Pastoral Care</span>{/if}
					<NotificationBadge count={$badgeCounts.pastoralConcerns} />
				</a>
			{/if}

			<a href="/hub/help" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/help')} title="Help" on:click={handleNavClick}>
				<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			{#if !collapsed || onClose}<span class="hub-sidebar-label">Help</span>{/if}
			</a>

			<!-- Settings (accordion: main item toggles sub-items) -->
			{#if collapsed && !onClose}
				<a href="/hub/settings" class="hub-sidebar-item" class:active={isSettingsActive} title="Settings" on:click={handleNavClick}>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</a>
			{:else}
				<div class="hub-sidebar-accordion">
					<button
						type="button"
						class="hub-sidebar-item hub-sidebar-accordion-trigger"
						class:active={isSettingsActive}
						title="Settings"
						aria-expanded={settingsOpen}
						aria-controls="hub-settings-panel"
						id="hub-settings-trigger"
						on:click={toggleSettings}
					>
						<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						<span class="hub-sidebar-label">Settings</span>
						<svg class="hub-sidebar-accordion-chevron w-4 h-4 flex-shrink-0" class:rotate-180={settingsOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</button>
					<div
						id="hub-settings-panel"
						class="hub-sidebar-accordion-panel"
						class:open={settingsOpen}
						role="region"
						aria-labelledby="hub-settings-trigger"
						hidden={!settingsOpen}
					>
						<a href="/hub/profile" class="hub-sidebar-item hub-sidebar-subitem" class:active={$page.url.pathname.startsWith('/hub/profile')} title="Profile" on:click={handleNavClick}>
							<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
							</svg>
							<span class="hub-sidebar-label truncate">Profile</span>
						</a>
						{#if canAccessUsers}
							<a href="/hub/users" class="hub-sidebar-item hub-sidebar-subitem" class:active={$page.url.pathname.startsWith('/hub/users')} title="Admins" on:click={handleNavClick}>
								<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
								</svg>
								<span class="hub-sidebar-label">Admins</span>
							</a>
							<a href="/hub/audit-logs" class="hub-sidebar-item hub-sidebar-subitem" class:active={$page.url.pathname.startsWith('/hub/audit-logs')} title="Audit Logs" on:click={handleNavClick}>
								<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
								</svg>
								<span class="hub-sidebar-label">Audit Logs</span>
							</a>
						{/if}
						<a href="/hub/settings" class="hub-sidebar-item hub-sidebar-subitem" class:active={$page.url.pathname.startsWith('/hub/settings')} title="Settings" on:click={handleNavClick}>
							<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							</svg>
							<span class="hub-sidebar-label">Settings</span>
						</a>
						{#if SHOW_MANAGE_VIDEOS && canAccessVideos}
							<a href="/hub/videos" class="hub-sidebar-item hub-sidebar-subitem" class:active={$page.url.pathname.startsWith('/hub/videos')} title="Manage Videos" on:click={handleNavClick}>
								<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
								</svg>
								<span class="hub-sidebar-label">Manage Videos</span>
							</a>
						{/if}
						{#if canAccessUsers}
							<a href="/hub/images" class="hub-sidebar-item hub-sidebar-subitem" class:active={$page.url.pathname.startsWith('/hub/images')} title="Manage Images" on:click={handleNavClick}>
								<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<span class="hub-sidebar-label">Manage Images</span>
							</a>
						{/if}
					</div>
				</div>
			{/if}
		</nav>
	{/if}

	<!-- Bottom: billing, logout (Profile moved under Settings) -->
	<div class="hub-sidebar-bottom">
		{#if admin}
			{#if showBilling}
				<a href="/hub/billing" class="hub-sidebar-item" class:active={$page.url.pathname.startsWith('/hub/billing')} title="Billing" on:click={handleNavClick}>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
				{#if !collapsed || onClose}<span class="hub-sidebar-label">Billing</span>{/if}
				</a>
			{/if}
		{/if}
		<a href="/hub/auth/logout" class="hub-sidebar-item hub-sidebar-logout" title="Log out" on:click={handleNavClick}>
			<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
			</svg>
		{#if !collapsed || onClose}<span class="hub-sidebar-label">Log out</span>{/if}
		</a>
	</div>
</aside>

<style>
	.hub-sidebar {
		--sidebar-width: 13rem;
		--sidebar-width-collapsed: 4rem;
		width: var(--sidebar-width);
		max-width: var(--sidebar-width);
		height: 100%;
		min-height: 100%;
		background: linear-gradient(180deg, #1e3a5f 0%, #1e293b 100%);
		border-right: 1px solid #334155;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		transition: width 0.25s ease, max-width 0.25s ease;
		overflow: clip;
	}
	.hub-sidebar.collapsed {
		width: var(--sidebar-width-collapsed);
		max-width: var(--sidebar-width-collapsed);
	}
	.hub-sidebar.collapsed .hub-sidebar-brand-text,
	.hub-sidebar.collapsed .hub-sidebar-label {
		opacity: 0;
		visibility: hidden;
		white-space: nowrap;
		overflow: hidden;
		width: 0;
		padding: 0;
		margin: 0;
		border: 0;
		position: absolute;
	}
	.hub-sidebar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 1rem;
		min-height: 3.5rem;
		border-bottom: 1px solid #334155;
	}
	.hub-sidebar-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: #fff;
		font-weight: 700;
		font-size: 1.125rem;
		min-height: 2.75rem;
		min-width: 2.75rem;
	}
	.hub-sidebar-brand:hover {
		color: #fff;
		opacity: 0.95;
	}
	.hub-sidebar-logo {
		width: 2rem;
		height: 2rem;
		object-fit: contain;
		flex-shrink: 0;
	}
	.hub-sidebar-brand-text {
		white-space: nowrap;
		transition: opacity 0.2s, visibility 0.2s;
	}
	.hub-sidebar-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border: none;
		background: transparent;
		color: #94a3b8;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.hub-sidebar-toggle:hover,
	.hub-sidebar-toggle:focus-visible {
		background: #334155;
		color: #f1f5f9;
	}
	.hub-sidebar-close {
		min-width: 2.75rem;
		min-height: 2.75rem;
	}
	.hub-sidebar-nav {
		flex: 1;
		overflow-y: auto;
		padding: 0.375rem;
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}
	.hub-sidebar-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		min-height: 2.25rem;
		border-radius: 0.375rem;
		color: #cbd5e1;
		text-decoration: none;
		font-size: 0.8125rem;
		font-weight: 500;
		transition: background 0.15s, color 0.15s;
		position: relative;
	}
	.hub-sidebar-item:hover {
		background: #334155;
		color: #f1f5f9;
	}
	.hub-sidebar-item.active {
		background: #4A97D2;
		color: #f1f5f9;
	}
	.hub-sidebar-item:focus-visible {
		outline: 2px solid #4A97D2;
		outline-offset: 2px;
	}
	.hub-sidebar-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: opacity 0.2s, visibility 0.2s;
	}
	/* Badge: push to right in expanded state */
	:global(.hub-sidebar-item .hub-notif-badge) {
		margin-left: auto;
	}
	/* Badge: small corner overlay in collapsed state */
	.hub-sidebar.collapsed :global(.hub-sidebar-item .hub-notif-badge) {
		position: absolute;
		top: 0.2rem;
		right: 0.2rem;
		margin-left: 0;
		min-width: 1rem;
		height: 1rem;
		font-size: 0.5625rem;
		padding: 0 0.2rem;
	}
	.hub-sidebar-accordion {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}
	.hub-sidebar-accordion-trigger {
		width: 100%;
		text-align: left;
		border: none;
		background: transparent;
		cursor: pointer;
		font-size: 0.8125rem;
		font-weight: 500;
		color: #cbd5e1;
		transition: background 0.15s, color 0.15s;
		appearance: none;
	}
	.hub-sidebar-accordion-trigger:hover {
		background: #334155;
		color: #f1f5f9;
	}
	.hub-sidebar-accordion-trigger.active {
		background: #4A97D2;
		color: #f1f5f9;
	}
	.hub-sidebar-accordion-trigger:focus-visible {
		outline: 2px solid #4A97D2;
		outline-offset: 2px;
	}
	.hub-sidebar-accordion-chevron {
		margin-left: auto;
		transition: transform 0.2s ease;
	}
	.hub-sidebar-accordion-chevron.rotate-180 {
		transform: rotate(180deg);
	}
	.hub-sidebar-accordion-panel {
		display: none;
		overflow: hidden;
		flex-direction: column;
		gap: 0.0625rem;
	}
	.hub-sidebar-accordion-panel.open {
		display: flex;
	}
	.hub-sidebar-accordion-panel[hidden] {
		display: none !important;
	}
	.hub-sidebar-subitem {
		padding-left: 1.5rem;
		min-height: 2rem;
	}
	.hub-sidebar-bottom {
		padding: 0.375rem;
		border-top: 1px solid #334155;
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
	}
	.hub-sidebar-profile {
		gap: 0.75rem;
	}
	.hub-sidebar-avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: #4A97D2;
		color: #fff;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.875rem;
		font-weight: 600;
		flex-shrink: 0;
	}
	.hub-sidebar-logout {
		color: #94a3b8;
	}
	.hub-sidebar-logout:hover {
		background: #7f1d1d;
		color: #fecaca;
	}
	@media (max-width: 1023px) {
		.hub-sidebar {
			position: fixed;
			left: 0;
			top: 0;
			z-index: 40;
			box-shadow: 4px 0 12px rgba(0,0,0,0.3);
		}
	}
</style>
