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
	$: valuesSection = sections.find(s => s.type === 'values');
	
	// Debug logging in browser console
	$: {
		if (typeof window !== 'undefined') {
			console.log('[Church Page Frontend] Sections:', {
				total: sections.length,
				historySection: historySection ? { type: historySection.type, title: historySection.title, hasContent: !!historySection.content } : null,
				otherSectionsCount: otherSections.length,
				valuesSection: valuesSection ? { type: valuesSection.type, title: valuesSection.title, valuesCount: valuesSection.values?.length || 0 } : null
			});
		}
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
	<section class="py-20 bg-gray-900">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="text-center mb-16">
					<span class="text-primary text-sm font-semibold uppercase tracking-wider mb-2 block">Who We Are</span>
					<h2 class="text-4xl md:text-5xl font-bold text-white mb-4">
						Our Identity
					</h2>
					<p class="text-xl text-gray-300 max-w-2xl mx-auto">
						Discover what makes us who we are
					</p>
				</div>
				<div class="grid md:grid-cols-3 gap-8">
					{#each otherSections as section, index}
						<div
							class="group relative animate-fade-in-up bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:shadow-xl transform hover:-translate-y-2 flex flex-col"
							style="animation-delay: {index * 0.1}s"
						>
							<div class="relative overflow-hidden aspect-[2/1]">
								{#if index === 0}
									<img
										src="https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066390/egcc/egcc/img-church-bg.jpg"
										alt="Church Community"
										class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
									/>
								{:else if index === 1}
									<img
										src="https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066391/egcc/egcc/img-community-groups-bg.jpg"
										alt="Church Family"
										class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
									/>
								{:else}
									<img
										src="https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066391/egcc/egcc/img-community-groups-bg.jpg"
										alt="Community Groups"
										class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
									/>
								{/if}
							</div>
							<div class="p-6 flex-1 flex flex-col">
								{#if section.title}
									<h3 class="text-xl font-bold mb-4 text-white">
										{@html section.title}
									</h3>
								{/if}
								{#if section.content}
									<div class="prose prose-sm max-w-none text-gray-300 leading-relaxed flex-1">
										{@html section.content}
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Values Section -->
{#if valuesSection}
	<section class="py-20 bg-gradient-to-b from-white to-gray-50">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="text-center mb-16">
					<span class="text-primary text-sm font-semibold uppercase tracking-wider mb-2 block">What Makes Us Who We Are</span>
					{#if valuesSection.title}
						<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
							{valuesSection.title}
						</h2>
					{/if}
					{#if valuesSection.description}
						<p class="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
							{valuesSection.description}
						</p>
					{/if}
				</div>
				{#if valuesSection.values && valuesSection.values.length > 0}
					<div class="grid md:grid-cols-2 gap-8 mb-12">
						{#each valuesSection.values as value, index}
							{@const colorClasses = [
								{ bg: 'bg-primary/10', border: 'border-primary', title: 'text-primary' },
								{ bg: 'bg-brand-blue/10', border: 'border-brand-blue', title: 'text-brand-blue' },
								{ bg: 'bg-brand-yellow/10', border: 'border-brand-yellow', title: 'text-brand-yellow' },
								{ bg: 'bg-brand-red/10', border: 'border-brand-red', title: 'text-brand-red' },
								{ bg: 'bg-primary/10', border: 'border-primary', title: 'text-primary' },
								{ bg: 'bg-brand-blue/10', border: 'border-brand-blue', title: 'text-brand-blue' },
								{ bg: 'bg-brand-yellow/10', border: 'border-brand-yellow', title: 'text-brand-yellow' }
							]}
							{@const colors = colorClasses[index % colorClasses.length]}
							<div class="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border-2 {colors.border} transform hover:-translate-y-2">
								<div class="flex items-start gap-4 mb-4">
									<div class="w-12 h-12 {colors.bg} rounded-full flex items-center justify-center flex-shrink-0">
										<span class="text-xl font-bold {colors.title}">{index + 1}</span>
									</div>
									<div class="flex-1">
										{#if value.title}
											<h3 class="text-2xl md:text-3xl font-bold {colors.title} mb-3 leading-tight">
												{value.title}
											</h3>
										{/if}
									</div>
								</div>
								{#if value.description}
									<p class="text-gray-600 leading-relaxed">
										{value.description}
									</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
				
				<!-- What We Believe Box -->
				<div class="bg-gradient-to-br from-primary/10 via-brand-blue/10 to-primary/10 border-2 border-primary rounded-2xl p-8 text-center shadow-lg">
					<h3 class="text-2xl font-bold text-gray-900 mb-4">What We Believe</h3>
					<p class="text-gray-700 mb-6 max-w-2xl mx-auto">
						We agree with the Evangelical Alliance statement of faith.
					</p>
					<a
						href="https://www.eauk.org/about-us/how-we-work/basis-of-faith"
						target="_blank"
						rel="noopener noreferrer"
						class="inline-block px-8 py-4 bg-primary text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
					>
						Read Statement of Faith
					</a>
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
