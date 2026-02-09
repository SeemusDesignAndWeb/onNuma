<script>
	import { page } from '$app/stores';
	import { notifications } from '$lib/crm/stores/notifications.js';

	$: plan = $page.data?.plan ?? 'free';
	$: currentOrganisation = $page.data?.currentOrganisation ?? null;
	$: subscriptionStatus = currentOrganisation?.subscriptionStatus ?? null;
	$: currentPeriodEnd = currentOrganisation?.currentPeriodEnd ?? null;
	$: cancelAtPeriodEnd = !!currentOrganisation?.cancelAtPeriodEnd;
	$: hasPaddleCustomer = !!(currentOrganisation?.paddleCustomerId);
	$: showBilling = !!$page.data?.showBilling;
	$: showBillingPortal = !!$page.data?.showBillingPortal;
	$: isSuperAdmin = !!$page.data?.isSuperAdmin;
	$: showBillingSection = showBilling || showBillingPortal;

	let billingCheckoutLoading = false;
	let billingPortalLoading = false;

	async function goToCheckout(planName) {
		billingCheckoutLoading = true;
		try {
			const res = await fetch(`/hub/api/checkout?plan=${encodeURIComponent(planName)}`, { credentials: 'include' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				notifications.error(json.error || 'Failed to start checkout');
				return;
			}
			if (json.url) {
				window.location.href = json.url;
			} else {
				notifications.error('No checkout URL returned');
			}
		} catch (err) {
			notifications.error(err.message || 'Checkout failed');
		} finally {
			billingCheckoutLoading = false;
		}
	}

	async function openBillingPortal() {
		billingPortalLoading = true;
		try {
			const res = await fetch('/hub/api/billing-portal', { credentials: 'include' });
			const json = await res.json().catch(() => ({}));
			if (!res.ok) {
				notifications.error(json.error || 'Failed to open billing portal');
				return;
			}
			if (json.url) {
				window.open(json.url, '_blank', 'noopener,noreferrer');
			} else {
				notifications.error('No portal URL returned');
			}
		} catch (err) {
			notifications.error(err.message || 'Failed to open portal');
		} finally {
			billingPortalLoading = false;
		}
	}
</script>

<svelte:head>
	<title>Billing - TheHUB</title>
</svelte:head>

<div class="max-w-2xl mx-auto px-4 py-8">
	<div class="bg-white shadow rounded-lg p-6">
		<h1 class="text-2xl font-bold text-gray-900 mb-2">Billing &amp; account</h1>
		<p class="text-gray-600 mb-6">
			You can view and manage your subscription (including cancellation) here or via the link provided in your plan confirmation.
		</p>

		{#if showBillingSection}
			<div class="space-y-6">
				<div class="p-4 bg-gray-50 border border-gray-200 rounded-md">
					<p class="text-sm font-medium text-gray-700">Current plan</p>
					<p class="text-lg font-semibold text-gray-900 capitalize">{plan}</p>
					{#if subscriptionStatus === 'active' && currentPeriodEnd}
						<p class="text-sm text-gray-500 mt-1">Next billing date: {new Date(currentPeriodEnd).toLocaleDateString()}</p>
					{/if}
					{#if cancelAtPeriodEnd}
						<p class="text-sm text-amber-700 mt-1">Subscription will cancel at the end of the current period.</p>
					{/if}
				</div>

				{#if isSuperAdmin && showBilling}
					<div>
						<p class="text-sm font-medium text-gray-700 mb-2">Upgrade plan</p>
						<div class="flex flex-wrap gap-2">
							{#if plan !== 'professional'}
								<button
									type="button"
									disabled={billingCheckoutLoading}
									on:click={() => goToCheckout('professional')}
									class="px-4 py-2 text-sm font-medium btn-theme-1 rounded-md disabled:opacity-50"
								>
									{billingCheckoutLoading ? 'Opening…' : 'Subscribe to Professional'}
								</button>
							{/if}
							{#if plan !== 'enterprise'}
								<button
									type="button"
									disabled={billingCheckoutLoading}
									on:click={() => goToCheckout('enterprise')}
									class="px-4 py-2 text-sm font-medium btn-theme-2 rounded-md disabled:opacity-50"
								>
									{billingCheckoutLoading ? 'Opening…' : 'Subscribe to Enterprise'}
								</button>
							{/if}
						</div>
					</div>
				{/if}

				{#if showBillingPortal}
					<div>
						<p class="text-sm font-medium text-gray-700 mb-2">Manage subscription &amp; billing</p>
						<p class="text-xs text-gray-500 mb-2">Update payment method, view invoices, or cancel your subscription.</p>
						{#if isSuperAdmin}
							<button
								type="button"
								disabled={billingPortalLoading || !hasPaddleCustomer}
								on:click={openBillingPortal}
								class="px-4 py-2 text-sm font-medium btn-theme-light-1 rounded-md disabled:opacity-50"
								title={!hasPaddleCustomer ? 'Available after your first subscription' : 'Open billing portal'}
							>
								{billingPortalLoading ? 'Opening…' : 'Manage subscription'}
							</button>
							{#if !hasPaddleCustomer}
								<p class="text-xs text-gray-500 mt-1">Manage subscription is available after you subscribe.</p>
							{/if}
						{:else}
							<p class="text-sm text-gray-500">Only organisation administrators can manage the subscription. Ask your admin to open the billing portal.</p>
						{/if}
					</div>
				{/if}
			</div>
		{:else}
			<p class="text-sm text-gray-500">Billing is not configured for this organisation.</p>
		{/if}
	</div>
</div>
