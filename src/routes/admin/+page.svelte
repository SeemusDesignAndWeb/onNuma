<script>
	export let params = {};
</script>

<svelte:head>
	<title>Admin Dashboard - EGCC</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
		<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
			<a
				href="/admin/pages"
				class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
			>
				<h2 class="text-xl font-bold mb-2">Pages</h2>
				<p class="text-gray-600">Manage page content</p>
			</a>

			<a
				href="/admin/team"
				class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
			>
				<h2 class="text-xl font-bold mb-2">Team</h2>
				<p class="text-gray-600">Manage team members</p>
			</a>

			<a
				href="/admin/services"
				class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
			>
				<h2 class="text-xl font-bold mb-2">Services</h2>
				<p class="text-gray-600">Manage services & programs</p>
			</a>

			<a
				href="/admin/activities"
				class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
			>
				<h2 class="text-xl font-bold mb-2">Activities</h2>
				<p class="text-gray-600">Manage community activities</p>
			</a>

			<a
				href="/admin/podcasts"
				class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
			>
				<h2 class="text-xl font-bold mb-2">Podcasts</h2>
				<p class="text-gray-600">Manage sermons & audio</p>
			</a>

			<a
				href="/admin/hero-slides"
				class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
			>
				<h2 class="text-xl font-bold mb-2">Hero Slides</h2>
				<p class="text-gray-600">Manage homepage hero slides</p>
			</a>

			<a
				href="/admin/images"
				class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
			>
				<h2 class="text-xl font-bold mb-2">Images</h2>
				<p class="text-gray-600">Upload and manage images</p>
			</a>

			<a
				href="/admin/settings"
				class="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow"
			>
				<h2 class="text-xl font-bold mb-2">Settings</h2>
				<p class="text-gray-600">Contact info & service times</p>
			</a>
		</div>
	</div>

