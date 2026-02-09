<script>
	import PolicyDoc from '$lib/components/PolicyDoc.svelte';
	export let data;
</script>

<svelte:head>
	<title>Privacy Policy | OnNuma</title>
	<meta name="description" content="Privacy Policy for the OnNuma volunteer organisation platform." />
</svelte:head>

<PolicyDoc htmlContent={data?.policyHtml ?? '<p>Loading…</p>'} />
