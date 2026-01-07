<script lang="js">
	import Footer from '$lib/components/Footer.svelte';
	import Contact from '$lib/components/Contact.svelte';
	import { onMount, getContext } from 'svelte';

	export let data;

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

	onMount(() => {
		// Component mounted
	});

	// Extract sections from page data
	$: sections = data.page?.sections || [];
	$: introSection = sections.find(s => s.type === 'text' && s.id === 'intro-section');
	$: events = data.events || [];

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

	function getEventDate(event) {
		if (!event.date) return null;
		return new Date(event.date);
	}

	function isUpcoming(event) {
		const eventDate = getEventDate(event);
		if (!eventDate) return false;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return eventDate >= today;
	}

	$: upcomingEvents = events.filter(isUpcoming);
	$: pastEvents = events.filter(e => !isUpcoming(e));
</script>

<svelte:head>
	<title>{data.page.title} - Eltham Green Community Church</title>
	<meta name="description" content={data.page.metaDescription || data.page.title} />
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
{:else}
	<section class="bg-gradient-to-r from-primary to-brand-blue py-20" class:mt-[5px]={bannerVisible}>
		<div class="container mx-auto px-4">
			<div class="max-w-2xl">
				<h1 class="text-white text-4xl md:text-5xl font-bold mb-4">
					{data.page?.heroTitle || 'Upcoming Events'}
				</h1>
				{#if data.page?.heroSubtitle}
					<p class="text-white text-lg md:text-xl mb-6">{data.page.heroSubtitle}</p>
				{/if}
				<a
					href="/events/calendar"
					class="inline-flex items-center gap-2 px-6 py-3 bg-white text-brand-blue rounded-lg font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					View Calendar
				</a>
			</div>
		</div>
	</section>
{/if}

<!-- Intro Section -->
{#if introSection}
	<section class="py-20 bg-gradient-to-b from-white to-gray-50">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="grid md:grid-cols-2 gap-12 items-center">
					<div class="order-2 md:order-1">
						<div class="inline-block mb-4">
							<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider">Events</span>
						</div>
						{#if introSection.title}
							<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
								{@html introSection.title}
							</h2>
						{/if}
						{#if introSection.content}
							<div class="prose prose-lg max-w-none text-gray-700 leading-relaxed">
								{@html introSection.content}
							</div>
						{/if}
					</div>
					<div class="order-1 md:order-2 flex justify-center md:justify-end">
						<div class="relative w-full max-w-lg">
							<div class="absolute -inset-4 bg-brand-blue/20 rounded-2xl transform rotate-3"></div>
							<div class="relative bg-gradient-to-br from-brand-blue/10 to-brand-blue/5 rounded-2xl p-12 shadow-2xl">
								<div class="text-center">
									<svg class="w-24 h-24 text-brand-blue mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									<h3 class="text-2xl font-bold text-gray-900 mb-2">Join Us</h3>
									<p class="text-gray-600">Come and be part of our community events</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Upcoming Events -->
{#if upcomingEvents.length > 0}
	<section class="py-20 bg-white">
		<div class="container mx-auto px-4">
			<div class="text-center mb-16">
				<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider mb-2 block">What's Coming</span>
				<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
					Upcoming Events
				</h2>
				<p class="text-xl text-gray-600 max-w-2xl mx-auto mb-6">
					Join us for these upcoming events and activities
				</p>
				<a
					href="/events/calendar"
					class="inline-flex items-center gap-2 px-6 py-3 bg-brand-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					View Calendar
				</a>
				<p class="text-sm text-gray-500 mt-3">
					<a href="/events/calendar" class="text-brand-blue hover:underline">/events/calendar</a>
				</p>
			</div>

			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
				{#each upcomingEvents as event, index}
					<a
						href="/events/{event.id}"
						class="group relative animate-fade-in-up bg-white rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
						style="animation-delay: {index * 0.1}s"
					>
						<div class="relative overflow-hidden aspect-[2/1]">
							{#if event.image}
								<img
									src={event.image}
									alt={event.title}
									class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
								/>
							{:else}
								<div class="w-full h-full bg-gradient-to-br from-brand-blue/20 to-brand-blue/10 flex items-center justify-center">
									<svg class="w-24 h-24 text-brand-blue/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
							{/if}
							{#if event.featured}
								<div class="absolute top-4 right-4 bg-brand-blue text-white px-3 py-1 rounded-full text-xs font-semibold">
									Featured
								</div>
							{/if}
							<div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity duration-300"></div>
						</div>
						<div class="p-6">
							<h3 class="text-xl font-bold mb-3 text-gray-900 group-hover:text-brand-blue transition-colors">{event.title}</h3>
							
							<div class="space-y-2 mb-4">
								{#if event.date}
									<div class="flex items-center gap-2 text-gray-600">
										<svg class="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
										</svg>
										<span class="text-sm font-medium">{formatDate(event.date)}</span>
									</div>
								{/if}
								{#if event.time}
									<div class="flex items-center gap-2 text-gray-600">
										<svg class="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<span class="text-sm font-medium">{formatTime(event.time)}</span>
									</div>
								{/if}
								{#if event.location}
									<div class="flex items-center gap-2 text-gray-600">
										<svg class="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
										<span class="text-sm">{event.location}</span>
									</div>
								{/if}
							</div>

							{#if event.description}
								<div class="text-gray-600 text-sm leading-relaxed line-clamp-3 mb-4">
									{@html event.description.replace(/<[^>]*>/g, '').substring(0, 150)}
									{#if event.description.replace(/<[^>]*>/g, '').length > 150}...{/if}
								</div>
							{/if}

							<div class="text-brand-blue font-semibold text-sm group-hover:underline">
								Learn more →
							</div>
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- Past Events -->
{#if pastEvents.length > 0}
	<section class="py-20 bg-gray-50">
		<div class="container mx-auto px-4">
			<div class="text-center mb-16">
				<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider mb-2 block">Archive</span>
				<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
					Past Events
				</h2>
			</div>

			<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
				{#each pastEvents.slice(0, 6) as event, index}
					<a
						href="/events/{event.id}"
						class="group relative bg-white rounded-2xl overflow-hidden shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-1 opacity-75"
					>
						<div class="relative overflow-hidden aspect-[2/1]">
							{#if event.image}
								<img
									src={event.image}
									alt={event.title}
									class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
								/>
							{:else}
								<div class="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
									<svg class="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
							{/if}
						</div>
						<div class="p-6">
							<h3 class="text-lg font-bold mb-2 text-gray-900">{event.title}</h3>
							{#if event.date}
								<div class="flex items-center gap-2 text-gray-500 text-sm">
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									<span>{formatDate(event.date)}</span>
								</div>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		</div>
	</section>
{/if}

<!-- No Events Message -->
{#if events.length === 0}
	<section class="py-20 bg-white">
		<div class="container mx-auto px-4">
			<div class="max-w-2xl mx-auto text-center">
				<svg class="w-24 h-24 text-gray-300 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				<h2 class="text-3xl font-bold text-gray-900 mb-4">No Events Scheduled</h2>
				<p class="text-gray-600 mb-8">
					Check back soon for upcoming events and activities.
				</p>
			</div>
		</div>
	</section>
{/if}

<!-- Call to Action -->
<section class="py-20 bg-gradient-to-br from-brand-blue/5 via-white to-gray-50">
	<div class="container mx-auto px-4">
		<div class="max-w-4xl mx-auto text-center">
			<div class="inline-block mb-4">
				<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider">Get Involved</span>
			</div>
			<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
				We Look Forward to Seeing You!
			</h2>
			<p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
				Join us for our events and be part of our growing community. All are welcome!
			</p>
			<a
				href="#contact"
				class="inline-block px-8 py-4 bg-brand-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
			>
				Get in Touch
			</a>
		</div>
	</div>
</section>

<!-- Contact Section -->
<Contact contactInfo={data.contactInfo} />

<Footer />

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in {
		animation: fade-in 0.6s ease-out;
	}

	@keyframes fade-in-up {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in-up {
		animation: fade-in-up 0.8s ease-out forwards;
		opacity: 0;
	}

	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

