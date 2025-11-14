<script>
	import '../app.css';
	import Preloader from '$lib/components/Preloader.svelte';
	import { onMount } from 'svelte';

	export let params = {};

	let showPreloader = true;

	onMount(() => {
		setTimeout(() => {
			showPreloader = false;
		}, 1000);
	});
</script>

{#if showPreloader}
	<Preloader />
{/if}

<slot />

