<script>
	import { createEventDispatcher, onMount } from 'svelte';

	export let event = null;
	export let open = false;

	const dispatch = createEventDispatcher();
	let lastScrollY = 0;
	let scrollHandler = null;
	let bannerHeight = 0;

	function close() {
		dispatch('close');
	}

	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { 
			day: 'numeric', 
			month: 'short', 
			year: 'numeric' 
		});
	}

	// Setup scroll handler when banner opens
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
		// Clean up when banner closes
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

{#if open && event}
	<div
		class="fixed top-0 left-0 right-0 z-[100] bg-yellow-400 text-gray-900 shadow-lg transition-all duration-300"
		role="banner"
		aria-label="Event highlight banner"
	>
		<div class="container mx-auto px-4 py-1.5">
			<div class="flex items-center justify-between gap-3">
				<!-- Event Info - All on one line -->
				<div class="flex-1 flex items-center gap-2 min-w-0">
					<div class="flex-shrink-0">
						<svg class="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<div class="flex items-center gap-2 text-xs md:text-sm font-semibold whitespace-nowrap overflow-hidden">
						<span class="truncate">{event.title}</span>
						{#if event.date}
							<span class="flex items-center gap-1 flex-shrink-0">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								{formatDate(event.date)}
								{#if event.time}
									<span>• {event.time}</span>
								{/if}
							</span>
						{/if}
						{#if event.location}
							<span class="flex items-center gap-1 flex-shrink-0">
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
								{event.location}
							</span>
						{/if}
					</div>
				</div>
				
				<!-- Actions -->
				<div class="flex items-center gap-2 flex-shrink-0">
					<a
						href="/events/{event.id}"
						class="px-2.5 py-1 bg-gray-900 text-white rounded hover:bg-gray-800 hover:text-white transition-all font-medium text-xs whitespace-nowrap"
					>
						Learn More
					</a>
					<button
						on:click={close}
						class="text-gray-900 hover:text-gray-700 transition-all hover:rotate-90 hover:scale-110 p-1"
						aria-label="Close banner"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

