<script lang="js">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import VideoSection from '$lib/components/VideoSection.svelte';

	export let data;
	export let params = {};

	let currentPage = 1;
	let itemsPerPage = 12;
	let startDate = '';
	let endDate = '';
	let selectedVideo = null;

	$: filteredVideos = (data.videos || []).filter(video => {
		if (!startDate && !endDate) return true;
		const videoDate = new Date(video.publishedAt);
		if (startDate && videoDate < new Date(startDate)) return false;
		if (endDate && videoDate > new Date(endDate + 'T23:59:59')) return false;
		return true;
	});

	$: mostRecentVideo = filteredVideos.length > 0 && currentPage === 1 ? filteredVideos[0] : null;
	$: videosToShow = currentPage === 1 && filteredVideos.length > 0 
		? [filteredVideos[0], ...filteredVideos.slice(1, itemsPerPage)]
		: filteredVideos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
	$: totalPages = Math.ceil(filteredVideos.length / itemsPerPage);

	function resetFilters() {
		startDate = '';
		endDate = '';
		currentPage = 1;
	}

	function goToPage(page) {
		currentPage = page;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function openVideo(video) {
		selectedVideo = video;
	}

	function closeVideo() {
		selectedVideo = null;
	}
</script>

<svelte:head>
	<title>{data.page.title} - Eltham Green Community Church</title>
	<meta name="description" content={data.page.metaDescription || data.page.title} />
</svelte:head>

<Navbar />

<!-- Hero Section -->
{#if data.page?.heroImage}
	<section
		id="hero"
		class="relative h-[50vh] overflow-hidden"
		style="background-image: url('{data.page.heroImage}'); background-size: cover; background-position: center;"
	>
		<div
			class="absolute inset-0 bg-black"
			style="opacity: {(data.page.heroOverlay || 40) / 100};"
		></div>
		<div class="relative h-full flex items-end pb-12">
			<div class="container mx-auto px-4">
				<div class="max-w-2xl">
					{#if data.page.heroTitle}
						<h1 class="text-white text-4xl md:text-5xl font-bold mb-3 animate-fade-in">
							{@html data.page.heroTitle}
						</h1>
					{/if}
					{#if data.page.heroSubtitle}
						<p class="text-white text-lg md:text-xl mb-4 animate-fade-in">{data.page.heroSubtitle}</p>
					{/if}
					{#if data.page.heroButtons && data.page.heroButtons.length > 0}
						<div class="flex flex-wrap gap-3 mt-4">
							{#each data.page.heroButtons as button}
								<a
									href={button.link}
									target={button.target || '_self'}
									class="px-6 py-3 {button.style === 'secondary' ? 'bg-white text-brand-blue hover:bg-gray-100' : 'bg-brand-blue text-white hover:bg-opacity-90'} rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg text-sm"
								>
									{button.text}
								</a>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>
{/if}

{#if data.videos && data.videos.length > 0}
	<section class="py-20 bg-white">
		<div class="container mx-auto px-4">

			<!-- Date Range Filter - Hidden for now, but keeping code for future use -->
			{#if false}
				<div class="mb-8 bg-gray-50 p-4 rounded-lg">
					<div class="flex flex-wrap gap-4 items-end">
						<div class="flex-1 min-w-[200px]">
							<label for="start-date" class="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
							<input
								id="start-date"
								type="date"
								bind:value={startDate}
								on:change={() => currentPage = 1}
								class="w-full px-3 py-2 border rounded"
							/>
						</div>
						<div class="flex-1 min-w-[200px]">
							<label for="end-date" class="block text-sm font-medium text-gray-700 mb-1">End Date</label>
							<input
								id="end-date"
								type="date"
								bind:value={endDate}
								on:change={() => currentPage = 1}
								class="w-full px-3 py-2 border rounded"
							/>
						</div>
						<div>
							<button
								on:click={resetFilters}
								class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
							>
								Clear Filters
							</button>
						</div>
					</div>
					{#if startDate || endDate}
						<p class="text-sm text-gray-600 mt-2">
							Showing {filteredVideos.length} of {data.videos.length} videos
						</p>
					{/if}
				</div>
			{/if}

			<VideoSection videos={videosToShow} playlistTitle={data.playlistInfo?.title || 'Videos'} mostRecentVideo={mostRecentVideo} />

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="mt-8 flex justify-center items-center gap-2">
					<button
						on:click={() => goToPage(currentPage - 1)}
						disabled={currentPage === 1}
						class="px-4 py-2 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Previous
					</button>
					{#each Array(totalPages) as _, i}
						{@const page = i + 1}
						{#if page === currentPage || page === 1 || page === totalPages || (page >= currentPage - 2 && page <= currentPage + 2)}
							<button
								on:click={() => goToPage(page)}
								class="px-4 py-2 {page === currentPage ? 'bg-primary text-white' : 'bg-white border'} rounded hover:bg-opacity-90"
							>
								{page}
							</button>
						{:else if page === currentPage - 3 || page === currentPage + 3}
							<span class="px-2">...</span>
						{/if}
					{/each}
					<button
						on:click={() => goToPage(currentPage + 1)}
						disabled={currentPage === totalPages}
						class="px-4 py-2 bg-white border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						Next
					</button>
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
		</div>
	</section>
{:else}
	<section class="py-20 bg-white">
		<div class="container mx-auto px-4">
			<div class="text-center py-12">
				{#if data.playlistInfo?.error}
					<p class="text-red-600 mb-4 font-semibold">Error loading YouTube playlist</p>
					<p class="text-sm text-gray-500 mb-4">
						{data.playlistInfo.message || 'There was an error fetching videos from YouTube.'}
					</p>
					<p class="text-xs text-gray-400">
						Please check that your playlist ID is correct and the playlist is public. You can update it in <a href="/admin/settings" class="text-primary hover:underline">admin settings</a>.
					</p>
				{:else if !data.playlistInfo && (!data.videos || data.videos.length === 0)}
					<p class="text-gray-600 mb-4">No YouTube playlist configured.</p>
					<p class="text-sm text-gray-500 mb-4">
						Please configure a YouTube playlist ID in the <a href="/admin/settings" class="text-primary hover:underline">admin settings</a>.
					</p>
					<p class="text-xs text-gray-400">
						To find your playlist ID, go to your YouTube playlist and copy the ID from the URL: <code class="bg-gray-100 px-2 py-1 rounded">youtube.com/playlist?list=PLAYLIST_ID</code>
					</p>
				{:else}
					<p class="text-gray-600 mb-4">No videos found in the playlist.</p>
					<p class="text-sm text-gray-500">
						The playlist may be empty or there was an error loading videos. Please check the server logs for details.
					</p>
				{/if}
			</div>
		</div>
	</section>
{/if}

<Footer />
