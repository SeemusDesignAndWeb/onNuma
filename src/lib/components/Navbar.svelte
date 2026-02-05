<script lang="js">
	import { onMount } from 'svelte';
	import { contactPopupOpen } from '$lib/stores/contactPopup.js';

	export let bannerVisible = false;
	/** @type {{ logoPath?: string } | null} */
	export let theme = null;
	/** @type {{ ctaRequestDemoUrl?: string; ctaStartOrganisationUrl?: string } | null} */
	export let landing = null;
	/** When true (marketing home), navbar is transparent over hero until scrolled */
	export let transparentOverHero = false;
	/** Optional class(es) for the root nav element */
	export let className = '';
	let menuOpen = false;
	let scrolled = false;
	$: overHero = transparentOverHero && !scrolled;
	/** Dark navbar (scrolled on home): dark bg + white nav items */
	$: darkNav = transparentOverHero && scrolled;

	function scrollTo(e, targetId) {
		e?.preventDefault();
		menuOpen = false;
		const el = document.getElementById(targetId);
		if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	onMount(() => {
		const handleScroll = () => { scrolled = window.scrollY > 50; };
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	const navLinks = [
		{ id: 'about', label: 'About' },
		{ id: 'features', label: 'Features' },
		{ id: 'pricing', label: 'Pricing' },
		{ id: 'contact', label: 'Contact', openPopup: true }
	];

	function handleNavClick(e, link) {
		if (link.openPopup && link.id === 'contact') {
			e?.preventDefault();
			menuOpen = false;
			contactPopupOpen.set(true);
		} else {
			scrollTo(e, link.id);
		}
	}
</script>

<nav
	class="fixed left-0 right-0 z-50 transition-all duration-300 {overHero ? 'bg-transparent' : darkNav ? 'bg-slate-800/95 backdrop-blur-sm' : 'bg-white/98 backdrop-blur-sm'} {scrolled ? 'shadow-lg' : ''} {bannerVisible ? 'top-[45px]' : 'top-0'} {className}"
	style={overHero || darkNav ? undefined : '--color-navbar-bg: #FFFFFF;'}
>
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">
			<a href="/" class="flex items-center z-10" aria-label="OnNuma home">
				<img
					src={theme?.logoPath?.trim() || '/images/onnuma-logo.png'}
					alt="OnNuma"
					class="h-8 w-auto {overHero || darkNav ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]' : ''}"
				/>
			</a>

			<!-- Desktop: nav links + CTA -->
			<div class="hidden md:flex items-center gap-8">
				<ul class="flex items-center gap-8">
					{#each navLinks as link}
						<li>
							<button
								type="button"
								on:click={(e) => handleNavClick(e, link)}
								class="font-medium transition-colors text-[15px] {overHero || darkNav ? 'text-white hover:text-white/90' : 'text-slate-600 hover:text-slate-900'}"
							>
								{link.label}
							</button>
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
				<span class="block w-6 h-0.5 transition-all duration-300 {overHero || darkNav ? 'bg-white' : 'bg-slate-700'}" class:rotate-45={menuOpen} class:translate-y-2={menuOpen}></span>
				<span class="block w-6 h-0.5 transition-all duration-300 {overHero || darkNav ? 'bg-white' : 'bg-slate-700'}" class:opacity-0={menuOpen}></span>
				<span class="block w-6 h-0.5 transition-all duration-300 {overHero || darkNav ? 'bg-white' : 'bg-slate-700'}" class:-rotate-45={menuOpen} class:-translate-y-2={menuOpen}></span>
			</button>
		</div>

		{#if menuOpen}
			<div class="md:hidden pb-5 pt-2 border-t {overHero ? 'bg-slate-800/95 border-white/30' : darkNav ? 'bg-slate-800 border-white/30' : 'bg-white border-slate-200'}">
				<ul class="flex flex-col gap-1">
					{#each navLinks as link}
						<li>
							<button
								type="button"
								on:click={(e) => handleNavClick(e, link)}
								class="block w-full text-left py-3 font-medium {overHero || darkNav ? 'text-white hover:text-white/90' : 'text-slate-700 hover:text-slate-900'}"
							>
								{link.label}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
</nav>
