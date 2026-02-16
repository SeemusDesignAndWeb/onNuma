<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let base = '/multi-org';
	/** When set (e.g. mobile overlay), show close button and call on nav/close */
	export let onClose = null;

	const SIDEBAR_COLLAPSED_KEY = 'multi_org_sidebar_collapsed';

	function handleNavClick() {
		if (onClose) onClose();
	}

	$: path = $page.url.pathname.startsWith('/multi-org') ? $page.url.pathname : '/multi-org' + $page.url.pathname;
	$: isOrganisations = path === base + '/organisations' || path.startsWith(base + '/organisations/');
	$: isHubSuperAdmins = path === base + '/hub-super-admins' || path.startsWith(base + '/hub-super-admins/');
	$: isPlans = path === base + '/plans' || path.startsWith(base + '/plans/');
	$: isBilling = path === base + '/billing' || path.startsWith(base + '/billing/');
	$: isMarketing = path === base + '/marketing' || path.startsWith(base + '/marketing/');
	$: isSettings = path.startsWith(base + '/settings');
	$: isDashboard = path === base || path === base + '/' || isOrganisations;
	$: marketingPath = isMarketing ? (path.slice((base + '/marketing').length) || '/') : '';

	const marketingSections = [
		{ href: '', label: 'Overview', match: (p) => p === '/' || p === '' },
		{ href: '/templates', label: 'Email Templates', match: (p) => p.startsWith('/templates') },
		{ href: '/mailshots', label: 'Mailshots', match: (p) => p.startsWith('/mailshots') },
		{ href: '/sequences', label: 'Sequences', match: (p) => p.startsWith('/sequences') },
		{ href: '/blocks', label: 'Content Blocks', match: (p) => p.startsWith('/blocks') },
		{ href: '/links', label: 'Links Library', match: (p) => p.startsWith('/links') },
		{ href: '/reports', label: 'Reports & Logs', match: (p) => p.startsWith('/reports') },
		{ href: '/variables', label: 'Variables', match: (p) => p.startsWith('/variables') },
		{ href: '/branding', label: 'Branding', match: (p) => p.startsWith('/branding') },
		{ href: '/preferences', label: 'Consent', match: (p) => p.startsWith('/preferences') },
		{ href: '/migration', label: 'Import / Export', match: (p) => p.startsWith('/migration') }
	];

	let collapsed = false;

	onMount(() => {
		try {
			const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
			if (stored !== null) collapsed = stored === 'true';
		} catch (_) {}
	});

	function setCollapsed(value) {
		collapsed = value;
		try {
			localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(value));
		} catch (_) {}
	}

	function toggleCollapsed() {
		setCollapsed(!collapsed);
	}
</script>

<aside
	class="multi-org-sidebar"
	class:collapsed={collapsed && !onClose}
	class:multi-org-sidebar-drawer={!!onClose}
	role="navigation"
	aria-label="Main navigation"
>
	<div class="multi-org-sidebar-top">
		<a
			href="{base}/organisations"
			class="multi-org-sidebar-brand"
			aria-label={collapsed ? 'Expand sidebar' : 'Dashboard'}
			on:click={(e) => {
				if (collapsed && !onClose) {
					e.preventDefault();
					toggleCollapsed();
				}
				if (onClose) onClose();
			}}
		>
			<!-- Small navbar: icon only (desktop collapsed; never in mobile drawer) -->
			<img
				src="/assets/OnNuma-Icon.png"
				alt=""
				class="multi-org-sidebar-logo multi-org-sidebar-logo-white multi-org-sidebar-logo-icon"
				class:multi-org-sidebar-logo-icon-visible={collapsed && !onClose}
				width="32"
				height="32"
			/>
			<!-- Full OnNuma logo: desktop expanded or mobile drawer (always white) -->
			<img
				src="/assets/onnuma-logo.png"
				alt="OnNuma"
				class="multi-org-sidebar-logo multi-org-sidebar-logo-white multi-org-sidebar-logo-full"
				class:multi-org-sidebar-logo-full-visible={!collapsed || onClose}
				width="120"
				height="32"
			/>
		</a>
		{#if onClose}
			<button
				type="button"
				class="multi-org-sidebar-toggle multi-org-sidebar-close"
				aria-label="Close menu"
				on:click={onClose}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{:else}
			<button
				type="button"
				class="multi-org-sidebar-toggle"
				on:click={() => { if (!collapsed) setCollapsed(true); }}
				aria-label={collapsed ? 'Sidebar collapsed; click logo to expand' : 'Collapse sidebar'}
				aria-expanded={!collapsed}
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					{#if collapsed}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 12h14" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
					{/if}
				</svg>
			</button>
		{/if}
	</div>

	<nav class="multi-org-sidebar-nav">
		<a href="{base}/organisations" class="multi-org-sidebar-item" class:active={isDashboard} title="Organisations" on:click={handleNavClick}>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
			</svg>
			{#if !collapsed || onClose}<span class="multi-org-sidebar-label">Organisations</span>{/if}
		</a>
		<a href="{base}/hub-super-admins" class="multi-org-sidebar-item" class:active={isHubSuperAdmins} title="Users" on:click={handleNavClick}>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
			</svg>
			{#if !collapsed || onClose}<span class="multi-org-sidebar-label">Users</span>{/if}
		</a>
		<a href="{base}/plans" class="multi-org-sidebar-item" class:active={isPlans} title="Plans" on:click={handleNavClick}>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
			</svg>
			{#if !collapsed || onClose}<span class="multi-org-sidebar-label">Plans</span>{/if}
		</a>
		<a href="{base}/billing" class="multi-org-sidebar-item" class:active={isBilling} title="Billing" on:click={handleNavClick}>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
			</svg>
			{#if !collapsed || onClose}<span class="multi-org-sidebar-label">Billing</span>{/if}
		</a>
		<!-- Marketing: parent link; sub-menu revealed when Marketing is selected -->
		<a href="{base}/marketing" class="multi-org-sidebar-item" class:active={isMarketing} title="Marketing" on:click={handleNavClick}>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
			</svg>
			{#if !collapsed || onClose}<span class="multi-org-sidebar-label">Marketing</span>{/if}
		</a>
		{#if isMarketing && (!collapsed || onClose)}
			<div class="multi-org-sidebar-sub">
				{#each marketingSections as sec}
					{@const subActive = sec.match(marketingPath)}
					<a
						href="{base}/marketing{sec.href}"
						class="multi-org-sidebar-sub-item"
						class:active={subActive}
						title={sec.label}
						on:click={handleNavClick}
					>
						<span class="multi-org-sidebar-label">{sec.label}</span>
					</a>
				{/each}
			</div>
		{/if}
		<a href="{base}/settings" class="multi-org-sidebar-item" class:active={isSettings} title="Settings" on:click={handleNavClick}>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
			</svg>
			{#if !collapsed || onClose}<span class="multi-org-sidebar-label">Settings</span>{/if}
		</a>
	</nav>

	<div class="multi-org-sidebar-bottom">
		<a href="{base}/auth/logout" class="multi-org-sidebar-item multi-org-sidebar-logout" title="Log out" on:click={handleNavClick}>
			<svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
			</svg>
			{#if !collapsed || onClose}<span class="multi-org-sidebar-label">Log out</span>{/if}
		</a>
	</div>
</aside>

<style>
	/* Peach theme: same structure as hub sidebar, warm palette */
	.multi-org-sidebar {
		--mo-sidebar-bg-start: #5c4033;
		--mo-sidebar-bg-end: #4a3728;
		--mo-sidebar-border: #6b5344;
		--mo-sidebar-text: #ffffff;
		--mo-sidebar-brand: #ffffff;
		--mo-sidebar-hover-bg: #6b5344;
		--mo-sidebar-active-bg: #c75a4a;
		--mo-sidebar-avatar: #EB9486;
		--mo-sidebar-logout-hover: #7d2e24;
		--sidebar-width: 16rem;
		--sidebar-width-collapsed: 4.5rem;
		width: var(--sidebar-width);
		max-width: var(--sidebar-width);
		height: 100vh;
		min-height: 100vh;
		background: linear-gradient(180deg, var(--mo-sidebar-bg-start) 0%, var(--mo-sidebar-bg-end) 100%);
		border-right: 1px solid var(--mo-sidebar-border);
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		transition: width 0.25s ease, max-width 0.25s ease;
		position: sticky;
		top: 0;
		overflow: clip;
	}
	.multi-org-sidebar.collapsed {
		width: var(--sidebar-width-collapsed);
		max-width: var(--sidebar-width-collapsed);
	}
	.multi-org-sidebar.collapsed .multi-org-sidebar-label {
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
	/* In mobile drawer always show labels and keep text white */
	.multi-org-sidebar-drawer.collapsed .multi-org-sidebar-label,
	.multi-org-sidebar-drawer .multi-org-sidebar-label {
		opacity: 1 !important;
		visibility: visible !important;
		width: auto;
		padding: 0;
		margin: 0;
		border: 0;
		position: static;
	}
	.multi-org-sidebar-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 1rem;
		min-height: 3.5rem;
		border-bottom: 1px solid var(--mo-sidebar-border);
	}
	.multi-org-sidebar-brand {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		text-decoration: none;
		color: #ffffff !important;
		font-weight: 700;
		font-size: 1.125rem;
		min-height: 2.75rem;
		min-width: 2.75rem;
		position: relative;
	}
	.multi-org-sidebar-logo {
		object-fit: contain;
		flex-shrink: 0;
		transition: opacity 0.2s, visibility 0.2s;
	}
	.multi-org-sidebar-logo-white {
		filter: brightness(0) invert(1);
	}
	/* Mobile drawer: always show full logo in white */
	.multi-org-sidebar-drawer .multi-org-sidebar-logo-full {
		opacity: 1 !important;
		visibility: visible !important;
		position: static;
	}
	.multi-org-sidebar-drawer .multi-org-sidebar-logo-icon {
		opacity: 0 !important;
		visibility: hidden !important;
	}
	.multi-org-sidebar-drawer .multi-org-sidebar-logo {
		filter: brightness(0) invert(1);
	}
	.multi-org-sidebar-logo-icon {
		width: 2rem;
		height: 2rem;
		opacity: 0;
		visibility: hidden;
		position: absolute;
		left: 0;
	}
	.multi-org-sidebar-logo-icon.multi-org-sidebar-logo-icon-visible {
		opacity: 1;
		visibility: visible;
		position: static;
	}
	.multi-org-sidebar-logo-full {
		max-height: 2rem;
		width: auto;
		height: 2rem;
		opacity: 0;
		visibility: hidden;
		position: absolute;
		left: 0;
	}
	.multi-org-sidebar-logo-full.multi-org-sidebar-logo-full-visible {
		opacity: 1;
		visibility: visible;
		position: static;
	}
	.multi-org-sidebar-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border: none;
		background: transparent;
		color: #ffffff !important;
		border-radius: 0.5rem;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.multi-org-sidebar-toggle:hover,
	.multi-org-sidebar-toggle:focus-visible {
		background: var(--mo-sidebar-hover-bg);
		color: #ffffff !important;
	}
	.multi-org-sidebar-close {
		min-width: 2.75rem;
		min-height: 2.75rem;
	}
	.multi-org-sidebar-nav {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.multi-org-sidebar-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		min-height: 2.75rem;
		border-radius: 0.5rem;
		color: #ffffff !important;
		text-decoration: none;
		font-size: 0.9375rem;
		font-weight: 500;
		transition: background 0.15s, color 0.15s;
		position: relative;
	}
	.multi-org-sidebar-item:hover {
		background: var(--mo-sidebar-hover-bg);
		color: #ffffff;
	}
	.multi-org-sidebar-item.active {
		background: var(--mo-sidebar-active-bg);
		color: #ffffff;
	}
	.multi-org-sidebar-item:focus-visible {
		outline: 2px solid var(--mo-sidebar-avatar);
		outline-offset: 2px;
	}
	.multi-org-sidebar-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		transition: opacity 0.2s, visibility 0.2s;
		color: #ffffff !important;
	}
	.multi-org-sidebar-sub {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		margin-top: 0.25rem;
		margin-bottom: 0.25rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		background: rgba(255, 255, 255, 0.12);
	}
	.multi-org-sidebar-sub-item {
		display: flex;
		align-items: center;
		padding: 0.5rem 0.75rem;
		min-height: 2.25rem;
		border-radius: 0.375rem;
		color: #ffffff !important;
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		transition: background 0.15s, color 0.15s;
	}
	.multi-org-sidebar-sub-item:hover {
		background: var(--mo-sidebar-hover-bg);
		color: #ffffff;
	}
	.multi-org-sidebar-sub-item.active {
		background: var(--mo-sidebar-active-bg);
		color: #ffffff;
	}
	.multi-org-sidebar-bottom {
		padding: 0.5rem;
		border-top: 1px solid var(--mo-sidebar-border);
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.multi-org-sidebar-logout {
		color: #ffffff;
	}
	.multi-org-sidebar-logout:hover {
		background: var(--mo-sidebar-logout-hover);
		color: #ffffff;
	}
	@media (max-width: 1023px) {
		.multi-org-sidebar {
			position: fixed;
			left: 0;
			top: 0;
			z-index: 40;
			box-shadow: 4px 0 12px rgba(0,0,0,0.3);
		}
	}
	/* Mobile drawer: larger touch targets for finger taps */
	.multi-org-sidebar-drawer .multi-org-sidebar-item {
		min-height: 3rem;
		padding: 0.875rem 1rem;
	}
	.multi-org-sidebar-drawer .multi-org-sidebar-sub-item {
		min-height: 2.75rem;
		padding: 0.625rem 0.75rem;
	}
</style>
