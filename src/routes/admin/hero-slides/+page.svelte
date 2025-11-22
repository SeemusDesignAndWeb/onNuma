<script lang="js">
	import { onMount } from 'svelte';
	import ImagePicker from '$lib/components/ImagePicker.svelte';

	export let params = {};

	let slides = [];
	let loading = true;
	let editing = null;
	let showForm = false;
	let showImagePicker = false;
	let images = [];

	onMount(async () => {
		await Promise.all([loadSlides(), loadImages()]);
	});

	async function loadSlides() {
		try {
			const response = await fetch('/api/content?type=hero-slides');
			slides = await response.json();
		} catch (error) {
			console.error('Failed to load hero slides:', error);
		} finally {
			loading = false;
		}
	}

	async function loadImages() {
		try {
			const response = await fetch('/api/images');
			if (response.ok) {
				images = await response.json();
			}
		} catch (error) {
			console.error('Failed to load images:', error);
		}
	}

	function openImagePicker() {
		showImagePicker = true;
	}

	function handleImageSelect(imagePath) {
		if (editing) {
			editing.image = imagePath;
		}
		showImagePicker = false;
	}

	function startEdit(slide) {
		editing = slide
			? { ...slide }
			: {
					id: '',
					title: '',
					subtitle: '',
					cta: '',
					ctaLink: '',
					image: ''
				};
		showForm = true;
	}

	function cancelEdit() {
		editing = null;
		showForm = false;
	}

	async function saveSlide() {
		if (!editing) return;

		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'hero-slide', data: editing })
			});

			if (response.ok) {
				await loadSlides();
				cancelEdit();
			}
		} catch (error) {
			console.error('Failed to save hero slide:', error);
		}
	}

	async function deleteSlide(id) {
		if (!confirm('Are you sure you want to delete this hero slide?')) return;

		try {
			const response = await fetch(`/api/content?type=hero-slide&id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadSlides();
			}
		} catch (error) {
			console.error('Failed to delete hero slide:', error);
		}
	}
</script>

<svelte:head>
	<title>Manage Hero Slides - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Manage Hero Slides</h1>
		<button
			on:click={() => startEdit()}
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
		>
			Add New Slide
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<h2 class="text-2xl font-bold mb-4">
				{editing.id ? 'Edit Hero Slide' : 'New Hero Slide'}
			</h2>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">ID</label>
					<input
						type="text"
						bind:value={editing.id}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., slide-1"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Title</label>
					<input
						type="text"
						bind:value={editing.title}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Subtitle</label>
					<input
						type="text"
						bind:value={editing.subtitle}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Call to Action Text</label>
					<input
						type="text"
						bind:value={editing.cta}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., Learn More"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Call to Action Link</label>
					<input
						type="text"
						bind:value={editing.ctaLink}
						class="w-full px-3 py-2 border rounded"
						placeholder="/im-new"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Background Image</label>
					<div class="space-y-2">
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={editing.image}
								class="flex-1 px-3 py-2 border rounded"
								placeholder="/images/hero-background.jpg or select from uploaded images"
							/>
							<button
								type="button"
								on:click={openImagePicker}
								class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
							>
								Select Image
							</button>
						</div>
						{#if editing.image}
							<div class="mt-2">
								<img
									src={editing.image}
									alt="Preview"
									class="max-w-xs h-32 object-cover rounded border"
									on:error={(e) => {
										e.currentTarget.style.display = 'none';
									}}
								/>
							</div>
						{/if}
					</div>
				</div>
				<div class="flex gap-2">
					<button
						on:click={saveSlide}
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
	{:else if slides.length === 0}
		<p class="text-gray-600">No hero slides found. Add your first slide!</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Slide Preview
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							CTA Button
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each slides as slide}
						<tr>
							<td class="px-6 py-4 text-sm font-medium">
								<div class="flex items-center gap-3">
									{#if slide.image}
										<img
											src={slide.image}
											alt={slide.title}
											class="w-16 h-16 object-cover rounded"
											on:error={(e) => {
												e.currentTarget.style.display = 'none';
											}}
										/>
									{/if}
									<div>
										<div class="font-medium">{slide.title}</div>
										<div class="text-xs text-gray-500">{slide.subtitle}</div>
									</div>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">{slide.cta}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(slide)}
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deleteSlide(slide.id)}
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

	<ImagePicker open={showImagePicker} onSelect={handleImageSelect} />
</div>

