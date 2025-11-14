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
	$: welcomeSection = sections.find(s => s.type === 'welcome');
	$: columnsSection = sections.find(s => s.type === 'columns');
	
	// Extract "Worship and a message" content from first column
	$: worshipContent = columnsSection?.columns?.[0]?.content 
		? (() => {
			const content = columnsSection.columns[0].content;
			const worshipMatch = content.match(/<h4><strong>Worship and a message<\/strong><\/h4>(.*?)(?=<h4>|$)/s);
			return worshipMatch ? worshipMatch[1].trim() : null;
		})()
		: null;
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
						<p class="text-white text-lg md:text-xl mb-3 animate-fade-in">{data.page.heroSubtitle}</p>
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
							href="#welcome"
							class="px-6 py-3 bg-brand-blue text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg text-sm"
						>
							Get Started
						</a>
						<a
							href="#contact"
							class="px-6 py-3 bg-white text-brand-blue rounded-lg font-semibold hover:bg-gray-100 transition-all transform hover:scale-105 shadow-lg text-sm"
						>
							Get in Touch
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- Welcome Section -->
{#if welcomeSection}
	<section id="welcome" class="py-20 bg-gradient-to-b from-white to-gray-50">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="grid md:grid-cols-2 gap-12 items-center">
					<div class="order-2 md:order-1">
						<div class="inline-block mb-4">
							<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider">Welcome</span>
						</div>
						{#if welcomeSection.title}
							<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
								{@html welcomeSection.title}
							</h2>
						{/if}
						{#if welcomeSection.content}
							<div class="prose prose-lg max-w-none text-gray-700 leading-relaxed mb-6">
								{@html welcomeSection.content}
							</div>
						{/if}
						{#if welcomeSection.signature}
							<div class="mt-6">
								<img
									src={welcomeSection.signature}
									alt="Signature"
									class="h-16 w-auto opacity-80"
								/>
							</div>
						{/if}
					</div>
					<div class="order-1 md:order-2 flex justify-center md:justify-end">
						{#if welcomeSection.image}
							<div class="relative w-2/3 max-w-md">
								<div class="absolute -inset-4 bg-brand-blue/20 rounded-2xl transform rotate-3"></div>
								<img
									src={welcomeSection.image}
									alt={welcomeSection.imageAlt || welcomeSection.title || 'Welcome'}
									class="relative rounded-2xl shadow-2xl w-full h-auto"
								/>
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- What to Expect Section -->
{#if columnsSection && columnsSection.columns}
	<section class="py-20 bg-white">
		<div class="container mx-auto px-4">
			<div class="max-w-6xl mx-auto">
				<div class="text-center mb-16">
					<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider mb-2 block">What to Expect</span>
					<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
						Your First Visit
					</h2>
					<p class="text-xl text-gray-600 max-w-2xl mx-auto">
						We want you to feel at home from the moment you arrive
					</p>
				</div>
				<div class="grid md:grid-cols-3 gap-8">
					<!-- Card 1: Start with coffee -->
					{#if columnsSection.columns[0]}
						{@const coffeeContent = columnsSection.columns[0].content?.match(/<h4><strong>Start with a coffee\.\.<\/strong><\/h4>(.*?)(?=<h4>|$)/s)?.[1] || ''}
						<div
							class="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
						>
							<div class="w-16 h-16 bg-brand-blue text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
								1
							</div>
							<h3 class="text-2xl font-bold text-gray-900 mb-4">
								Start with a coffee
							</h3>
							{#if coffeeContent}
								<div class="prose prose-sm max-w-none text-gray-600 leading-relaxed">
									{@html coffeeContent.trim()}
								</div>
							{/if}
						</div>
					{/if}
					
					<!-- Card 2: Worship and a message -->
					{#if worshipContent}
						<div
							class="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
						>
							<div class="w-16 h-16 bg-brand-yellow text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
								2
							</div>
							<h3 class="text-2xl font-bold text-gray-900 mb-4">
								Worship and a message
							</h3>
							<div class="prose prose-sm max-w-none text-gray-600 leading-relaxed">
								{@html worshipContent}
							</div>
						</div>
					{/if}
					
					<!-- Card 3: Get connected -->
					{#if columnsSection.columns[2]}
						<div
							class="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
						>
							<div class="w-16 h-16 bg-brand-red text-white rounded-full flex items-center justify-center mb-6 text-2xl font-bold">
								3
							</div>
							{#if columnsSection.columns[2].title}
								<h3 class="text-2xl font-bold text-gray-900 mb-4">
									{@html columnsSection.columns[2].title}
								</h3>
							{/if}
							{#if columnsSection.columns[2].content}
								<div class="prose prose-sm max-w-none text-gray-600 leading-relaxed">
									{@html columnsSection.columns[2].content}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>
	</section>
{/if}

<!-- For All Ages Section -->
<section class="py-20 bg-gray-900">
	<div class="container mx-auto px-4">
		<div class="max-w-6xl mx-auto">
			<div class="grid md:grid-cols-2 gap-12 items-center">
				<div>
					<span class="text-brand-blue text-sm font-semibold uppercase tracking-wider mb-2 block">For Everyone</span>
					<h2 class="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
						For All Ages
					</h2>
					<div class="space-y-6 text-gray-300 leading-relaxed">
						<div>
							<h4 class="text-xl font-bold text-white mb-2">Young and old are welcome</h4>
							<p>
								Youth and children go out to their own groups instead of the bible talk. We are a family church so we love the little ones and they are free to be involved in our worship together.
							</p>
						</div>
						<div class="grid grid-cols-2 gap-4 pt-4">
							<div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
								<div class="text-2xl font-bold text-brand-blue mb-1">Adventurers</div>
								<div class="text-sm text-gray-300">Up to 7 years</div>
							</div>
							<div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
								<div class="text-2xl font-bold text-brand-blue mb-1">Explorers</div>
								<div class="text-sm text-gray-300">8-14 years</div>
							</div>
						</div>
						<p class="text-sm text-gray-400 italic">
							Our older teenagers join the main church in the meeting.
						</p>
					</div>
				</div>
				<div class="relative">
					<div class="absolute -inset-4 bg-brand-blue/20 rounded-3xl transform -rotate-3"></div>
					<div class="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-700">
						<div class="text-center">
							<div class="text-6xl font-bold text-brand-blue mb-2">11:00</div>
							<div class="text-xl text-white mb-4">Sunday Service</div>
							<div class="text-sm text-gray-300 mb-6">Doors open at 10:30am</div>
							<div class="space-y-2 text-left">
								<div class="flex items-center text-gray-300">
									<svg class="w-5 h-5 text-brand-blue mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
									<span>Refreshments from 10:30am</span>
								</div>
								<div class="flex items-center text-gray-300">
									<svg class="w-5 h-5 text-brand-blue mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
									</svg>
									<span>Worship and message</span>
								</div>
								<div class="flex items-center text-gray-300">
									<svg class="w-5 h-5 text-brand-blue mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
									</svg>
									<span>Children's groups available</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- Get Connected Section -->
<section class="py-20 bg-white">
	<div class="container mx-auto px-4">
		<div class="max-w-4xl mx-auto text-center">
			<span class="text-primary text-sm font-semibold uppercase tracking-wider mb-2 block">Community</span>
			<h2 class="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
				Get Connected
			</h2>
			<p class="text-xl text-gray-600 mb-8 leading-relaxed">
				Church for us is more than Sundays. We have various Community Groups that happen during the week. We encourage our church family to be more than Sunday attenders where they can really find support, care and encouragement.
			</p>
			<a
				href="/community-groups"
				class="inline-block px-8 py-4 bg-primary text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-lg"
			>
				Explore Community Groups
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
</style>
