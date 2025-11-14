<script lang="js">
	import { onMount } from 'svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import ImagePicker from '$lib/components/ImagePicker.svelte';

	export let params = {};

	let pages = [];
	let loading = true;
	let editing = null;
	let showForm = false;
	let showImagePicker = false;

	onMount(async () => {
		await loadPages();
	});

	async function loadPages() {
		try {
			const response = await fetch('/api/content?type=pages');
			pages = await response.json();
		} catch (error) {
			console.error('Failed to load pages:', error);
		} finally {
			loading = false;
		}
	}

	function startEdit(page) {
		editing = page
			? { 
				...page, 
				heroMessages: page.heroMessages || [],
				heroTitle: page.heroTitle || '',
				heroSubtitle: page.heroSubtitle || '',
				heroButtons: page.heroButtons || [],
				heroOverlay: page.heroOverlay || 40
			}
			: {
					id: '',
					title: '',
					content: '',
					heroImage: '',
					heroTitle: '',
					heroSubtitle: '',
					heroButtons: [],
					heroOverlay: 40,
					metaDescription: '',
					heroMessages: []
				};
		showForm = true;
	}

	function addHeroMessage() {
		if (editing && !editing.heroMessages) {
			editing.heroMessages = [];
		}
		if (editing) {
			editing.heroMessages = [...(editing.heroMessages || []), ''];
		}
	}

	function removeHeroMessage(index) {
		if (editing && editing.heroMessages) {
			editing.heroMessages = editing.heroMessages.filter((_, i) => i !== index);
		}
	}

	function addHeroButton() {
		if (editing && !editing.heroButtons) {
			editing.heroButtons = [];
		}
		if (editing) {
			editing.heroButtons = [...(editing.heroButtons || []), { text: '', link: '', style: 'primary', target: '_self' }];
		}
	}

	function removeHeroButton(index) {
		if (editing && editing.heroButtons) {
			editing.heroButtons = editing.heroButtons.filter((_, i) => i !== index);
		}
	}

	function cancelEdit() {
		editing = null;
		showForm = false;
	}

	function openImagePicker() {
		showImagePicker = true;
	}

	function handleImageSelect(imagePath) {
		if (editing) {
			editing.heroImage = imagePath;
		}
		showImagePicker = false;
	}

	async function savePage() {
		if (!editing) return;

		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'page', data: editing })
			});

			if (response.ok) {
				await loadPages();
				cancelEdit();
			}
		} catch (error) {
			console.error('Failed to save page:', error);
		}
	}

	async function deletePage(id) {
		if (!confirm('Are you sure you want to delete this page?')) return;

		try {
			const response = await fetch(`/api/content?type=page&id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadPages();
			}
		} catch (error) {
			console.error('Failed to delete page:', error);
		}
	}
</script>

<svelte:head>
	<title>Manage Pages - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Manage Pages</h1>
		<button
			on:click={() => startEdit()}
			class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90"
		>
			Add New Page
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<h2 class="text-2xl font-bold mb-4">
				{editing.id ? 'Edit Page' : 'New Page'}
			</h2>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">ID (URL slug)</label>
					<input
						type="text"
						bind:value={editing.id}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., im-new"
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
					<label class="block text-sm font-medium mb-1">Hero Title</label>
					<p class="text-xs text-gray-500 mb-2">
						The main title in the hero section. You can use HTML like &lt;span style="color:#4BB170;"&gt;text&lt;/span&gt; for colored text.
					</p>
					<input
						type="text"
						bind:value={editing.heroTitle}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., Online"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Hero Subtitle</label>
					<input
						type="text"
						bind:value={editing.heroSubtitle}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., Watch our services online"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Hero Buttons</label>
					<p class="text-xs text-gray-500 mb-2">
						Add buttons to display in the hero section.
					</p>
					{#if editing.heroButtons && editing.heroButtons.length > 0}
						<div class="space-y-3 mb-2">
							{#each editing.heroButtons as button, index}
								<div class="border p-3 rounded space-y-2">
									<div class="flex gap-2">
										<input
											type="text"
											bind:value={editing.heroButtons[index].text}
											class="flex-1 px-3 py-2 border rounded"
											placeholder="Button text"
										/>
										<button
											type="button"
											on:click={() => removeHeroButton(index)}
											class="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
											aria-label="Remove button"
										>
											×
										</button>
									</div>
									<input
										type="text"
										bind:value={editing.heroButtons[index].link}
										class="w-full px-3 py-2 border rounded"
										placeholder="Button link (e.g., /contact or https://example.com)"
									/>
									<div class="flex gap-2">
										<select bind:value={editing.heroButtons[index].style} class="flex-1 px-3 py-2 border rounded">
											<option value="primary">Primary (colored)</option>
											<option value="secondary">Secondary (white)</option>
										</select>
										<select bind:value={editing.heroButtons[index].target} class="flex-1 px-3 py-2 border rounded">
											<option value="_self">Same window</option>
											<option value="_blank">New window</option>
										</select>
									</div>
								</div>
							{/each}
						</div>
					{/if}
					<button
						type="button"
						on:click={addHeroButton}
						class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
					>
						+ Add Button
					</button>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Hero Messages (Rotating Subtitles)</label>
					<p class="text-xs text-gray-500 mb-2">
						These messages will rotate in the hero section. Leave empty if you don't want rotating messages.
					</p>
					{#if editing.heroMessages && editing.heroMessages.length > 0}
						<div class="space-y-2 mb-2">
							{#each editing.heroMessages as msg, index}
								<div class="flex gap-2">
									<input
										type="text"
										bind:value={editing.heroMessages[index]}
										class="flex-1 px-3 py-2 border rounded"
										placeholder="Enter rotating message..."
									/>
									<button
										type="button"
										on:click={() => removeHeroMessage(index)}
										class="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
										aria-label="Remove message"
									>
										×
									</button>
								</div>
							{/each}
						</div>
					{/if}
					<button
						type="button"
						on:click={addHeroMessage}
						class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
					>
						+ Add Message
					</button>
				</div>
				<div class="relative mb-4">
					<label class="block text-sm font-medium mb-1">Content</label>
					<div class="relative" style="height: 400px;">
						<RichTextEditor bind:value={editing.content} height="400px" />
					</div>
				</div>
				<div class="relative mt-4">
					<label class="block text-sm font-medium mb-1">Hero Image URL</label>
					<div class="space-y-2">
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={editing.heroImage}
								class="flex-1 px-3 py-2 border rounded"
								placeholder="/images/hero-bg.jpg"
							/>
							<button
								type="button"
								on:click={openImagePicker}
								class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
							>
								Select Image
							</button>
						</div>
						{#if editing.heroImage}
							<div class="mt-2">
								<img
									src={editing.heroImage}
									alt="Preview"
									class="max-w-xs h-32 object-cover rounded border"
								/>
							</div>
						{/if}
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Hero Overlay Opacity</label>
					<p class="text-xs text-gray-500 mb-2">
						Dark overlay opacity over hero image (0-100). Higher = darker.
					</p>
					<input
						type="number"
						bind:value={editing.heroOverlay}
						min="0"
						max="100"
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Meta Description</label>
					<input
						type="text"
						bind:value={editing.metaDescription}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div class="flex gap-2">
					<button
						on:click={savePage}
						class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90"
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
	{:else if pages.length === 0}
		<p class="text-gray-600">No pages found. Create your first page!</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							ID
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Title
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each pages as page}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">{page.id}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">{page.title}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(page)}
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deletePage(page.id)}
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

<ImagePicker open={showImagePicker} onSelect={handleImageSelect} />

