<script lang="js">
	import Navbar from '$lib/components/Navbar.svelte';
	import Team from '$lib/components/Team.svelte';
	import Contact from '$lib/components/Contact.svelte';
	import Footer from '$lib/components/Footer.svelte';

	export let data;
	export let params = {};
</script>

<svelte:head>
	<title>Our Team - Eltham Green Community Church</title>
	<meta name="description" content="Meet the leadership team of Eltham Green Community Church" />
</svelte:head>

<Navbar />

<section
	id="home"
	class="relative h-[50vh] overflow-hidden"
	style="background-image: url('https://res.cloudinary.com/dl8kjhwjs/image/upload/v1763066390/egcc/egcc/img-church-bg.jpg'); background-size: cover; background-position: center;"
>
	<div class="absolute inset-0 bg-black bg-opacity-40"></div>
	<div class="relative h-full flex items-end pb-12">
		<div class="container mx-auto px-4">
			<div class="max-w-2xl">
				<h1 class="text-white text-4xl md:text-5xl font-bold mb-3 animate-fade-in">
					{data.teamHeroTitle}
				</h1>
				{#if data.teamHeroSubtitle}
					<p class="text-white text-lg md:text-xl mb-4 animate-fade-in">
						{data.teamHeroSubtitle}
					</p>
				{/if}
				{#if data.teamHeroButtons && data.teamHeroButtons.length > 0}
					<div class="flex flex-wrap gap-3 mt-4">
						{#each data.teamHeroButtons as button}
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

<Team teamDescription={data.teamDescription} team={data.team} />

<Contact contactInfo={data.contactInfo} />

<Footer />

