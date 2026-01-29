<script>
	import '../app.css';
	import Preloader from '$lib/components/Preloader.svelte';
	import EventHighlightBanner from '$lib/components/EventHighlightBanner.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import NotificationPopup from '$lib/crm/components/NotificationPopup.svelte';
	import ConfirmDialog from '$lib/crm/components/ConfirmDialog.svelte';
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';

	export let data;
	export let params = {};

	let showPreloader = true;
	let showHighlightBanner = false;

	// Don't show navbar, banner, or preloader in admin or HUB areas
	// But DO show navbar for public signup pages (rota, event, and member signups)
	// Don't show banner on signup pages or sundays page
	$: isAdminArea = $page.url.pathname.startsWith('/admin');
	$: isHubArea = $page.url.pathname.startsWith('/hub');
	$: isSignupPage = $page.url.pathname.startsWith('/signup/rota') || $page.url.pathname.startsWith('/signup/event') || $page.url.pathname.startsWith('/signup/member');
	$: isSundaysPage = $page.url.pathname === '/sundays';
	$: hideWebsiteElements = isAdminArea || isHubArea;
	$: showWebsiteNavbar = !hideWebsiteElements || isSignupPage;
	$: showWebsiteBanner = !hideWebsiteElements && !isSignupPage && !isSundaysPage && showHighlightBanner;

	// Share banner visibility with child components via store
	const bannerVisibleStore = writable(false);
	setContext('bannerVisible', bannerVisibleStore);
	
	$: if (!hideWebsiteElements) {
		bannerVisibleStore.set(showHighlightBanner);
	}

	onMount(() => {
		// Don't show preloader or banner in admin or CRM areas
		if (hideWebsiteElements) {
			showPreloader = false;
			return;
		}

		setTimeout(() => {
			showPreloader = false;
		}, 1000);

		// Check if banner should be shown
		// Only show if there's a highlighted event and latest message popup is not enabled
		if (data.highlightedEvent && !data.settings?.showLatestMessagePopup) {
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

<!-- Website Navbar - only show outside admin area -->
{#if showWebsiteNavbar}
	<Navbar bannerVisible={showHighlightBanner && !isSignupPage && !isSundaysPage} class="gallery-hide-when-fullscreen" />
{/if}

<!-- Page Content with dynamic padding to account for fixed navbar and banner -->
<div class="transition-all duration-300" class:pt-[110px]={showHighlightBanner && !hideWebsiteElements && !isSignupPage && !isSundaysPage} class:pt-[80px]={!showHighlightBanner && !hideWebsiteElements && !isSignupPage && !isSundaysPage} class:pt-0={hideWebsiteElements || isSignupPage || isSundaysPage}>
	<slot />
</div>

<!-- Global Notification Popups -->
<NotificationPopup />

<!-- Global Dialog/Confirm -->
<ConfirmDialog />

