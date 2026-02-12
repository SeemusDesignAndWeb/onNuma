<script>
	import '$lib/crm/hub.css';
	import CrmShell from '$lib/crm/components/CrmShell.svelte';
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

	export let data = {};
	export let params = {};
	$: orgUpdated = typeof $page !== 'undefined' && $page.url?.searchParams?.get('org_updated') === '1';
	$: admin = data?.admin ?? null;
	$: theme = data?.theme ?? null;
	$: superAdminEmail = data?.superAdminEmail ?? null;
	$: showOnboarding = data?.showOnboarding ?? false;
	$: organisationAreaPermissions = data?.organisationAreaPermissions ?? null;
	$: currentOrgId = data?.organisationId ?? null;

	// Track organisation changes to refresh store data
	let previousOrgId = null;

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

	// Hub theme: set CSS variables on document (client-side only; avoids PostCSS preprocessing issues)
	$: if (typeof document !== 'undefined' && theme) {
		const root = document.documentElement;
		root.style.setProperty('--color-primary', getColor(theme.primaryColor, '#4BB170'));
		root.style.setProperty('--color-brand', getColor(theme.brandColor, '#4A97D2'));
		const navbarBg = theme.navbarBackgroundColor;
		if (typeof navbarBg === 'string') {
			const t = navbarBg.trim();
			if (t && /^#[0-9A-Fa-f]{6}$/.test(t) && t !== '#FFFFFF' && t !== '#ffffff') {
				root.style.setProperty('--color-navbar-bg', t);
			} else {
				root.style.setProperty('--color-navbar-bg', '#4A97D2');
			}
		} else {
			root.style.setProperty('--color-navbar-bg', '#4A97D2');
		}
		root.style.setProperty('--color-button-1', getColor(theme.buttonColors?.[0], '#4A97D2'));
		root.style.setProperty('--color-button-2', getColor(theme.buttonColors?.[1], '#4BB170'));
		root.style.setProperty('--color-button-3', getColor(theme.buttonColors?.[2], '#3B79A8'));
		root.style.setProperty('--color-button-4', getColor(theme.buttonColors?.[3], '#3C8E5A'));
		root.style.setProperty('--color-button-5', getColor(theme.buttonColors?.[4], '#E6A324'));
		root.style.setProperty('--color-panel-head-1', getColor(theme.panelHeadColors?.[0], '#4A97D2'));
		root.style.setProperty('--color-panel-head-2', getColor(theme.panelHeadColors?.[1], '#3B79A8'));
		root.style.setProperty('--color-panel-head-3', getColor(theme.panelHeadColors?.[2], '#2C5B7E'));
		root.style.setProperty('--color-panel-bg', getColor(theme.panelBackgroundColor, '#E8F2F9'));
	}
</script>

<svelte:head>
	<!-- Preload LCP image (Hub logo) so header paints faster -->
	<link rel="preload" as="image" href={theme?.logoPath?.trim() || '/assets/OnNuma-Icon.png'} fetchpriority="high" />
</svelte:head>

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
<CrmShell {admin} {theme} superAdminEmail={superAdminEmail} organisationAreaPermissions={organisationAreaPermissions} sundayPlannersLabel={data?.sundayPlannersLabel ?? 'Sunday Planners'} showBilling={data?.showBilling ?? false} showBillingPortal={data?.showBillingPortal ?? false}>
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
