<script lang="js">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import Contact from '$lib/components/Contact.svelte';
	import { onMount } from 'svelte';

	export let data;
	export let params = {};

	let currentMessage = 0;
	let autoplayInterval = null;

	onMount(() => {
		if (data.page.heroMessages && data.page.heroMessages.length > 0) {
			autoplayInterval = window.setInterval(() => {
				currentMessage = (currentMessage + 1) % data.page.heroMessages.length;
			}, 4000);
		}
		return () => {
			if (autoplayInterval) window.clearInterval(autoplayInterval);
		};
	});

	// Extract sections from page data
	$: sections = data.page?.sections || [];
	$: introSection = sections.find((s, i) => s.type === 'text' && i === 0);
	$: detailsSection = sections.find((s, i) => s.type === 'text' && i === 1);
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
						<p class="text-white text-lg md:text-xl mb-3 animate-fade-in">
							{data.page.heroSubtitle}
						</p>
					{/if}
					{#if data.page.heroMessages && data.page.heroMessages.length > 0}
						<div class="relative h-12 mb-4">
							{#each data.page.heroMessages as msg, index}
								<div
									class="absolute inset-0 transition-opacity duration-1000"
									class:opacity-0={currentMessage !== index}
									class:opacity-100={currentMessage === index}
								>
									<p class="text-white text-lg md:text-xl font-light animate-fade-in">
										{msg}
									</p>
								</div>
							{/each}
						</div>
					{/if}
					<div class="flex flex-wrap gap-3 mt-4">
						<a
							href="#intro"
							class="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg text-sm"
						>
							Learn More
						</a>
						<a
							href="#contact"
							class="px-6 py-3 bg-white text-primary rounded-lg font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg text-sm"
						>
							Join a Group
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Intro Section -->
{#if introSection}
	<section id="intro" class="py-20 bg-gradient-to-b from-white to-gray-50">
		<div class="container mx-auto px-4">
			<div class="max-w-4xl mx-auto text-center">
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
		</div>
	</section>
{/if}

<!-- Details Section -->
{#if detailsSection}
	<section class="py-20 bg-white">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="grid md:grid-cols-2 gap-12 items-center">
					<div>
						<span class="text-primary text-sm font-semibold uppercase tracking-wider mb-2 block">
							{detailsSection.title || "Our Approach"}
						</span>
						{#if detailsSection.content}
							<div class="prose prose-lg max-w-none text-gray-700 leading-relaxed">
								{@html detailsSection.content}
							</div>
						{/if}
						{#if detailsSection.cta}
							<div class="mt-8">
								<a
									href={detailsSection.cta.link}
									class="inline-block px-8 py-4 bg-primary text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
								>
									{detailsSection.cta.text}
								</a>
							</div>
						{/if}
					</div>
					<div class="flex justify-center md:justify-end">
						<div class="relative w-full max-w-lg">
							<div class="absolute -inset-4 bg-primary/20 rounded-2xl transform rotate-3"></div>
							<img
								src={detailsSection.image || "https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066391/egcc/egcc/img-community-groups-bg.jpg"}
								alt="Community Groups"
								class="relative rounded-2xl shadow-2xl w-full h-auto"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Groups Schedule Section -->
<section class="py-20 bg-gray-900">
	<div class="container mx-auto px-4">
		<div class="max-w-6xl mx-auto">
			<div class="text-center mb-16">
				<span class="text-primary text-sm font-semibold uppercase tracking-wider mb-2 block">Join Us</span>
				<h2 class="text-4xl md:text-5xl font-bold text-white mb-4">
					Community Group Times
				</h2>
				<p class="text-xl text-gray-300 max-w-2xl mx-auto">
					Find a group that fits your schedule
				</p>
			</div>
			{#if data.communityGroups && data.communityGroups.length > 0}
				<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
					{#each data.communityGroups.sort((a, b) => (a.order || 0) - (b.order || 0)) as group}
						{@const iconColor = group.iconColor || 'primary'}
						{@const iconColorClass = iconColor === 'primary' ? 'primary' : iconColor === 'brand-yellow' ? 'brand-yellow' : iconColor === 'brand-red' ? 'brand-red' : iconColor === 'brand-blue' ? 'brand-blue' : 'primary'}
						<div class="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-700">
							<div class="flex items-center justify-between mb-4">
								<div class="w-12 h-12 rounded-full flex items-center justify-center {iconColorClass === 'primary' ? 'bg-primary/10' : iconColorClass === 'brand-yellow' ? 'bg-brand-yellow/10' : iconColorClass === 'brand-red' ? 'bg-brand-red/10' : iconColorClass === 'brand-blue' ? 'bg-brand-blue/10' : 'bg-primary/10'}">
									<svg class="w-6 h-6 {iconColorClass === 'primary' ? 'text-primary' : iconColorClass === 'brand-yellow' ? 'text-brand-yellow' : iconColorClass === 'brand-red' ? 'text-brand-red' : iconColorClass === 'brand-blue' ? 'text-brand-blue' : 'text-primary'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
								</div>
							</div>
							<h3 class="text-xl font-bold text-white mb-2">{group.day}</h3>
							<div class="flex items-center gap-2 text-primary font-semibold mb-4">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
								<span>{group.time}</span>
							</div>
							{#if group.description}
								<p class="text-gray-300 text-sm">
									{group.description}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-gray-300 text-center">No community groups scheduled at this time.</p>
			{/if}
		</div>
	</div>
</section>

<!-- Benefits Section -->
<section class="py-20 bg-gradient-to-br from-primary/5 via-white to-gray-50">
	<div class="container mx-auto px-4">
		<div class="max-w-6xl mx-auto">
			<div class="text-center mb-16">
				<span class="text-primary text-sm font-semibold uppercase tracking-wider mb-2 block">Why Join</span>
				<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
					What You'll Experience
				</h2>
				<p class="text-xl text-gray-600 max-w-2xl mx-auto">
					Community Groups are at the heart of how we do church
				</p>
			</div>
			<div class="grid md:grid-cols-3 gap-8">
				<div class="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
					<div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
						<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
						</svg>
					</div>
					<h3 class="text-2xl font-bold text-gray-900 mb-4">
						Love God
					</h3>
					<p class="text-gray-600 leading-relaxed">
						Through worship and the word, we grow in our relationship with God and learn to follow Christ together.
					</p>
				</div>
				<div class="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
					<div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
						<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
						</svg>
					</div>
					<h3 class="text-2xl font-bold text-gray-900 mb-4">
						Love Each Other
					</h3>
					<p class="text-gray-600 leading-relaxed">
						By serving and supporting one another, we build genuine relationships and care for each other through life's journey.
					</p>
				</div>
				<div class="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100">
					<div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
						<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
						</svg>
					</div>
					<h3 class="text-2xl font-bold text-gray-900 mb-4">
						Love Our Community
					</h3>
					<p class="text-gray-600 leading-relaxed">
						Through connecting and inviting, we reach out to our local community and share God's love with those around us.
					</p>
				</div>
			</div>
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
</style>
