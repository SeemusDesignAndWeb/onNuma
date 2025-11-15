<script lang="js">
	import { onMount } from 'svelte';

	export let params = {};

	let images = [];
	let loading = true;
	let uploading = false;
	let uploadError = '';
	let syncing = false;
	let syncMessage = '';
	let syncError = '';
	let cloudinaryImages = [];
	let loadingCloudinary = false;
	let showCloudinarySelector = false;
	let selectedPublicIds = [];
	let searchTerm = '';
	let rateLimitResetTime = null;

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

	async function loadCloudinaryImages() {
		loadingCloudinary = true;
		syncError = '';
		syncMessage = '';

		try {
			const response = await fetch('/api/images/sync');
			
			if (!response.ok) {
				// Try to get error message from response
				let errorMessage = 'Failed to load Cloudinary images';
				try {
					const errorData = await response.json();
					errorMessage = errorData.error || errorMessage;
					// Store rate limit reset time if available
					if (errorData.resetTime) {
						rateLimitResetTime = errorData.resetTime;
					} else {
						rateLimitResetTime = null;
					}
				} catch (e) {
					errorMessage = `HTTP ${response.status}: ${response.statusText}`;
					rateLimitResetTime = null;
				}
				syncError = errorMessage;
				loadingCloudinary = false;
				return;
			}

			const result = await response.json();

			if (result.success) {
				cloudinaryImages = result.images || [];
				showCloudinarySelector = true;
				selectedPublicIds = [];
			} else {
				syncError = result.error || 'Failed to load Cloudinary images';
				rateLimitResetTime = result.resetTime || null;
			}
		} catch (error) {
			syncError = 'Failed to load Cloudinary images: ' + (error.message || 'Unknown error');
			rateLimitResetTime = null;
			console.error('Load error:', error);
		} finally {
			loadingCloudinary = false;
		}
	}

	function toggleSelection(publicId) {
		const index = selectedPublicIds.indexOf(publicId);
		if (index > -1) {
			selectedPublicIds = selectedPublicIds.filter(id => id !== publicId);
		} else {
			selectedPublicIds = [...selectedPublicIds, publicId];
		}
	}

	function selectAll() {
		const newIds = cloudinaryImages
			.filter(img => !img.alreadyImported && !selectedPublicIds.includes(img.publicId))
			.map(img => img.publicId);
		selectedPublicIds = [...selectedPublicIds, ...newIds];
	}

	function deselectAll() {
		selectedPublicIds = [];
	}

	async function importSelected() {
		if (selectedPublicIds.length === 0) {
			syncError = 'Please select at least one image to import';
			return;
		}

		syncing = true;
		syncMessage = '';
		syncError = '';

		try {
			const response = await fetch('/api/images/sync', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					publicIds: selectedPublicIds
				})
			});

			const result = await response.json();

			if (response.ok && result.success) {
				syncMessage = result.message || `Imported successfully! Added: ${result.added}, Updated: ${result.updated}, Total: ${result.total}`;
				rateLimitResetTime = null;
				// Reload images after sync
				await loadImages();
				// Reload Cloudinary images to update "already imported" status
				await loadCloudinaryImages();
			} else {
				syncError = result.error || 'Failed to import images';
				rateLimitResetTime = result.resetTime || null;
			}
		} catch (error) {
			syncError = 'Failed to import images: ' + error.message;
			console.error('Import error:', error);
		} finally {
			syncing = false;
		}
	}

	function closeCloudinarySelector() {
		showCloudinarySelector = false;
		cloudinaryImages = [];
		selectedPublicIds = [];
		syncMessage = '';
		syncError = '';
	}

	$: filteredCloudinaryImages = searchTerm
		? cloudinaryImages.filter(img =>
				img.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
				img.publicId.toLowerCase().includes(searchTerm.toLowerCase())
			)
		: cloudinaryImages;
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

	<!-- Sync from Cloudinary Section -->
	<div class="bg-white p-6 rounded-lg shadow mb-6">
		<h2 class="text-2xl font-bold mb-4">Import from Cloudinary</h2>
		<div class="space-y-4">
			<p class="text-sm text-gray-600">
				Browse and select images from your Cloudinary account to import into the database.
			</p>
			{#if !showCloudinarySelector}
				<div class="space-y-2">
					<button
						on:click={loadCloudinaryImages}
						disabled={loadingCloudinary}
						class="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loadingCloudinary ? 'Loading...' : 'Browse Cloudinary Images'}
					</button>
					{#if loadingCloudinary}
						<p class="text-sm text-gray-500">Fetching images from Cloudinary. This may take a moment...</p>
					{/if}
				</div>
			{:else}
				<div class="space-y-4">
					<!-- Search and Selection Controls -->
					<div class="flex gap-2 items-center">
						<input
							type="text"
							bind:value={searchTerm}
							placeholder="Search images..."
							class="flex-1 px-3 py-2 border rounded"
						/>
						<button
							on:click={selectAll}
							class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
						>
							Select All New
						</button>
						<button
							on:click={deselectAll}
							class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
						>
							Deselect All
						</button>
						<button
							on:click={closeCloudinarySelector}
							class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
						>
							Close
						</button>
					</div>

					<!-- Selected Count -->
					<div class="text-sm text-gray-600">
						{selectedPublicIds.length} image{selectedPublicIds.length !== 1 ? 's' : ''} selected
					</div>

					<!-- Cloudinary Images Grid -->
					<div class="max-h-96 overflow-y-auto border rounded p-4">
						{#if loadingCloudinary}
							<div class="text-center py-8">Loading images from Cloudinary...</div>
						{:else if filteredCloudinaryImages.length === 0}
							<div class="text-center py-8 text-gray-500">
								{searchTerm ? 'No images found matching your search.' : 'No images found in Cloudinary.'}
							</div>
						{:else}
							<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
								{#each filteredCloudinaryImages as img}
									<div
										class="border rounded-lg overflow-hidden relative {img.alreadyImported ? 'opacity-60' : ''} {selectedPublicIds.includes(img.publicId) ? 'ring-2 ring-primary' : ''}"
									>
										<label class="cursor-pointer block">
											<div class="aspect-square bg-gray-100 relative">
												<img
													src={img.url}
													alt={img.filename}
													class="w-full h-full object-cover"
												/>
												{#if img.alreadyImported}
													<div class="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
														Imported
													</div>
												{/if}
												<div class="absolute top-2 left-2">
													<input
														type="checkbox"
														checked={selectedPublicIds.includes(img.publicId)}
														on:change={() => toggleSelection(img.publicId)}
														disabled={img.alreadyImported}
														class="w-5 h-5"
													/>
												</div>
											</div>
											<div class="p-2">
												<p class="text-xs truncate" title={img.filename}>
													{img.filename}
												</p>
												<p class="text-xs text-gray-500">
													{formatFileSize(img.size)}
												</p>
											</div>
										</label>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Import Button -->
					<div class="flex gap-2">
						<button
							on:click={importSelected}
							disabled={syncing || selectedPublicIds.length === 0}
							class="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{syncing ? 'Importing...' : `Import Selected (${selectedPublicIds.length})`}
						</button>
					</div>
				</div>
			{/if}

			{#if syncMessage}
				<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
					{syncMessage}
				</div>
			{/if}
			{#if syncError}
				<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
					<div class="font-semibold mb-1">{syncError}</div>
					{#if rateLimitResetTime}
						<div class="text-sm mt-2">
							You can try again after: <strong>{rateLimitResetTime}</strong>
						</div>
					{:else if syncError.includes('rate limit')}
						<div class="text-sm mt-2">
							Cloudinary has a rate limit of 500 API calls per hour. Please wait a bit and try again.
						</div>
					{/if}
				</div>
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

