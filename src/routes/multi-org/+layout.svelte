<script>
	import '$lib/crm/hub.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import MultiOrgShell from '$lib/crm/components/MultiOrgShell.svelte';

	export let data;
	$: multiOrgAdmin = data?.multiOrgAdmin || null;

	const base = '/multi-org';

	// Peach theme: set CSS variables so hub.css (headings, buttons, panel) uses peach instead of blue
	function applyPeachTheme() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		const peach = {
			primary: '#EB9486',
			brand: '#e08070',
			navbar: '#5c4033',
			b1: '#EB9486',
			b2: '#e08070',
			b3: '#475569',
			b4: '#c75a4a',
			b5: '#f59e0b',
			p1: '#c75a4a',
			p2: '#b85a4a',
			p3: '#4a3728',
			panel: '#fdf8f6'
		};
		root.style.setProperty('--color-primary', peach.primary);
		root.style.setProperty('--color-brand', peach.brand);
		root.style.setProperty('--color-navbar-bg', peach.navbar);
		root.style.setProperty('--color-button-1', peach.b1);
		root.style.setProperty('--color-button-2', peach.b2);
		root.style.setProperty('--color-button-3', peach.b3);
		root.style.setProperty('--color-button-4', peach.b4);
		root.style.setProperty('--color-button-5', peach.b5);
		root.style.setProperty('--color-panel-head-1', peach.p1);
		root.style.setProperty('--color-panel-head-2', peach.p2);
		root.style.setProperty('--color-panel-head-3', peach.p3);
		root.style.setProperty('--color-panel-bg', peach.panel);
	}

	function clearPeachTheme() {
		if (typeof document === 'undefined') return;
		const root = document.documentElement;
		root.style.removeProperty('--color-primary');
		root.style.removeProperty('--color-brand');
		root.style.removeProperty('--color-navbar-bg');
		root.style.removeProperty('--color-button-1');
		root.style.removeProperty('--color-button-2');
		root.style.removeProperty('--color-button-3');
		root.style.removeProperty('--color-button-4');
		root.style.removeProperty('--color-button-5');
		root.style.removeProperty('--color-panel-head-1');
		root.style.removeProperty('--color-panel-head-2');
		root.style.removeProperty('--color-panel-head-3');
		root.style.removeProperty('--color-panel-bg');
	}

	onMount(() => {
		applyPeachTheme();
		return () => clearPeachTheme();
	});
</script>

<MultiOrgShell base={base}>
	<slot />
</MultiOrgShell>
