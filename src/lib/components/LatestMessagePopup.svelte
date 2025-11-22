<script>
	import { createEventDispatcher, onMount } from 'svelte';

	export let video = null;
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

{#if open && video}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm"
		on:click={handleClickOutside}
		role="dialog"
		aria-modal="true"
		aria-labelledby="popup-title"
	>
		<div
			class="bg-primary rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all popup-container"
			on:click|stopPropagation
		>
			<!-- Funky Header with Badge -->
			<div class="bg-primary text-white p-3 flex justify-between items-center relative overflow-hidden">
				<div class="flex items-center gap-4 z-10 flex-1">
					<div class="bg-white/20 backdrop-blur-sm rounded-full p-3 flex-shrink-0">
						<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
							<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
						</svg>
					</div>
					<h2 id="popup-title" class="text-2xl md:text-3xl font-bold text-white pb-0 mb-0">Catch up from Sunday</h2>
				</div>
				<button
					on:click={close}
					class="text-white hover:text-gray-200 transition-all hover:rotate-90 hover:scale-110 z-10 bg-white/10 backdrop-blur-sm rounded-full p-2 flex-shrink-0 ml-4"
					aria-label="Close popup"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
				<!-- Decorative elements -->
				<div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
				<div class="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
			</div>

			<!-- Compact Content -->
			<div class="p-3 pt-2">
				<div class="flex gap-4 items-end">
					<!-- Video Thumbnail/Embed -->
					<div class="w-1/2 flex-shrink-0">
						<div class="aspect-video rounded-2xl overflow-hidden bg-gray-100 shadow-lg border-2 border-white/20 relative group ml-4 mb-4">
							<iframe
								src={video.embedUrl}
								title={video.title}
								class="w-full h-full"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowfullscreen
							></iframe>
							<div class="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
								NEW
							</div>
						</div>
					</div>
					
					<!-- Text Content -->
					<div class="w-1/2 flex flex-col">
						<div class="mb-4">
							<!-- Generic Text -->
							<p class="text-white/95 text-sm leading-relaxed">
								Missed Sunday or want to revisit the talk? You can watch or listen to the latest message here. Take a moment to pause, reflect, and stay connected with what God is saying to our church family.
							</p>
						</div>
						<div class="mb-4">
							<a
								href={video.url}
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-primary rounded-lg hover:bg-white/90 transition-all shadow-md hover:shadow-lg transform hover:scale-105 font-medium text-xs"
							>
								<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
									<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
								</svg>
								Watch on YouTube
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	
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

