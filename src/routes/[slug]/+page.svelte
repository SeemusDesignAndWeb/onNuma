<script lang="js">
	import PageRenderer from '$lib/components/PageRenderer.svelte';
	import Footer from '$lib/components/Footer.svelte';

	export let data;
	export let params = {};
	$: page = data?.page ?? null;
	$: contactInfo = data?.contactInfo ?? null;
</script>

<svelte:head>
	<title>{page?.title ?? 'Page'} - Eltham Green Community Church</title>
	<meta name="description" content={page?.metaDescription || page?.title || ''} />
</svelte:head>

{#if page}
	<PageRenderer page={page} contactInfo={contactInfo} />
{:else}
	<p class="p-8 text-gray-600">Page not found.</p>
{/if}

<Footer />









