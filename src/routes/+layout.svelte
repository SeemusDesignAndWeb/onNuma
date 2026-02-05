<script>
	import '../app.css';
	import Preloader from '$lib/components/Preloader.svelte';
	import EventHighlightBanner from '$lib/components/EventHighlightBanner.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import StandaloneHeader from '$lib/components/StandaloneHeader.svelte';
	import ContactFormPopup from '$lib/components/ContactFormPopup.svelte';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';
	import ConfirmDialog from '$lib/crm/components/ConfirmDialog.svelte';
	import { contactPopupOpen } from '$lib/stores/contactPopup.js';
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';

	export let data;
	export let params = {};

	function getColor(val, fallback) {
		return typeof val === 'string' && val.trim() && /^#[0-9A-Fa-f]{6}$/.test(val.trim()) ? val.trim() : fallback;
	}

	// Route-derived flags (defined first so theme logic can use them)
	$: isAdminArea = $page.url.pathname.startsWith('/admin');
	$: isHubArea = $page.url.pathname.startsWith('/hub');
	$: isMultiOrgArea = $page.url.pathname.startsWith('/multi-org');
	// On admin subdomain path is /auth/* or /organisations, so we also hide website UI via data from server
	$: multiOrgAdminDomain = data?.multiOrgAdminDomain ?? false;
	$: hideWebsiteElements = isAdminArea || isHubArea || isMultiOrgArea || multiOrgAdminDomain;
	// External = public hub pages: signup, event token, forms, unsubscribe, view-rotas (theme applies only here when Hub branding is on)
	$: isExternalPage = $page.url.pathname.startsWith('/signup') || $page.url.pathname.startsWith('/event/') || $page.url.pathname.startsWith('/forms') || $page.url.pathname.startsWith('/unsubscribe') || $page.url.pathname.startsWith('/view-rotas');

	// Theme from Hub settings. Only applied in Hub/admin and on public hub pages. Main website (/, /church, /events, etc.) never uses Hub theme.
	$: theme = data?.theme || null;
	// Hub/admin: always use theme. Main website: never use theme. External (public hub) pages: always use theme (OnNuma = Hub branding only).
	$: effectiveTheme = hideWebsiteElements ? theme : (isExternalPage ? theme : null);

	// Apply theme CSS variables on external (public hub) pages. Main website: never touch theme vars (keeps app.css defaults).
	$: if (typeof document !== 'undefined') {
		const root = document.documentElement;
		if (isExternalPage && theme) {
			root.style.setProperty('--color-primary', getColor(theme.primaryColor, '#4BB170'));
			root.style.setProperty('--color-brand', getColor(theme.brandColor, '#4A97D2'));
			const navbarBg = theme.navbarBackgroundColor;
			if (typeof navbarBg === 'string') {
				const t = navbarBg.trim();
				if (t && /^#[0-9A-Fa-f]{6}$/.test(t) && t !== '#FFFFFF' && t !== '#ffffff') {
					root.style.setProperty('--color-navbar-bg', t);
				} else {
					root.style.setProperty('--color-navbar-bg', '#4A97D2');
				}
			} else {
				root.style.setProperty('--color-navbar-bg', '#4A97D2');
			}
			root.style.setProperty('--color-button-1', getColor(theme.buttonColors?.[0], '#4A97D2'));
			root.style.setProperty('--color-button-2', getColor(theme.buttonColors?.[1], '#4BB170'));
			root.style.setProperty('--color-button-3', getColor(theme.buttonColors?.[2], '#3B79A8'));
			root.style.setProperty('--color-button-4', getColor(theme.buttonColors?.[3], '#3C8E5A'));
			root.style.setProperty('--color-button-5', getColor(theme.buttonColors?.[4], '#E6A324'));
			root.style.setProperty('--color-panel-head-1', getColor(theme.panelHeadColors?.[0], '#4A97D2'));
			root.style.setProperty('--color-panel-head-2', getColor(theme.panelHeadColors?.[1], '#3B79A8'));
			root.style.setProperty('--color-panel-head-3', getColor(theme.panelHeadColors?.[2], '#2C5B7E'));
			root.style.setProperty('--color-panel-bg', getColor(theme.panelBackgroundColor, '#E8F2F9'));
		} else {
			// Main website: ensure navbar uses public site default (white)
			root.style.setProperty('--color-navbar-bg', '#FFFFFF');
		}
	}

	let showPreloader = true;
	let showHighlightBanner = false;

	// Don't show navbar, banner, or preloader in admin or HUB areas
	// But DO show navbar for public signup pages (rota, event, and member signups)
	// Don't show banner on signup pages or sundays page
	$: isSignupPage = $page.url.pathname.startsWith('/signup/rota') || $page.url.pathname.startsWith('/signup/event') || $page.url.pathname.startsWith('/signup/member');
	// External pages (signup, forms, etc.) always use minimal header with theme branding, no hub nav items
	$: useStandaloneHeader = isExternalPage;
	$: isMarketingHome = $page.url.pathname === '/';
	$: showWebsiteNavbar = !hideWebsiteElements || isSignupPage;
	$: showStandaloneHeader = showWebsiteNavbar && useStandaloneHeader;
	$: showFullNavbar = showWebsiteNavbar && !useStandaloneHeader;
	$: showWebsiteBanner = !hideWebsiteElements && !isSignupPage && !isMarketingHome && showHighlightBanner;

	// Single padding class for content (avoid multiple padding classes). Marketing home: no top padding so hero extends behind navbar.
	$: contentPaddingClass = showStandaloneHeader
		? 'pt-[56px]'
		: hideWebsiteElements || (isSignupPage && showFullNavbar)
			? 'pt-0'
			: isMarketingHome
				? 'pt-0'
				: showHighlightBanner
					? 'pt-[110px]'
					: 'pt-[80px]';

	// Share banner visibility with child components via store
	const bannerVisibleStore = writable(false);
	setContext('bannerVisible', bannerVisibleStore);
	
	$: if (!hideWebsiteElements) {
		bannerVisibleStore.set(showHighlightBanner);
	}

	onMount(() => {
		// Don't show preloader or banner in admin or CRM areas; skip preloader on marketing home
		if (hideWebsiteElements || isMarketingHome) {
			showPreloader = false;
			if (hideWebsiteElements) return;
		}

		if (!isMarketingHome) {
			setTimeout(() => {
				showPreloader = false;
			}, 1000);
		}

		// Check if banner should be shown (not on marketing home)
		if (!isMarketingHome && data?.highlightedEvent && !data.settings?.showLatestMessagePopup) {
			setTimeout(() => {
				showHighlightBanner = true;
			}, 300);
		}
	});
</script>

{#if showPreloader && !hideWebsiteElements}
	<Preloader />
{/if}

<!-- Event Highlight Banner - shows on all pages except admin -->
{#if showWebsiteBanner}
	<EventHighlightBanner 
		event={data.highlightedEvent} 
		open={showHighlightBanner} 
		on:close={() => showHighlightBanner = false} 
		class="gallery-hide-when-fullscreen"
	/>
{/if}

<!-- Standalone header (external pages when theme is standalone) -->
{#if showStandaloneHeader}
	<StandaloneHeader theme={effectiveTheme} class="gallery-hide-when-fullscreen" />
{/if}
<!-- Website Navbar - full site nav when not standalone external page -->
{#if showFullNavbar}
	<Navbar theme={effectiveTheme} bannerVisible={showHighlightBanner && !isSignupPage} landing={data?.landing} transparentOverHero={isMarketingHome} className="gallery-hide-when-fullscreen" />
{/if}

<!-- Page Content with dynamic padding to account for fixed navbar and banner -->
<div class="transition-all duration-300 {contentPaddingClass}">
	<slot />
</div>

<!-- Global Notification Popups (MultiOrg uses OnNuma theme colours) -->
<NotificationPopup useMultiOrgTheme={isMultiOrgArea} />

<!-- Contact form popup (website only) -->
{#if !hideWebsiteElements}
	<ContactFormPopup open={$contactPopupOpen} on:close={() => contactPopupOpen.set(false)} />
{/if}

<!-- Global Dialog/Confirm -->
<ConfirmDialog />

