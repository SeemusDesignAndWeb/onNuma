<script>
	import PolicyDoc from '$lib/components/PolicyDoc.svelte';
	export let data;
</script>

<svelte:head>
	<title>Refund Policy | OnNuma</title>
	<meta name="description" content="Refund and cancellation policy for OnNuma subscriptions." />
</svelte:head>

<PolicyDoc htmlContent={data?.policyHtml ?? '<p>Loading…</p>'} />
