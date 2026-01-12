<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import LoomVideo from '$lib/components/LoomVideo.svelte';

	let selectedCategory = null;
	let isLoadingVideo = false;
	let initialLoad = true;
	
	$: videos = $page.data?.videos || [];
	$: isLoading = $page.status === 'loading' || initialLoad;
	
	// Create tabs based on video titles
	$: videoTabs = videos.map(video => ({
		title: video.title || 'Untitled',
		id: video.id
	}));
	
	// Check if we should show tabs (only if more than one video)
	$: showTabs = videos.length > 1;
	
	// Auto-select first video when tabs are shown and no video is selected
	$: if (showTabs && selectedCategory === null && videoTabs.length > 0) {
		selectedCategory = videoTabs[0].id;
	}
	
	// Reactive filtered videos that update when selection changes
	$: filteredVideos = (() => {
		// If tabs are shown and a video is selected, show only that video
		if (showTabs && selectedCategory) {
			const filtered = videos.filter(video => video.id === selectedCategory);
			return filtered.length > 0 ? filtered : videos;
		}
		// If no tabs or no video selected, show all videos
		return videos;
	})();
	
	// Hide initial loading when videos are loaded
	$: if (videos.length > 0 && initialLoad) {
		setTimeout(() => {
			initialLoad = false;
		}, 300);
	}
	
	// Hide loading when filtered videos change (video has loaded)
	$: if (filteredVideos.length > 0 && isLoadingVideo) {
		setTimeout(() => {
			isLoadingVideo = false;
		}, 500);
	}
	
	onMount(() => {
		// Set initial load to false after mount if videos are already loaded
		if (videos.length > 0) {
			setTimeout(() => {
				initialLoad = false;
			}, 300);
		}
	});
</script>

<div class="flex-1 p-6">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-2xl font-bold text-gray-900 mb-6">Video Tutorials</h1>
		
		{#if showTabs}
			<div class="mb-6 flex flex-wrap gap-2">
				{#each videoTabs as tab}
					<button
						on:click={() => {
							isLoadingVideo = true;
							selectedCategory = tab.id;
						}}
						class="px-4 py-2 text-sm font-medium rounded-md transition-colors {selectedCategory === tab.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
					>
						{tab.title}
					</button>
				{/each}
			</div>
		{/if}
		
		{#if isLoading || isLoadingVideo}
			<div class="flex items-center justify-center py-12">
				<div class="text-center">
					<div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-4"></div>
					<p class="text-gray-600">{isLoading ? 'Loading videos...' : 'Loading video...'}</p>
				</div>
			</div>
		{:else if filteredVideos.length > 0}
			<div class="space-y-8">
				{#each filteredVideos as video}
					<LoomVideo
						embedCode={video.embedCode}
						title={video.title}
						description={video.description}
					/>
				{/each}
			</div>
		{:else}
			<div class="text-center py-12">
				<svg class="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
				</svg>
				<p class="text-gray-500 text-lg mb-2">No videos available yet</p>
			</div>
		{/if}
	</div>
</div>
