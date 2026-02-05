<script>
	export let data;
	$: multiOrgAdmin = data?.multiOrgAdmin || null;
	$: base = data?.multiOrgBasePath ?? '';
</script>

<div class="min-h-screen bg-gradient-to-br from-[#f8f8fa] via-white to-[#F3DE8A]/20 flex flex-col">
	{#if multiOrgAdmin}
		<div class="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
				<div class="flex items-center justify-between gap-4">
					<div class="flex items-center gap-6">
						<img src="/images/onnuma-logo.png" alt="OnNuma" class="h-9 w-auto object-contain" />
						<nav class="flex items-center gap-1">
							<a
								href="/organisations"
								class="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors bg-[#EB9486]/15 text-[#c75a4a]"
							>
								<svg class="w-4 h-4 mr-2 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
								Organisations
							</a>
						</nav>
					</div>
					<div class="flex items-center gap-2 text-sm text-slate-600">
						<a
							href="/auth/logout"
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
							Sign out
						</a>
					</div>
				</div>
			</div>
		</div>
	{/if}
	<main class="flex-1 flex flex-col max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-0">
		<slot />
	</main>
</div>
