<script lang="js">
	import { onMount } from 'svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import ImagePicker from '$lib/components/ImagePicker.svelte';

	export let params = {};

	let services = [];
	let loading = true;
	let editing = null;
	let showForm = false;
	let showImagePicker = false;

	onMount(async () => {
		await loadServices();
	});

	async function loadServices() {
		try {
			const response = await fetch('/api/content?type=services');
			services = await response.json();
		} catch (error) {
			console.error('Failed to load services:', error);
		} finally {
			loading = false;
		}
	}

	function startEdit(service) {
		editing = service
			? { ...service }
			: {
					id: '',
					title: '',
					description: '',
					image: '',
					icon: ''
				};
		showForm = true;
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
			editing.image = imagePath;
		}
		showImagePicker = false;
	}

	async function saveService() {
		if (!editing) return;

		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'service', data: editing })
			});

			if (response.ok) {
				await loadServices();
				cancelEdit();
			}
		} catch (error) {
			console.error('Failed to save service:', error);
		}
	}

	async function deleteService(id) {
		if (!confirm('Are you sure you want to delete this service?')) return;

		try {
			const response = await fetch(`/api/content?type=service&id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadServices();
			}
		} catch (error) {
			console.error('Failed to delete service:', error);
		}
	}
</script>

<svelte:head>
	<title>Manage Services - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Manage Services</h1>
		<button
			on:click={() => startEdit()}
			class="px-4 py-2 bg-primary text-white rounded hover:bg-opacity-90"
		>
			Add New Service
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<h2 class="text-2xl font-bold mb-4">
				{editing.id ? 'Edit Service' : 'New Service'}
			</h2>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">ID</label>
					<input
						type="text"
						bind:value={editing.id}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., sunday-worship"
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
					<label class="block text-sm font-medium mb-1">Description</label>
					<RichTextEditor bind:value={editing.description} height="250px" />
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Image URL</label>
					<div class="space-y-2">
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={editing.image}
								class="flex-1 px-3 py-2 border rounded"
								placeholder="/images/service.jpg"
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
								/>
							</div>
						{/if}
					</div>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Icon (FontAwesome class, optional)</label>
					<input
						type="text"
						bind:value={editing.icon}
						class="w-full px-3 py-2 border rounded"
						placeholder="fa fa-heart"
					/>
				</div>
				<div class="flex gap-2">
					<button
						on:click={saveService}
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
	{:else if services.length === 0}
		<p class="text-gray-600">No services found. Add your first service!</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Title
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Description Preview
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each services as service}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">{service.title}</td>
							<td class="px-6 py-4 text-sm text-gray-500">
								{service.description.substring(0, 100)}...
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(service)}
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deleteService(service.id)}
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

