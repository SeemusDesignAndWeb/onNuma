<script>
	export let params = {};
</script>

<svelte:head>
	<title>Admin – OnNuma</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<h1 class="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
		<div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
			<a
				href="/admin/landing"
				class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-brand-blue hover:shadow-md transition-all"
			>
				<h2 class="text-lg font-bold text-gray-900 mb-1">Landing page</h2>
				<p class="text-gray-600 text-sm">Tagline and CTA links for the marketing homepage.</p>
			</a>
			<a
				href="/admin/images"
				class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-brand-blue hover:shadow-md transition-all"
			>
				<h2 class="text-lg font-bold text-gray-900 mb-1">Images</h2>
				<p class="text-gray-600 text-sm">Upload and manage images for the site.</p>
			</a>
			<a
				href="/admin/settings"
				class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-brand-blue hover:shadow-md transition-all"
			>
				<h2 class="text-lg font-bold text-gray-900 mb-1">Settings</h2>
				<p class="text-gray-600 text-sm">Site and contact settings.</p>
			</a>
		</div>
	</div>
</div>
