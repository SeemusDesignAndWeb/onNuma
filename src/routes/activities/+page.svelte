<script lang="js">
	import Footer from '$lib/components/Footer.svelte';
	import Contact from '$lib/components/Contact.svelte';
	import { onMount, getContext } from 'svelte';

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

	onMount(() => {
		// Component mounted
	});

	// Extract sections from page data
	$: sections = data.page?.sections || [];
	$: introSection = sections.find(s => s.type === 'text' && s.id === 'intro-section');
	$: activities = data.activities || [];

	function getTimeInfo(activity) {
		if (activity.timeInfo) return activity.timeInfo;
		if (activity.audience) return activity.audience;
		return '';
	}
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
{/if}

<!-- Intro Section -->
{#if introSection}
	<section class="py-20 bg-gradient-to-b from-white to-gray-50">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="grid md:grid-cols-2 gap-12 items-center">
					<div class="order-2 md:order-1">
						<div class="inline-block mb-4">
							<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider">Community</span>
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
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
									</svg>
									<h3 class="text-2xl font-bold text-gray-900 mb-2">Serving Together</h3>
									<p class="text-gray-600">Building community through shared activities</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Activities Grid -->
<section class="py-20 bg-gray-900">
	<div class="container mx-auto px-4">
		<div class="text-center mb-16">
			<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider mb-2 block">What We Offer</span>
			<h2 class="text-4xl md:text-5xl font-bold text-white mb-4">
				Our Activities
			</h2>
			<p class="text-xl text-gray-300 max-w-2xl mx-auto">
				Join us for community activities designed to serve and connect
			</p>
		</div>

		<div class="grid md:grid-cols-3 gap-8">
			{#each activities as activity, index}
				<div
					class="group relative animate-fade-in-up bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 {activity.link ? 'cursor-pointer hover:shadow-xl hover:-translate-y-2' : ''}"
					style="animation-delay: {index * 0.1}s"
					on:click={() => {
						if (activity.link) {
							window.open(activity.link, activity.link.startsWith('http') ? '_blank' : '_self');
						}
					}}
					role={activity.link ? 'button' : undefined}
					tabindex={activity.link ? 0 : undefined}
					on:keydown={(e) => {
						if (activity.link && (e.key === 'Enter' || e.key === ' ')) {
							e.preventDefault();
							window.open(activity.link, activity.link.startsWith('http') ? '_blank' : '_self');
						}
					}}
				>
					<div class="relative overflow-hidden aspect-[2/1]">
						{#if activity.image}
							<img
								src={activity.image}
								alt={activity.title}
								class="w-full h-full object-cover transition-transform duration-500 {activity.link ? 'group-hover:scale-110' : ''}"
							/>
						{:else}
							<div class="w-full h-full bg-gradient-to-br from-brand-blue/20 to-brand-blue/10 flex items-center justify-center">
								<svg class="w-24 h-24 text-brand-blue/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
								</svg>
							</div>
						{/if}
						{#if activity.link && activity.image}
							<div
								class="absolute inset-0 bg-black bg-opacity-60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
							>
								<div class="text-white text-center">
									<i class="fa fa-external-link text-4xl"></i>
								</div>
							</div>
						{/if}
					</div>
					<div class="p-6">
						<h3 class="text-xl font-bold mb-2 text-white">{activity.title}</h3>
						{#if getTimeInfo(activity)}
							<div class="text-brand-blue font-bold text-sm mb-3">{getTimeInfo(activity)}</div>
						{/if}
						<div class="text-gray-300 text-sm leading-relaxed">
							{@html activity.description}
						</div>
						{#if activity.link && activity.linkText}
							<div class="mt-4">
								<span class="text-brand-blue hover:text-brand-blue/80 text-sm font-medium transition-colors">
									{activity.linkText} →
								</span>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>


<!-- Call to Action -->
<section class="py-20 bg-gradient-to-br from-brand-blue/5 via-white to-gray-50">
	<div class="container mx-auto px-4">
		<div class="max-w-4xl mx-auto text-center">
			<div class="inline-block mb-4">
				<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider">Join Us</span>
			</div>
			<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
				We Look Forward to Welcoming You!
			</h2>
			<p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
				All our activities are designed to serve and to share with our local community. Come and be part of what we're doing.
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
</style>
