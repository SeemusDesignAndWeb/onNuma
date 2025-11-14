<script>
	export let videos = [];
	export let playlistTitle = 'Videos';
	export let loading = false;
	export let mostRecentVideo = null;

	let selectedVideo = null;

	function openVideo(video) {
		selectedVideo = video;
	}

	function closeVideo() {
		selectedVideo = null;
	}
</script>

{#if loading}
	<div class="text-center py-12">
		<p class="text-gray-600">Loading videos...</p>
	</div>
{:else if videos.length === 0}
	<div class="text-center py-12">
		<p class="text-gray-600">No videos available at this time.</p>
	</div>
{:else}
	<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
		{#each videos as video}
			{@const isMostRecent = mostRecentVideo && video.id === mostRecentVideo.id}
			<div
				class="rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer {isMostRecent ? 'bg-brand-blue' : 'bg-white'}"
				on:click={() => openVideo(video)}
				role="button"
				tabindex="0"
				on:keydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						openVideo(video);
					}
				}}
			>
				<div class="relative aspect-video bg-gray-200">
					<img
						src={video.thumbnail}
						alt={video.title}
						class="w-full h-full object-cover"
					/>
					<div class="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-opacity flex items-center justify-center">
						<div class="text-white text-4xl opacity-0 hover:opacity-100 transition-opacity">
							<i class="fa fa-play-circle"></i>
						</div>
					</div>
					{#if video.duration}
						<div class="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
							{video.duration}
						</div>
					{/if}
				</div>
				<div class="p-4">
					<h3 class="text-lg font-bold {isMostRecent ? 'text-white' : 'text-gray-900'} mb-2 line-clamp-2">{video.title}</h3>
					<div class="flex items-center justify-between text-sm {isMostRecent ? 'text-gray-200' : 'text-gray-600'}">
						<span>{video.channelTitle}</span>
						{#if video.viewCount > 0}
							<span>{video.viewCount.toLocaleString()} views</span>
						{/if}
					</div>
					<div class="flex items-center justify-between mt-2">
						{#if video.publishedAt}
							<p class="text-xs {isMostRecent ? 'text-gray-200' : 'text-gray-500'}">
								{new Date(video.publishedAt).toLocaleDateString('en-GB', {
									year: 'numeric',
									month: 'long',
									day: 'numeric'
								})}
							</p>
						{:else}
							<span></span>
						{/if}
					{#if isMostRecent}
						<span class="bg-white text-brand-blue px-3 py-1 rounded-full text-xs font-bold">
							Latest
						</span>
					{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<!-- Video Modal -->
{#if selectedVideo}
	<div
		class="fixed inset-0 z-[9999] bg-black bg-opacity-90 flex items-center justify-center p-4"
		on:click={closeVideo}
		on:keydown={(e) => {
			if (e.key === 'Escape') closeVideo();
		}}
		role="button"
		tabindex="0"
	>
		<button
			class="absolute top-4 right-4 text-white text-4xl hover:text-primary transition-colors z-10"
			on:click={closeVideo}
			aria-label="Close video"
		>
			&times;
		</button>
		<div
			class="relative w-full max-w-4xl"
			on:click|stopPropagation
			on:keydown|stopPropagation
			role="presentation"
		>
			<div class="aspect-video bg-black rounded-lg overflow-hidden">
				<iframe
					src="{selectedVideo.embedUrl}?autoplay=1"
					title={selectedVideo.title}
					class="w-full h-full"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe>
			</div>
			<div class="mt-4 text-white">
				<h3 class="text-xl font-bold mb-2">{selectedVideo.title}</h3>
				<div class="flex items-center justify-between text-sm text-gray-300">
					<span>{selectedVideo.channelTitle}</span>
					{#if selectedVideo.viewCount > 0}
						<span>{selectedVideo.viewCount.toLocaleString()} views</span>
					{/if}
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
</style>

