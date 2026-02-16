<script>
	import Onboarding from '$lib/crm/components/Onboarding.svelte';

	export let data = {};
	$: admin = data?.admin ?? null;
	$: superAdminEmail = data?.superAdminEmail ?? null;
	$: organisationAreaPermissions = data?.organisationAreaPermissions ?? null;
</script>

<div class="w-full p-6">
	<Onboarding
		showOnboarding={true}
		inline={true}
		{admin}
		{superAdminEmail}
		{organisationAreaPermissions}
	/>
</div>
