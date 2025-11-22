<script>
	import '../app.css';
	import Preloader from '$lib/components/Preloader.svelte';
	import EventHighlightBanner from '$lib/components/EventHighlightBanner.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';
	import { page } from '$app/stores';

	export let data;
	export let params = {};

	let showPreloader = true;
	let showHighlightBanner = false;

	// Don't show navbar, banner, or preloader in admin area
	$: isAdminArea = $page.url.pathname.startsWith('/admin');
	$: showWebsiteNavbar = !isAdminArea;
	$: showWebsiteBanner = !isAdminArea && showHighlightBanner;

	// Share banner visibility with child components via store
	const bannerVisibleStore = writable(false);
	setContext('bannerVisible', bannerVisibleStore);
	
	$: if (!isAdminArea) {
		bannerVisibleStore.set(showHighlightBanner);
	}

	onMount(() => {
		// Don't show preloader or banner in admin area
		if (isAdminArea) {
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

{#if showPreloader && !isAdminArea}
	<Preloader />
{/if}

<!-- Event Highlight Banner - shows on all pages except admin -->
{#if showWebsiteBanner}
	<EventHighlightBanner 
		event={data.highlightedEvent} 
		open={showHighlightBanner} 
		on:close={() => showHighlightBanner = false} 
	/>
{/if}

<!-- Website Navbar - only show outside admin area -->
{#if showWebsiteNavbar}
	<Navbar bannerVisible={showHighlightBanner} />
{/if}

<!-- Page Content with dynamic padding to account for fixed navbar and banner -->
<div class="transition-all duration-300" class:pt-[110px]={showHighlightBanner && !isAdminArea} class:pt-[80px]={!showHighlightBanner && !isAdminArea} class:pt-0={isAdminArea}>
	<slot />
</div>

