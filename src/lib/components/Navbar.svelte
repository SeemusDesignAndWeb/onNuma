<script lang="js">
	import { onMount } from 'svelte';

	export let bannerVisible = false;

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

<nav
	class="fixed left-0 right-0 z-50 transition-all duration-300 {bannerVisible ? 'top-[45px]' : 'top-0'} {menuOpen ? 'bg-brand-blue shadow-md' : scrolled ? 'bg-white/90 backdrop-blur-sm shadow-md' : 'bg-white/70 backdrop-blur-sm'}"
>
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between transition-all duration-300" class:py-3={bannerVisible} class:py-4={!bannerVisible}>
			<!-- Logo -->
			<a href="/" class="flex items-center">
				<img
					src="/images/egcc-color.png"
					alt="Eltham Green Community Church"
					class="h-12 w-auto transition-all duration-300 {menuOpen ? 'brightness-0 invert' : ''} {menuOpen ? 'md:brightness-0 md:invert' : 'md:brightness-100 md:invert-0'}"
				/>
			</a>

			<!-- Mobile menu button -->
			<button
				class="md:hidden flex flex-col gap-1.5 p-2"
				on:click={() => (menuOpen = !menuOpen)}
				aria-label="Toggle menu"
			>
				<span
					class="block w-6 h-0.5 transition-all duration-300 {menuOpen ? 'bg-white' : 'bg-gray-900'}"
					class:rotate-45={menuOpen}
					class:translate-y-2={menuOpen}
				></span>
				<span
					class="block w-6 h-0.5 transition-all duration-300 {menuOpen ? 'bg-white' : 'bg-gray-900'}"
					class:opacity-0={menuOpen}
				></span>
				<span
					class="block w-6 h-0.5 transition-all duration-300 {menuOpen ? 'bg-white' : 'bg-gray-900'}"
					class:-rotate-45={menuOpen}
					class:-translate-y-2={menuOpen}
				></span>
			</button>

			<!-- Desktop menu -->
			<div class="hidden md:flex items-center gap-8">
				<ul class="flex items-center gap-6">
					{#each navigationPages as page}
						<li>
							<a
								href={getPageRoute(page.id)}
								on:click={() => (menuOpen = false)}
								class="transition-colors text-gray-900 hover:text-brand-blue"
							>
								{getNavigationLabel(page)}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>

		<!-- Mobile menu -->
		{#if menuOpen}
			<div class="md:hidden pb-4 bg-brand-blue -mx-4 px-4 pt-4">
				<ul class="flex flex-col gap-4">
					{#each navigationPages as page}
						<li>
							<a
								href={getPageRoute(page.id)}
								on:click={() => (menuOpen = false)}
								class="block transition-colors text-white hover:text-gray-200"
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

