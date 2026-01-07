<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	export let value = '';
	export let name = 'content';
	export let placeholder = 'Enter content...';
	export let showPlaceholders = false; // Show placeholder dropdown
	export let showImagePicker = false; // Show image picker

	let quill = null;
	let quillContainer = null;
	let initialValue = value;
	let loaded = false;
	let showPlaceholderMenu = false;
	let showImageModal = false;
	let images = [];
	let loadingImages = false;
	let imageSearchTerm = '';
	let isUpdatingFromExternal = false; // Track if we're updating from external source (reactive statement)

	const placeholders = [
		{ value: '{{firstName}}', label: 'First Name' },
		{ value: '{{lastName}}', label: 'Last Name' },
		{ value: '{{name}}', label: 'Full Name' },
		{ value: '{{email}}', label: 'Email' },
		{ value: '{{phone}}', label: 'Phone' },
		{ value: '{{rotaLinks}}', label: 'Upcoming Rotas' },
		{ value: '{{upcomingEvents}}', label: 'Upcoming Events' }
	];

	onMount(async () => {
		if (!quillContainer || !browser) return;
		
		// Add click outside handler
		document.addEventListener('click', handleClickOutside);

		try {
			// Dynamically import Quill and DOMPurify only in browser
			const [{ default: Quill }, DOMPurify] = await Promise.all([
				import('quill'),
				import('dompurify')
			]);
			
			// Import CSS
			await import('quill/dist/quill.snow.css');

			// Custom image handler
			const Image = Quill.import('formats/image');
			Image.sanitize = (url) => url; // Allow any URL

			// Ensure LTR direction
			quillContainer.setAttribute('dir', 'ltr');
			
			quill = new Quill(quillContainer, {
				theme: 'snow',
				placeholder,
				direction: 'ltr', // Explicitly set left-to-right
				modules: {
					toolbar: {
						container: [
							[{ 'header': [1, 2, 3, false] }],
							['bold', 'italic', 'underline', 'strike'],
							[{ 'list': 'ordered'}, { 'list': 'bullet' }],
							[{ 'align': [] }],
							['link', 'image'],
							['clean']
						],
						handlers: {
							image: () => {
								if (showImagePicker) {
									openImagePicker();
								} else {
									// Default image handler
									const url = prompt('Enter image URL:');
									if (url) {
										const range = quill.getSelection(true);
										quill.insertEmbed(range.index, 'image', url, 'user');
									}
								}
							}
						}
					}
				}
			});
			
			// Ensure the editor root also has LTR direction
			if (quill.root) {
				quill.root.setAttribute('dir', 'ltr');
			}

			// Handle paste events to ensure LTR direction (simplified, non-blocking)
			quill.root.addEventListener('paste', (e) => {
				// Let Quill handle paste normally, then fix direction asynchronously
				setTimeout(() => {
					if (quill && quill.root) {
						quill.root.setAttribute('dir', 'ltr');
						// Fix RTL elements after paste
						const allElements = quill.root.querySelectorAll('*');
						allElements.forEach(el => {
							if (el.hasAttribute('dir') && el.getAttribute('dir') === 'rtl') {
								el.setAttribute('dir', 'ltr');
							}
							if (el.style && el.style.direction === 'rtl') {
								el.style.direction = 'ltr';
							}
						});
					}
				}, 0);
			});

			if (initialValue) {
				// Use Quill's clipboard to properly parse HTML
				const delta = quill.clipboard.convert({ html: initialValue });
				quill.setContents(delta);
			}

			// Simplified text-change handler - don't sanitize on every keystroke (causes delays)
			// Only update the value, sanitize on form submit
			quill.on('text-change', () => {
				if (quill && !isUpdatingFromExternal) {
					// Use setTimeout to avoid blocking the UI thread
					setTimeout(() => {
						if (quill && !isUpdatingFromExternal) {
							const html = quill.root.innerHTML;
							// Only update if content actually changed
							if (html !== value) {
								value = html;
								
								// Update hidden input directly to ensure form submission works
								const hiddenInput = quillContainer.parentElement?.querySelector(`input[name="${name}"]`);
								if (hiddenInput) {
									hiddenInput.value = html;
								}
								
								// Dispatch custom event
								const event = new CustomEvent('change', { detail: { value: html } });
								quillContainer.dispatchEvent(event);
							}
						}
					}, 0);
				}
			});
			
			// Sanitize on form submit to ensure clean HTML is saved
			const form = quillContainer.closest('form');
			if (form) {
				form.addEventListener('submit', () => {
					const html = quill.root.innerHTML;
					// Sanitize on submit (not on every keystroke to avoid delays)
					const sanitized = DOMPurify.default.sanitize(html, {
						ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style'],
						ALLOWED_CLASSES: {
							'*': ['ql-align-center', 'ql-align-right', 'ql-align-justify', 'ql-align-left']
						}
					});
					value = sanitized;
					const hiddenInput = quillContainer.parentElement?.querySelector(`input[name="${name}"]`);
					if (hiddenInput) {
						hiddenInput.value = sanitized;
					}
				});
			}

			loaded = true;
		} catch (error) {
			console.error('Error loading Quill editor:', error);
		}
	});

	onDestroy(() => {
		if (browser && typeof document !== 'undefined') {
			document.removeEventListener('click', handleClickOutside);
		}
		if (quill) {
			quill = null;
		}
	});

	// Update editor when value changes externally (simplified like RichTextEditor)
	$: if (quill && loaded && !isUpdatingFromExternal && value !== initialValue) {
		const current = quill.root.innerHTML;
		const newValue = value || '';
		// Only update if the value is actually different
		if (current !== newValue) {
			isUpdatingFromExternal = true;
			quill.root.innerHTML = newValue;
			initialValue = newValue;
			// Reset flag after a brief delay
			setTimeout(() => {
				isUpdatingFromExternal = false;
			}, 0);
		} else {
			initialValue = value;
		}
	}

	async function loadImages() {
		if (loadingImages || images.length > 0) return;
		loadingImages = true;
		try {
			const response = await fetch('/hub/api/images');
			if (response.ok) {
				images = await response.json();
			}
		} catch (error) {
			console.error('Failed to load images:', error);
		} finally {
			loadingImages = false;
		}
	}

	function insertPlaceholder(placeholderValue) {
		if (!quill) return;
		const range = quill.getSelection(true);
		quill.insertText(range.index, placeholderValue, 'user');
		quill.setSelection(range.index + placeholderValue.length);
		showPlaceholderMenu = false;
	}

	function insertImage(imageUrl) {
		if (!quill) return;
		const range = quill.getSelection(true);
		quill.insertEmbed(range.index, 'image', imageUrl, 'user');
		showImageModal = false;
	}

	function openImagePicker() {
		showImageModal = true;
		if (images.length === 0) {
			loadImages();
		}
	}

	function closeImageModal() {
		showImageModal = false;
		imageSearchTerm = '';
	}

	$: filteredImages = imageSearchTerm
		? images.filter(img =>
			(img.originalName || img.filename || '').toLowerCase().includes(imageSearchTerm.toLowerCase()) ||
			(img.path || '').toLowerCase().includes(imageSearchTerm.toLowerCase())
		)
		: images;

	// Close menus when clicking outside
	function handleClickOutside(event) {
		if (showPlaceholderMenu && !event.target.closest('.placeholder-menu-container')) {
			showPlaceholderMenu = false;
		}
	}
</script>

<div class="html-editor">
	{#if showPlaceholders}
		<div class="mb-2 flex gap-2">
			{#if showPlaceholders}
				<div class="relative placeholder-menu-container">
					<button
						type="button"
						on:click|stopPropagation={() => showPlaceholderMenu = !showPlaceholderMenu}
						class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700"
					>
						Insert Placeholder ↓
					</button>
					{#if showPlaceholderMenu}
						<div class="absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg min-w-[200px]" on:click|stopPropagation>
							<div class="py-1">
								{#each placeholders as placeholder}
									<button
										type="button"
										on:click={() => insertPlaceholder(placeholder.value)}
										class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
									>
										<code class="text-xs">{placeholder.value}</code> - {placeholder.label}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
	<div bind:this={quillContainer} class="bg-white" dir="ltr"></div>
	<input type="hidden" name={name} value={value} />
</div>

<!-- Image Picker Modal -->
{#if showImageModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" on:click={closeImageModal} role="dialog" aria-modal="true">
		<div class="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] flex flex-col" on:click|stopPropagation>
			<!-- Header -->
			<div class="flex justify-between items-center p-6 border-b">
				<h2 class="text-2xl font-bold text-gray-900">Select Image</h2>
				<button
					type="button"
					on:click={closeImageModal}
					class="text-gray-400 hover:text-gray-600 text-2xl font-bold"
					aria-label="Close"
				>
					×
				</button>
			</div>
			
			<!-- Search -->
			<div class="p-4 border-b">
				<input
					type="text"
					bind:value={imageSearchTerm}
					placeholder="Search images..."
					class="w-full px-4 py-2 border border-gray-500 rounded-md focus:border-green-500 focus:ring-green-500"
				/>
			</div>
			
			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				{#if loadingImages}
					<div class="text-center py-12 text-gray-500">Loading images...</div>
				{:else if filteredImages.length === 0}
					<div class="text-center py-12 text-gray-500">
						{imageSearchTerm ? 'No images found matching your search.' : 'No images available'}
					</div>
				{:else}
					<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{#each filteredImages as image}
							<button
								type="button"
								on:click={() => insertImage(image.path)}
								class="relative aspect-square border-2 border-gray-300 rounded-lg overflow-hidden hover:border-green-500 hover:shadow-lg transition-all group"
							>
								<img src={image.path} alt={image.originalName || image.filename} class="w-full h-full object-cover" />
								<div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all"></div>
								<div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2 truncate opacity-0 group-hover:opacity-100 transition-opacity">
									{image.originalName || image.filename}
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
			
			<!-- Footer -->
			<div class="p-6 border-t flex justify-end">
				<button
					type="button"
					on:click={closeImageModal}
					class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.html-editor .ql-container) {
		min-height: 200px;
		font-size: 14px;
	}
	:global(.html-editor .ql-editor) {
		min-height: 200px;
		direction: ltr;
		text-align: left;
	}
	
	:global(.html-editor .ql-container) {
		direction: ltr;
	}
	
	/* Ensure consistent heading sizes matching preview and PDF */
	:global(.html-editor .ql-editor h1) {
		font-size: 2em;
		line-height: 1.2;
		font-weight: 600;
		margin-top: 0.67em;
		margin-bottom: 0.67em;
	}
	
	:global(.html-editor .ql-editor h2) {
		font-size: 1.5em;
		line-height: 1.3;
		font-weight: 600;
		margin-top: 0.83em;
		margin-bottom: 0.83em;
	}
	
	:global(.html-editor .ql-editor h3) {
		font-size: 1.17em;
		line-height: 1.4;
		font-weight: 600;
		margin-top: 1em;
		margin-bottom: 1em;
	}
	
	:global(.html-editor .ql-editor h4) {
		font-size: 1em;
		line-height: 1.5;
		font-weight: 600;
		margin-top: 1.33em;
		margin-bottom: 1.33em;
	}
</style>
