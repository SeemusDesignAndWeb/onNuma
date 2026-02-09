<script>
	import PolicyDoc from '$lib/components/PolicyDoc.svelte';
	export let data;
</script>

<svelte:head>
	<title>Terms and Conditions | OnNuma</title>
	<meta name="description" content="Terms and Conditions for the OnNuma volunteer organisation platform." />
</svelte:head>

<PolicyDoc htmlContent={data?.policyHtml ?? '<p>Loading…</p>'} />
