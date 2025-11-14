<script lang="js">
	import { onMount } from 'svelte';

	export let params = {};

	let images = [];
	let loading = true;
	let uploading = false;
	let uploadError = '';

	onMount(async () => {
		await loadImages();
	});

	async function loadImages() {
		try {
			const response = await fetch('/api/images');
			if (response.ok) {
				images = await response.json();
			}
		} catch (error) {
			console.error('Failed to load images:', error);
		} finally {
			loading = false;
		}
	}

	async function handleUpload(event) {
		const target = event.target;
		const file = target.files?.[0];
		if (!file) return;

		uploading = true;
		uploadError = '';

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/api/images', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				await loadImages();
				// Reset file input
				target.value = '';
			} else {
				const error = await response.json();
				uploadError = error.error || 'Failed to upload image';
			}
		} catch (error) {
			uploadError = 'Failed to upload image';
			console.error('Upload error:', error);
		} finally {
			uploading = false;
		}
	}

	async function deleteImage(id) {
		if (!confirm('Are you sure you want to delete this image?')) return;

		try {
			const response = await fetch(`/api/images?id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadImages();
			}
		} catch (error) {
			console.error('Failed to delete image:', error);
		}
	}

	function copyImagePath(path) {
		navigator.clipboard.writeText(path);
		// Could add a toast notification here
	}

	function formatFileSize(bytes) {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}
</script>

<svelte:head>
	<title>Manage Images - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Manage Images</h1>
	</div>

	<!-- Upload Section -->
	<div class="bg-white p-6 rounded-lg shadow mb-6">
		<h2 class="text-2xl font-bold mb-4">Upload New Image</h2>
		<div class="space-y-4">
			<div>
				<label class="block text-sm font-medium mb-2">Select Image</label>
				<input
					type="file"
					accept="image/*"
					on:change={handleUpload}
					disabled={uploading}
					class="w-full px-3 py-2 border rounded disabled:opacity-50"
				/>
				<p class="text-sm text-gray-500 mt-1">
					Supported formats: JPG, PNG, GIF, WebP. Max size: 10MB
				</p>
			</div>
			{#if uploadError}
				<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
					{uploadError}
				</div>
			{/if}
			{#if uploading}
				<div class="text-primary">Uploading...</div>
			{/if}
		</div>
	</div>

	<!-- Images Grid -->
	{#if loading}
		<p>Loading images...</p>
	{:else if images.length === 0}
		<p class="text-gray-600">No images uploaded yet. Upload your first image above!</p>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each images as image}
				<div class="bg-white rounded-lg shadow overflow-hidden">
					<div class="aspect-square bg-gray-100 relative">
						<img
							src={image.path}
							alt={image.originalName}
							class="w-full h-full object-cover"
						/>
					</div>
					<div class="p-4">
						<h3 class="font-medium text-sm mb-1 truncate" title={image.originalName}>
							{image.originalName}
						</h3>
						<p class="text-xs text-gray-500 mb-2">{formatFileSize(image.size)}</p>
						<div class="flex gap-2">
							<button
								on:click={() => copyImagePath(image.path)}
								class="flex-1 px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
								title="Copy image path"
							>
								Copy Path
							</button>
							<button
								on:click={() => deleteImage(image.id)}
								class="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
								title="Delete image"
							>
								Delete
							</button>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

