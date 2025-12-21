<script lang="js">
	import { onMount } from 'svelte';

	export let params = {};

	let podcasts = [];
	let loading = true;
	let editing = null;
	let showForm = false;
	let uploading = false;
	let uploadError = '';
	let audioFile = null;
	let audioUrl = '';
	let podcastSettings = {
		podcastAuthor: '',
		podcastEmail: '',
		podcastImage: '',
		podcastDescription: ''
	};
	let savingSettings = false;
	let settingsSaved = false;
	let showSettings = false;
	
	// Migration state
	let migrating = false;
	let migrationResult = null;
	let migrationError = null;
	let downloading = false;
	let downloadResult = null;
	let downloadError = null;
	
	// Bulk upload state
	let bulkUploading = false;
	let bulkUploadResult = null;
	let bulkUploadError = null;
	let selectedFiles = [];

	onMount(async () => {
		await loadPodcasts();
		await loadPodcastSettings();
	});

	async function loadPodcasts() {
		try {
			const response = await fetch('/api/audio');
			if (response.ok) {
				podcasts = await response.json();
			}
		} catch (error) {
			console.error('Failed to load podcasts:', error);
		} finally {
			loading = false;
		}
	}

	// Convert ISO date to datetime-local format (YYYY-MM-DDTHH:mm)
	function isoToDatetimeLocal(isoString) {
		if (!isoString) return '';
		const date = new Date(isoString);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}

	// Convert datetime-local format to ISO string
	function datetimeLocalToIso(datetimeLocal) {
		if (!datetimeLocal) return new Date().toISOString();
		// datetime-local format is YYYY-MM-DDTHH:mm (no timezone)
		// We need to treat it as local time and convert to ISO
		const date = new Date(datetimeLocal);
		return date.toISOString();
	}

	function startEdit(podcast) {
		if (podcast) {
			editing = { ...podcast };
			// Convert ISO date to datetime-local format for the input
			editing.publishedAt = isoToDatetimeLocal(podcast.publishedAt);
		} else {
			editing = {
				id: '',
				title: '',
				description: '',
				speaker: '',
				speakerEmail: '',
				audioUrl: '',
				filename: '',
				originalName: '',
				size: 0,
				publishedAt: isoToDatetimeLocal(new Date().toISOString()),
				guid: ''
			};
		}
		audioUrl = editing.audioUrl;
		audioFile = null;
		showForm = true;
		uploadError = '';
	}

	function cancelEdit() {
		editing = null;
		showForm = false;
		audioFile = null;
		audioUrl = '';
		uploadError = '';
	}

	async function handleAudioUpload(event) {
		const target = event.target;
		const file = target.files?.[0];
		if (!file) return;

		uploading = true;
		uploadError = '';

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/api/audio', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				const result = await response.json();
				audioUrl = result.audioUrl;
				if (editing) {
					editing.audioUrl = result.audioUrl;
					editing.filename = result.filename;
					editing.originalName = result.originalName;
					editing.size = result.size;
				}
				audioFile = file;
				target.value = '';
			} else {
				const error = await response.json();
				uploadError = error.error || 'Failed to upload audio';
			}
		} catch (error) {
			uploadError = 'Failed to upload audio';
			console.error('Upload error:', error);
		} finally {
			uploading = false;
		}
	}

	async function savePodcast() {
		if (!editing) return;

		if (!editing.audioUrl) {
			uploadError = 'Please upload an audio file';
			return;
		}

		try {
			// Convert datetime-local back to ISO format before saving
			const podcastToSave = {
				...editing,
				publishedAt: datetimeLocalToIso(editing.publishedAt)
			};

			const formData = new FormData();
			formData.append('podcast', JSON.stringify(podcastToSave));

			const response = await fetch('/api/audio', {
				method: 'POST',
				body: formData
			});

			if (response.ok) {
				await loadPodcasts();
				cancelEdit();
			} else {
				const error = await response.json();
				uploadError = error.error || 'Failed to save podcast';
			}
		} catch (error) {
			console.error('Failed to save podcast:', error);
			uploadError = 'Failed to save podcast';
		}
	}

	async function deletePodcast(id) {
		if (!confirm('Are you sure you want to delete this podcast?')) return;

		try {
			const response = await fetch(`/api/audio?id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadPodcasts();
			}
		} catch (error) {
			console.error('Failed to delete podcast:', error);
		}
	}

	function formatFileSize(bytes) {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	async function loadPodcastSettings() {
		try {
			const response = await fetch('/api/content?type=settings');
			const settings = await response.json();
			podcastSettings = {
				podcastAuthor: settings.podcastAuthor || '',
				podcastEmail: settings.podcastEmail || '',
				podcastImage: settings.podcastImage || '',
				podcastDescription: settings.podcastDescription || ''
			};
		} catch (error) {
			console.error('Failed to load podcast settings:', error);
		}
	}

	async function savePodcastSettings() {
		savingSettings = true;
		settingsSaved = false;
		try {
			// Merge with existing settings (siteName, primaryColor)
			const currentSettings = await fetch('/api/content?type=settings').then(r => r.json());
			const mergedSettings = {
				...currentSettings,
				...podcastSettings
			};
			
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'settings', data: mergedSettings })
			});

			if (response.ok) {
				settingsSaved = true;
				setTimeout(() => (settingsSaved = false), 3000);
			}
		} catch (error) {
			console.error('Failed to save podcast settings:', error);
		} finally {
			savingSettings = false;
		}
	}

	async function migrateAudioFiles() {
		migrating = true;
		migrationResult = null;
		migrationError = null;
		try {
			const response = await fetch('/api/audio/migrate', {
				method: 'POST'
			});
			const result = await response.json();
			if (response.ok) {
				migrationResult = result;
				// Reload podcasts to see any updates
				await loadPodcasts();
			} else {
				migrationError = result.error || 'Migration failed';
			}
		} catch (error) {
			migrationError = error.message || 'Failed to migrate files';
		} finally {
			migrating = false;
		}
	}

	async function downloadExternalAudio() {
		downloading = true;
		downloadResult = null;
		downloadError = null;
		try {
			const response = await fetch('/api/audio/download-external', {
				method: 'POST'
			});
			const result = await response.json();
			if (response.ok) {
				downloadResult = result;
				// Reload podcasts to see any updates
				await loadPodcasts();
			} else {
				downloadError = result.error || 'Download failed';
			}
		} catch (error) {
			downloadError = error.message || 'Failed to download files';
		} finally {
			downloading = false;
		}
	}

	function handleBulkFileSelect(event) {
		const files = Array.from(event.target.files || []);
		selectedFiles = files;
	}

	async function uploadBulkFiles() {
		if (selectedFiles.length === 0) {
			bulkUploadError = 'Please select at least one file';
			return;
		}

		bulkUploading = true;
		bulkUploadResult = null;
		bulkUploadError = null;

		try {
			const formData = new FormData();
			selectedFiles.forEach(file => {
				formData.append('files', file);
			});

			const response = await fetch('/api/audio/bulk-upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();
			if (response.ok) {
				bulkUploadResult = result;
				// Clear selected files
				selectedFiles = [];
				// Reset file input
				const fileInput = document.getElementById('bulk-file-input');
				if (fileInput) {
					fileInput.value = '';
				}
			} else {
				bulkUploadError = result.error || 'Upload failed';
			}
		} catch (error) {
			bulkUploadError = error.message || 'Failed to upload files';
		} finally {
			bulkUploading = false;
		}
	}
</script>

<svelte:head>
	<title>Manage Podcasts - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-8">Manage Podcasts</h1>

	{#if settingsSaved}
		<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
			Podcast settings saved successfully!
		</div>
	{/if}

	<!-- Settings Toggle Button -->
	<div class="mb-6 flex gap-4">
		<button
			on:click={() => (showSettings = !showSettings)}
			class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors flex items-center gap-2"
		>
			<svg
				class="w-5 h-5 transition-transform {showSettings ? 'rotate-180' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
			Settings
		</button>
	</div>

	<!-- Audio Migration Tools -->
	<div class="bg-white p-6 rounded-lg shadow mb-8">
		<h2 class="text-2xl font-bold mb-4">Audio File Migration</h2>
		<p class="text-sm text-gray-600 mb-4">
			Migrate audio files to the Railway volume for persistent storage across deployments.
		</p>
		
		<div class="space-y-4">
			<!-- Bulk Upload Files -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">0. Upload Multiple Audio Files</h3>
				<p class="text-sm text-gray-600 mb-3">
					Upload multiple audio files directly to the volume storage. Files will be saved with unique names.
				</p>
				<div class="space-y-3">
					<div>
						<label for="bulk-file-input" class="block text-sm font-medium mb-2">
							Select Audio Files (MP3, M4A, OGG, WAV - max 100MB each)
						</label>
						<input
							id="bulk-file-input"
							type="file"
							multiple
							accept="audio/*,.mp3,.m4a,.ogg,.wav"
							on:change={handleBulkFileSelect}
							class="w-full px-3 py-2 border rounded"
							disabled={bulkUploading}
						/>
						{#if selectedFiles.length > 0}
							<p class="text-sm text-gray-600 mt-2">
								{selectedFiles.length} file(s) selected
								({selectedFiles.reduce((sum, f) => sum + f.size, 0).toLocaleString()} bytes)
							</p>
						{/if}
					</div>
					<button
						on:click={uploadBulkFiles}
						disabled={bulkUploading || selectedFiles.length === 0}
						class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{bulkUploading ? 'Uploading...' : `Upload ${selectedFiles.length || 0} File(s)`}
					</button>
					
					{#if bulkUploadResult}
						<div class="mt-4 p-3 bg-green-50 border border-green-200 rounded">
							<p class="font-semibold text-green-800">Upload Complete!</p>
							<p class="text-sm text-green-700">
								✅ Uploaded: {bulkUploadResult.uploaded} file(s)<br>
								❌ Failed: {bulkUploadResult.failed} file(s)<br>
								📦 Total size: {bulkUploadResult.totalSizeFormatted || '0 Bytes'}
							</p>
							{#if bulkUploadResult.files && bulkUploadResult.files.length > 0}
								<details class="mt-2">
									<summary class="text-sm text-green-700 cursor-pointer">Uploaded Files</summary>
									<ul class="text-xs text-green-600 mt-1 space-y-1">
										{#each bulkUploadResult.files as file}
											<li>
												{file.originalName} → {file.filename} ({file.sizeFormatted})
											</li>
										{/each}
									</ul>
								</details>
							{/if}
							{#if bulkUploadResult.errors && bulkUploadResult.errors.length > 0}
								<details class="mt-2">
									<summary class="text-sm text-red-700 cursor-pointer">Errors</summary>
									<ul class="text-xs text-red-600 mt-1 list-disc list-inside">
										{#each bulkUploadResult.errors as error}
											<li>{error.filename}: {error.error}</li>
										{/each}
									</ul>
								</details>
							{/if}
						</div>
					{/if}
					
					{#if bulkUploadError}
						<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded">
							<p class="font-semibold text-red-800">Upload Failed</p>
							<p class="text-sm text-red-700">{bulkUploadError}</p>
						</div>
					{/if}
				</div>
			</div>
			<!-- Migrate from static directory -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">1. Migrate Files from Static Directory</h3>
				<p class="text-sm text-gray-600 mb-3">
					Copy audio files from the static directory to the volume storage.
				</p>
				<button
					on:click={migrateAudioFiles}
					disabled={migrating}
					class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{migrating ? 'Migrating...' : 'Migrate Files'}
				</button>
				
				{#if migrationResult}
					<div class="mt-4 p-3 bg-green-50 border border-green-200 rounded">
						<p class="font-semibold text-green-800">Migration Complete!</p>
						<p class="text-sm text-green-700">
							✅ Migrated: {migrationResult.migrated} file(s)<br>
							⏭️ Skipped: {migrationResult.skipped} file(s)<br>
							❌ Errors: {migrationResult.errors} file(s)<br>
							📦 Total size: {migrationResult.totalSizeFormatted || '0 Bytes'}
						</p>
						{#if migrationResult.errorDetails && migrationResult.errorDetails.length > 0}
							<details class="mt-2">
								<summary class="text-sm text-green-700 cursor-pointer">Error Details</summary>
								<ul class="text-xs text-green-600 mt-1 list-disc list-inside">
									{#each migrationResult.errorDetails as error}
										<li>{error}</li>
									{/each}
								</ul>
							</details>
						{/if}
					</div>
				{/if}
				
				{#if migrationError}
					<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded">
						<p class="font-semibold text-red-800">Migration Failed</p>
						<p class="text-sm text-red-700">{migrationError}</p>
					</div>
				{/if}
			</div>

			<!-- Download external files -->
			<div class="border rounded-lg p-4">
				<h3 class="font-semibold mb-2">2. Download External Audio Files</h3>
				<p class="text-sm text-gray-600 mb-3">
					Download audio files from external URLs (e.g., egcc.co.uk) and save them to the volume.
				</p>
				<button
					on:click={downloadExternalAudio}
					disabled={downloading}
					class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{downloading ? 'Downloading...' : 'Download External Files'}
				</button>
				
				{#if downloadResult}
					<div class="mt-4 p-3 bg-green-50 border border-green-200 rounded">
						<p class="font-semibold text-green-800">Download Complete!</p>
						<p class="text-sm text-green-700">
							✅ Downloaded: {downloadResult.downloaded} file(s)<br>
							⏭️ Skipped: {downloadResult.skipped} file(s)<br>
							❌ Errors: {downloadResult.errors} file(s)<br>
							📦 Total size: {downloadResult.totalSizeFormatted || '0 Bytes'}
						</p>
						{#if downloadResult.errorDetails && downloadResult.errorDetails.length > 0}
							<details class="mt-2">
								<summary class="text-sm text-green-700 cursor-pointer">Error Details</summary>
								<ul class="text-xs text-green-600 mt-1 list-disc list-inside">
									{#each downloadResult.errorDetails as error}
										<li>{error}</li>
									{/each}
								</ul>
							</details>
						{/if}
					</div>
				{/if}
				
				{#if downloadError}
					<div class="mt-4 p-3 bg-red-50 border border-red-200 rounded">
						<p class="font-semibold text-red-800">Download Failed</p>
						<p class="text-sm text-red-700">{downloadError}</p>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Podcast RSS Feed Settings -->
	{#if showSettings}
		<div class="bg-white p-6 rounded-lg shadow mb-8">
		<h2 class="text-2xl font-bold mb-4">Podcast RSS Feed Settings</h2>
		<p class="text-sm text-gray-600 mb-4">
			Configure settings for your podcast RSS feed. This feed is available at{' '}
			<code class="bg-gray-100 px-2 py-1 rounded">/api/podcast-feed</code> and can be
			submitted to Apple Podcasts, Spotify, and other podcast platforms.
		</p>
		<div class="space-y-4">
			<div>
				<label for="podcast-author" class="block text-sm font-medium mb-1">Podcast Author *</label>
				<input
					id="podcast-author"
					type="text"
					bind:value={podcastSettings.podcastAuthor}
					class="w-full px-3 py-2 border rounded"
					placeholder="Eltham Green Community Church"
				/>
				<p class="text-xs text-gray-500 mt-1">
					The name of the podcast author/owner (appears in iTunes/Apple Podcasts)
				</p>
			</div>
			<div>
				<label for="podcast-email" class="block text-sm font-medium mb-1">Podcast Email *</label>
				<input
					id="podcast-email"
					type="email"
					bind:value={podcastSettings.podcastEmail}
					class="w-full px-3 py-2 border rounded"
					placeholder="johnawatson72@gmail.com"
				/>
				<p class="text-xs text-gray-500 mt-1">
					Contact email for the podcast (used in RSS feed metadata)
				</p>
			</div>
			<div>
				<label for="podcast-image" class="block text-sm font-medium mb-1">Podcast Image URL</label>
				<input
					id="podcast-image"
					type="url"
					bind:value={podcastSettings.podcastImage}
					class="w-full px-3 py-2 border rounded"
					placeholder="http://www.egcc.co.uk/company/egcc/images/EGCC-Audio.png"
				/>
				<p class="text-xs text-gray-500 mt-1">
					URL to the podcast cover art image (should be at least 1400x1400px for Apple Podcasts)
				</p>
			</div>
			<div>
				<label for="podcast-description" class="block text-sm font-medium mb-1">Podcast Description</label>
				<textarea
					id="podcast-description"
					bind:value={podcastSettings.podcastDescription}
					rows="3"
					class="w-full px-3 py-2 border rounded"
					placeholder="Latest sermons from Eltham Green Community Church"
				></textarea>
				<p class="text-xs text-gray-500 mt-1">
					Brief description of your podcast (appears in podcast directories)
				</p>
			</div>
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
				<h3 class="font-bold mb-2">RSS Feed URL</h3>
				<p class="text-sm text-gray-700 mb-2">
					Your podcast RSS feed is available at:
				</p>
				<code class="block bg-white p-2 rounded text-sm mb-2">
					/api/podcast-feed
				</code>
				<p class="text-sm text-gray-700">
					Use this URL when submitting your podcast to Apple Podcasts, Spotify, Google Podcasts, and other platforms.
				</p>
			</div>
			<button
				on:click={savePodcastSettings}
				disabled={savingSettings}
				class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
			>
				{savingSettings ? 'Saving...' : 'Save Podcast Settings'}
			</button>
		</div>
	</div>
	{/if}

	<div class="flex justify-between items-center mb-6">
		<h2 class="text-2xl font-bold">Podcasts</h2>
		<button
			on:click={() => startEdit()}
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
		>
			Add New Podcast
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-2xl font-bold">
					{editing.id ? 'Edit Podcast' : 'New Podcast'}
				</h2>
				<div class="flex gap-2">
					<button
						on:click={savePodcast}
						class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
					>
						Save
					</button>
					<button
						on:click={cancelEdit}
						class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
					>
						Cancel
					</button>
				</div>
			</div>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">Title *</label>
					<input
						type="text"
						bind:value={editing.title}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., Building in the face of opposition"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Description</label>
					<textarea
						bind:value={editing.description}
						rows="3"
						class="w-full px-3 py-2 border rounded"
						placeholder="By John Watson"
					></textarea>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label class="block text-sm font-medium mb-1">Speaker *</label>
						<input
							type="text"
							bind:value={editing.speaker}
							class="w-full px-3 py-2 border rounded"
							placeholder="e.g., John Watson"
						/>
					</div>
					<div>
						<label class="block text-sm font-medium mb-1">Speaker Email</label>
						<input
							type="email"
							bind:value={editing.speakerEmail}
							class="w-full px-3 py-2 border rounded"
							placeholder="johnawatson72@gmail.com"
						/>
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Audio File *</label>
					<div class="space-y-2">
						<input
							type="file"
							accept="audio/*,.mp3"
							on:change={handleAudioUpload}
							disabled={uploading}
							class="w-full px-3 py-2 border rounded disabled:opacity-50"
						/>
						<p class="text-sm text-gray-500">
							Supported formats: MP3. Max size: 100MB
						</p>
						{#if uploading}
							<div class="text-primary">Uploading...</div>
						{/if}
						{#if uploadError}
							<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
								{uploadError}
							</div>
						{/if}
						{#if audioUrl}
							<div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
								Audio uploaded: {editing.originalName || 'File'} ({formatFileSize(editing.size)})
							</div>
						{/if}
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Published Date *</label>
					<input
						type="datetime-local"
						bind:value={editing.publishedAt}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">GUID (for RSS feed)</label>
					<input
						type="text"
						bind:value={editing.guid}
						class="w-full px-3 py-2 border rounded"
						placeholder="Auto-generated if left empty"
					/>
				</div>
				<div class="flex gap-2">
					<button
						on:click={savePodcast}
						class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
					>
						Save
					</button>
					<button
						on:click={cancelEdit}
						class="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	{#if loading}
		<p>Loading...</p>
	{:else if podcasts.length === 0}
		<p class="text-gray-600">No podcasts found. Add your first podcast!</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Title
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Speaker
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Published
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each podcasts as podcast}
						<tr>
							<td class="px-6 py-4 text-sm font-medium">{podcast.title}</td>
							<td class="px-6 py-4 text-sm">{podcast.speaker}</td>
							<td class="px-6 py-4 text-sm text-gray-500">
								{new Date(podcast.publishedAt).toLocaleDateString('en-GB')}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(podcast)}
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deletePodcast(podcast.id)}
									class="text-red-600 hover:underline"
								>
									Delete
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

