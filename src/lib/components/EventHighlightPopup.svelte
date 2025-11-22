<script>
	import { createEventDispatcher, onMount } from 'svelte';

	export let event = null;
	export let open = false;

	const dispatch = createEventDispatcher();
	let lastScrollY = 0;
	let scrollHandler = null;

	function close() {
		dispatch('close');
	}

	function handleClickOutside(event) {
		if (event.target === event.currentTarget) {
			close();
		}
	}

	function getExcerpt(text, maxLength = 200) {
		if (!text) return '';
		// Strip HTML tags for excerpt
		const stripped = text.replace(/<[^>]*>/g, '');
		if (stripped.length <= maxLength) return stripped;
		return stripped.substring(0, maxLength).trim() + '...';
	}

	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { 
			day: 'numeric', 
			month: 'long', 
			year: 'numeric' 
		});
	}

	// Setup scroll handler when popup opens
	$: if (open && typeof window !== 'undefined') {
		lastScrollY = window.scrollY || window.pageYOffset || 0;
		
		// Remove old handler if it exists
		if (scrollHandler) {
			window.removeEventListener('scroll', scrollHandler);
		}
		
		scrollHandler = () => {
			if (!open) return;
			
			const currentScrollY = window.scrollY || window.pageYOffset || 0;
			const scrollDelta = Math.abs(currentScrollY - lastScrollY);
			
			// Close on any scroll movement
			if (scrollDelta > 5) {
				close();
			}
		};

		window.addEventListener('scroll', scrollHandler, { passive: true });
	} else {
		// Clean up when popup closes
		if (scrollHandler && typeof window !== 'undefined') {
			window.removeEventListener('scroll', scrollHandler);
			scrollHandler = null;
		}
	}

	onMount(() => {
		return () => {
			// Cleanup on component destroy
			if (scrollHandler && typeof window !== 'undefined') {
				window.removeEventListener('scroll', scrollHandler);
			}
		};
	});
</script>

<style>
	.popup-container {
		animation: slideInScale 0.3s ease-out;
	}
	
	@keyframes slideInScale {
		from {
			opacity: 0;
			transform: scale(0.9) translateY(-20px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}
</style>

{#if open && event}
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm"
		on:click={handleClickOutside}
		role="dialog"
		aria-modal="true"
		aria-labelledby="popup-title"
	>
		<div
			class="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden transform transition-all popup-container"
			on:click|stopPropagation
		>
			<!-- Image Hero Section with Overlay -->
			{#if event.image}
				<div class="relative h-64 overflow-hidden">
					<img
						src={event.image}
						alt={event.title}
						class="w-full h-full object-cover"
					/>
					<!-- Gradient Overlay -->
					<div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
					<!-- Header Content Over Image -->
					<div class="absolute inset-0 flex flex-col justify-between p-5">
						<div class="flex justify-between items-start">
							<div>
								<h2 id="popup-title" class="text-2xl md:text-3xl font-bold text-white mb-2">An event you will not want to miss</h2>
							</div>
							<button
								on:click={close}
								class="text-white hover:text-gray-200 transition-all hover:rotate-90 hover:scale-110 z-10 bg-black/30 backdrop-blur-sm rounded-full p-2"
								aria-label="Close popup"
							>
								<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					</div>
				</div>
			{:else}
				<!-- Header without Image -->
				<div class="bg-gradient-to-r from-primary to-primary/80 text-white p-5 flex justify-between items-center relative overflow-hidden">
					<h2 id="popup-title" class="text-2xl md:text-3xl font-bold text-white pb-0 mb-0">An event you will not want to miss</h2>
					<button
						on:click={close}
						class="text-white hover:text-gray-200 transition-all hover:rotate-90 hover:scale-110 z-10 bg-white/10 backdrop-blur-sm rounded-full p-2"
						aria-label="Close popup"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
					<div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
				</div>
			{/if}

			<!-- Content Section -->
			<div class="p-6 bg-white">
				<div class="space-y-4">
					<!-- Event Title -->
					<h3 class="text-3xl font-bold text-gray-900">{event.title}</h3>
					
					<!-- Event Details -->
					<div class="flex flex-wrap gap-4 text-gray-600">
						{#if event.date}
							<div class="flex items-center gap-2">
								<div class="bg-primary/10 rounded-full p-2">
									<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
								<div>
									<div class="text-sm font-medium text-gray-500">Date</div>
									<div class="font-semibold">{formatDate(event.date)}</div>
									{#if event.time}
										<div class="text-sm">{event.time}</div>
									{/if}
								</div>
							</div>
						{/if}
						
						{#if event.location}
							<div class="flex items-center gap-2">
								<div class="bg-primary/10 rounded-full p-2">
									<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
								</div>
								<div>
									<div class="text-sm font-medium text-gray-500">Location</div>
									<div class="font-semibold">{event.location}</div>
								</div>
							</div>
						{/if}
					</div>
					
					<!-- Description -->
					{#if event.description || event.eventInfo}
						<div class="text-gray-700 leading-relaxed pt-2">
							{@html getExcerpt(event.description || event.eventInfo || '', 200)}
						</div>
					{/if}
					
					<!-- CTA Button -->
					<div class="pt-4">
						<a
							href="/events/{event.id}"
							class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 font-semibold"
						>
							<span>Learn More</span>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
							</svg>
						</a>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

