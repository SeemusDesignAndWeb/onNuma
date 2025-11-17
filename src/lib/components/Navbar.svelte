<script lang="js">
	import { onMount } from 'svelte';

	let menuOpen = false;
	let scrolled = false;
	let mounted = false;

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
	class="fixed top-0 left-0 right-0 z-50 transition-all duration-300 {menuOpen ? 'bg-brand-blue shadow-md' : scrolled ? 'bg-white/90 backdrop-blur-sm shadow-md' : 'bg-white/70 backdrop-blur-sm'}"
>
	<div class="container mx-auto px-4">
		<div class="flex items-center justify-between py-4">
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
					<li>
						<a
							href="/im-new"
							on:click={() => (menuOpen = false)}
							class="transition-colors text-gray-900 hover:text-brand-blue"
						>
							I'm New
						</a>
					</li>
					<li>
						<a
							href="/church"
							on:click={() => (menuOpen = false)}
							class="transition-colors text-gray-900 hover:text-brand-blue"
						>
							Church
						</a>
					</li>
					<li>
						<a
							href="/team"
							on:click={() => (menuOpen = false)}
							class="transition-colors text-gray-900 hover:text-brand-blue"
						>
							Team
						</a>
					</li>
					<li>
						<a
							href="/community-groups"
							on:click={() => (menuOpen = false)}
							class="transition-colors text-gray-900 hover:text-brand-blue"
						>
							Community Groups
						</a>
					</li>
					<li>
						<a
							href="/activities"
							on:click={() => (menuOpen = false)}
							class="transition-colors text-gray-900 hover:text-brand-blue"
						>
							Activities
						</a>
					</li>
					<li>
						<a
							href="/audio"
							on:click={() => (menuOpen = false)}
							class="transition-colors text-gray-900 hover:text-brand-blue"
						>
							Audio
						</a>
					</li>
					<li>
						<a
							href="/media"
							on:click={() => (menuOpen = false)}
							class="transition-colors text-gray-900 hover:text-brand-blue"
						>
							Online
						</a>
					</li>
				</ul>
			</div>
		</div>

		<!-- Mobile menu -->
		{#if menuOpen}
			<div class="md:hidden pb-4 bg-brand-blue -mx-4 px-4 pt-4">
				<ul class="flex flex-col gap-4">
					<li>
						<a
							href="/im-new"
							on:click={() => (menuOpen = false)}
							class="block transition-colors text-white hover:text-gray-200"
						>
							I'm New
						</a>
					</li>
					<li>
						<a
							href="/church"
							on:click={() => (menuOpen = false)}
							class="block transition-colors text-white hover:text-gray-200"
						>
							Church
						</a>
					</li>
					<li>
						<a
							href="/team"
							on:click={() => (menuOpen = false)}
							class="block transition-colors text-white hover:text-gray-200"
						>
							Team
						</a>
					</li>
					<li>
						<a
							href="/community-groups"
							on:click={() => (menuOpen = false)}
							class="block transition-colors text-white hover:text-gray-200"
						>
							Community Groups
						</a>
					</li>
					<li>
						<a
							href="/activities"
							on:click={() => (menuOpen = false)}
							class="block transition-colors text-white hover:text-gray-200"
						>
							Activities
						</a>
					</li>
					<li>
						<a
							href="/audio"
							on:click={() => (menuOpen = false)}
							class="block transition-colors text-white hover:text-gray-200"
						>
							Audio
						</a>
					</li>
					<li>
						<a
							href="/media"
							on:click={() => (menuOpen = false)}
							class="block transition-colors text-white hover:text-gray-200"
						>
							Online
						</a>
					</li>
				</ul>
			</div>
		{/if}
	</div>
</nav>

