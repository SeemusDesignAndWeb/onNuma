<script>
	import { page } from '$app/stores';

	export let data;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: rawPath = $page.url.pathname;
	$: path = rawPath.startsWith('/multi-org/marketing') ? rawPath.slice('/multi-org/marketing'.length) || '/' : rawPath;

	const sections = [
		{ href: '', label: 'Overview', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', match: (p) => p === '/' },
		{ href: '/templates', label: 'Email Templates', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', match: (p) => p.startsWith('/templates') },
		{ href: '/mailshots', label: 'Mailshots', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', match: (p) => p.startsWith('/mailshots') },
		{ href: '/sequences', label: 'Sequences', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', match: (p) => p.startsWith('/sequences') },
		{ href: '/blocks', label: 'Content Blocks', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', match: (p) => p.startsWith('/blocks') },
		{ href: '/links', label: 'Links Library', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', match: (p) => p.startsWith('/links') },
		{ href: '/reports', label: 'Reports & Logs', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', match: (p) => p.startsWith('/reports') },
		{ href: '/variables', label: 'Variables', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', match: (p) => p.startsWith('/variables') },
		{ href: '/branding', label: 'Branding', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01', match: (p) => p.startsWith('/branding') },
		{ href: '/preferences', label: 'Consent', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', match: (p) => p.startsWith('/preferences') },
		{ href: '/migration', label: 'Import / Export', icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12', match: (p) => p.startsWith('/migration') }
	];
</script>

<div class="flex gap-6 min-h-0 flex-1">
	<!-- Sidebar sub-nav -->
	<aside class="w-52 flex-shrink-0 hidden md:block">
		<nav class="sticky top-24 flex flex-col gap-0.5">
			{#each sections as sec}
				{@const active = sec.match(path)}
				<a
					href="{base}/marketing{sec.href}"
					class="flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors {active ? 'bg-[#EB9486]/15 text-[#c75a4a] font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}"
				>
					<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={sec.icon} /></svg>
					{sec.label}
				</a>
			{/each}
		</nav>
	</aside>
	<!-- Main content -->
	<div class="flex-1 min-w-0">
		<slot />
	</div>
</div>
