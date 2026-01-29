<script lang="js">
	import { onMount } from 'svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import { notifications, dialog } from '$lib/crm/stores/notifications.js';

	export let params = {};

	let testimonials = [];
	let loading = true;
	let editing = null;
	let showForm = false;

	onMount(async () => {
		await loadTestimonials();
	});

	async function loadTestimonials() {
		try {
			const response = await fetch('/api/content?type=testimonials');
			testimonials = await response.json();
		} catch (error) {
			console.error('Failed to load testimonials:', error);
		} finally {
			loading = false;
		}
	}

	function startEdit(testimonial) {
		editing = testimonial
			? { ...testimonial }
			: {
					id: '',
					name: '',
					role: '',
					content: '',
					image: ''
				};
		showForm = true;
	}

	function cancelEdit() {
		editing = null;
		showForm = false;
	}

	async function saveTestimonial() {
		if (!editing) return;

		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'testimonial', data: editing })
			});

			if (response.ok) {
				await loadTestimonials();
				notifications.success('Testimonial saved successfully!');
				cancelEdit();
			} else {
				const error = await response.json();
				notifications.error(error.error || 'Failed to save testimonial');
			}
		} catch (error) {
			console.error('Failed to save testimonial:', error);
			notifications.error('Failed to save testimonial');
		}
	}

	async function deleteTestimonial(id) {
		const confirmed = await dialog.confirm('Are you sure you want to delete this testimonial?');
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/content?type=testimonial&id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadTestimonials();
				notifications.success('Testimonial deleted successfully');
			} else {
				notifications.error('Failed to delete testimonial');
			}
		} catch (error) {
			console.error('Failed to delete testimonial:', error);
			notifications.error('Failed to delete testimonial');
		}
	}
</script>

<svelte:head>
	<title>Manage Testimonials - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h1 class="text-2xl sm:text-3xl font-bold">Manage Testimonials</h1>
		<button
			on:click={() => startEdit()}
			class="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm sm:text-base"
		>
			Add New Testimonial
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-2xl font-bold">
					{editing.id ? 'Edit Testimonial' : 'New Testimonial'}
				</h2>
				<div class="flex gap-2">
					<button
						on:click={saveTestimonial}
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
					<label class="block text-sm font-medium mb-1">ID</label>
					<input
						type="text"
						bind:value={editing.id}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., testimonial-1"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Name</label>
					<input
						type="text"
						bind:value={editing.name}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Role (optional)</label>
					<input
						type="text"
						bind:value={editing.role}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Content</label>
					<RichTextEditor bind:value={editing.content} height="250px" />
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Image URL (optional)</label>
					<input
						type="text"
						bind:value={editing.image}
						class="w-full px-3 py-2 border rounded"
						placeholder="/images/testimonial.jpg"
					/>
				</div>
				<div class="flex gap-2">
					<button
						on:click={saveTestimonial}
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
	{:else if testimonials.length === 0}
		<p class="text-gray-600">No testimonials found. Add your first testimonial!</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Content Preview
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each testimonials as testimonial}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								{testimonial.name}
							</td>
							<td class="px-6 py-4 text-sm text-gray-500">
								{testimonial.content.substring(0, 100)}...
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(testimonial)}
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deleteTestimonial(testimonial.id)}
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

