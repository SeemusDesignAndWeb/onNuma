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
	/** When true (e.g. signup page with dark bg), use white nav items and no solid background */
	export let lightText = false;
	/** When true, hide the "Get started free" CTA button (e.g. on signup page) */
	export let hideCta = false;
	/** Optional class(es) for the root nav element */
	export let className = '';
	let menuOpen = false;
	let scrolled = false;
	$: overHero = transparentOverHero && !scrolled;
	/** Dark navbar (scrolled on home): dark bg + white nav items */
	$: darkNav = transparentOverHero && scrolled;
	$: useLightNav = overHero || darkNav || lightText;

	onMount(() => {
		const handleScroll = () => {
			scrolled = window.scrollY > 50;
			if (menuOpen) menuOpen = false;
		};
		window.addEventListener('scroll', handleScroll);
		return () => window.removeEventListener('scroll', handleScroll);
	});

	const navLinks = [
		{ id: 'about', label: 'About', href: '/#about' },
		{ id: 'features', label: 'Features', href: '/#features' },
		{ id: 'pricing', label: 'Pricing', href: '/#pricing' },
		{ id: 'contact', label: 'Contact', href: '/#contact', openPopup: true }
	];

	function handleNavClick(e, link) {
		menuOpen = false;
		if (link.openPopup && link.id === 'contact' && typeof window !== 'undefined' && window.location.pathname === '/') {
			e?.preventDefault();
			contactPopupOpen.set(true);
		}
	}
</script>

<nav
	class="fixed left-0 right-0 z-50 transition-all duration-300 {menuOpen ? (useLightNav ? 'bg-slate-800/95 backdrop-blur-sm' : 'bg-white/98 backdrop-blur-sm') : (overHero || lightText) ? 'bg-transparent' : darkNav ? 'bg-slate-800/95 backdrop-blur-sm' : 'bg-white/98 backdrop-blur-sm'} {scrolled && !lightText ? 'shadow-lg' : ''} {bannerVisible ? 'top-[45px]' : 'top-0'} {className}"
	style={!useLightNav ? '--color-navbar-bg: #FFFFFF;' : undefined}
>
	<div class="container mx-auto px-4 sm:px-6 lg:px-8">
		<div class="flex items-center justify-between h-16">
			<a href="/" class="flex items-center z-10" aria-label="OnNuma home">
				<img
					src={theme?.logoPath?.trim() || '/assets/onnuma-logo.png'}
					alt="OnNuma"
					class="h-8 w-auto {useLightNav ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]' : ''}"
				/>
			</a>

			<!-- Desktop: nav links + CTA -->
			<div class="hidden md:flex items-center gap-8">
				<ul class="flex items-center gap-8">
					{#each navLinks as link}
						<li>
							<a
								href={link.href}
								on:click={(e) => handleNavClick(e, link)}
								class="font-medium transition-colors text-[15px] {useLightNav ? 'text-white hover:text-white/90' : 'text-slate-600 hover:text-slate-900'}"
							>
								{link.label}
							</a>
						</li>
					{/each}
				</ul>
				{#if !hideCta}
					<a
						href="/signup?plan=free"
						class="font-semibold text-[15px] px-4 py-2 rounded-lg transition-colors {useLightNav ? 'bg-white text-slate-800 hover:bg-white/90' : 'bg-brand-blue text-white hover:bg-brand-blue/90'}"
					>
						Get started free
					</a>
				{/if}
			</div>

			<!-- Mobile menu button -->
			<button
				class="md:hidden flex flex-col gap-1.5 p-2 relative z-50"
				on:click={() => (menuOpen = !menuOpen)}
				aria-label="Toggle menu"
			>
				<span class="block w-6 h-0.5 transition-all duration-300 {useLightNav ? 'bg-white' : 'bg-slate-700'}" class:rotate-45={menuOpen} class:translate-y-2={menuOpen}></span>
				<span class="block w-6 h-0.5 transition-all duration-300 {useLightNav ? 'bg-white' : 'bg-slate-700'}" class:opacity-0={menuOpen}></span>
				<span class="block w-6 h-0.5 transition-all duration-300 {useLightNav ? 'bg-white' : 'bg-slate-700'}" class:-rotate-45={menuOpen} class:-translate-y-2={menuOpen}></span>
			</button>
		</div>

		{#if menuOpen}
			<div class="md:hidden w-screen max-w-none relative left-1/2 -translate-x-1/2 pb-5 pt-2 border-t px-4 sm:px-6 {useLightNav ? 'border-white/30' : 'border-slate-200'}">
				<ul class="flex flex-col gap-1">
					{#each navLinks as link}
						<li>
							<a
								href={link.href}
								on:click={() => (menuOpen = false)}
								class="block w-full text-left py-3 font-medium {useLightNav ? 'text-white hover:text-white/90' : 'text-slate-700 hover:text-slate-900'}"
							>
								{link.label}
							</a>
						</li>
					{/each}
					{#if !hideCta}
						<li class="pt-2 mt-2 border-t {useLightNav ? 'border-white/30' : 'border-slate-200'}">
							<a
								href="/signup?plan=free"
								class="block w-full py-3 font-semibold text-center rounded-lg {useLightNav ? 'bg-white text-slate-800' : 'bg-brand-blue text-white'}"
								on:click={() => (menuOpen = false)}
							>
								Get started free
							</a>
						</li>
					{/if}
				</ul>
			</div>
		{/if}
	</div>
</nav>
