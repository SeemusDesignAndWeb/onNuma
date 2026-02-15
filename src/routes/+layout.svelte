<script>
	import '../app.css';
	import EventHighlightBanner from '$lib/components/EventHighlightBanner.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import StandaloneHeader from '$lib/components/StandaloneHeader.svelte';
	import ContactFormPopup from '$lib/components/ContactFormPopup.svelte';
	import { contactPopupOpen } from '$lib/stores/contactPopup.js';
	import { browser } from '$app/environment';
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';

	export let data;

	function getColor(val, fallback) {
		return typeof val === 'string' && val.trim() && /^#[0-9A-Fa-f]{6}$/.test(val.trim()) ? val.trim() : fallback;
	}

	// Route-derived flags (defined first so theme logic can use them)
	$: isAdminArea = $page.url.pathname.startsWith('/admin');
	$: isHubArea = $page.url.pathname.startsWith('/hub');
	$: isMultiOrgArea = $page.url.pathname.startsWith('/multi-org');
	$: isMyArea = $page.url.pathname.startsWith('/my');
	// On admin subdomain path is /auth/* or /organisations, so we also hide website UI via data from server
	$: multiOrgAdminDomain = data?.multiOrgAdminDomain ?? false;
	// My volunteering area: no OnNuma frontend navbar (uses its own layout)
	$: hideWebsiteElements = isAdminArea || isHubArea || isMultiOrgArea || isMyArea || multiOrgAdminDomain;
	// External = public hub pages: signup sub-routes (rota/event/member), event token, forms, unsubscribe, view-rotas (theme applies only here when Hub branding is on).
	// Root /signup (free-trial) is part of the frontend marketing site and uses full navbar (not /signup/ so not external).
	$: isExternalPage = $page.url.pathname.startsWith('/signup/') || $page.url.pathname.startsWith('/event/') || $page.url.pathname.startsWith('/forms') || $page.url.pathname.startsWith('/unsubscribe') || $page.url.pathname.startsWith('/view-rotas');

	// Theme from Hub settings. Only applied in Hub/admin and on public hub pages. Main website (/, /church, /events, etc.) never uses Hub theme.
	$: theme = data?.theme || null;
	// Hub/admin: always use theme. Main website: never use theme. External (public hub) pages: always use theme (OnNuma = Hub branding only).
	$: effectiveTheme = hideWebsiteElements ? theme : (isExternalPage ? theme : null);

	// Apply theme CSS variables on external (public hub) pages. Main website: never touch theme vars.
	$: if (typeof document !== 'undefined') {
		const root = document.documentElement;
		const D = { primary: '#0d9488', brand: '#0284c7', navbar: '#0f172a', b1: '#0284c7', b2: '#0d9488', b3: '#475569', b4: '#0369a1', b5: '#f59e0b', p1: '#0284c7', p2: '#0369a1', p3: '#0f172a', panel: '#f1f5f9' };
		if (isExternalPage && theme) {
			root.style.setProperty('--color-primary', getColor(theme.primaryColor, D.primary));
			root.style.setProperty('--color-brand', getColor(theme.brandColor, D.brand));
			const navbarBg = theme.navbarBackgroundColor;
			if (typeof navbarBg === 'string') {
				const t = navbarBg.trim();
				if (t && /^#[0-9A-Fa-f]{6}$/.test(t)) {
					root.style.setProperty('--color-navbar-bg', t);
				} else {
					root.style.setProperty('--color-navbar-bg', D.navbar);
				}
			} else {
				root.style.setProperty('--color-navbar-bg', D.navbar);
			}
			root.style.setProperty('--color-button-1', getColor(theme.buttonColors?.[0], D.b1));
			root.style.setProperty('--color-button-2', getColor(theme.buttonColors?.[1], D.b2));
			root.style.setProperty('--color-button-3', getColor(theme.buttonColors?.[2], D.b3));
			root.style.setProperty('--color-button-4', getColor(theme.buttonColors?.[3], D.b4));
			root.style.setProperty('--color-button-5', getColor(theme.buttonColors?.[4], D.b5));
			root.style.setProperty('--color-panel-head-1', getColor(theme.panelHeadColors?.[0], D.p1));
			root.style.setProperty('--color-panel-head-2', getColor(theme.panelHeadColors?.[1], D.p2));
			root.style.setProperty('--color-panel-head-3', getColor(theme.panelHeadColors?.[2], D.p3));
			root.style.setProperty('--color-panel-bg', getColor(theme.panelBackgroundColor, D.panel));
		} else {
			root.style.setProperty('--color-navbar-bg', '#FFFFFF');
		}
	}

	let bannerDismissed = false;
	$: isSignupPage = $page.url.pathname === '/signup' || $page.url.pathname.startsWith('/signup/rota') || $page.url.pathname.startsWith('/signup/event') || $page.url.pathname.startsWith('/signup/member');
	$: useStandaloneHeader = isExternalPage;
	$: isMarketingHome = $page.url.pathname === '/';
	$: showWebsiteNavbar = !hideWebsiteElements || isSignupPage;
	$: showStandaloneHeader = showWebsiteNavbar && useStandaloneHeader;
	$: showFullNavbar = showWebsiteNavbar && !useStandaloneHeader;
	$: showBannerArea = !hideWebsiteElements && !isSignupPage && !isMarketingHome && data?.highlightedEvent && !data.settings?.showLatestMessagePopup;
	$: showBannerOpen = showBannerArea && !bannerDismissed;
	$: showWebsiteBanner = showBannerArea;

	// Single padding class for content (avoid multiple padding classes). Marketing home: no top padding so hero extends behind navbar.
	$: contentPaddingClass = showStandaloneHeader
		? 'pt-[56px]'
		: hideWebsiteElements || (isSignupPage && showFullNavbar)
			? 'pt-0'
			: isMarketingHome
				? 'pt-0'
				: showBannerOpen
					? 'pt-[110px]'
					: 'pt-[80px]';

	// Share banner visibility with child components via store
	const bannerVisibleStore = writable(false);
	setContext('bannerVisible', bannerVisibleStore);

	// Lazy-load CRM popup/dialog only when in Hub/admin/multi-org to shrink initial bundle and reduce parse cost
	let NotificationPopupComponent = null;
	let ConfirmDialogComponent = null;
	let crmComponentsLoaded = false;
	function loadCrmComponents() {
		if (crmComponentsLoaded) return;
		crmComponentsLoaded = true;
		Promise.all([
			import('$lib/crm/components/NotificationPopup.svelte'),
			import('$lib/crm/components/ConfirmDialog.svelte')
		]).then(([m1, m2]) => {
			NotificationPopupComponent = m1.default;
			ConfirmDialogComponent = m2.default;
		});
	}
	$: if (browser && hideWebsiteElements) loadCrmComponents();
	
	$: if (!hideWebsiteElements) bannerVisibleStore.set(showBannerOpen);

	function maybeOpenContactPopup() {
		if (typeof window !== 'undefined' && window.location.pathname === '/' && window.location.hash === '#contact') {
			contactPopupOpen.set(true);
		}
	}

	onMount(() => {
		maybeOpenContactPopup();
		window.addEventListener('hashchange', maybeOpenContactPopup);
		return () => window.removeEventListener('hashchange', maybeOpenContactPopup);
	});
</script>

{#if showWebsiteBanner}
	<EventHighlightBanner 
		event={data.highlightedEvent} 
		open={showBannerOpen} 
		on:close={() => bannerDismissed = true} 
		class="gallery-hide-when-fullscreen"
	/>
{/if}

<!-- Standalone header (external pages when theme is standalone) -->
{#if showStandaloneHeader}
	<StandaloneHeader theme={effectiveTheme} class="gallery-hide-when-fullscreen" />
{/if}
<!-- Website Navbar - full site nav when not standalone external page -->
{#if showFullNavbar}
	<Navbar theme={effectiveTheme} bannerVisible={showBannerOpen} landing={data?.landing} transparentOverHero={isMarketingHome} lightText={isSignupPage} hideCta={isSignupPage} className="gallery-hide-when-fullscreen" />
{/if}

<!-- Page Content with dynamic padding to account for fixed navbar and banner -->
<div class="transition-all duration-300 {contentPaddingClass}">
	<slot />
</div>

<!-- Global Notification Popups (lazy-loaded in Hub/admin to reduce initial JS parse) -->
{#if NotificationPopupComponent}
	<svelte:component this={NotificationPopupComponent} useMultiOrgTheme={isMultiOrgArea} />
{/if}

<!-- Contact form popup (website only) -->
{#if !hideWebsiteElements}
	<ContactFormPopup open={$contactPopupOpen} on:close={() => contactPopupOpen.set(false)} />
{/if}

<!-- Global Dialog/Confirm (lazy-loaded in Hub/admin) -->
{#if ConfirmDialogComponent}
	<svelte:component this={ConfirmDialogComponent} />
{/if}

