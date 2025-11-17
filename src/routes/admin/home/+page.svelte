<script lang="js">
	import { onMount } from 'svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import ImagePicker from '$lib/components/ImagePicker.svelte';

	export let params = {};

	let home = {
		aboutLabel: '',
		aboutTitle: '',
		aboutContent: '',
		aboutImage: ''
	};
	let loading = true;
	let saving = false;
	let saved = false;
	let showImagePicker = false;

	onMount(async () => {
		await loadHome();
	});

	async function loadHome() {
		try {
			const response = await fetch('/api/content?type=home');
			home = await response.json();
		} catch (error) {
			console.error('Failed to load home page data:', error);
		} finally {
			loading = false;
		}
	}

	function openImagePicker() {
		showImagePicker = true;
	}

	function handleImageSelect(imagePath) {
		home.aboutImage = imagePath;
		showImagePicker = false;
	}

	async function saveHome() {
		saving = true;
		saved = false;
		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'home', data: home })
			});

			if (response.ok) {
				saved = true;
				setTimeout(() => (saved = false), 3000);
			} else {
				const error = await response.json();
				alert(error.error || 'Failed to save home page');
			}
		} catch (error) {
			console.error('Failed to save home page:', error);
			alert('Failed to save home page');
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Home Page - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="max-w-4xl mx-auto">
		<div class="mb-8">
			<h1 class="text-3xl font-bold text-gray-900 mb-2">Home Page Settings</h1>
			<p class="text-gray-600">Edit the "About" section content that appears on the home page.</p>
		</div>

		{#if loading}
			<div class="text-center py-12">
				<p class="text-gray-500">Loading...</p>
			</div>
		{:else}
			<div class="bg-white rounded-lg shadow-md p-6 space-y-6">
				<!-- About Label -->
				<div>
					<label class="block text-sm font-medium mb-1">About Section Label</label>
					<p class="text-xs text-gray-500 mb-2">
						The small label that appears above the title (e.g., "Our Story")
					</p>
					<input
						type="text"
						bind:value={home.aboutLabel}
						class="w-full px-3 py-2 border rounded"
						placeholder="Our Story"
					/>
				</div>

				<!-- About Title -->
				<div>
					<label class="block text-sm font-medium mb-1">About Section Title</label>
					<p class="text-xs text-gray-500 mb-2">
						The main heading for the about section. HTML is supported (e.g., for colored text).
					</p>
					<input
						type="text"
						bind:value={home.aboutTitle}
						class="w-full px-3 py-2 border rounded"
						placeholder="Welcome to Eltham Green Community Church"
					/>
				</div>

				<!-- About Content -->
				<div>
					<label class="block text-sm font-medium mb-1">About Section Content</label>
					<p class="text-xs text-gray-500 mb-2">
						The main content text. Use the rich text editor to format your content.
					</p>
					<div class="relative" style="height: 400px;">
						<RichTextEditor bind:value={home.aboutContent} height="400px" />
					</div>
				</div>

				<!-- About Image -->
				<div>
					<label class="block text-sm font-medium mb-1">About Section Image</label>
					<p class="text-xs text-gray-500 mb-2">
						The image displayed in the about section.
					</p>
					<div class="flex gap-3">
						<input
							type="text"
							bind:value={home.aboutImage}
							class="flex-1 px-3 py-2 border rounded"
							placeholder="Image URL"
						/>
						<button
							type="button"
							on:click={openImagePicker}
							class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
						>
							Choose Image
						</button>
					</div>
					{#if home.aboutImage}
						<div class="mt-3">
							<img
								src={home.aboutImage}
								alt="About section preview"
								class="max-w-xs rounded border"
								on:error={(e) => {
									e.target.style.display = 'none';
								}}
							/>
						</div>
					{/if}
				</div>

				<!-- Save Button -->
				<div class="flex justify-end pt-4 border-t">
					<button
						on:click={saveHome}
						disabled={saving}
						class="px-6 py-2 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if showImagePicker}
	<ImagePicker on:select={handleImageSelect} on:close={() => (showImagePicker = false)} />
{/if}

