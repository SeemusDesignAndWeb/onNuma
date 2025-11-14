<script lang="js">
	import Navbar from '$lib/components/Navbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
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
	$: historySection = sections.find((s, i) => s.type === 'text' && i === 0);
	$: otherSections = sections.filter((s, i) => s.type === 'text' && i > 0);
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
						<p class="text-white text-lg md:text-xl mb-4 animate-fade-in">
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
					{#if data.page.heroButtons && data.page.heroButtons.length > 0}
						<div class="flex flex-wrap gap-3 mt-4">
							{#each data.page.heroButtons as button}
								<a
									href={button.link}
									target={button.target || '_self'}
									class="px-6 py-3 {button.style === 'secondary' ? 'bg-white text-primary hover:bg-gray-100' : 'bg-primary text-white hover:bg-opacity-90'} rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg text-sm"
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

<!-- History Section -->
{#if historySection}
	<section class="py-20 bg-gradient-to-b from-white to-gray-50">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="grid md:grid-cols-2 gap-12 items-center">
					<div class="order-2 md:order-1">
						<div class="inline-block mb-4">
							<span class="text-primary text-sm font-semibold uppercase tracking-wider">Our Story</span>
						</div>
						{#if historySection.title}
							<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
								{@html historySection.title}
							</h2>
						{/if}
						{#if historySection.content}
							<div class="prose prose-lg max-w-none text-gray-700 leading-relaxed">
								{@html historySection.content}
							</div>
						{/if}
					</div>
					<div class="order-1 md:order-2 flex justify-center md:justify-end">
						<div class="relative w-full max-w-lg">
							<div class="absolute -inset-4 bg-primary/20 rounded-2xl transform rotate-3"></div>
							<img
								src="https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066407/egcc/egcc/page-hero-church.jpg"
								alt="Eltham Green Community Church"
								class="relative rounded-2xl shadow-2xl w-full h-auto"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Other Sections - Card Grid -->
{#if otherSections.length > 0}
	<section class="py-20 bg-white">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="text-center mb-16">
					<span class="text-primary text-sm font-semibold uppercase tracking-wider mb-2 block">Who We Are</span>
					<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
						Our Identity
					</h2>
					<p class="text-xl text-gray-600 max-w-2xl mx-auto">
						Discover what makes us who we are
					</p>
				</div>
				<div class="grid md:grid-cols-3 gap-8">
					{#each otherSections as section, index}
						<div
							class="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100 flex flex-col"
						>
							<div class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
								{#if index === 0}
									<!-- Network icon -->
									<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
									</svg>
								{:else if index === 1}
									<!-- Family icon -->
									<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
									</svg>
								{:else}
									<!-- Life Groups icon -->
									<svg class="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
									</svg>
								{/if}
							</div>
							{#if section.title}
								<h3 class="text-2xl font-bold text-gray-900 mb-4">
									{@html section.title}
								</h3>
							{/if}
							{#if section.content}
								<div class="prose prose-sm max-w-none text-gray-600 leading-relaxed flex-1">
									{@html section.content}
								</div>
							{/if}
							<div class="mt-6 pt-6 border-t border-gray-200">
								<div class="relative h-40 rounded-lg overflow-hidden">
									{#if index === 0}
										<img
											src="https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066390/egcc/egcc/img-church-bg.jpg"
											alt="Church Community"
											class="w-full h-full object-cover"
										/>
									{:else if index === 1}
										<img
											src="https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066391/egcc/egcc/img-community-groups-bg.jpg"
											alt="Church Family"
											class="w-full h-full object-cover"
										/>
									{:else}
										<img
											src="https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066391/egcc/egcc/img-community-groups-bg.jpg"
											alt="Community Groups"
											class="w-full h-full object-cover"
										/>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}

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
