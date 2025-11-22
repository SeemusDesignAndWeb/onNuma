<script lang="js">
	import { onMount } from 'svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import ImagePicker from '$lib/components/ImagePicker.svelte';

	export let params = {};

	let events = [];
	let loading = true;
	let editing = null;
	let showForm = false;
	let showImagePicker = false;

	onMount(async () => {
		await loadEvents();
	});

	async function loadEvents() {
		try {
			const response = await fetch('/api/content?type=events');
			events = await response.json();
		} catch (error) {
			console.error('Failed to load events:', error);
		} finally {
			loading = false;
		}
	}

	function startEdit(event) {
		if (event) {
			editing = {
				...event,
				description: event.description || '',
				eventInfo: typeof event.eventInfo === 'string' ? event.eventInfo : ''
			};
		} else {
			editing = {
				id: '',
				title: '',
				description: '',
				eventInfo: '',
				date: '',
				time: '',
				location: '',
				image: '',
				featured: false,
				highlighted: false,
				published: true,
				order: events.length
			};
		}
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

	async function saveEvent() {
		if (!editing) return;

		if (!editing.id || !editing.title || !editing.date) {
			alert('Please fill in ID, Title, and Date');
			return;
		}

		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'event', data: editing })
			});

			if (response.ok) {
				await loadEvents();
				cancelEdit();
			} else {
				const error = await response.json();
				alert(error.error || 'Failed to save event');
			}
		} catch (error) {
			console.error('Failed to save event:', error);
			alert('Failed to save event');
		}
	}

	async function deleteEvent(id) {
		if (!confirm('Are you sure you want to delete this event?')) return;

		try {
			const response = await fetch(`/api/content?type=event&id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadEvents();
			} else {
				alert('Failed to delete event');
			}
		} catch (error) {
			console.error('Failed to delete event:', error);
			alert('Failed to delete event');
		}
	}

	function formatDate(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Manage Events - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Manage Events</h1>
		<button
			on:click={() => startEdit()}
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
		>
			Add New Event
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<h2 class="text-2xl font-bold mb-4">
				{editing.id ? 'Edit Event' : 'New Event'}
			</h2>
			<div class="space-y-4">
				<div>
					<label for="event-id" class="block text-sm font-medium mb-1">ID *</label>
					<input
						id="event-id"
						type="text"
						bind:value={editing.id}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., easter-service-2024"
					/>
					<p class="text-xs text-gray-500 mt-1">Unique identifier (lowercase, hyphens only)</p>
				</div>
				<div>
					<label for="event-title" class="block text-sm font-medium mb-1">Title *</label>
					<input
						id="event-title"
						type="text"
						bind:value={editing.title}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., Easter Service"
					/>
				</div>
				<div class="relative mb-4">
					<label for="event-info" class="block text-sm font-medium mb-1">Event Info</label>
					<div id="event-info" class="relative" style="height: 300px;">
						<RichTextEditor bind:value={editing.eventInfo} height="300px" placeholder="" />
					</div>
					<p class="text-xs text-gray-500 mt-1">This information will be displayed on the event detail page</p>
				</div>
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="event-date" class="block text-sm font-medium mb-1">Date *</label>
						<input
							id="event-date"
							type="date"
							bind:value={editing.date}
							class="w-full px-3 py-2 border rounded"
						/>
					</div>
					<div>
						<label for="event-time" class="block text-sm font-medium mb-1">Time</label>
						<input
							id="event-time"
							type="time"
							bind:value={editing.time}
							class="w-full px-3 py-2 border rounded"
						/>
					</div>
				</div>
				<div>
					<label for="event-location" class="block text-sm font-medium mb-1">Location</label>
					<input
						id="event-location"
						type="text"
						bind:value={editing.location}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., Main Hall"
					/>
				</div>
				<div>
					<label for="event-image" class="block text-sm font-medium mb-1">Image URL</label>
					<div class="space-y-2">
						<div class="flex gap-2">
							<input
								id="event-image"
								type="text"
								bind:value={editing.image}
								class="flex-1 px-3 py-2 border rounded"
								placeholder="/images/event.jpg"
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
				<div class="flex gap-6 flex-wrap">
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={editing.featured} class="rounded" />
						<span class="text-sm font-medium">Featured (Show on home page)</span>
					</label>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={editing.highlighted} class="rounded" />
						<span class="text-sm font-medium">Highlight (Show banner at top)</span>
					</label>
					<label class="flex items-center gap-2">
						<input type="checkbox" bind:checked={editing.published} class="rounded" />
						<span class="text-sm font-medium">Published</span>
					</label>
				</div>
				<div>
					<label for="event-order" class="block text-sm font-medium mb-1">Order</label>
					<input
						id="event-order"
						type="number"
						bind:value={editing.order}
						class="w-full px-3 py-2 border rounded"
						min="0"
					/>
					<p class="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
				</div>
				<div class="flex gap-2">
					<button
						on:click={saveEvent}
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
	{:else if events.length === 0}
		<p class="text-gray-600">No events found. Add your first event!</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Title
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Date
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Time
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Location
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Status
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each events.sort((a, b) => {
						// Sort by date, then by order
						const dateA = new Date(a.date || '9999-12-31');
						const dateB = new Date(b.date || '9999-12-31');
						if (dateA.getTime() !== dateB.getTime()) {
							return dateA.getTime() - dateB.getTime();
						}
						return (a.order || 0) - (b.order || 0);
					}) as event}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<div class="flex items-center gap-2">
									{event.title}
									{#if event.featured}
										<span class="px-2 py-1 text-xs bg-blue-500 text-white rounded">Featured</span>
									{/if}
									{#if event.highlighted}
										<span class="px-2 py-1 text-xs bg-yellow-500 text-white rounded">Highlighted</span>
									{/if}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">{formatDate(event.date)}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">{event.time || '-'}</td>
							<td class="px-6 py-4 text-sm text-gray-500">{event.location || '-'}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">
								<span class="px-2 py-1 text-xs rounded {event.published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
									{event.published ? 'Published' : 'Draft'}
								</span>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(event)}
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deleteEvent(event.id)}
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

