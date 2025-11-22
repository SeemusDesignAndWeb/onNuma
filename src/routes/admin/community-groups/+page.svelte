<script lang="js">
	import { onMount } from 'svelte';

	export let params = {};

	let groups = [];
	let loading = true;
	let editing = null;
	let showForm = false;

	onMount(async () => {
		await loadGroups();
	});

	async function loadGroups() {
		try {
			const response = await fetch('/api/content?type=community-groups');
			groups = await response.json();
		} catch (error) {
			console.error('Failed to load community groups:', error);
		} finally {
			loading = false;
		}
	}

	function startEdit(group) {
		editing = group
			? { ...group }
			: {
					id: '',
					day: '',
					time: '',
					description: '',
					iconColor: 'primary',
					order: groups.length
				};
		showForm = true;
	}

	function cancelEdit() {
		editing = null;
		showForm = false;
	}

	async function saveGroup() {
		if (!editing) return;

		if (!editing.id || !editing.day || !editing.time) {
			alert('Please fill in ID, Day, and Time');
			return;
		}

		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'community-group', data: editing })
			});

			if (response.ok) {
				await loadGroups();
				cancelEdit();
			} else {
				const error = await response.json();
				alert(error.error || 'Failed to save community group');
			}
		} catch (error) {
			console.error('Failed to save community group:', error);
			alert('Failed to save community group');
		}
	}

	async function deleteGroup(id) {
		if (!confirm('Are you sure you want to delete this community group?')) return;

		try {
			const response = await fetch(`/api/content?type=community-group&id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadGroups();
			} else {
				alert('Failed to delete community group');
			}
		} catch (error) {
			console.error('Failed to delete community group:', error);
			alert('Failed to delete community group');
		}
	}

	async function moveUp(index) {
		if (index === 0) return;
		const newGroups = [...groups];
		[newGroups[index - 1], newGroups[index]] = [newGroups[index], newGroups[index - 1]];
		groups = newGroups;
		// Update order values
		for (let i = 0; i < groups.length; i++) {
			groups[i].order = i;
			await saveGroupDirectly(groups[i]);
		}
		await loadGroups();
	}

	async function moveDown(index) {
		if (index === groups.length - 1) return;
		const newGroups = [...groups];
		[newGroups[index], newGroups[index + 1]] = [newGroups[index + 1], newGroups[index]];
		groups = newGroups;
		// Update order values
		for (let i = 0; i < groups.length; i++) {
			groups[i].order = i;
			await saveGroupDirectly(groups[i]);
		}
		await loadGroups();
	}

	async function saveGroupDirectly(group) {
		try {
			await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'community-group', data: group })
			});
		} catch (error) {
			console.error('Failed to save group order:', error);
		}
	}
</script>

<svelte:head>
	<title>Manage Community Groups - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex justify-between items-center mb-6">
		<h1 class="text-3xl font-bold">Manage Community Groups</h1>
		<button
			on:click={() => startEdit()}
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
		>
			Add New Group
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<h2 class="text-2xl font-bold mb-4">
				{editing.id ? 'Edit Community Group' : 'New Community Group'}
			</h2>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">ID *</label>
					<input
						type="text"
						bind:value={editing.id}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., tuesday-group"
					/>
					<p class="text-xs text-gray-500 mt-1">Unique identifier (lowercase, hyphens only)</p>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Day *</label>
					<select
						bind:value={editing.day}
						class="w-full px-3 py-2 border rounded"
					>
						<option value="">Select a day</option>
						<option value="Monday">Monday</option>
						<option value="Tuesday">Tuesday</option>
						<option value="Wednesday">Wednesday</option>
						<option value="Thursday">Thursday</option>
						<option value="Friday">Friday</option>
						<option value="Saturday">Saturday</option>
						<option value="Sunday">Sunday</option>
					</select>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Time *</label>
					<input
						type="text"
						bind:value={editing.time}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., 7:30 PM"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Description</label>
					<textarea
						bind:value={editing.description}
						class="w-full px-3 py-2 border rounded"
						rows="3"
						placeholder="e.g., Join us for Bible study, prayer, and fellowship"
					></textarea>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Icon Color</label>
					<select
						bind:value={editing.iconColor}
						class="w-full px-3 py-2 border rounded"
					>
						<option value="primary">Primary (Green)</option>
						<option value="brand-yellow">Yellow</option>
						<option value="brand-red">Red</option>
						<option value="brand-blue">Blue</option>
					</select>
					<p class="text-xs text-gray-500 mt-1">Color for the calendar icon background</p>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Order</label>
					<input
						type="number"
						bind:value={editing.order}
						class="w-full px-3 py-2 border rounded"
						min="0"
					/>
					<p class="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
				</div>
				<div class="flex gap-2">
					<button
						on:click={saveGroup}
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
	{:else if groups.length === 0}
		<p class="text-gray-600">No community groups found. Add your first group!</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Order
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Day
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Time
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Description
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each groups.sort((a, b) => (a.order || 0) - (b.order || 0)) as group, index}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap text-sm">
								<div class="flex gap-1">
									<button
										on:click={() => moveUp(index)}
										disabled={index === 0}
										class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
										title="Move up"
									>
										↑
									</button>
									<button
										on:click={() => moveDown(index)}
										disabled={index === groups.length - 1}
										class="text-gray-400 hover:text-gray-600 disabled:opacity-30"
										title="Move down"
									>
										↓
									</button>
									<span class="ml-2">{group.order || 0}</span>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">{group.day}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">{group.time}</td>
							<td class="px-6 py-4 text-sm text-gray-500">
								{group.description || '-'}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(group)}
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deleteGroup(group.id)}
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

