<script lang="js">
	import Footer from '$lib/components/Footer.svelte';
	import { getContext } from 'svelte';

	export let data;
	export let params = {};

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

	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { 
			weekday: 'long',
			day: 'numeric', 
			month: 'long', 
			year: 'numeric' 
		});
	}

	function formatTime(timeString) {
		if (!timeString) return '';
		const [hours, minutes] = timeString.split(':');
		const hour = parseInt(hours);
		const ampm = hour >= 12 ? 'PM' : 'AM';
		const hour12 = hour % 12 || 12;
		return `${hour12}:${minutes} ${ampm}`;
	}
</script>

<svelte:head>
	<title>{data.event.title} - Eltham Green Community Church</title>
	<meta name="description" content={data.event.description ? data.event.description.replace(/<[^>]*>/g, '').substring(0, 160) : data.event.title} />
</svelte:head>

<!-- Hero Section -->
{#if data.event.image}
	<section class="relative h-[35vh] overflow-hidden transition-all duration-300" class:mt-[5px]={bannerVisible}>
		<!-- Background Image with Blur -->
		<div
			class="absolute inset-0 bg-cover bg-center"
			style="background-image: url('{data.event.image}'); filter: blur(8px); transform: scale(1.1);"
		></div>
		<!-- Overlay -->
		<div class="absolute inset-0 bg-black bg-opacity-50"></div>
		<!-- Content -->
		<div class="relative h-full flex items-end pb-8 md:pb-12">
			<div class="container mx-auto px-4">
				<div class="max-w-3xl">
					<h1 class="text-white text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4">{data.event.title}</h1>
					<!-- Date and Time -->
					<div class="flex flex-wrap items-center gap-4 md:gap-6 text-white">
						{#if data.event.date}
							<div class="flex items-center gap-2">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<span class="text-lg font-medium">{formatDate(data.event.date)}</span>
							</div>
						{/if}
						{#if data.event.time}
							<div class="flex items-center gap-2">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span class="text-lg font-medium">{formatTime(data.event.time)}</span>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>
{:else}
	<section class="bg-gradient-to-r from-primary to-brand-blue py-20">
		<div class="container mx-auto px-4">
			<div class="max-w-3xl">
				<h1 class="text-white text-4xl md:text-5xl font-bold mb-4">{data.event.title}</h1>
				<!-- Date and Time -->
				<div class="flex flex-wrap items-center gap-6 text-white">
					{#if data.event.date}
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
							</svg>
							<span class="text-lg font-medium">{formatDate(data.event.date)}</span>
						</div>
					{/if}
					{#if data.event.time}
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-lg font-medium">{formatTime(data.event.time)}</span>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Event Details -->
<section class="py-20 bg-white">
	<div class="container mx-auto px-4">
		<div class="max-w-4xl mx-auto">
			<div class="grid md:grid-cols-3 gap-8">
				<!-- Main Content -->
				<div class="md:col-span-2">
					{#if data.event.description}
						<div class="prose prose-lg max-w-none mb-8">
							{@html data.event.description}
						</div>
					{/if}
					{#if data.event.eventInfo}
						<div class="bg-gray-50 rounded-lg p-6 mb-8">
							<h2 class="text-2xl font-bold text-gray-900 mb-4">Event Information</h2>
							<div class="prose prose-lg max-w-none text-gray-700">
								{@html data.event.eventInfo}
							</div>
						</div>
					{/if}
				</div>

				<!-- Sidebar -->
				<div class="md:col-span-1">
					<div class="bg-gray-50 rounded-lg p-6 sticky top-4">
						<h2 class="text-2xl font-bold text-gray-900 mb-6">Event Details</h2>
						
						<div class="space-y-4">
							{#if data.event.date}
								<div class="flex items-start gap-3">
									<svg class="w-6 h-6 text-primary mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									<div>
										<div class="text-sm text-gray-600">Date</div>
										<div class="font-semibold text-gray-900">{formatDate(data.event.date)}</div>
									</div>
								</div>
							{/if}

							{#if data.event.time}
								<div class="flex items-start gap-3">
									<svg class="w-6 h-6 text-primary mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<div>
										<div class="text-sm text-gray-600">Time</div>
										<div class="font-semibold text-gray-900">{formatTime(data.event.time)}</div>
									</div>
								</div>
							{/if}

							{#if data.event.location}
								<div class="flex items-start gap-3">
									<svg class="w-6 h-6 text-primary mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
									</svg>
									<div>
										<div class="text-sm text-gray-600">Location</div>
										<div class="font-semibold text-gray-900">{data.event.location}</div>
									</div>
								</div>
							{/if}
						</div>

						<div class="mt-8 pt-6 border-t border-gray-200">
							<h3 class="font-semibold text-gray-900 mb-3">Need more information?</h3>
							<a
								href="/#contact"
								class="block w-full text-center px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all"
							>
								Contact Us
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<Footer contactInfo={data.contactInfo} serviceTimes={data.serviceTimes} />

