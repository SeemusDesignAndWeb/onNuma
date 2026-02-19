<script>
	/** @type {{ logoPath?: string } | null} */
	export let theme = null;
</script>

<header
	class="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-3 shadow-md"
	style="background-color: var(--color-navbar-bg, #FFFFFF);"
>
	<a href="/" class="flex items-center">
		<img
			src={theme?.logoPath?.trim() || '/assets/OnNuma-Icon.png'}
			alt="Logo"
			class="h-10 w-auto {theme ? 'brightness-0 invert' : ''}"
		/>
	</a>
	<a
		href="/"
		class="text-sm font-medium {theme ? 'text-white hover:text-white/90' : 'text-gray-800 hover:text-primary'} transition-colors"
	>
		Back to site
	</a>
</header>
