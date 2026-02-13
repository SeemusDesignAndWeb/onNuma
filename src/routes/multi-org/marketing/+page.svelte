<script>
	import { enhance } from '$app/forms';
	export let data;
	export let form;
	$: base = data?.multiOrgBasePath ?? '/multi-org';
	$: stats = data?.stats || {};

	let seeding = false;

	const cards = [
		{ label: 'Email Templates', href: '/marketing/templates', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', get: (s) => `${s?.templates?.active ?? 0} active / ${s?.templates?.total ?? 0} total` },
		{ label: 'Mailshots', href: '/marketing/mailshots', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', get: (s) => `${s?.mailshots?.active ?? 0} active / ${s?.mailshots?.total ?? 0} total` },
		{ label: 'Sequences', href: '/marketing/sequences', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', get: (s) => `${s?.sequences?.active ?? 0} active / ${s?.sequences?.total ?? 0} total` },
		{ label: 'Content Blocks', href: '/marketing/blocks', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10', get: (s) => `${s?.blocks ?? 0} blocks` },
		{ label: 'Links Library', href: '/marketing/links', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1', get: (s) => `${s?.links ?? 0} links` }
	];
</script>

<svelte:head>
	<title>Marketing – OnNuma</title>
</svelte:head>

<div>
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-slate-800">Marketing</h1>
		<p class="mt-1 text-sm text-slate-500">Create onboarding email templates, build timed sequences, and track engagement.</p>
	</div>

	<!-- Stats cards -->
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
		{#each cards as card}
			<a href="{base}{card.href}" class="block rounded-2xl border {card.color} p-5 hover:shadow-md transition-shadow">
				<div class="flex items-center gap-3 mb-3">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={card.icon} /></svg>
					<span class="font-semibold text-sm">{card.label}</span>
				</div>
				<p class="text-xs opacity-80">{card.get(stats)}</p>
			</a>
		{/each}
	</div>

	<!-- Send stats -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
		<div class="bg-white rounded-2xl border border-slate-200 p-5">
			<p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Queue Pending</p>
			<p class="text-2xl font-bold text-slate-800">{stats?.queue?.pending ?? 0}</p>
		</div>
		<div class="bg-white rounded-2xl border border-slate-200 p-5">
			<p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Emails Sent</p>
			<p class="text-2xl font-bold text-emerald-600">{stats?.queue?.sent ?? 0}</p>
		</div>
		<div class="bg-white rounded-2xl border border-slate-200 p-5">
			<p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Failed</p>
			<p class="text-2xl font-bold text-red-600">{stats?.queue?.failed ?? 0}</p>
		</div>
	</div>

	<!-- Seed result -->
	{#if form?.seeded}
		{@const total = (form.counts.blocks ?? 0) + (form.counts.links ?? 0) + (form.counts.templates ?? 0) + (form.counts.sequences ?? 0) + (form.counts.steps ?? 0)}
		<div class="mb-6 p-4 rounded-xl {total > 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'} border text-sm">
			{#if total > 0}
				Onboarding content seeded successfully!
				Created {form.counts.blocks} blocks, {form.counts.links} links, {form.counts.templates} templates, {form.counts.sequences} sequence{form.counts.sequences !== 1 ? 's' : ''} with {form.counts.steps} steps.
			{:else}
				No new content was created. You already have the full onboarding set (blocks, links, templates, and the Default Onboarding sequence). Nothing was duplicated.
			{/if}
		</div>
	{/if}
	{#if form?.error}
		<div class="mb-6 p-4 rounded-xl bg-red-50 text-red-800 border border-red-200 text-sm">
			Error seeding content: {form.error}
		</div>
	{/if}

	<!-- Quick actions -->
	<div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
		<h2 class="text-lg font-semibold text-slate-800 mb-4">Quick Actions</h2>
		<div class="flex flex-wrap gap-3">
			<a href="{base}/marketing/templates/new" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[#EB9486] hover:bg-[#e08070] transition-all">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
				New Template
			</a>
			<a href="{base}/marketing/sequences/new" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 transition-all">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
				New Sequence
			</a>
			<a href="{base}/marketing/mailshots/new" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-all">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
				New Mailshot
			</a>
			<a href="{base}/marketing/blocks/new" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
				New Block
			</a>
			<a href="{base}/marketing/reports" class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
				View Reports
			</a>
		</div>
	</div>

	<!-- Seed onboarding content -->
	<div class="mt-6 bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border border-slate-200/80 shadow-sm p-6">
		<div class="flex items-start gap-4">
			<div class="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
				<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
			</div>
			<div class="flex-1">
				<h2 class="text-lg font-semibold text-slate-800">Seed Onboarding Content</h2>
				<p class="mt-1 text-sm text-slate-500 leading-relaxed">
					Generate a complete set of professional onboarding emails, reusable content blocks, links, and a 21-day sequence.
					Covers contacts, events, rotas, emails, forms, meeting planners, settings, and tips. Existing items (same name/key) are skipped — if you see "0 created", you already have the full set.
				</p>
				<form method="POST" action="?/seedContent" use:enhance={() => { seeding = true; return async ({ update }) => { seeding = false; update(); }; }} class="mt-4">
					<button
						type="submit"
						disabled={seeding}
						class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
					>
						{#if seeding}
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
							Seeding…
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
							Seed Onboarding Content
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>
</div>
