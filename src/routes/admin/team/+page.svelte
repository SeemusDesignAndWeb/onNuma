<script lang="js">
	import { onMount } from 'svelte';
	import ImagePicker from '$lib/components/ImagePicker.svelte';

	export let params = {};

	let team = [];
	let loading = true;
	let editing = null;
	let showForm = false;
	let showImagePicker = false;

	onMount(async () => {
		await loadTeam();
	});

	async function loadTeam() {
		try {
			const response = await fetch('/api/content?type=team');
			team = await response.json();
		} catch (error) {
			console.error('Failed to load team:', error);
		} finally {
			loading = false;
		}
	}


	function startEdit(member) {
		editing = member
			? { ...member, social: member.social || {} }
			: {
					id: '',
					name: '',
					role: '',
					image: '',
					quote: '',
					social: { facebook: '', twitter: '', instagram: '', linkedin: '' }
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

	async function saveMember() {
		if (!editing) return;

		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'team', data: editing })
			});

			if (response.ok) {
				await loadTeam();
				cancelEdit();
			}
		} catch (error) {
			console.error('Failed to save team member:', error);
		}
	}

	async function deleteMember(id) {
		if (!confirm('Are you sure you want to delete this team member?')) return;

		try {
			const response = await fetch(`/api/content?type=team&id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadTeam();
			}
		} catch (error) {
			console.error('Failed to delete team member:', error);
		}
	}
</script>

<svelte:head>
	<title>Manage Team - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<h1 class="text-3xl font-bold mb-8">Manage Team</h1>

	<div class="flex justify-between items-center mb-6">
		<h2 class="text-2xl font-bold">Team Members</h2>
		<button
			on:click={() => startEdit()}
			class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
		>
			Add New Member
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<h2 class="text-2xl font-bold mb-4">
				{editing.id ? 'Edit Team Member' : 'New Team Member'}
			</h2>
			<div class="space-y-4">
				<div>
					<label class="block text-sm font-medium mb-1">ID</label>
					<input
						type="text"
						bind:value={editing.id}
						class="w-full px-3 py-2 border rounded"
						placeholder="e.g., john-watson"
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
					<label class="block text-sm font-medium mb-1">Role</label>
					<input
						type="text"
						bind:value={editing.role}
						class="w-full px-3 py-2 border rounded"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Image URL</label>
					<div class="space-y-2">
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={editing.image}
								class="flex-1 px-3 py-2 border rounded"
								placeholder="/images/team-member.jpg"
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
					<label class="block text-sm font-medium mb-1">Quote</label>
					<textarea
						bind:value={editing.quote}
						rows="3"
						class="w-full px-3 py-2 border rounded"
					></textarea>
				</div>
				<div>
					<label class="block text-sm font-medium mb-1">Social Links</label>
					{#if editing && editing.social}
						<div class="grid grid-cols-2 gap-2">
							<input
								type="text"
								bind:value={editing.social.facebook}
								placeholder="Facebook URL"
								class="px-3 py-2 border rounded"
							/>
							<input
								type="text"
								bind:value={editing.social.twitter}
								placeholder="Twitter URL"
								class="px-3 py-2 border rounded"
							/>
							<input
								type="text"
								bind:value={editing.social.instagram}
								placeholder="Instagram URL"
								class="px-3 py-2 border rounded"
							/>
							<input
								type="text"
								bind:value={editing.social.linkedin}
								placeholder="LinkedIn URL"
								class="px-3 py-2 border rounded"
							/>
						</div>
					{/if}
				</div>
				<div class="flex gap-2">
					<button
						on:click={saveMember}
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
	{:else if team.length === 0}
		<p class="text-gray-600">No team members found. Add your first member!</p>
	{:else}
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Name
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Role
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each team as member}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								{member.name}
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">{member.role}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(member)}
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deleteMember(member.id)}
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

