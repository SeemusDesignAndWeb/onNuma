<script lang="js">
	import { onMount } from 'svelte';

	export let bannerVisible = false;
	/** @type {{ logoPath?: string; primaryColor?: string; brandColor?: string } | null} */
	export let theme = null;

	let menuOpen = false;
	let scrolled = false;
	let mounted = false;
	let navigationPages = [];

	// Page ID to route mapping
	const pageRoutes = {
		'im-new': '/im-new',
		'church': '/church',
		'team': '/team',
		'community-groups': '/community-groups',
		'activities': '/activities',
		'audio': '/audio',
		'media': '/media'
	};

	// Get navigation label for a page
	function getNavigationLabel(page) {
		return page.navigationLabel || page.title || 'Page';
	}

	// Get route for a page
	function getPageRoute(pageId) {
		return pageRoutes[pageId] || `/${pageId}`;
	}

	onMount(async () => {
		// Load pages for navigation
		try {
			const response = await fetch('/api/navigation-pages');
			if (response.ok) {
				navigationPages = await response.json();
			}
		} catch (error) {
			console.error('Failed to load navigation pages:', error);
		}
	});

	onMount(() => {
		mounted = true;
		const handleScroll = () => {
			scrolled = window.scrollY > 50;
		};
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	function smoothScroll(e, targetId) {
		e.preventDefault();
		menuOpen = false;
		const element = document.getElementById(targetId);
		if (element) {
			const offset = 49;
			const elementPosition = element.getBoundingClientRect().top;
			const offsetPosition = elementPosition + window.pageYOffset - offset;
			window.scrollTo({
				top: offsetPosition,
				behavior: 'smooth'
			});
		}
	}
</script>

<style>
	/* Prevent white background on nav link hover/focus (global or browser styles) */
	nav a:hover,
	nav a:focus,
	nav a:active {
		background-color: transparent !important;
	}
	/* Override app.css a.text-white:hover so themed nav links show blue (theme button / navbar colour) on hover */
	nav.navbar--themed a.nav-link:hover,
	nav.navbar--themed a.nav-link:focus,
	nav.navbar--themed a.nav-link:active {
		color: var(--color-button-1, #4A97D2) !important;
	}
</style>

<nav
	class="fixed left-0 right-0 z-50 transition-all duration-300 {bannerVisible ? 'top-[45px]' : 'top-0'} {scrolled ? 'shadow-md' : ''} {theme ? 'navbar--themed' : ''}"
	style="background-color: var(--color-navbar-bg, #FFFFFF);"
>
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between transition-all duration-300" class:py-3={bannerVisible} class:py-4={!bannerVisible}>
			<!-- Logo: colour on public (no theme), white/invert on themed/Hub banner -->
			<a href="/" class="flex items-center z-10">
				<img
					src={theme?.logoPath?.trim() || '/images/egcc-color.png'}
					alt="Eltham Green Community Church"
					class="h-12 w-auto {theme ? 'brightness-0 invert' : ''}"
				/>
			</a>

			<!-- Desktop menu: hover = blue/theme-button-1 (or navbar colour), no white bg -->
			<div class="hidden md:flex items-center gap-8">
				<ul class="flex items-center gap-6">
					{#each navigationPages as page}
						<li>
							<a
								href={getPageRoute(page.id)}
								on:click={() => (menuOpen = false)}
								class="nav-link transition-colors rounded px-1 py-0.5 hover:bg-transparent focus:bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 {theme ? 'text-white focus-visible:outline-theme-button-1' : 'text-gray-800 hover:text-primary focus-visible:outline-primary'}"
							>
								{getNavigationLabel(page)}
							</a>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Mobile menu button -->
			<button
				class="md:hidden flex flex-col gap-1.5 p-2 relative z-50"
				on:click={() => (menuOpen = !menuOpen)}
				aria-label="Toggle menu"
			>
				<span
					class="block w-6 h-0.5 transition-all duration-300 {theme ? 'bg-white' : 'bg-gray-800'}"
					class:rotate-45={menuOpen}
					class:translate-y-2={menuOpen}
				></span>
				<span
					class="block w-6 h-0.5 transition-all duration-300 {theme ? 'bg-white' : 'bg-gray-800'}"
					class:opacity-0={menuOpen}
				></span>
				<span
					class="block w-6 h-0.5 transition-all duration-300 {theme ? 'bg-white' : 'bg-gray-800'}"
					class:-rotate-45={menuOpen}
					class:-translate-y-2={menuOpen}
				></span>
			</button>
		</div>

		<!-- Mobile menu -->
		{#if menuOpen}
			<div class="md:hidden pb-4 -mx-4 px-4 pt-4" style="background-color: var(--color-navbar-bg, #FFFFFF);">
				<ul class="flex flex-col gap-4">
					{#each navigationPages as page}
						<li>
							<a
								href={getPageRoute(page.id)}
								on:click={() => (menuOpen = false)}
								class="nav-link block transition-colors rounded py-1 hover:bg-transparent focus:bg-transparent {theme ? 'text-white' : 'text-gray-800 hover:text-primary'}"
							>
								{getNavigationLabel(page)}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</nav>

