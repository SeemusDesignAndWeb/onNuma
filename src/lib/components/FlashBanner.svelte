<script lang="js">
	import { onMount } from 'svelte';

	export let events = null;

	let currentIndex = 0;
	let autoplayInterval = null;

	$: featuredEvents = events && Array.isArray(events) && events.length > 0 
		? events
		: [];

	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}

	function nextFlash() {
		if (featuredEvents.length > 0) {
			currentIndex = (currentIndex + 1) % featuredEvents.length;
		}
	}

	onMount(() => {
		if (featuredEvents.length > 1) {
			autoplayInterval = window.setInterval(nextFlash, 5000);
		}
		return () => {
			if (autoplayInterval) window.clearInterval(autoplayInterval);
		};
	});
</script>

{#if featuredEvents && featuredEvents.length > 0}
	{#each featuredEvents as event, index}
		<div
			class="absolute inset-0 transition-opacity duration-500"
			class:opacity-0={currentIndex !== index}
			class:opacity-100={currentIndex === index}
		>
			{#if event.image}
				<div
					class="relative w-full h-full"
					style="background-image: url('{event.image}'); background-size: cover; background-position: center;"
				>
					<div class="absolute inset-0 bg-black bg-opacity-30"></div>
					<div class="absolute bottom-0 left-0 right-0">
						<a href="/events/{event.id}" class="block">
							<div class="bg-white px-4 py-2 shadow-lg">
								<div class="flex items-center justify-between gap-3">
									<div class="flex-1 min-w-0">
										<h3 class="font-bold text-gray-900 truncate">{event.title}</h3>
										{#if event.date}
											<p class="text-sm text-gray-600">{formatDate(event.date)}</p>
										{/if}
									</div>
									{#if featuredEvents.length > 1}
										<div class="flex gap-1">
											{#each featuredEvents as _, i}
												<button
													on:click|stopPropagation={() => currentIndex = i}
													class="w-2 h-2 rounded-full transition-all {currentIndex === i ? 'bg-primary' : 'bg-gray-300'}"
													aria-label="Go to event {i + 1}"
												></button>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						</a>
					</div>
				</div>
			{:else}
				<div class="relative w-full h-full bg-primary">
					<div class="absolute bottom-0 left-0 right-0">
						<a href="/events/{event.id}" class="block">
							<div class="bg-white px-4 py-2 shadow-lg">
								<div class="flex items-center justify-between gap-3">
									<div class="flex-1 min-w-0">
										<h3 class="font-bold text-gray-900 truncate">{event.title}</h3>
										{#if event.date}
											<p class="text-sm text-gray-600">{formatDate(event.date)}</p>
										{/if}
									</div>
									{#if featuredEvents.length > 1}
										<div class="flex gap-1">
											{#each featuredEvents as _, i}
												<button
													on:click|stopPropagation={() => currentIndex = i}
													class="w-2 h-2 rounded-full transition-all {currentIndex === i ? 'bg-primary' : 'bg-gray-300'}"
													aria-label="Go to event {i + 1}"
												></button>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						</a>
					</div>
				</div>
			{/if}
		</div>
	{/each}
{/if}

