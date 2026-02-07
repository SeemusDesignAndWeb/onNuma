<script lang="js">
	import { onMount } from 'svelte';
	import RichTextEditor from '$lib/components/RichTextEditor.svelte';
	import ImagePicker from '$lib/components/ImagePicker.svelte';
	import { notifications, dialog } from '$lib/crm/stores/notifications.js';

	export let params = {};

	let pages = [];
	let loading = true;
	let editing = null;
	let showForm = false;
	let showImagePicker = false;
	let currentSectionIndex = null;
	let currentImageIndex = null;
	let selectingSignature = false;
	let draggedIndex = null;
	let draggedOverIndex = null;

	onMount(async () => {
		await loadPages();
	});

	// Reset section index when image picker closes without selection
	$: if (!showImagePicker && currentSectionIndex !== null) {
		currentSectionIndex = null;
		currentImageIndex = null;
		selectingSignature = false;
	}

	async function loadPages() {
		try {
			const response = await fetch('/api/content?type=pages');
			let loadedPages = await response.json();
			
			// Ensure team page exists in the list
			const teamPageExists = loadedPages.some(p => p.id === 'team');
			if (!teamPageExists) {
				// Load settings to get default values
				const settingsResponse = await fetch('/api/content?type=settings');
				const settings = await settingsResponse.json();
				
				// Create default team page
				const defaultTeamPage = {
					id: 'team',
					title: 'Our Team',
					heroTitle: settings.teamHeroTitle || 'Developing leaders of tomorrow',
					heroSubtitle: settings.teamHeroSubtitle || '',
					heroButtons: settings.teamHeroButtons || [],
					heroImage: settings.teamHeroImage || '/images/church-bg.jpg',
					heroOverlay: 40,
					teamDescription: settings.teamDescription || '',
					sections: [],
					metaDescription: 'Meet the leadership team of Eltham Green Community Church'
				};
				
				// Add to the list
				loadedPages = [...loadedPages, defaultTeamPage];
			}
			
			// Ensure events page exists in the list
			const eventsPageExists = loadedPages.some(p => p.id === 'events');
			if (!eventsPageExists) {
				// Create default events page
				const defaultEventsPage = {
					id: 'events',
					title: 'Events',
					heroTitle: 'Upcoming Events',
					heroSubtitle: '',
					heroButtons: [],
					heroImage: '/images/events-bg.jpg',
					heroOverlay: 40,
					sections: [],
					metaDescription: 'Join us for upcoming events and activities at Eltham Green Community Church',
					showInNavigation: true,
					navigationLabel: 'Events'
				};
				
				// Add to the list
				loadedPages = [...loadedPages, defaultEventsPage];
			}
			
			// Ensure events-calendar page exists in the list
			const eventsCalendarPageExists = loadedPages.some(p => p.id === 'events-calendar');
			if (!eventsCalendarPageExists) {
				// Create default events-calendar page
				const defaultEventsCalendarPage = {
					id: 'events-calendar',
					title: 'Event Calendar',
					heroTitle: 'Event Calendar',
					heroSubtitle: 'View our upcoming public events and activities',
					heroButtons: [],
					heroImage: '',
					heroOverlay: 40,
					sections: [],
					metaDescription: 'View our upcoming public events and activities',
					showInNavigation: false,
					navigationLabel: ''
				};
				
				// Add to the list
				loadedPages = [...loadedPages, defaultEventsCalendarPage];
			}
			
			// Sort pages by navigationOrder, then by title
			pages = loadedPages.sort((a, b) => {
				const orderA = a.navigationOrder !== undefined ? a.navigationOrder : 999;
				const orderB = b.navigationOrder !== undefined ? b.navigationOrder : 999;
				if (orderA !== orderB) {
					return orderA - orderB;
				}
				return (a.title || '').localeCompare(b.title || '');
			});
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
				sections: page.sections || [],
				teamDescription: page.teamDescription || '',
			showInNavigation: page.showInNavigation !== undefined ? page.showInNavigation : true,
			navigationLabel: page.navigationLabel || '',
			navigationOrder: page.navigationOrder !== undefined ? page.navigationOrder : 999
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
					sections: [],
					teamDescription: '',
					showInNavigation: true,
					navigationLabel: ''
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
			// Setting image/logo for a section
			const section = editing.sections[currentSectionIndex];
			if (section.type === 'mlg') {
				// For MLG sections, set the logo
				section.logo = imagePath;
			} else if (section.type === 'gallery') {
				// For gallery sections, add to images array or update existing
				if (!section.images) section.images = [];
				if (currentImageIndex !== null && currentImageIndex < section.images.length) {
					// Update existing image
					section.images[currentImageIndex] = imagePath;
				} else {
					// Add new image
					section.images = [...section.images, imagePath];
				}
			} else if (section.type === 'welcome' && selectingSignature) {
				// For welcome sections, set the signature if we're selecting signature
				section.signature = imagePath;
			} else if (section.type === 'welcome') {
				// For welcome sections, set the main image
				section.image = imagePath;
			} else {
				// For other sections, set the image
				section.image = imagePath;
			}
			// Force reactivity update
			editing = { ...editing, sections: [...editing.sections] };
			currentSectionIndex = null;
			currentImageIndex = null;
			selectingSignature = false;
		} else if (editing) {
			// Setting image for hero
			editing.heroImage = imagePath;
			editing = { ...editing };
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
				notifications.success('Page saved successfully!');
				cancelEdit();
			} else {
				const error = await response.json();
				notifications.error(error.error || 'Failed to save page');
			}
		} catch (error) {
			console.error('Failed to save page:', error);
			notifications.error('Failed to save page');
		}
	}

	async function deletePage(id) {
		const confirmed = await dialog.confirm('Are you sure you want to delete this page?');
		if (!confirmed) return;

		try {
			const response = await fetch(`/api/content?type=page&id=${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				await loadPages();
				notifications.success('Page deleted successfully');
			} else {
				notifications.error('Failed to delete page');
			}
		} catch (error) {
			console.error('Failed to delete page:', error);
			notifications.error('Failed to delete page');
		}
	}

	async function toggleNavigationVisibility(page) {
		const updatedPage = {
			...page,
			showInNavigation: !(page.showInNavigation !== false)
		};

		try {
			const response = await fetch('/api/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'page', data: updatedPage })
			});

			if (response.ok) {
				await loadPages();
				notifications.success(`Page "${page.title}" navigation visibility updated`);
			} else {
				notifications.error('Failed to update navigation visibility');
			}
		} catch (error) {
			console.error('Failed to update navigation visibility:', error);
			notifications.error('Failed to update navigation visibility');
		}
	}

	function handleDragStart(index) {
		draggedIndex = index;
	}

	function handleDragOver(event, index) {
		event.preventDefault();
		draggedOverIndex = index;
	}

	function handleDragLeave() {
		draggedOverIndex = null;
	}

	async function handleDrop(event, dropIndex) {
		event.preventDefault();
		
		if (draggedIndex === null || draggedIndex === dropIndex) {
			draggedIndex = null;
			draggedOverIndex = null;
			return;
		}

		// Reorder pages array
		const reorderedPages = [...pages];
		const [draggedPage] = reorderedPages.splice(draggedIndex, 1);
		reorderedPages.splice(dropIndex, 0, draggedPage);

		// Update navigationOrder for all affected pages
		const updates = reorderedPages.map((page, index) => ({
			...page,
			navigationOrder: index
		}));

		// Save all updated pages
		try {
			const savePromises = updates.map(page =>
				fetch('/api/content', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ type: 'page', data: page })
				})
			);

			await Promise.all(savePromises);
			await loadPages();
			notifications.success('Page order updated successfully');
		} catch (error) {
			console.error('Failed to update page order:', error);
			notifications.error('Failed to update page order');
		}

		draggedIndex = null;
		draggedOverIndex = null;
	}

	function handleDragEnd() {
		draggedIndex = null;
		draggedOverIndex = null;
	}
</script>

<svelte:head>
	<title>Manage Pages - Admin</title>
</svelte:head>

<div class="container mx-auto px-4 py-8">
	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
		<h1 class="text-2xl sm:text-3xl font-bold">Manage Pages</h1>
		<button
			on:click={() => startEdit()}
			class="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm sm:text-base"
		>
			Add New Page
		</button>
	</div>

	{#if showForm && editing}
		<div class="bg-white p-6 rounded-lg shadow mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-2xl font-bold">
					{editing.id ? 'Edit Page' : 'New Page'}
				</h2>
				<div class="flex gap-2">
					<button
						on:click={savePage}
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
				<div class="border-t pt-4 mt-4">
					<h3 class="text-lg font-semibold mb-4">Navigation Settings</h3>
					<div class="space-y-4">
						<div>
							<label class="flex items-center gap-2">
								<input
									type="checkbox"
									bind:checked={editing.showInNavigation}
									class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
								/>
								<span class="text-sm font-medium">Show in Navigation Menu</span>
							</label>
							<p class="text-xs text-gray-500 mt-1 ml-6">
								When enabled, this page will appear in the main website navigation menu.
							</p>
						</div>
						{#if editing.showInNavigation}
							<div>
								<label class="block text-sm font-medium mb-1">Navigation Label</label>
								<p class="text-xs text-gray-500 mb-2">
									Custom label for the navigation menu. If left empty, the page title will be used.
								</p>
								<input
									type="text"
									bind:value={editing.navigationLabel}
									class="w-full px-3 py-2 border rounded"
									placeholder={editing.title || 'Page title'}
								/>
							</div>
						{/if}
					</div>
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
				{#if editing.id !== 'events' && editing.id !== 'events-calendar'}
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
				{/if}
				{#if !editing.sections || editing.sections.length === 0}
					{#if editing.id !== 'team' && editing.id !== 'events'}
						<div class="relative mb-4">
							<label class="block text-sm font-medium mb-1">Content</label>
							<div class="relative" style="height: 400px;">
								<RichTextEditor bind:value={editing.content} height="400px" />
							</div>
						</div>
					{/if}
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
										<label class="block text-xs font-medium mb-1 text-gray-600">Section ID (optional)</label>
										<p class="text-xs text-gray-500 mb-1">Used to identify this section (e.g., 'intro-section' for events page intro)</p>
										<input
											type="text"
											bind:value={section.id}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., intro-section"
										/>
									</div>
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
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Title</label>
										<p class="text-xs text-gray-500 mb-1">The main heading for the welcome section. You can use HTML like &lt;span style="color:#4BB170;"&gt;text&lt;/span&gt; for colored text.</p>
										<input
											type="text"
											bind:value={section.title}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., You are welcome"
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
													selectingSignature = false;
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
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Image Alt Text</label>
										<input
											type="text"
											bind:value={section.imageAlt}
											class="w-full px-3 py-2 border rounded"
											placeholder="Alt text for the image (optional)"
										/>
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Signature Image URL</label>
										<div class="flex gap-2">
											<input
												type="text"
												bind:value={section.signature}
												class="flex-1 px-3 py-2 border rounded"
												placeholder="Signature image URL (optional)"
											/>
											<button
												type="button"
												on:click={() => {
													showImagePicker = true;
													// Store which section we're editing for signature
													currentSectionIndex = sectionIndex;
													selectingSignature = true;
												}}
												class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
											>
												Select Signature
											</button>
										</div>
										{#if section.signature}
											<div class="mt-2">
												<img
													src={section.signature}
													alt="Signature Preview"
													class="max-w-xs h-16 object-contain rounded border"
												/>
											</div>
										{/if}
									</div>
									<div class="relative mb-3" style="height: 300px;">
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
								{:else if section.type === 'for-all-ages'}
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Label (small text above title)</label>
										<input
											type="text"
											bind:value={section.label}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., For Everyone"
										/>
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Title</label>
										<input
											type="text"
											bind:value={section.title}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., For All Ages"
										/>
									</div>
									<div class="relative mb-3" style="height: 300px;">
										<label class="block text-xs font-medium mb-1 text-gray-600">Content</label>
										<RichTextEditor bind:value={section.content} height="280px" />
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Footer Text (optional)</label>
										<input
											type="text"
											bind:value={section.footerText}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., Our older teenagers join the main church in the meeting."
										/>
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-2 text-gray-600">Children's Groups</label>
										{#if section.childrenGroups && section.childrenGroups.length > 0}
											<div class="space-y-2 mb-2">
												{#each section.childrenGroups as group, groupIndex}
													<div class="flex gap-2 items-center p-2 bg-white border rounded">
														<input
															type="text"
															bind:value={group.name}
															class="flex-1 px-2 py-1 border rounded text-sm"
															placeholder="Group name"
														/>
														<input
															type="text"
															bind:value={group.ageRange}
															class="flex-1 px-2 py-1 border rounded text-sm"
															placeholder="Age range"
														/>
														<button
															type="button"
															on:click={() => {
																section.childrenGroups = section.childrenGroups.filter((_, i) => i !== groupIndex);
																editing = editing;
															}}
															class="text-red-600 hover:text-red-800 text-xs px-2"
														>
															Remove
														</button>
													</div>
												{/each}
											</div>
										{/if}
										<button
											type="button"
											on:click={() => {
												if (!section.childrenGroups) section.childrenGroups = [];
												section.childrenGroups = [...section.childrenGroups, { name: '', ageRange: '' }];
												editing = editing;
											}}
											class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
										>
											+ Add Children's Group
										</button>
									</div>
									<div class="border-t pt-3 mt-3">
										<label class="block text-xs font-medium mb-2 text-gray-600">Service Information (Right Side Card)</label>
										<div class="mb-2">
											<label class="block text-xs font-medium mb-1 text-gray-600">Service Time</label>
											<input
												type="text"
												bind:value={section.serviceTime}
												class="w-full px-3 py-2 border rounded"
												placeholder="e.g., 11:00"
											/>
										</div>
										<div class="mb-2">
											<label class="block text-xs font-medium mb-1 text-gray-600">Service Title</label>
											<input
												type="text"
												bind:value={section.serviceTitle}
												class="w-full px-3 py-2 border rounded"
												placeholder="e.g., Sunday Service"
											/>
										</div>
										<div class="mb-2">
											<label class="block text-xs font-medium mb-1 text-gray-600">Doors Open Text</label>
											<input
												type="text"
												bind:value={section.doorsOpen}
												class="w-full px-3 py-2 border rounded"
												placeholder="e.g., Doors open at 10:30am"
											/>
										</div>
										<div class="mb-2">
											<label class="block text-xs font-medium mb-2 text-gray-600">Service Details</label>
											{#if section.serviceDetails && section.serviceDetails.length > 0}
												<div class="space-y-2 mb-2">
													{#each section.serviceDetails as detail, detailIndex}
														<div class="flex gap-2 items-center p-2 bg-white border rounded">
															<input
																type="text"
																bind:value={detail.text}
																class="flex-1 px-2 py-1 border rounded text-sm"
																placeholder="Detail text"
															/>
															<button
																type="button"
																on:click={() => {
																	section.serviceDetails = section.serviceDetails.filter((_, i) => i !== detailIndex);
																	editing = editing;
																}}
																class="text-red-600 hover:text-red-800 text-xs px-2"
															>
																Remove
															</button>
														</div>
													{/each}
												</div>
											{/if}
											<button
												type="button"
												on:click={() => {
													if (!section.serviceDetails) section.serviceDetails = [];
													section.serviceDetails = [...section.serviceDetails, { text: '' }];
													editing = editing;
												}}
												class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 text-xs"
											>
												+ Add Service Detail
											</button>
										</div>
									</div>
								{:else if section.type === 'mlg'}
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Logo</label>
										<div class="flex gap-2">
											<input
												type="text"
												bind:value={section.logo}
												class="flex-1 px-3 py-2 border rounded"
												placeholder="Logo URL (optional)"
											/>
											<button
												type="button"
												on:click={() => {
													showImagePicker = true;
													currentSectionIndex = sectionIndex;
												}}
												class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
											>
												Select Logo
											</button>
										</div>
										{#if section.logo}
											<div class="mt-2">
												<img
													src={section.logo}
													alt="Logo Preview"
													class="max-w-xs h-32 object-contain rounded border"
												/>
											</div>
										{/if}
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Label (small text above title)</label>
										<input
											type="text"
											bind:value={section.label}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., Partnership"
										/>
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Title</label>
										<input
											type="text"
											bind:value={section.title}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., Part of the MissionLifeGrace Network"
										/>
									</div>
									<div class="relative mb-3" style="height: 300px;">
										<label class="block text-xs font-medium mb-1 text-gray-600">Content</label>
										<RichTextEditor bind:value={section.content} height="280px" />
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Button Text</label>
										<input
											type="text"
											bind:value={section.buttonText}
											class="w-full px-3 py-2 border rounded"
											placeholder="e.g., Visit Mission Life Grace"
										/>
									</div>
								{:else if section.type === 'gallery'}
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Title (optional)</label>
										<input
											type="text"
											bind:value={section.title}
											class="w-full px-3 py-2 border rounded"
											placeholder="Gallery title"
										/>
									</div>
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Columns</label>
										<select bind:value={section.columns} class="w-full px-3 py-2 border rounded">
											<option value={2}>2 Columns</option>
											<option value={3}>3 Columns</option>
											<option value={4}>4 Columns</option>
										</select>
									</div>
									<div class="mb-3">
										<label class="flex items-center gap-2">
											<input
												type="checkbox"
												bind:checked={section.startFullscreenSlideshow}
												class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
											/>
											<span class="text-sm font-medium text-gray-700">Start fullscreen slideshow</span>
										</label>
										<p class="text-xs text-gray-500 mt-1 ml-6">
											When checked, the gallery will automatically open in fullscreen mode when the page loads, with images fading in and out automatically.
										</p>
									</div>
									{#if section.startFullscreenSlideshow}
										<div class="mb-3">
											<label class="block text-xs font-medium mb-1 text-gray-600">Slideshow Interval (milliseconds)</label>
											<input
												type="number"
												bind:value={section.slideshowInterval}
												class="w-full px-3 py-2 border rounded"
												placeholder="4000"
												min="1000"
												step="500"
											/>
											<p class="text-xs text-gray-500 mt-1">
												Time each image is displayed before fading to the next (default: 4000ms = 4 seconds)
											</p>
										</div>
									{/if}
									<div class="mb-3">
										<label class="block text-xs font-medium mb-1 text-gray-600">Images</label>
										{#if !section.images}
											{section.images = []}
										{/if}
										<div class="space-y-2">
											{#each section.images as image, imageIndex}
												<div class="flex items-center gap-2 p-2 border rounded">
													<input
														type="text"
														bind:value={section.images[imageIndex]}
														class="flex-1 px-3 py-2 border rounded"
														placeholder="Image URL"
													/>
													<button
														type="button"
														on:click={() => {
															showImagePicker = true;
															currentSectionIndex = sectionIndex;
															// Store which image index we're updating
															currentImageIndex = imageIndex;
														}}
														class="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
													>
														Select
													</button>
													{#if section.images[imageIndex]}
														<img
															src={section.images[imageIndex]}
															alt="Preview"
															class="w-16 h-16 object-cover rounded border"
														/>
													{/if}
													<button
														type="button"
														on:click={() => {
															section.images = section.images.filter((_, i) => i !== imageIndex);
															editing = editing;
														}}
														class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
													>
														Remove
													</button>
												</div>
											{/each}
											<button
												type="button"
												on:click={() => {
													if (!section.images) section.images = [];
													section.images = [...section.images, ''];
													editing = editing;
												}}
												class="w-full px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
											>
												+ Add Image
											</button>
											<button
												type="button"
												on:click={() => {
													showImagePicker = true;
													currentSectionIndex = sectionIndex;
													currentImageIndex = null; // Adding new image
												}}
												class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
											>
												+ Select from Library
											</button>
										</div>
									</div>
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
							<button
								type="button"
								on:click={() => {
									if (!editing.sections) editing.sections = [];
									editing.sections = [...editing.sections, { type: 'gallery', title: '', images: [], columns: 3, startFullscreenSlideshow: false, slideshowInterval: 4000 }];
									editing = editing;
								}}
								class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
							>
								+ Add Gallery Section
							</button>
							{#if editing.id === 'im-new'}
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										editing.sections = [...editing.sections, { type: 'welcome', title: '', content: '', image: '', imageAlt: '', signature: '' }];
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
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										editing.sections = [...editing.sections, { 
											type: 'for-all-ages', 
											label: 'For Everyone',
											title: 'For All Ages',
											content: '',
											childrenGroups: [
												{ name: 'Adventurers', ageRange: 'Up to 7 years' },
												{ name: 'Explorers', ageRange: '8-14 years' }
											],
											footerText: 'Our older teenagers join the main church in the meeting.',
											serviceTime: '11:00',
											serviceTitle: 'Sunday Service',
											doorsOpen: 'Doors open at 10:30am',
											serviceDetails: [
												{ text: 'Refreshments from 10:30am' },
												{ text: 'Worship and message' },
												{ text: "Children's groups available" }
											]
										}];
										editing = editing;
									}}
									class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
								>
									+ Add For All Ages Section
								</button>
							{/if}
							{#if editing.id === 'church'}
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										editing.sections = [...editing.sections, { 
											type: 'mlg', 
											logo: '/images/egcc-logo.png',
											label: 'Partnership',
											title: 'Part of the MissionLifeGrace Network',
											content: '<p>Our aim is to see the Kingdom of God come, where broken lives are restored, the lost are found and communities transformed. We believe every church exists to be part of God\'s mission to show the world Christ and that we are better equipped to do this in partnership with other churches.</p><p>As a network our focus is to encourage each other through sharing our hearts, ideas and lessons learned along the way, to challenge one another to stay true to the course and to invest in helping people fulfil their God given calling. We believe that by journeying together we can see God do great things in our nation and around the world.</p>',
											buttonText: 'Visit Mission Life Grace'
										}];
										editing = editing;
									}}
									class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
								>
									+ Add Mission Life Grace Section
								</button>
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
							{#if editing.id === 'team'}
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
								<p class="text-xs text-gray-500 mt-2">
									Note: Team members are managed separately in the <a href="/admin/team" class="text-brand-blue underline">Team Management</a> section.
								</p>
							{/if}
							{#if editing.id === 'events'}
								<p class="text-xs text-gray-500 mt-2">
									Note: Individual events are managed separately in the <a href="/admin/events" class="text-brand-blue underline">Events Management</a> section. Use sections below to add introductory content or other page sections.
								</p>
							{/if}
						</div>
					</div>
				{/if}
				
				<!-- Show "Add Section" buttons when no sections exist (for all pages) -->
				{#if (!editing.sections || editing.sections.length === 0)}
					<div class="border-t pt-6 mt-6">
						<h3 class="text-lg font-semibold mb-4">Page Sections</h3>
						<div class="flex gap-2 flex-wrap">
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
							<button
								type="button"
								on:click={() => {
									if (!editing.sections) editing.sections = [];
									editing.sections = [...editing.sections, { type: 'gallery', title: '', images: [], columns: 3, startFullscreenSlideshow: false, slideshowInterval: 4000 }];
									editing = editing;
								}}
								class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
							>
								+ Add Gallery Section
							</button>
							{#if editing.id === 'im-new'}
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										editing.sections = [...editing.sections, { type: 'welcome', title: '', content: '', image: '', imageAlt: '', signature: '' }];
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
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										editing.sections = [...editing.sections, { 
											type: 'for-all-ages', 
											label: 'For Everyone',
											title: 'For All Ages',
											content: '',
											childrenGroups: [
												{ name: 'Adventurers', ageRange: 'Up to 7 years' },
												{ name: 'Explorers', ageRange: '8-14 years' }
											],
											footerText: 'Our older teenagers join the main church in the meeting.',
											serviceTime: '11:00',
											serviceTitle: 'Sunday Service',
											doorsOpen: 'Doors open at 10:30am',
											serviceDetails: [
												{ text: 'Refreshments from 10:30am' },
												{ text: 'Worship and message' },
												{ text: "Children's groups available" }
											]
										}];
										editing = editing;
									}}
									class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
								>
									+ Add For All Ages Section
								</button>
							{/if}
							{#if editing.id === 'church'}
								<button
									type="button"
									on:click={() => {
										if (!editing.sections) editing.sections = [];
										editing.sections = [...editing.sections, { 
											type: 'mlg', 
											logo: '/images/egcc-logo.png',
											label: 'Partnership',
											title: 'Part of the MissionLifeGrace Network',
											content: '<p>Our aim is to see the Kingdom of God come, where broken lives are restored, the lost are found and communities transformed. We believe every church exists to be part of God\'s mission to show the world Christ and that we are better equipped to do this in partnership with other churches.</p><p>As a network our focus is to encourage each other through sharing our hearts, ideas and lessons learned along the way, to challenge one another to stay true to the course and to invest in helping people fulfil their God given calling. We believe that by journeying together we can see God do great things in our nation and around the world.</p>',
											buttonText: 'Visit Mission Life Grace'
										}];
										editing = editing;
									}}
									class="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 text-sm"
								>
									+ Add Mission Life Grace Section
								</button>
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
							{#if editing.id === 'team'}
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
								<p class="text-xs text-gray-500 mt-2">
									Note: Team members are managed separately in the <a href="/admin/team" class="text-brand-blue underline">Team Management</a> section.
								</p>
							{/if}
							{#if editing.id === 'events'}
								<p class="text-xs text-gray-500 mt-2">
									Note: Individual events are managed separately in the <a href="/admin/events" class="text-brand-blue underline">Events Management</a> section. Use sections above to add introductory content or other page sections.
								</p>
							{/if}
						</div>
					</div>
				{/if}
				
				{#if editing.id === 'team'}
					<div class="border-t pt-6 mt-6">
						<h3 class="text-lg font-semibold mb-4">Team Description</h3>
						<p class="text-sm text-gray-600 mb-4">
							This description appears above the team members list on the team page.
						</p>
						<div class="mb-4">
							<label class="block text-sm font-medium mb-1">Team Description</label>
							<div class="relative" style="height: 300px;">
								<RichTextEditor bind:value={editing.teamDescription} height="280px" />
							</div>
							<p class="text-xs text-gray-500 mt-2">
								You can use HTML entities like &nbsp; for spacing. The text will be displayed centered below the team title.
							</p>
						</div>
					</div>
				{/if}
				
				<div class="mt-6">
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
	{:else if pages.length === 0}
		<p class="text-gray-600">No pages found. Create your first page!</p>
	{:else}
		<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
			<p class="text-sm text-blue-800">
				💡 <strong>Tip:</strong> Drag rows by the handle (☰) to reorder pages in the navigation menu. Use the checkbox to show/hide pages from navigation.
			</p>
		</div>
		<div class="bg-white rounded-lg shadow overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8">
							<!-- Drag handle column -->
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							ID
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Title
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Show in Nav
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="bg-white divide-y divide-gray-200">
					{#each pages as page, index}
						<tr
							draggable="true"
							on:dragstart={() => handleDragStart(index)}
							on:dragover={(e) => handleDragOver(e, index)}
							on:dragleave={handleDragLeave}
							on:drop={(e) => handleDrop(e, index)}
							on:dragend={handleDragEnd}
							class="cursor-move transition-colors {draggedOverIndex === index ? 'bg-blue-50' : ''} {draggedIndex === index ? 'opacity-50' : ''}"
						>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="flex items-center text-gray-400 hover:text-gray-600">
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16" />
									</svg>
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">{page.id}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">{page.title}</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm">
								<label class="flex items-center cursor-pointer">
									<input
										type="checkbox"
										checked={page.showInNavigation !== false}
										on:change={() => toggleNavigationVisibility(page)}
										on:click|stopPropagation
										class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
									/>
									<span class="ml-2 text-sm text-gray-700">
										{page.showInNavigation !== false ? 'Visible' : 'Hidden'}
									</span>
								</label>
							</td>
							<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
								<button
									on:click={() => startEdit(page)}
									on:click|stopPropagation
									class="text-primary hover:underline mr-4"
								>
									Edit
								</button>
								<button
									on:click={() => deletePage(page.id)}
									on:click|stopPropagation
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

<style>
	tr[draggable="true"]:hover {
		background-color: #f9fafb;
	}
	
	tr[draggable="true"]:active {
		cursor: grabbing;
	}
	
	tr[draggable="true"] {
		cursor: grab;
	}
</style>

