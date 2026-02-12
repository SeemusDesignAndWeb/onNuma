<script>
	import { onMount } from 'svelte';

	export let teamDescription = '';
	export let team = [];

	let mounted = false;

	onMount(() => {
		mounted = true;
	});

	// Fallback to hardcoded data if no team data provided
	const fallbackTeam = [
		{
			name: 'John Watson',
			role: 'Lead Pastor',
			image: '/assets/team-john-watson.png',
			quote: 'John has been in the church from the beginning and made a commitment to Christ at the age of 18. Lived in Eltham attending local schools then working in the city. Having been self-employed since \'94, John now also works part-time in Fleet Street and has lead the church for the last 20 years. He is married to Janna and has three children and loves coffee and café culture.'
		},
		{
			name: 'Daniel Bull',
			role: 'Elder',
			image: '/assets/team-daniel-bull.png',
			quote: 'Daniel has been at EGCC since becoming a Christian at the age of 13. Through the years he has worked with the children and youth, led prayer teams and been involved in the ministry of the Word. He is married to Louisa and they have three sons. Daniel enjoys doing Parkrun and playing games if he gets the chance.'
		},
		{
			name: 'Alan Robinson',
			role: 'Elder',
			image: '/assets/team-alan-robinson.jpg',
			quote: 'Alan is a long term member of EGCC and has held a number of roles. Alan launched Greenwich Foodbank as it is known today, joining many separate groups together. Alan is married to Esme and has 3 children and a number of grandchildren. He has also been a Trustee, Fresh Ground Coffee House director for many years and continues to play a large supporting role in church life.'
		},
		{
			name: 'Adam Bull',
			role: 'Elder',
			image: '/assets/team-adam-bull.jpg',
			quote: 'Adam has been a follower of Jesus for 28 years and has served in full-time ministry for the past 18 years. Much of that time has been spent in South Africa, where he\'s been involved in various ministries and church plants, driven by a deep passion to see people experience new life and purpose in Jesus. He is married to Bulelwa, and together they\'ve been blessed with two energetic boys, aged 4 and 2.'
		}
	];

	$: leadership = team && team.length > 0 ? team : fallbackTeam;
</script>

<section id="leadership" class="py-20 bg-white">
	<div class="container mx-auto px-4">
		<div class="text-center mb-16">
			<h2 class="text-4xl font-bold text-gray-900 mb-4">Our Eldership Team</h2>
			{#if teamDescription}
				<div class="max-w-4xl mx-auto text-gray-600 leading-relaxed">
					{@html teamDescription}
				</div>
			{:else}
				<p class="text-gray-600">Developing leaders of tomorrow</p>
			{/if}
		</div>

		<div class="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
			{#each leadership as leader}
				<div class="flex flex-col md:flex-row gap-6 md:gap-10">
					<div class="flex-shrink-0 flex justify-center md:justify-start">
						<div class="relative">
							<div class="absolute -inset-4 bg-primary/20 rounded-2xl transform rotate-3"></div>
							<img
								src={leader.image}
								alt={leader.name}
								class="relative w-44 h-44 object-cover rounded-2xl shadow-2xl"
							/>
						</div>
					</div>
					<div class="flex-1 text-center md:text-left">
						<h3 class="text-xl font-bold text-gray-900 mb-1">{leader.name}</h3>
						<p class="text-primary font-medium mb-3">{leader.role}</p>
						<p class="text-gray-600 text-sm leading-relaxed">{leader.quote}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>
