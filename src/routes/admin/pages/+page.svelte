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
	let currentSectionIndex = null;

	onMount(async () => {
		await loadPages();
	});

	// Reset section index when image picker closes without selection
	$: if (!showImagePicker && currentSectionIndex !== null) {
		currentSectionIndex = null;
	}

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
				heroOverlay: page.heroOverlay || 40,
				sections: page.sections || []
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
					heroMessages: [],
					sections: []
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
		if (currentSectionIndex !== null && editing && editing.sections) {
			// Setting image for a section
			editing.sections[currentSectionIndex].image = imagePath;
			currentSectionIndex = null;
		} else if (editing) {
			// Setting image for hero
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
				{#if !editing.sections || editing.sections.length === 0}
					<div class="relative mb-4">
						<label class="block text-sm font-medium mb-1">Content</label>
						<div class="relative" style="height: 400px;">
							<RichTextEditor bind:value={editing.content} height="400px" />
						</div>
					</div>
				{/if}
				
				{#if editing.sections && editing.sections.length > 0}
					<div class="border-t pt-6 mt-6">
						<h3 class="text-lg font-semibold mb-4">Page Sections</h3>
						
						{#each editing.sections as section, sectionIndex}
							<div class="mb-6 p-4 bg-gray-50 rounded border">
								<div class="flex justify-between items-center mb-3">
									<h4 class="text-sm font-semibold text-gray-700">
										Section {sectionIndex + 1}: {section.type || 'text'}
									</h4>
									<button
										type="button"
										on:click={() => {
											editing.sections = editing.sections.filter((_, i) => i !== sectionIndex);
											editing = editing;
										}}
										class="text-red-600 hover:text-red-800 text-xs px-2 py-1 bg-red-50 rounded"
									>
										Remove
									</button>
								</div>
								
								{#if section.type === 'text'}
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Title</label>
										<input
											type="text"
											bind:value={section.title}
											class="w-full px-3 py-2 border rounded"
											placeholder="Section title"
										/>
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Image URL</label>
										<div class="flex gap-2">
											<input
												type="text"
												bind:value={section.image}
												class="flex-1 px-3 py-2 border rounded"
												placeholder="Image URL (optional)"
											/>
											<button
												type="button"
												on:click={() => {
													showImagePicker = true;
													// Store which section we're editing
													currentSectionIndex = sectionIndex;
												}}
												class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
											>
												Select Image
											</button>
										</div>
										{#if section.image}
											<div class="mt-2">
												<img
													src={section.image}
													alt="Preview"
													class="max-w-xs h-32 object-cover rounded border"
												/>
											</div>
										{/if}
									</div>
									<div class="relative mb-3" style="height: 300px;">
										<label class="block text-xs font-medium mb-1 text-gray-600">Content</label>
										<RichTextEditor bind:value={section.content} height="280px" />
									</div>
									{#if section.cta}
										{@const ctaLink = section.cta?.link || ''}
										{@const ctaText = section.cta?.text || ''}
										<div class="mt-3 p-3 bg-white rounded border">
											<div class="flex justify-between items-center mb-2">
												<label class="block text-xs font-medium text-gray-600">Call to Action</label>
												<button
													type="button"
													on:click={() => {
														section.cta = undefined;
														editing = editing;
													}}
													class="text-red-600 hover:text-red-800 text-xs"
												>
													Remove CTA
												</button>
											</div>
											<label class="block text-xs font-medium mb-1 text-gray-600">CTA Link</label>
											<input
												type="text"
												value={ctaLink}
												on:input={(e) => {
													if (!section.cta) section.cta = { link: '', text: '' };
													section.cta.link = e.target.value;
													editing = editing;
												}}
												class="w-full px-3 py-2 border rounded mb-2"
												placeholder="e.g., /contact or #contact"
											/>
											<label class="block text-xs font-medium mb-1 text-gray-600">CTA Text</label>
											<input
												type="text"
												value={ctaText}
												on:input={(e) => {
													if (!section.cta) section.cta = { link: '', text: '' };
													section.cta.text = e.target.value;
													editing = editing;
												}}
												class="w-full px-3 py-2 border rounded"
												placeholder="e.g., Get Started"
											/>
										</div>
									{:else}
										<button
											type="button"
											on:click={() => {
												section.cta = { link: '', text: '' };
												editing = editing;
											}}
											class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
										>
											+ Add Call to Action
										</button>
									{/if}
								{:else if section.type === 'welcome'}
									<div class="relative" style="height: 300px;">
										<label class="block text-xs font-medium mb-1 text-gray-600">Welcome Section Content</label>
										<RichTextEditor bind:value={section.content} height="280px" />
									</div>
								{:else if section.type === 'columns' && section.columns}
									<label class="block text-xs font-medium mb-2 text-gray-600">Columns</label>
									{#each section.columns as column, colIndex}
										<div class="mb-4 p-3 bg-white rounded border">
											<div class="flex justify-between items-center mb-2">
												<label class="block text-xs font-medium text-gray-600">{column.title || `Column ${colIndex + 1}`}</label>
												<button
													type="button"
													on:click={() => {
														section.columns = section.columns.filter((_, i) => i !== colIndex);
														editing = editing;
													}}
													class="text-red-600 hover:text-red-800 text-xs"
												>
													Remove
												</button>
											</div>
											<div class="mb-2">
												<label class="block text-xs font-medium mb-1 text-gray-600">Column Title</label>
												<input
													type="text"
													bind:value={column.title}
													class="w-full px-3 py-2 border rounded text-sm"
													placeholder="Column title"
												/>
											</div>
											<div class="relative" style="height: 200px;">
												<RichTextEditor bind:value={column.content} height="180px" />
											</div>
										</div>
									{/each}
									<button
										type="button"
										on:click={() => {
											if (!section.columns) section.columns = [];
											section.columns = [...section.columns, { title: '', content: '' }];
											editing = editing;
										}}
										class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
									>
										+ Add Column
									</button>
								{:else if section.type === 'values'}
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Section Title</label>
										<input
											type="text"
											bind:value={section.title}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., Our Values"
										/>
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Section Description</label>
										<textarea
											bind:value={section.description}
											class="w-full px-3 py-2 border rounded"
											rows="3"
											placeholder="Introduction text for the values section"
										></textarea>
									</div>
									<label class="block text-xs font-medium mb-2 text-gray-600">Values</label>
									{#if section.values && section.values.length > 0}
										<div class="space-y-4 mb-4">
											{#each section.values as value, valueIndex}
												<div class="p-3 bg-white border rounded">
													<div class="flex justify-between items-start mb-2">
														<span class="text-xs font-medium text-gray-500">Value {valueIndex + 1}</span>
														<button
															type="button"
															on:click={() => {
																section.values = section.values.filter((_, i) => i !== valueIndex);
																editing = editing;
															}}
															class="text-red-600 hover:text-red-800 text-xs"
														>
															Remove
														</button>
													</div>
													<div class="mb-2">
														<label class="block text-xs font-medium mb-1 text-gray-600">Title</label>
														<input
															type="text"
															bind:value={value.title}
															class="w-full px-3 py-2 border rounded text-sm"
															placeholder="e.g., ENJOYING GOD"
														/>
													</div>
													<div>
														<label class="block text-xs font-medium mb-1 text-gray-600">Description</label>
														<textarea
															bind:value={value.description}
															class="w-full px-3 py-2 border rounded text-sm"
															rows="4"
															placeholder="Value description"
														></textarea>
													</div>
												</div>
											{/each}
										</div>
									{/if}
									<button
										type="button"
										on:click={() => {
											if (!section.values) section.values = [];
											section.values = [...section.values, { title: '', description: '' }];
											editing = editing;
										}}
										class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
									>
										+ Add Value
									</button>
								{/if}
							</div>
						{/each}
						
						<div class="flex gap-2 mt-4">
							<button
								type="button"
								on:click={() => {
									if (!editing.sections) editing.sections = [];
									editing.sections = [...editing.sections, { type: 'text', title: '', content: '' }];
									editing = editing;
								}}
								class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
							>
								+ Add Text Section
							</button>
							{#if editing.id === 'im-new'}
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										editing.sections = [...editing.sections, { type: 'welcome', content: '' }];
										editing = editing;
									}}
									class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
								>
									+ Add Welcome Section
								</button>
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										editing.sections = [...editing.sections, { type: 'columns', columns: [{ title: '', content: '' }] }];
										editing = editing;
									}}
									class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
								>
									+ Add Columns Section
								</button>
							{/if}
							{#if editing.id === 'church'}
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										const hasValues = editing.sections.some(s => s.type === 'values');
										if (!hasValues) {
											editing.sections = [...editing.sections, { 
												type: 'values', 
												title: 'Our Values',
												description: 'We believe that God creates each movement of churches distinct, destined to fulfil a divinely appointed purpose for a specific time, with different emphasis according to the will of God.',
												values: [
													{ title: 'ENJOYING GOD', description: 'We want to be a joyful people, who enjoy and celebrate Jesus Christ as our Lord and saviour, knowing we are loved, accepted and made righteous by Him.' },
													{ title: 'THE LORDSHIP OF CHRIST', description: 'We recognise the foundational significance of the simple truth that it is no longer I who live but Christ who lives in me. We must die to sin and our selfish desires and live new lives unto God.' },
													{ title: 'SPIRIT & WORD', description: 'As churches we seek to walk in and minister in the power of the Holy Spirit. The Holy Spirit brings vitality to the life of a believer and a church and guides our decision making.' },
													{ title: 'PRAYER', description: 'We believe in the vital importance of prayer in the life of a Christian and a church, prayer is the means by which we find the joy of the Lord and the knowledge of his will.' },
													{ title: 'ORDINARY PEOPLE', description: 'We are humbled by the fact that Christ has entrusted the Gospel to us through the power of His Spirit to see broken lives restored and the lost saved.' },
													{ title: 'THE CHURCH', description: 'We believe the manifold wisdom of God is displayed through the church, which is expressed through local churches.' },
													{ title: 'ELDERSHIP', description: 'Jesus Christ reigns as head over His church, and He gives to His church elders to oversee and lead local churches under His authority.' }
												]
											}];
											editing = editing;
										}
									}}
									class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
								>
									+ Add Values Section
								</button>
							{/if}
						</div>
					</div>
				{/if}
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

