<script>
	import Footer from '$lib/components/Footer.svelte';
	import PodcastPlayer from '$lib/components/PodcastPlayer.svelte';
	import { getContext } from 'svelte';

	export let data;
	export let params = {};

	let currentPage = 1;
	let bannerVisible = false;
	let expandedPodcastId = null;
	let selectedSeries = '';
	let shouldAutoplay = false;
	
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

	// Extract unique series from all podcasts
	$: allSeries = (() => {
		const seriesSet = new Set();
		data.podcasts.forEach(podcast => {
			if (podcast.series && typeof podcast.series === 'string' && podcast.series.trim()) {
				seriesSet.add(podcast.series.trim());
			}
		});
		return Array.from(seriesSet).sort();
	})();

	$: filteredPodcasts = data.podcasts.filter(podcast => {
		// Filter by series
		if (selectedSeries) {
			if (!podcast.series || podcast.series !== selectedSeries) {
				return false;
			}
		}
		// Filter by date range (if enabled)
		if (startDate || endDate) {
			const podcastDate = new Date(podcast.publishedAt);
			if (startDate && podcastDate < new Date(startDate)) return false;
			if (endDate && podcastDate > new Date(endDate + 'T23:59:59')) return false;
		}
		return true;
	});

	// Separate latest podcast from the rest
	$: latestPodcast = filteredPodcasts.length > 0 ? filteredPodcasts[0] : null;
	$: otherPodcasts = filteredPodcasts.length > 1 ? filteredPodcasts.slice(1) : [];

	$: totalPages = Math.ceil(otherPodcasts.length / itemsPerPage);
	$: paginatedPodcasts = otherPodcasts.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);
	$: selectedPodcast = expandedPodcastId ? data.podcasts.find(p => p.id === expandedPodcastId) : null;

	function resetFilters() {
		startDate = '';
		endDate = '';
		selectedSeries = '';
		currentPage = 1;
	}

	function goToPage(page) {
		currentPage = page;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function selectPodcast(podcastId, autoplay = false) {
		if (expandedPodcastId === podcastId) {
			expandedPodcastId = null;
			shouldAutoplay = false;
		} else {
			expandedPodcastId = podcastId;
			shouldAutoplay = autoplay;
			// Scroll to the player section
			setTimeout(() => {
				const playerSection = document.querySelector('#podcast-player-section');
				if (playerSection) {
					playerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}
			}, 100);
		}
	}

	function selectSeries(series) {
		if (selectedSeries === series) {
			selectedSeries = '';
		} else {
			selectedSeries = series;
		}
		currentPage = 1;
	}

	// Generate consistent color for each series (using primary/10 style with different colors)
	function getSeriesColor(series) {
		if (!series) return 'bg-gray-100 text-gray-700';
		
		// Color palette - different colors for different series (using /10 opacity style)
		const colors = [
			{ bg: 'bg-blue-100', text: 'text-blue-700' },
			{ bg: 'bg-green-100', text: 'text-green-700' },
			{ bg: 'bg-purple-100', text: 'text-purple-700' },
			{ bg: 'bg-pink-100', text: 'text-pink-700' },
			{ bg: 'bg-yellow-100', text: 'text-yellow-700' },
			{ bg: 'bg-indigo-100', text: 'text-indigo-700' },
			{ bg: 'bg-red-100', text: 'text-red-700' },
			{ bg: 'bg-teal-100', text: 'text-teal-700' },
			{ bg: 'bg-orange-100', text: 'text-orange-700' },
			{ bg: 'bg-cyan-100', text: 'text-cyan-700' },
			{ bg: 'bg-primary/10', text: 'text-primary' }
		];
		
		// Simple hash function to get consistent color for same series name
		let hash = 0;
		for (let i = 0; i < series.length; i++) {
			hash = series.charCodeAt(i) + ((hash << 5) - hash);
		}
		const index = Math.abs(hash) % colors.length;
		return `${colors[index].bg} ${colors[index].text}`;
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
			<!-- Audio Player at the top -->
			{#if selectedPodcast && selectedPodcast.audioUrl}
				<div id="podcast-player-section" class="mb-8">
					<PodcastPlayer podcast={selectedPodcast} autoplay={shouldAutoplay} />
				</div>
			{/if}

			<!-- First Row: Latest Episode (2 columns) and Series Filter (1 column) -->
			<div class="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
				<!-- Latest Episode - Spans 2 columns -->
				{#if latestPodcast}
					<div class="md:col-span-2">
						<div class="bg-brand-blue rounded-lg shadow-lg p-6 text-white relative">
							<!-- Top row: Badges and Listen Now button -->
							<div class="flex items-center justify-between mb-2">
								<div class="flex items-center gap-2">
									<span class="bg-white text-brand-blue px-3 py-1 rounded-full text-xs font-bold">
										Latest
									</span>
									{#if latestPodcast.series}
										{@const colorClasses = getSeriesColor(latestPodcast.series)}
										<span class="bg-white/20 text-white px-3 py-1 rounded-full text-xs">
											{latestPodcast.series}
										</span>
									{/if}
								</div>
								<button
									on:click={() => selectPodcast(latestPodcast.id, true)}
									class="bg-white text-brand-blue px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-sm"
								>
									Listen Now →
								</button>
							</div>
							<h2 class="text-2xl md:text-3xl font-bold mb-1 text-white">{latestPodcast.title}</h2>
							<p class="text-gray-200 text-sm mb-2">
								By {latestPodcast.speaker} • {new Date(latestPodcast.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
								{#if latestPodcast.duration}
									• {latestPodcast.duration}
								{/if}
							</p>
							{#if latestPodcast.description}
								{@const descriptionText = latestPodcast.description.trim()}
								{@const speakerPrefix = 'By ' + latestPodcast.speaker}
								{#if descriptionText.toLowerCase() !== speakerPrefix.toLowerCase() && !descriptionText.toLowerCase().startsWith(speakerPrefix.toLowerCase())}
									<p class="text-gray-200 text-sm line-clamp-2">{descriptionText}</p>
								{/if}
							{/if}
						</div>
					</div>
				{/if}

				<!-- Series Filter - 1 column -->
				<div class="md:col-span-1">
					<div class="bg-white rounded-lg shadow p-6 h-full">
						<h3 class="text-lg font-bold text-gray-900 mb-4">Filter by Series</h3>
						{#if allSeries.length > 0}
							<div class="flex flex-wrap gap-2">
								<button
									on:click={() => { selectedSeries = ''; currentPage = 1; }}
									class="inline-block px-2 py-1 text-xs rounded transition-all {selectedSeries === '' ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
								>
									All
								</button>
								{#each allSeries as series}
									{@const isSelected = selectedSeries === series}
									{@const colorClasses = getSeriesColor(series)}
									<button
										on:click={() => selectSeries(series)}
										class="inline-block px-2 py-1 text-xs rounded transition-all {isSelected ? 'ring-2 ring-brand-blue ring-offset-1' : ''} {isSelected ? 'bg-brand-blue text-white' : colorClasses}"
									>
										{series}
									</button>
								{/each}
							</div>
						{:else}
							<p class="text-sm text-gray-500">No series available</p>
						{/if}
					</div>
				</div>
			</div>

			<!-- Rest of the podcasts in date descending order -->
			{#if otherPodcasts.length > 0}
				<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each paginatedPodcasts as podcast}
						{@const isSelected = expandedPodcastId === podcast.id}
						<div class="relative rounded-lg shadow hover:shadow-lg transition-shadow bg-white {isSelected ? 'ring-2 ring-brand-blue' : ''}">
							<!-- Podcast Card Header (clickable) -->
							<button
								on:click={() => selectPodcast(podcast.id)}
								class="w-full text-left p-6 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 rounded-lg"
							>
								<!-- Play Icon -->
								<div class="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center bg-brand-blue/10 text-brand-blue">
									<svg class="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
										<path d="M8 5v14l11-7z"/>
									</svg>
								</div>
								<h3 class="text-xl font-bold mb-2 pr-8 text-gray-900">{podcast.title}</h3>
								{#if podcast.description}
									<p class="text-gray-700 text-sm mb-3 line-clamp-2">{podcast.description}</p>
								{:else}
									<p class="text-gray-600 text-sm mb-3">By {podcast.speaker}</p>
								{/if}
								<div class="flex items-center justify-between text-xs text-gray-500">
									<span>{new Date(podcast.publishedAt).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
									{#if podcast.duration}
										<span>{podcast.duration}</span>
									{/if}
								</div>
								<div class="flex items-center justify-between mt-2">
									{#if podcast.series}
										{@const colorClasses = getSeriesColor(podcast.series)}
										<span class="inline-block px-2 py-1 {colorClasses} text-xs rounded">
											{podcast.series}
										</span>
									{:else}
										<span></span>
									{/if}
								</div>
							</button>
						</div>
					{/each}
				</div>
			{:else if selectedSeries}
				<div class="text-center py-12">
					<p class="text-gray-600">No podcasts found in the selected series.</p>
					<button
						on:click={() => { selectedSeries = ''; currentPage = 1; }}
						class="mt-4 text-brand-blue hover:underline"
					>
						Show all podcasts
					</button>
				</div>
			{/if}

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
