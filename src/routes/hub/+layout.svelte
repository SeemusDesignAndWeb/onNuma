<script>
	import '$lib/crm/hub.css';
	import CrmShell from '$lib/crm/components/CrmShell.svelte';
	import OnboardingRouteBar from '$lib/crm/components/OnboardingRouteBar.svelte';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { invalidateAll, goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		hubDataLoaded,
		hubDataLoading,
		loadHubData,
		clearHubData,
		refreshHubData
	} from '$lib/crm/stores/hubData.js';
	import { setTerminology } from '$lib/crm/stores/terminology.js';
	import { badgeCounts, loadBadgeCounts } from '$lib/crm/stores/badgeCounts.js';

	export let data = {};
	export let params = {};
	$: orgUpdated = typeof $page !== 'undefined' && $page.url?.searchParams?.get('org_updated') === '1';
	$: admin = data?.admin ?? null;
	// Keep terminology store in sync whenever layout data changes (org switch, settings save, etc.)
	$: setTerminology(data?.terminology);
	$: theme = data?.theme ?? null;
	$: superAdminEmail = data?.superAdminEmail ?? null;
	$: showOnboarding = data?.showOnboarding ?? false;
	$: organisationAreaPermissions = data?.organisationAreaPermissions ?? null;
	$: currentOrgId = data?.organisationId ?? null;
	$: trialStatus = data?.trialStatus ?? { inTrial: false, expired: false, daysRemaining: 0, trialPlan: null };
	$: isSuperAdmin = data?.isSuperAdmin ?? false;
	$: privacyContactSet = data?.privacyContactSet ?? true;
	$: dbsBoltOn = data?.dbsBoltOn ?? false;
	$: churchBoltOn = data?.churchBoltOn ?? false;

	// Seed badge counts from SSR data whenever layout data refreshes (page nav, org switch)
	$: if (browser && data?.badgeCounts) {
		badgeCounts.seed(data.badgeCounts);
	}

	// Track organisation changes to refresh store data
	let previousOrgId = null;
	let badgePollInterval = null;

	// Lazy-load Onboarding only when needed to reduce initial Hub chunk parse time
	let OnboardingComponent = null;
	let onboardingLoaded = false;
	$: if (browser && showOnboarding && !onboardingLoaded) {
		onboardingLoaded = true;
		import('$lib/crm/components/Onboarding.svelte').then((m) => {
			OnboardingComponent = m.default;
		});
	}

	// Load hub data into stores once after login (enables SPA-like navigation)
	onMount(() => {
		// Load hub data if authenticated and not already loaded
		if (admin && !$hubDataLoaded && !$hubDataLoading) {
			loadHubData();
		}
		previousOrgId = currentOrgId;

		// Poll badge counts every 2 minutes while logged in
		if (admin) {
			badgePollInterval = setInterval(loadBadgeCounts, 2 * 60 * 1000);
		}

		// When user switches back to this tab (e.g. after changing org in MultiOrg), refetch
		const visibilityHandler = () => {
			if (document.visibilityState === 'visible') {
				invalidateAll();
				// Also refresh store data
				if (admin && $hubDataLoaded) {
					refreshHubData();
				}
			}
		};
		document.addEventListener('visibilitychange', visibilityHandler);
		return () => {
			document.removeEventListener('visibilitychange', visibilityHandler);
			if (badgePollInterval) {
				clearInterval(badgePollInterval);
				badgePollInterval = null;
			}
		};
	});

	// Refresh store data when organisation changes
	$: if (browser && currentOrgId && previousOrgId && currentOrgId !== previousOrgId) {
		previousOrgId = currentOrgId;
		if (admin) {
			refreshHubData();
		}
	}

	function getColor(val, fallback) {
		return typeof val === 'string' && val.trim() && /^#[0-9A-Fa-f]{6}$/.test(val.trim()) ? val.trim() : fallback;
	}

	// Hub theme: set CSS variables (theme always provided by layout server with getDefaultTheme fallback)
	$: if (typeof document !== 'undefined' && theme) {
		const root = document.documentElement;
		const D = { primary: '#0d9488', brand: '#0284c7', navbar: '#0f172a', b1: '#0284c7', b2: '#0d9488', b3: '#475569', b4: '#0369a1', b5: '#f59e0b', p1: '#0284c7', p2: '#0369a1', p3: '#0f172a', panel: '#f1f5f9' };
		root.style.setProperty('--color-primary', getColor(theme.primaryColor, D.primary));
		root.style.setProperty('--color-brand', getColor(theme.brandColor, D.brand));
		const navbarBg = theme.navbarBackgroundColor;
		if (typeof navbarBg === 'string') {
			const t = navbarBg.trim();
			if (t && /^#[0-9A-Fa-f]{6}$/.test(t)) {
				root.style.setProperty('--color-navbar-bg', t);
			} else {
				root.style.setProperty('--color-navbar-bg', D.navbar);
			}
		} else {
			root.style.setProperty('--color-navbar-bg', D.navbar);
		}
		root.style.setProperty('--color-button-1', getColor(theme.buttonColors?.[0], D.b1));
		root.style.setProperty('--color-button-2', getColor(theme.buttonColors?.[1], D.b2));
		root.style.setProperty('--color-button-3', getColor(theme.buttonColors?.[2], D.b3));
		root.style.setProperty('--color-button-4', getColor(theme.buttonColors?.[3], D.b4));
		root.style.setProperty('--color-button-5', getColor(theme.buttonColors?.[4], D.b5));
		root.style.setProperty('--color-panel-head-1', getColor(theme.panelHeadColors?.[0], D.p1));
		root.style.setProperty('--color-panel-head-2', getColor(theme.panelHeadColors?.[1], D.p2));
		root.style.setProperty('--color-panel-head-3', getColor(theme.panelHeadColors?.[2], D.p3));
		root.style.setProperty('--color-panel-bg', getColor(theme.panelBackgroundColor, D.panel));
	}
</script>


{#if orgUpdated}
	<div class="mx-4 mt-4 p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm flex items-center justify-between gap-4">
		<span>Organisation updated. Content is now scoped to the selected organisation.</span>
		<button
			type="button"
			class="text-emerald-600 hover:text-emerald-800 font-medium"
			on:click={() => {
				const url = new URL($page.url);
				url.searchParams.delete('org_updated');
				goto(url.pathname + url.search, { replaceState: true });
			}}
		>
			Dismiss
		</button>
	</div>
{/if}

{#if trialStatus.inTrial}
	<div class="mx-4 mt-4 p-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-sm flex items-center justify-between gap-4">
		<span>
			<strong>Professional Trial:</strong> 
			{#if trialStatus.daysRemaining === 1}
				1 day remaining
			{:else if trialStatus.daysRemaining > 0}
				{trialStatus.daysRemaining} days remaining
			{:else}
				Trial ends today
			{/if}
			– Upgrade to keep all your Professional features.
		</span>
		<a
			href="/hub/billing"
			class="px-3 py-1 rounded-lg bg-amber-600 text-white font-medium hover:bg-amber-700 transition-colors whitespace-nowrap"
		>
			Upgrade now
		</a>
	</div>
{:else if trialStatus.expired}
	<div class="mx-4 mt-4 p-3 rounded-lg bg-red-50 text-red-800 border border-red-200 text-sm flex items-center justify-between gap-4">
		<span>
			<strong>Trial ended:</strong> Your Professional trial has expired. You're now on the Free plan. Upgrade to restore Forms, Email campaigns, Members and more.
		</span>
		<a
			href="/hub/billing"
			class="px-3 py-1 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors whitespace-nowrap"
		>
			Upgrade now
		</a>
	</div>
{/if}

<CrmShell
	{admin}
	{theme}
	superAdminEmail={superAdminEmail}
	organisationAreaPermissions={organisationAreaPermissions}
	sundayPlannersLabel={data?.sundayPlannersLabel ?? 'Meeting Planner'}
	showBilling={data?.showBilling ?? false}
	showBillingPortal={data?.showBillingPortal ?? false}
	organisations={data?.organisations ?? []}
	currentOrganisation={data?.currentOrganisation ?? null}
	dbsBoltOn={dbsBoltOn}
>
	<svelte:fragment slot="top">
		<OnboardingRouteBar
			{admin}
			{superAdminEmail}
			{organisationAreaPermissions}
		/>
	</svelte:fragment>
	<slot />
</CrmShell>
{#if !$page.url.pathname.startsWith('/hub/auth/') && admin && showOnboarding && OnboardingComponent}
	<svelte:component
		this={OnboardingComponent}
		{showOnboarding}
		{admin}
		{superAdminEmail}
		{organisationAreaPermissions}
	/>
{/if}
