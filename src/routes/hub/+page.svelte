<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { formatDateUK } from '$lib/crm/utils/dateFormat.js';
	import { onMount } from 'svelte';
	import { hasRouteAccess } from '$lib/crm/permissions.js';

	function goToEvent(eventId) {
		if (eventId) goto(`/hub/events/${eventId}`);
	}

	const DEFAULT_PANEL_ORDER = ['rotaGaps', 'leaderboard', 'bookings', 'engagement', 'suggested'];
	const STORAGE_KEY_PREFIX = 'hub_dashboard_panel_order_';
	const STORAGE_KEY_WIDE_PREFIX = 'hub_dashboard_panel_wide_';
	const STORAGE_KEY_COLLAPSED_PREFIX = 'hub_dashboard_panel_collapsed_';

	$: admin = $page.data?.admin || null;
	$: stats = $page.data?.stats || {};
	$: rotaGaps = $page.data?.rotaGaps || [];
	$: organisationId = $page.data?.organisationId ?? null;
	const ROTA_GAPS_PAGE_SIZE = 5;
	let rotaGapsPage = 1;
	$: rotaGapsTotal = rotaGaps.length;
	$: rotaGapsTotalPages = Math.max(1, Math.ceil(rotaGapsTotal / ROTA_GAPS_PAGE_SIZE));
	$: rotaGapsCurrentPage = Math.min(rotaGapsPage, rotaGapsTotalPages);
	$: rotaGapsSlice = rotaGaps.slice((rotaGapsCurrentPage - 1) * ROTA_GAPS_PAGE_SIZE, rotaGapsCurrentPage * ROTA_GAPS_PAGE_SIZE);
	$: volunteerLeaderboard = $page.data?.volunteerLeaderboard || [];
	$: engagementState = $page.data?.engagementState || { engaged: 0, notEngaged: 0, total: 0 };
	$: engagementStateEngagedPct = engagementState.total
		? (engagementState.engaged / engagementState.total) * 100
		: 0;
	$: suggestedPeople = $page.data?.suggestedPeople || [];
	$: suggestedPeopleTotal = $page.data?.suggestedPeopleTotal ?? 0;
	$: eventBookings = $page.data?.eventBookings || [];
	$: eventBookingsMax = eventBookings.length ? Math.max(...eventBookings.map(r => r.bookings), 1) : 1;
	$: organisationAreaPermissions = $page.data?.organisationAreaPermissions ?? null;
	$: superAdminEmail = $page.data?.superAdminEmail ?? null;
	$: isSuperAdmin = $page.data?.isSuperAdmin ?? false;
	$: privacyContactSet = $page.data?.privacyContactSet ?? true;

	// Dismissible reminder to set Privacy policy contact (dashboard only; session-only until set)
	let privacyContactBannerDismissed = false;
	if (browser && typeof sessionStorage !== 'undefined') {
		try {
			privacyContactBannerDismissed = sessionStorage.getItem('hub_privacy_contact_banner_dismissed') === '1';
		} catch (_) {}
	}
	function dismissPrivacyContactBanner() {
		privacyContactBannerDismissed = true;
		try {
			sessionStorage.setItem('hub_privacy_contact_banner_dismissed', '1');
		} catch (_) {}
	}
	$: showPrivacyContactPanel = admin && isSuperAdmin && !privacyContactSet && !privacyContactBannerDismissed;

	$: urlParams = new URLSearchParams($page.url.search);
	$: accessDenied = urlParams.get('error') === 'access_denied';

	$: canAccessContacts = admin && hasRouteAccess(admin, '/hub/contacts', superAdminEmail, organisationAreaPermissions);
	$: canAccessLists = admin && hasRouteAccess(admin, '/hub/lists', superAdminEmail, organisationAreaPermissions);
	$: canAccessNewsletters = admin && hasRouteAccess(admin, '/hub/emails', superAdminEmail, organisationAreaPermissions);
	$: canAccessEvents = admin && hasRouteAccess(admin, '/hub/events', superAdminEmail, organisationAreaPermissions);
	$: canAccessRotas = admin && hasRouteAccess(admin, '/hub/rotas', superAdminEmail, organisationAreaPermissions);
	$: canAccessForms = admin && hasRouteAccess(admin, '/hub/forms', superAdminEmail, organisationAreaPermissions);

	$: visiblePanelIds = (() => {
		const ids = [];
		if (canAccessRotas) ids.push('rotaGaps');
		if (canAccessContacts || canAccessRotas) ids.push('leaderboard');
		if (canAccessEvents) ids.push('bookings');
		if (canAccessContacts) ids.push('engagement');
		if (canAccessContacts) ids.push('suggested');
		return ids;
	})();

	function getStorageKey() {
		return STORAGE_KEY_PREFIX + (organisationId || 'default');
	}
	function getSavedOrder() {
		if (!browser) return [];
		try {
			const raw = localStorage.getItem(getStorageKey());
			return raw ? JSON.parse(raw) : [];
		} catch {
			return [];
		}
	}
	function mergeOrder(visible, saved) {
		const order = (saved.length ? saved : DEFAULT_PANEL_ORDER).filter((id) => visible.includes(id));
		for (const id of visible) {
			if (!order.includes(id)) order.push(id);
		}
		return order;
	}
	function saveOrder(order) {
		if (!browser) return;
		try {
			localStorage.setItem(getStorageKey(), JSON.stringify(order));
		} catch {}
	}

	function getWideStorageKey() {
		return STORAGE_KEY_WIDE_PREFIX + (organisationId || 'default');
	}
	function getSavedWidePanels() {
		if (!browser) return new Set();
		try {
			const raw = localStorage.getItem(getWideStorageKey());
			const arr = raw ? JSON.parse(raw) : [];
			return new Set(Array.isArray(arr) ? arr : []);
		} catch {
			return new Set();
		}
	}
	function saveWidePanels(wideSet) {
		if (!browser) return;
		try {
			localStorage.setItem(getWideStorageKey(), JSON.stringify([...wideSet]));
		} catch {}
	}

	function getCollapsedStorageKey() {
		return STORAGE_KEY_COLLAPSED_PREFIX + (organisationId || 'default');
	}
	function getSavedCollapsedPanels() {
		if (!browser) return new Set();
		try {
			const raw = localStorage.getItem(getCollapsedStorageKey());
			const arr = raw ? JSON.parse(raw) : [];
			return new Set(Array.isArray(arr) ? arr : []);
		} catch {
			return new Set();
		}
	}
	function saveCollapsedPanels(collapsedSet) {
		if (!browser) return;
		try {
			localStorage.setItem(getCollapsedStorageKey(), JSON.stringify([...collapsedSet]));
		} catch {}
	}

	let widePanelIds = new Set();
	$: if (browser && visiblePanelIds.length) {
		widePanelIds = getSavedWidePanels();
	}

	function togglePanelWide(panelId) {
		const next = new Set(widePanelIds);
		if (next.has(panelId)) next.delete(panelId);
		else next.add(panelId);
		widePanelIds = next;
		saveWidePanels(next);
	}

	/** Constrict/expand: collapsed panels show only the heading bar (mobile and desktop, persisted) */
	let collapsedPanelIds = new Set();
	$: if (browser && visiblePanelIds.length) {
		collapsedPanelIds = getSavedCollapsedPanels();
	}
	function togglePanelCollapsed(panelId) {
		const next = new Set(collapsedPanelIds);
		if (next.has(panelId)) next.delete(panelId);
		else next.add(panelId);
		collapsedPanelIds = next;
		saveCollapsedPanels(next);
	}

	let orderedPanelIds = [];
	let prevOrderKey = '';
	$: orderKey = visiblePanelIds.join(',') + (organisationId || '');
	$: if (visiblePanelIds.length) {
		if (browser && orderKey !== prevOrderKey) {
			prevOrderKey = orderKey;
			orderedPanelIds = mergeOrder(visiblePanelIds, getSavedOrder());
		} else if (!browser) {
			orderedPanelIds = [...visiblePanelIds];
		}
	}

	let draggedPanelId = null;
	let dragOverPanelId = null;

	function handlePanelDragStart(e, panelId) {
		draggedPanelId = panelId;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', panelId);
		e.dataTransfer.setData('application/json', JSON.stringify({ panelId }));
		try {
			e.dataTransfer.setDragImage(e.target.closest('.dashboard-panel-wrap') || e.target, 0, 0);
		} catch {}
	}
	function handlePanelDragOver(e, panelId) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		if (draggedPanelId && draggedPanelId !== panelId) dragOverPanelId = panelId;
	}
	function handlePanelDragLeave() {
		dragOverPanelId = null;
	}
	function handlePanelDrop(e, targetPanelId) {
		e.preventDefault();
		if (!draggedPanelId || draggedPanelId === targetPanelId) {
			draggedPanelId = null;
			dragOverPanelId = null;
			return;
		}
		const newOrder = orderedPanelIds.filter((id) => id !== draggedPanelId);
		const targetIndex = newOrder.indexOf(targetPanelId);
		newOrder.splice(targetIndex >= 0 ? targetIndex : 0, 0, draggedPanelId);
		orderedPanelIds = newOrder;
		saveOrder(newOrder);
		draggedPanelId = null;
		dragOverPanelId = null;
	}
	function handlePanelDragEnd() {
		draggedPanelId = null;
		dragOverPanelId = null;
	}

	onMount(() => {
		if (accessDenied) {
			setTimeout(() => {
				const newUrl = new URL(window.location.href);
				newUrl.searchParams.delete('error');
				window.history.replaceState({}, '', newUrl);
			}, 5000);
		}
	});

	function formatRotaGapDate(dateStr) {
		if (!dateStr) return '';
		return formatDateUK(new Date(dateStr));
	}
</script>

<!-- Access Denied Message -->
{#if accessDenied}
	<div class="mb-4 rounded-xl bg-red-50 border-l-4 border-red-400 p-4">
		<div class="flex">
			<div class="flex-shrink-0">
				<svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
				</svg>
			</div>
			<div class="ml-3">
				<p class="text-sm text-red-700">
					<strong>Access Denied:</strong> You do not have permission to access that page. Please contact a super admin if you need access.
				</p>
			</div>
		</div>
	</div>
{/if}

{#if !accessDenied}
	<div class="space-y-6 min-w-0 max-w-full">
		<!-- Page header: Dashboard title left, privacy contact reminder right -->
		<div class="flex flex-wrap items-start justify-between gap-3 min-w-0">
			<h1 class="text-xl sm:text-2xl font-bold text-gray-900 break-words">Dashboard</h1>
			{#if showPrivacyContactPanel}
				<div class="relative w-full sm:w-1/2 min-w-0 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 p-3 pr-8 text-sm shadow-sm border-gray-100 sm:ml-auto">
					<button
						type="button"
						on:click={dismissPrivacyContactBanner}
						class="absolute top-2 right-2 p-1 rounded text-sky-600 hover:text-sky-800 hover:bg-sky-100 transition-colors"
						aria-label="Dismiss"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
					<p class="mb-0">
						<strong>Update your Privacy policy contact.</strong> Your policy currently shows the Super admin. Set a dedicated contact in <a href="/hub/settings?tab=privacy" class="font-medium underline hover:no-underline">Settings → Privacy</a>.
					</p>
				</div>
			{/if}
		</div>

		<!-- Compact Quick Stats: responsive grid, cards shrink and truncate on small screens -->
		<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 min-w-0">
			{#if canAccessContacts}
				<a href="/hub/contacts" class="dashboard-stat-tile rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow min-w-0">
					<div class="flex items-center gap-2 sm:gap-3 min-w-0">
						<div class="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-blue-50 flex items-center justify-center">
							<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Contacts</p>
							<p class="text-lg sm:text-xl font-semibold text-gray-900 truncate">{stats.contacts ?? 0}</p>
						</div>
					</div>
				</a>
			{/if}
			{#if canAccessEvents}
				<a href="/hub/events" class="dashboard-stat-tile rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow min-w-0 block md:hidden">
					<div class="flex items-center gap-2 sm:gap-3 min-w-0">
						<div class="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-50 flex items-center justify-center">
							<svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Events</p>
							<p class="text-lg sm:text-xl font-semibold text-gray-900 truncate">{stats.events ?? 0}</p>
						</div>
					</div>
				</a>
				<a href="/hub/events/calendar" class="dashboard-stat-tile rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow min-w-0 hidden md:block">
					<div class="flex items-center gap-2 sm:gap-3 min-w-0">
						<div class="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-amber-50 flex items-center justify-center">
							<svg class="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Events</p>
							<p class="text-lg sm:text-xl font-semibold text-gray-900 truncate">{stats.events ?? 0}</p>
						</div>
					</div>
				</a>
			{/if}
			{#if canAccessRotas}
				<a href="/hub/rotas" class="dashboard-stat-tile rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow min-w-0">
					<div class="flex items-center gap-2 sm:gap-3 min-w-0">
						<div class="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
							<svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Rotas</p>
							<p class="text-lg sm:text-xl font-semibold text-gray-900 truncate">{stats.rotas ?? 0}</p>
						</div>
					</div>
				</a>
			{/if}
			{#if canAccessNewsletters}
				<a href="/hub/emails" class="dashboard-stat-tile rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow min-w-0">
					<div class="flex items-center gap-2 sm:gap-3 min-w-0">
						<div class="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-violet-50 flex items-center justify-center">
							<svg class="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Emails</p>
							<p class="text-lg sm:text-xl font-semibold text-gray-900 truncate">{stats.newsletters ?? 0}</p>
						</div>
					</div>
				</a>
			{/if}
			{#if canAccessForms}
				<a href="/hub/forms" class="dashboard-stat-tile rounded-xl bg-white p-3 sm:p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow min-w-0">
					<div class="flex items-center gap-2 sm:gap-3 min-w-0">
						<div class="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-rose-50 flex items-center justify-center">
							<svg class="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">Forms</p>
							<p class="text-lg sm:text-xl font-semibold text-gray-900 truncate">{stats.forms ?? 0}</p>
						</div>
					</div>
				</a>
			{/if}
		</div>

		<!-- Modular panels grid: single column on mobile, responsive gap -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 min-w-0">
			{#each orderedPanelIds as panelId}
				<div
					class="dashboard-panel-wrap rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden transition-all duration-150 min-w-0 {widePanelIds.has(panelId) ? 'md:col-span-2 lg:col-span-2' : ''} {dragOverPanelId === panelId ? 'ring-2 ring-theme-button-1 ring-inset' : ''} {draggedPanelId === panelId ? 'opacity-50' : ''}"
					data-panel-id={panelId}
					on:dragover={(e) => handlePanelDragOver(e, panelId)}
					on:dragleave={handlePanelDragLeave}
					on:drop={(e) => handlePanelDrop(e, panelId)}
					role="listitem"
				>
					{#if panelId === 'rotaGaps'}
				<div class="dashboard-panel h-full flex flex-col">
					<header class="dashboard-panel-header">
						<div class="dashboard-panel-header-row">
							<div
								class="dashboard-panel-drag-handle hidden md:flex"
								draggable="true"
								role="button"
								tabindex="0"
								aria-label="Drag to reorder panel"
								on:dragstart={(e) => handlePanelDragStart(e, panelId)}
								on:dragend={handlePanelDragEnd}
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M8 6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zM5 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
								</svg>
							</div>
							<h2 class="dashboard-panel-title">Rota shortages</h2>
							<span class="dashboard-panel-link-spacer"></span>
							<button
								type="button"
								class="dashboard-panel-collapse-toggle inline-flex items-center justify-center w-9 h-9 -my-1 -mr-1 rounded text-gray-500 hover:text-theme-button-1 hover:bg-gray-100 touch-manipulation"
								aria-label={collapsedPanelIds.has(panelId) ? 'Expand panel' : 'Constrict panel to heading only'}
								title={collapsedPanelIds.has(panelId) ? 'Expand' : 'Constrict'}
								on:click={() => togglePanelCollapsed(panelId)}
							>
								{#if collapsedPanelIds.has(panelId)}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M19 9l-7 7-7-7" />
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M5 15l7-7 7 7" />
									</svg>
								{/if}
							</button>
							<button
								type="button"
								class="dashboard-panel-width-toggle hidden md:inline-flex"
								class:dashboard-panel-width-toggle--wide={widePanelIds.has(panelId)}
								aria-label={widePanelIds.has(panelId) ? 'Make panel 1 column wide' : 'Make panel 2 columns wide'}
								title={widePanelIds.has(panelId) ? 'Normal width' : '2 columns wide'}
								on:click={() => togglePanelWide(panelId)}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M5 12h14M13 5l7 7-7 7" />
								</svg>
							</button>
						</div>
					</header>
					<div class="dashboard-panel-body" class:hidden={collapsedPanelIds.has(panelId)}>
						{#if rotaGaps.length === 0}
							<p class="text-sm text-gray-500 py-1">No shortages at the moment. Well done!</p>
						{:else}
							<div class="overflow-x-auto">
								<table class="min-w-full text-sm">
									<thead>
										<tr class="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											<th scope="col" class="py-2 pr-3">Event</th>
											<th scope="col" class="py-2 pr-3 whitespace-nowrap">Date</th>
											<th scope="col" class="py-2 pr-3">Rota</th>
											<th scope="col" class="py-2 pr-3 text-center">Filled</th>
											<th scope="col" class="py-2 pl-3 w-10"></th>
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-100">
										{#each rotaGapsSlice as gap}
											<tr class="border-b border-gray-50 last:border-0">
												<td class="py-1.5 pr-3 font-medium text-gray-900 truncate max-w-[140px]" title={gap.eventTitle}>{gap.eventTitle}</td>
												<td class="py-1.5 pr-3 text-gray-600 whitespace-nowrap">{formatRotaGapDate(gap.date)}</td>
												<td class="py-1.5 pr-3 text-gray-900 truncate max-w-[120px]" title={gap.rotaName}>{gap.rotaName}</td>
												<td class="py-1.5 pr-3 text-center">
													<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium {gap.priority === 'critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}">
														{gap.positionsFilled}/{gap.positionsRequired}
													</span>
												</td>
												<td class="py-1.5 pl-3">
													<a href="/hub/rotas/{gap.rotaId}" class="inline-flex items-center justify-center w-8 h-8 rounded text-gray-500 hover:text-theme-button-1 hover:bg-gray-100" title="View rota" aria-label="View {gap.rotaName}">
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
														</svg>
													</a>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
							{#if rotaGapsTotalPages > 1}
								<div class="mt-2 flex items-center justify-between">
									<button
										type="button"
										class="text-xs font-medium text-theme-button-1 hover:underline disabled:opacity-50 disabled:pointer-events-none"
										disabled={rotaGapsCurrentPage <= 1}
										on:click={() => (rotaGapsPage -= 1)}
									>
										Previous
									</button>
									<span class="text-xs text-gray-500">Page {rotaGapsCurrentPage} of {rotaGapsTotalPages}</span>
									<button
										type="button"
										class="text-xs font-medium text-theme-button-1 hover:underline disabled:opacity-50 disabled:pointer-events-none"
										disabled={rotaGapsCurrentPage >= rotaGapsTotalPages}
										on:click={() => (rotaGapsPage += 1)}
									>
										Next
									</button>
								</div>
							{/if}
							<div class="mt-2 flex flex-wrap gap-1.5">
								<a href="/hub/rotas/invite" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium">Send request</a>
								<a href="/hub/rotas" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-medium">Copy sign-up link</a>
							</div>
						{/if}
						<a href="/hub/rotas" class="dashboard-panel-link mt-4 block">View your rotas</a>
					</div>
				</div>
					{:else if panelId === 'leaderboard'}
				<div class="dashboard-panel h-full flex flex-col">
					<header class="dashboard-panel-header">
						<div class="dashboard-panel-header-row">
							<div
								class="dashboard-panel-drag-handle hidden md:flex"
								draggable="true"
								role="button"
								tabindex="0"
								aria-label="Drag to reorder panel"
								on:dragstart={(e) => handlePanelDragStart(e, panelId)}
								on:dragend={handlePanelDragEnd}
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M8 6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zM5 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
								</svg>
							</div>
							<h2 class="dashboard-panel-title">Volunteer Leaderboard</h2>
							<span class="dashboard-panel-link-spacer"></span>
							<button
								type="button"
								class="dashboard-panel-collapse-toggle inline-flex items-center justify-center w-9 h-9 -my-1 -mr-1 rounded text-gray-500 hover:text-theme-button-1 hover:bg-gray-100 touch-manipulation"
								aria-label={collapsedPanelIds.has(panelId) ? 'Expand panel' : 'Constrict panel to heading only'}
								title={collapsedPanelIds.has(panelId) ? 'Expand' : 'Constrict'}
								on:click={() => togglePanelCollapsed(panelId)}
							>
								{#if collapsedPanelIds.has(panelId)}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M19 9l-7 7-7-7" />
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M5 15l7-7 7 7" />
									</svg>
								{/if}
							</button>
							<button
								type="button"
								class="dashboard-panel-width-toggle hidden md:inline-flex"
								class:dashboard-panel-width-toggle--wide={widePanelIds.has(panelId)}
								aria-label={widePanelIds.has(panelId) ? 'Make panel 1 column wide' : 'Make panel 2 columns wide'}
								title={widePanelIds.has(panelId) ? 'Normal width' : '2 columns wide'}
								on:click={() => togglePanelWide(panelId)}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M5 12h14M13 5l7 7-7 7" />
								</svg>
							</button>
						</div>
					</header>
					<div class="dashboard-panel-body" class:hidden={collapsedPanelIds.has(panelId)}>
						{#if volunteerLeaderboard.length === 0}
							<p class="text-sm text-gray-500">Participation data will appear here as volunteers sign up.</p>
						{:else}
							<div class="overflow-x-auto">
								<table class="min-w-full text-sm">
									<thead>
										<tr class="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
											<th scope="col" class="py-2 pr-3">Name</th>
											<th scope="col" class="py-2 pr-3 text-center">Rotas</th>
											<th scope="col" class="py-2 pl-3 text-center whitespace-nowrap">Last 30 days</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-gray-100">
										{#each volunteerLeaderboard as person}
											<tr class="border-b border-gray-50 last:border-0">
												<td class="py-2 pr-3 font-medium text-gray-900">{person.name}</td>
												<td class="py-2 pr-3 text-center text-gray-600">{person.rotaCount}</td>
												<td class="py-2 pl-3 text-center text-gray-600">{person.servingLast30Days}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
						<a href="/hub/contacts" class="dashboard-panel-link mt-4 block">View contacts</a>
					</div>
				</div>
					{:else if panelId === 'bookings'}
				<div class="dashboard-panel h-full flex flex-col">
					<header class="dashboard-panel-header">
						<div class="dashboard-panel-header-row">
							<div
								class="dashboard-panel-drag-handle hidden md:flex"
								draggable="true"
								role="button"
								tabindex="0"
								aria-label="Drag to reorder panel"
								on:dragstart={(e) => handlePanelDragStart(e, panelId)}
								on:dragend={handlePanelDragEnd}
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M8 6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zM5 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
								</svg>
							</div>
							<h2 class="dashboard-panel-title">Bookings</h2>
							<span class="dashboard-panel-link-spacer"></span>
							<button
								type="button"
								class="dashboard-panel-collapse-toggle inline-flex items-center justify-center w-9 h-9 -my-1 -mr-1 rounded text-gray-500 hover:text-theme-button-1 hover:bg-gray-100 touch-manipulation"
								aria-label={collapsedPanelIds.has(panelId) ? 'Expand panel' : 'Constrict panel to heading only'}
								title={collapsedPanelIds.has(panelId) ? 'Expand' : 'Constrict'}
								on:click={() => togglePanelCollapsed(panelId)}
							>
								{#if collapsedPanelIds.has(panelId)}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M19 9l-7 7-7-7" />
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M5 15l7-7 7 7" />
									</svg>
								{/if}
							</button>
							<button
								type="button"
								class="dashboard-panel-width-toggle hidden md:inline-flex"
								class:dashboard-panel-width-toggle--wide={widePanelIds.has(panelId)}
								aria-label={widePanelIds.has(panelId) ? 'Make panel 1 column wide' : 'Make panel 2 columns wide'}
								title={widePanelIds.has(panelId) ? 'Normal width' : '2 columns wide'}
								on:click={() => togglePanelWide(panelId)}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M5 12h14M13 5l7 7-7 7" />
								</svg>
							</button>
						</div>
					</header>
					<p class="dashboard-panel-subtitle" class:hidden={collapsedPanelIds.has(panelId)}>Events with signups</p>
					<div class="dashboard-panel-body" class:hidden={collapsedPanelIds.has(panelId)}>
						{#if eventBookings.length === 0}
							<p class="text-sm text-gray-500">No events with signups yet. Enable signup on an event to see bookings here.</p>
						{:else}
							<div class="bookings-chart space-y-3" role="list" aria-label="Bar chart of bookings per event">
								{#each eventBookings as row}
									{#if row.eventId}
										<button
											type="button"
											class="bookings-chart-row min-w-0 w-full block rounded-md -mx-1 px-1 py-0.5 hover:bg-gray-50 transition-colors cursor-pointer group text-left border-0 bg-transparent"
											title="View bookings for {row.eventName}"
											aria-label="View event: {row.eventName}"
											on:click={() => goToEvent(row.eventId)}
										>
											<div class="flex items-center justify-between gap-2 mb-0.5">
												<span class="text-sm font-medium text-gray-900 truncate flex-shrink-0 max-w-[60%] group-hover:text-theme-button-1" title={row.eventName}>{row.eventName}</span>
												<span class="text-sm text-gray-600 tabular-nums flex-shrink-0">{row.bookings}</span>
											</div>
											<div class="h-6 rounded-md bg-gray-100 overflow-hidden pointer-events-none" aria-hidden="true">
												<div
													class="h-full rounded-md bg-theme-button-1 transition-[width] duration-300 min-w-0 group-hover:opacity-90"
													style="width: {(row.bookings / eventBookingsMax) * 100}%"
												></div>
											</div>
										</button>
									{:else}
										<div class="min-w-0">
											<div class="flex items-center justify-between gap-2 mb-0.5">
												<span class="text-sm font-medium text-gray-900 truncate flex-shrink-0 max-w-[60%]" title={row.eventName}>{row.eventName}</span>
												<span class="text-sm text-gray-600 tabular-nums flex-shrink-0">{row.bookings}</span>
											</div>
											<div class="h-6 rounded-md bg-gray-100 overflow-hidden" aria-hidden="true">
												<div
													class="h-full rounded-md bg-theme-button-1 transition-[width] duration-300 min-w-0"
													style="width: {(row.bookings / eventBookingsMax) * 100}%"
												></div>
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{/if}
						<a href="/hub/events" class="dashboard-panel-link mt-4 block">View events</a>
					</div>
				</div>
					{:else if panelId === 'engagement'}
				<div class="dashboard-panel h-full flex flex-col">
					<header class="dashboard-panel-header">
						<div class="dashboard-panel-header-row">
							<div
								class="dashboard-panel-drag-handle hidden md:flex"
								draggable="true"
								role="button"
								tabindex="0"
								aria-label="Drag to reorder panel"
								on:dragstart={(e) => handlePanelDragStart(e, panelId)}
								on:dragend={handlePanelDragEnd}
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M8 6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zM5 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
								</svg>
							</div>
							<h2 class="dashboard-panel-title">Current engagement state</h2>
							<span class="dashboard-panel-link-spacer"></span>
							<button
								type="button"
								class="dashboard-panel-collapse-toggle inline-flex items-center justify-center w-9 h-9 -my-1 -mr-1 rounded text-gray-500 hover:text-theme-button-1 hover:bg-gray-100 touch-manipulation"
								aria-label={collapsedPanelIds.has(panelId) ? 'Expand panel' : 'Constrict panel to heading only'}
								title={collapsedPanelIds.has(panelId) ? 'Expand' : 'Constrict'}
								on:click={() => togglePanelCollapsed(panelId)}
							>
								{#if collapsedPanelIds.has(panelId)}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M19 9l-7 7-7-7" />
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M5 15l7-7 7 7" />
									</svg>
								{/if}
							</button>
							<button
								type="button"
								class="dashboard-panel-width-toggle hidden md:inline-flex"
								class:dashboard-panel-width-toggle--wide={widePanelIds.has(panelId)}
								aria-label={widePanelIds.has(panelId) ? 'Make panel 1 column wide' : 'Make panel 2 columns wide'}
								title={widePanelIds.has(panelId) ? 'Normal width' : '2 columns wide'}
								on:click={() => togglePanelWide(panelId)}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M5 12h14M13 5l7 7-7 7" />
								</svg>
							</button>
						</div>
					</header>
					<p class="dashboard-panel-subtitle" class:hidden={collapsedPanelIds.has(panelId)}>Contacts by rota participation</p>
					<div class="dashboard-panel-body dashboard-panel-body--engagement flex flex-1 flex-col items-center gap-3 min-h-0" class:hidden={collapsedPanelIds.has(panelId)}>
						{#if engagementState.total === 0}
							<p class="text-sm text-gray-500">No contacts yet. Add contacts to see engagement.</p>
						{:else}
							<div class="engagement-pie-wrap flex-shrink-0 w-full max-w-[14rem] flex items-center justify-center p-1">
								<div
									class="engagement-pie w-full h-full aspect-square min-w-0 min-h-0 max-w-full max-h-full rounded-full border-4 border-white shadow-inner"
									style="background: conic-gradient(var(--color-button-1, #4A97D2) 0% {engagementStateEngagedPct}%, #e5e7eb {engagementStateEngagedPct}% 100%);"
									role="img"
									aria-label="Pie chart: {engagementState.engaged} engaged, {engagementState.notEngaged} not yet engaged"
								></div>
							</div>
							<div class="flex flex-wrap justify-center gap-x-6 gap-y-2 flex-shrink-0 py-1">
								<div class="flex items-center gap-2 text-sm">
									<span class="w-3 h-3 rounded-full flex-shrink-0" style="background: var(--color-button-1, #4A97D2);"></span>
									<span class="text-gray-700">Engaged</span>
									<span class="font-medium text-gray-900">{engagementState.engaged}</span>
									<span class="text-gray-500">({engagementState.total ? Math.round(engagementStateEngagedPct) : 0}%)</span>
								</div>
								<div class="flex items-center gap-2 text-sm">
									<span class="w-3 h-3 rounded-full flex-shrink-0 bg-gray-200"></span>
									<span class="text-gray-700">Not yet engaged</span>
									<span class="font-medium text-gray-900">{engagementState.notEngaged}</span>
									<span class="text-gray-500">({engagementState.total ? Math.round(100 - engagementStateEngagedPct) : 0}%)</span>
								</div>
							</div>
						{/if}
					</div>
				</div>
					{:else if panelId === 'suggested'}
				<div class="dashboard-panel h-full flex flex-col">
					<header class="dashboard-panel-header">
						<div class="dashboard-panel-header-row">
							<div
								class="dashboard-panel-drag-handle hidden md:flex"
								draggable="true"
								role="button"
								tabindex="0"
								aria-label="Drag to reorder panel"
								on:dragstart={(e) => handlePanelDragStart(e, panelId)}
								on:dragend={handlePanelDragEnd}
							>
								<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M8 6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zm0 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8zM5 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm0 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
								</svg>
							</div>
							<h2 class="dashboard-panel-title">Suggested to invite</h2>
							<span class="dashboard-panel-link-spacer"></span>
							<button
								type="button"
								class="dashboard-panel-collapse-toggle inline-flex items-center justify-center w-9 h-9 -my-1 -mr-1 rounded text-gray-500 hover:text-theme-button-1 hover:bg-gray-100 touch-manipulation"
								aria-label={collapsedPanelIds.has(panelId) ? 'Expand panel' : 'Constrict panel to heading only'}
								title={collapsedPanelIds.has(panelId) ? 'Expand' : 'Constrict'}
								on:click={() => togglePanelCollapsed(panelId)}
							>
								{#if collapsedPanelIds.has(panelId)}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M19 9l-7 7-7-7" />
									</svg>
								{:else}
									<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
										<path d="M5 15l7-7 7 7" />
									</svg>
								{/if}
							</button>
							<button
								type="button"
								class="dashboard-panel-width-toggle hidden md:inline-flex"
								class:dashboard-panel-width-toggle--wide={widePanelIds.has(panelId)}
								aria-label={widePanelIds.has(panelId) ? 'Make panel 1 column wide' : 'Make panel 2 columns wide'}
								title={widePanelIds.has(panelId) ? 'Normal width' : '2 columns wide'}
								on:click={() => togglePanelWide(panelId)}
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true">
									<path d="M5 12h14M13 5l7 7-7 7" />
								</svg>
							</button>
						</div>
					</header>
					<p class="dashboard-panel-subtitle" class:hidden={collapsedPanelIds.has(panelId)}>Registered but not yet participating</p>
					<div class="dashboard-panel-body" class:hidden={collapsedPanelIds.has(panelId)}>
						{#if suggestedPeople.length === 0}
							<p class="text-sm text-gray-500">Everyone in your contacts has participated recently, or you have no contacts yet.</p>
						{:else}
							<ul class="space-y-3">
								{#each suggestedPeople as person}
									<li class="flex items-center justify-between gap-3">
										<div class="min-w-0 flex-1">
											<p class="font-medium text-gray-900 truncate">{person.name}</p>
											{#if person.lastActivity}
												<p class="text-xs text-gray-500">Last activity: {formatRotaGapDate(person.lastActivity)}</p>
											{/if}
										</div>
										<a href="/hub/suggested-to-invite/invite/{person.id}" class="hub-btn flex-shrink-0 bg-theme-button-2 text-white">Invite</a>
									</li>
								{/each}
							</ul>
						{/if}
						{#if suggestedPeopleTotal > 0}
							<a href="/hub/suggested-to-invite" class="dashboard-panel-link mt-4 block">View full list ({suggestedPeopleTotal})</a>
						{/if}
					</div>
				</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	/* Dashboard panel: allow shrink on mobile */
	.dashboard-panel {
		min-width: 0;
	}
	.dashboard-panel-body > .overflow-x-auto {
		-webkit-overflow-scrolling: touch;
	}
	/* Dashboard panel headers: same layout, padding, and typography for all panels */
	.dashboard-panel-header {
		padding: 0.5rem 0.75rem 0.5rem 1rem;
		border-bottom: 1px solid #f3f4f6;
	}
	@media (max-width: 639px) {
		.dashboard-panel-header {
			padding-left: 0.75rem;
		}
	}
	.dashboard-panel-header-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		min-width: 0;
		height: 2rem;
	}
	.dashboard-panel-drag-handle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		flex-shrink: 0;
		border-radius: 0.5rem;
		color: #9ca3af;
		cursor: grab;
		touch-action: none;
	}
	.dashboard-panel-drag-handle:hover {
		color: #4b5563;
		background: #f3f4f6;
	}
	.dashboard-panel-drag-handle:active {
		cursor: grabbing;
	}
	.dashboard-panel-width-toggle {
		display: none; /* hidden on mobile; shown from md up via Tailwind md:inline-flex */
	}
	@media (min-width: 768px) {
		.dashboard-panel-width-toggle {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			flex-shrink: 0;
			border: none;
			border-radius: 0.5rem;
			background: transparent;
			color: #9ca3af;
			cursor: pointer;
		}
		.dashboard-panel-width-toggle:hover {
			color: #4b5563;
			background: #f3f4f6;
		}
		.dashboard-panel-width-toggle:focus-visible {
			outline: 2px solid var(--color-button-1, #4A97D2);
			outline-offset: 2px;
		}
		.dashboard-panel-width-toggle--wide svg {
			transform: rotate(180deg);
		}
	}
	.dashboard-panel-collapse-toggle:focus-visible {
		outline: 2px solid var(--color-button-1, #4A97D2);
		outline-offset: 2px;
	}
	.dashboard-panel-title {
		font-size: 1rem;
		font-weight: 600;
		line-height: 2rem;
		color: #111827;
		flex: 1;
		min-width: 0;
		margin: 10px 0px 0px 0px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dashboard-panel-link {
		font-size: 0.875rem;
		font-weight: 500;
		line-height: 2rem;
		flex-shrink: 1;
		min-width: 0;
		margin-left: auto;
		color: var(--color-button-1, #4A97D2);
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dashboard-panel-link:hover {
		text-decoration: underline;
	}
	.dashboard-panel-link-spacer {
		flex-shrink: 0;
		width: 1px;
		margin-left: auto;
	}
	.dashboard-panel-subtitle {
		font-size: 0.8125rem;
		color: #6b7280;
		margin: 0;
		padding: 0.375rem 1rem 0;
		line-height: 1.25;
	}
	/* Engagement panel: keep height minimal; pie only as large as needed (max 14rem), panel extends when row is taller */
	.dashboard-panel-body--engagement .engagement-pie-wrap {
		max-height: 14rem;
	}
	.dashboard-panel-body--engagement .engagement-pie {
		max-height: 14rem;
	}

	/* On larger panels, reduce engagement pie size by 30% (scale to 70%) */
	@media (min-width: 768px) {
		.dashboard-panel-body--engagement .engagement-pie-wrap {
			transform: scale(0.7);
			transform-origin: center;
		}
	}

	.dashboard-panel-body {
		padding: 0.75rem 1rem;
		min-width: 0;
	}
	@media (max-width: 639px) {
		.dashboard-panel-body {
			padding: 0.75rem;
		}
	}
</style>
