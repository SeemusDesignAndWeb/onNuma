<script>
	import Footer from '$lib/components/Footer.svelte';
	import { getContext } from 'svelte';

	export let data;
	export let params = {};

	let currentPage = 1;
	let bannerVisible = false;
	
	// Get banner visibility from context
	try {
		const bannerVisibleStore = getContext('bannerVisible');
		if (bannerVisibleStore) {
			bannerVisibleStore.subscribe(value => {
				bannerVisible = value;
			});
		}
	} catch (e) {
		// Context not available
	}
	let itemsPerPage = 12;
	let startDate = '';
	let endDate = '';

	$: filteredPodcasts = data.podcasts.filter(podcast => {
		if (!startDate && !endDate) return true;
		const podcastDate = new Date(podcast.publishedAt);
		if (startDate && podcastDate < new Date(startDate)) return false;
		if (endDate && podcastDate > new Date(endDate + 'T23:59:59')) return false;
		return true;
	});

	$: totalPages = Math.ceil(filteredPodcasts.length / itemsPerPage);
	$: paginatedPodcasts = filteredPodcasts.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);
	$: mostRecentPodcast = filteredPodcasts.length > 0 && currentPage === 1 ? filteredPodcasts[0] : null;

	function resetFilters() {
		startDate = '';
		endDate = '';
		currentPage = 1;
	}

	function goToPage(page) {
		currentPage = page;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
</script>

<svelte:head>
	<title>{data.page.title} - Eltham Green Community Church</title>
	<meta name="description" content={data.page.metaDescription || data.page.title} />
	<link rel="alternate" type="application/rss+xml" title="EGCC Podcast Feed" href="/api/podcast-feed" />
</svelte:head>

<!-- Hero Section -->
{#if data.page?.heroImage}
	<section
		id="hero"
		class="relative h-[35vh] overflow-hidden transition-all duration-300"
		class:mt-[5px]={bannerVisible}
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

{#if data.podcasts && data.podcasts.length > 0}
	<section class="py-20 bg-gray-50">
		<div class="container mx-auto px-4">
			<!-- Date Range Filter - Hidden for now, but keeping code for future use -->
			{#if false}
				<div class="mb-8 bg-white p-4 rounded-lg shadow">
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
							Showing {filteredPodcasts.length} of {data.podcasts.length} podcasts
						</p>
					{/if}
				</div>
			{/if}

			<!-- Removed PodcastPlayer - all links now go to Spotify -->

			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each paginatedPodcasts as podcast}
					{@const isMostRecent = mostRecentPodcast && podcast.id === mostRecentPodcast.id}
					<a
						href={data.spotifyShowUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="relative rounded-lg shadow hover:shadow-lg transition-shadow p-6 cursor-pointer block {isMostRecent ? 'bg-brand-blue' : 'bg-white'}"
					>
						<!-- Play Icon -->
						<div class="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center {isMostRecent ? 'bg-white/20 text-white' : 'bg-brand-blue/10 text-brand-blue'}">
							<svg class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
								<path d="M8 5v14l11-7z"/>
							</svg>
						</div>
						<h3 class="text-xl font-bold mb-2 pr-8 {isMostRecent ? 'text-white' : 'text-gray-900'}">{podcast.title}</h3>
						{#if podcast.description}
							<p class="{isMostRecent ? 'text-gray-200' : 'text-gray-700'} text-sm mb-3 line-clamp-2">{podcast.description}</p>
						{:else}
							<p class="{isMostRecent ? 'text-gray-200' : 'text-gray-600'} text-sm mb-3">By {podcast.speaker}</p>
						{/if}
						<div class="flex items-center justify-between text-xs {isMostRecent ? 'text-gray-200' : 'text-gray-500'}">
							<span>{new Date(podcast.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
							{#if podcast.duration}
								<span>{podcast.duration}</span>
							{/if}
						</div>
						<div class="flex items-center justify-between mt-2">
							{#if podcast.series}
								<span class="inline-block px-2 py-1 {isMostRecent ? 'bg-white text-brand-blue' : 'bg-primary/10 text-primary'} text-xs rounded">
									{podcast.series}
								</span>
							{:else}
								<span></span>
							{/if}
							{#if isMostRecent}
								<span class="bg-white text-brand-blue px-3 py-1 rounded-full text-xs font-bold">
									Latest
								</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>

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
								class="px-4 py-2 {page === currentPage ? 'bg-brand-blue text-white' : 'bg-white border'} rounded hover:bg-opacity-90"
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
		</div>
	</section>
{:else}
	<section class="py-20 bg-gray-50">
		<div class="container mx-auto px-4 text-center">
			<p class="text-gray-600">No sermons available yet. Check back soon!</p>
		</div>
	</section>
{/if}

<Footer />
