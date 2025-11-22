<script>
	import { onMount } from 'svelte';
	import Hero from '$lib/components/Hero.svelte';
	import About from '$lib/components/About.svelte';
	import Team from '$lib/components/Team.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import Contact from '$lib/components/Contact.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import LatestMessagePopup from '$lib/components/LatestMessagePopup.svelte';

	export let data;
	export let params = {};

	let showLatestMessage = false;

	onMount(() => {
		// Show popup if enabled and data is available
		if (data.settings?.showLatestMessagePopup && data.latestVideo) {
			// Small delay to ensure page is loaded
			setTimeout(() => {
				showLatestMessage = true;
			}, 500);
		}
	});
</script>

<svelte:head>
	<title>Eltham Green Community Church - EGCC</title>
	<meta name="description" content="Eltham Green Community Church - A welcoming community of faith in Eltham, London" />
</svelte:head>

<Hero heroSlides={data.heroSlides} featuredEvents={data.heroEvents} />
<About home={data.home} />
<Menu services={data.services} />
<Contact contactInfo={data.contactInfo} />
<Footer contactInfo={data.contactInfo} serviceTimes={data.serviceTimes} />

<!-- Popups -->
<LatestMessagePopup 
	video={data.latestVideo} 
	open={showLatestMessage} 
	on:close={() => showLatestMessage = false} 
/>

