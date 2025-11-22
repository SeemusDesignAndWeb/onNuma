<script>
	import '../app.css';
	import Preloader from '$lib/components/Preloader.svelte';
	import EventHighlightBanner from '$lib/components/EventHighlightBanner.svelte';
	import Navbar from '$lib/components/Navbar.svelte';
	import { onMount, setContext } from 'svelte';
	import { writable } from 'svelte/store';

	export let data;
	export let params = {};

	let showPreloader = true;
	let showHighlightBanner = false;

	// Share banner visibility with child components via store
	const bannerVisibleStore = writable(false);
	setContext('bannerVisible', bannerVisibleStore);
	
	$: bannerVisibleStore.set(showHighlightBanner);

	onMount(() => {
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

{#if showPreloader}
	<Preloader />
{/if}

<!-- Event Highlight Banner - shows on all pages -->
<EventHighlightBanner 
	event={data.highlightedEvent} 
	open={showHighlightBanner} 
	on:close={() => showHighlightBanner = false} 
/>

<Navbar bannerVisible={showHighlightBanner} />

<!-- Page Content with dynamic padding to account for fixed navbar and banner -->
<div class="transition-all duration-300" class:pt-[110px]={showHighlightBanner} class:pt-[80px]={!showHighlightBanner}>
	<slot />
</div>

