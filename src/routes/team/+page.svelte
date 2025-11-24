<script lang="js">
	import Team from '$lib/components/Team.svelte';
	import Contact from '$lib/components/Contact.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { getContext } from 'svelte';

	export let data;
	export let params = {};

	// Extract sections from page data
	$: sections = data.page?.sections || [];
	
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
</script>

<svelte:head>
	<title>{data.page?.title || 'Our Team'} - Eltham Green Community Church</title>
	<meta name="description" content={data.page?.metaDescription || "Meet the leadership team of Eltham Green Community Church"} />
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
						<p class="text-white text-lg md:text-xl mb-4 animate-fade-in">
							{data.page.heroSubtitle}
						</p>
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

<!-- Team Members Section -->
<Team teamDescription={data.page?.teamDescription || ''} team={data.team} />

<!-- Page Sections -->
{#each sections as section, sectionIndex}
	{#if section.type === 'text'}
		<section class="py-20 {sectionIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
			<div class="container mx-auto px-4">
				<div class="max-w-6xl mx-auto">
					{#if section.image}
						<div class="grid md:grid-cols-2 gap-12 items-center">
							<div class="order-2 md:order-1">
								{#if section.title}
									<h2 class="text-4xl font-bold text-gray-900 mb-4">
										{@html section.title}
									</h2>
								{/if}
								{#if section.content}
									<div class="prose prose-lg max-w-none text-gray-700 leading-relaxed">
										{@html section.content}
									</div>
								{/if}
								{#if section.cta && section.cta.link && section.cta.text}
									<div class="mt-6">
										<a
											href={section.cta.link}
											target={section.cta.target || '_self'}
											class="inline-block px-6 py-3 bg-brand-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
										>
											{section.cta.text}
										</a>
									</div>
								{/if}
							</div>
							<div class="order-1 md:order-2 flex justify-center md:justify-end">
								<div class="relative w-full max-w-lg">
									<div class="absolute -inset-4 bg-primary/20 rounded-2xl transform rotate-3"></div>
									<img
										src={section.image}
										alt={section.title || "Section image"}
										class="relative rounded-2xl shadow-2xl w-full h-auto"
									/>
								</div>
							</div>
						</div>
					{:else}
						<div class="max-w-4xl mx-auto text-center">
							{#if section.title}
								<h2 class="text-4xl font-bold text-gray-900 mb-4">
									{@html section.title}
								</h2>
							{/if}
							{#if section.content}
								<div class="prose prose-lg max-w-none text-gray-700 leading-relaxed">
									{@html section.content}
								</div>
							{/if}
							{#if section.cta && section.cta.link && section.cta.text}
								<div class="mt-6">
									<a
										href={section.cta.link}
										target={section.cta.target || '_self'}
										class="inline-block px-6 py-3 bg-brand-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-colors"
									>
										{section.cta.text}
									</a>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</section>
	{/if}
{/each}

<Contact contactInfo={data.contactInfo} />

<Footer />

