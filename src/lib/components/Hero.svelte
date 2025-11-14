<script lang="js">
	import { onMount } from 'svelte';

	export let heroSlides = null;
	export let featuredEvents = null;

	let currentSlide = 0;
	let autoplayInterval = null;

	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	function formatTime(timeString) {
		if (!timeString) return '';
		// Convert 24h to 12h format if needed
		const [hours, minutes] = timeString.split(':');
		const hour = parseInt(hours);
		const ampm = hour >= 12 ? 'PM' : 'AM';
		const hour12 = hour % 12 || 12;
		return `${hour12}:${minutes} ${ampm}`;
	}

	// Fallback slides if none in database
	const defaultSlides = [
		{
			id: 'default-1',
			title: 'Eltham Green Community Church',
			subtitle: 'A welcoming community of faith, hope, and love',
			cta: 'Join Us',
			ctaLink: '#services',
			image: '/images/church-bg.jpg'
		},
		{
			id: 'default-2',
			title: 'Sunday Worship',
			subtitle: 'Join us every Sunday for inspiring worship and fellowship',
			cta: 'Service Times',
			ctaLink: '#services',
			image: '/images/church-bg.jpg'
		},
		{
			id: 'default-3',
			title: 'Community & Connection',
			subtitle: 'Building relationships and serving our community together',
			cta: 'Get Involved',
			ctaLink: '#contact',
			image: '/images/church-bg.jpg'
		}
	];

	$: slides = heroSlides && heroSlides.length > 0 ? heroSlides : defaultSlides;

	function nextSlide() {
		currentSlide = (currentSlide + 1) % slides.length;
	}

	function goToSlide(index) {
		currentSlide = index;
	}

	function smoothScroll(e, targetId) {
		e.preventDefault();
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

	onMount(() => {
		autoplayInterval = window.setInterval(nextSlide, 5000);
		return () => {
			if (autoplayInterval) window.clearInterval(autoplayInterval);
		};
	});
</script>

<section id="home" class="relative h-screen overflow-hidden">
	{#each slides as slide, index}
		<div
			class="absolute inset-0 transition-opacity duration-1000"
			class:opacity-0={currentSlide !== index}
			class:opacity-100={currentSlide === index}
			style="background-image: url('{slide.image}'); background-size: cover; background-position: center;"
		>
		<div class="absolute inset-0 bg-black bg-opacity-40"></div>
		<div class="relative h-full flex items-center">
			<div class="container mx-auto px-4">
				<div class="grid md:grid-cols-3 gap-8 w-full">
					<!-- Left side - Hero content -->
					<div class="md:col-span-2">
						<div class="max-w-3xl">
							{#if slide.title}
								<p class="text-white text-xl md:text-2xl font-light mb-4 animate-fade-in">
									{slide.title}
								</p>
							{/if}
							{#if slide.subtitle}
								<h1 class="text-white text-5xl md:text-6xl font-bold mb-8 leading-tight animate-fade-in">
									{slide.subtitle}
								</h1>
							{/if}
							{#if slide.cta}
								<a
									href={slide.ctaLink}
									on:click={(e) => smoothScroll(e, slide.ctaLink.slice(1))}
									class="inline-block bg-primary text-white px-8 py-4 rounded-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg animate-fade-in"
								>
									{slide.cta}
								</a>
							{/if}
						</div>
					</div>
					<!-- Right side - Events -->
					{#if featuredEvents && featuredEvents.length > 0}
						<div class="md:col-span-1">
							<div class="space-y-4 animate-fade-in">
								{#each featuredEvents as event}
									<a
										href="/events/{event.id}"
										class="block relative rounded-lg overflow-hidden shadow-2xl transition-all transform hover:scale-105 cursor-pointer group"
										style="height: 280px;"
									>
										{#if event.image}
											<div
												class="absolute inset-0 bg-cover bg-center"
												style="background-image: url('{event.image}');"
											>
												<div class="absolute inset-0 bg-black bg-opacity-40 group-hover:bg-opacity-30 transition-all"></div>
											</div>
										{:else}
											<div class="absolute inset-0 bg-primary"></div>
										{/if}
										<div class="absolute bottom-0 left-0 right-0 bg-primary/70 px-4 py-2">
											<div class="flex items-center gap-2 text-sm text-white">
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
												</svg>
												<span>{formatDate(event.date)}</span>
												{#if event.time}
													<span class="mx-1">•</span>
													<span>{formatTime(event.time)}</span>
												{/if}
											</div>
											{#if event.location}
												<div class="flex items-center gap-1 text-xs text-white/80 mt-1">
													<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
													</svg>
													<span class="truncate">{event.location}</span>
												</div>
											{/if}
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
		</div>
	{/each}

	<!-- Slide indicators -->
	<div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
		{#each slides as _, index}
			<button
				on:click={() => goToSlide(index)}
				class="w-3 h-3 rounded-full transition-all {currentSlide === index ? 'bg-white' : 'bg-white/50'}"
				aria-label="Go to slide {index + 1}"
			></button>
		{/each}
	</div>
</section>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in {
		animation: fade-in 1s ease-out;
	}
</style>

