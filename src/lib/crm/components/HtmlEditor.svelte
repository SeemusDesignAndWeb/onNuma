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
	let ResizableImageClass = null; // Store ResizableImage class for resize functionality

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

			// Custom image handler with resize functionality
			const Image = Quill.import('formats/image');
			Image.sanitize = (url) => url; // Allow any URL

			// Create custom ImageBlot with resize functionality
			const BlockEmbed = Quill.import('blots/block/embed');
			
			class ResizableImage extends BlockEmbed {
				static create(value) {
					const node = super.create();
					if (typeof value === 'string') {
						node.setAttribute('src', value);
					} else {
						node.setAttribute('src', value.url || value);
						if (value.width) node.setAttribute('width', value.width);
						if (value.height) node.setAttribute('height', value.height);
					}
					node.setAttribute('contenteditable', 'false');
					node.classList.add('ql-resizable-image');
					return node;
				}

				static value(node) {
					return {
						url: node.getAttribute('src'),
						width: node.getAttribute('width') || null,
						height: node.getAttribute('height') || null
					};
				}

				static formats(node) {
					return {
						width: node.getAttribute('width') || null,
						height: node.getAttribute('height') || null
					};
				}
			}
			ResizableImage.blotName = 'resizableImage';
			ResizableImage.tagName = 'img';
			ResizableImage.className = 'ql-resizable-image';

			// Register the custom format
			Quill.register(ResizableImage, true);
			ResizableImageClass = ResizableImage; // Store for resize function

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
										quill.insertEmbed(range.index, 'resizableImage', url, 'user');
									}
								}
							}
						}
					}
				}
			});

			// Add resize functionality to images
			setupImageResize(quill, ResizableImageClass);
			
			// Ensure the editor root also has LTR direction
			if (quill.root) {
				quill.root.setAttribute('dir', 'ltr');
			}

			// Handle paste events to ensure LTR direction and convert images
			quill.root.addEventListener('paste', (e) => {
				// Let Quill handle paste normally, then fix direction and convert images asynchronously
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
						
						// Convert any pasted images to resizable format
						const images = quill.root.querySelectorAll('img:not(.ql-resizable-image)');
						images.forEach((img) => {
							const src = img.getAttribute('src');
							if (src) {
								try {
									const leaf = quill.getLeaf(img);
									if (leaf && leaf[0]) {
										const index = quill.getIndex(leaf[0]);
										const width = img.getAttribute('width');
										const height = img.getAttribute('height');
										quill.deleteText(index, 1, 'user');
										quill.insertEmbed(index, 'resizableImage', { url: src, width, height }, 'user');
									}
								} catch (error) {
									console.warn('Error converting pasted image to resizable format:', error);
								}
							}
						});
					}
				}, 0);
			});

			if (initialValue) {
				// Use Quill's clipboard to properly parse HTML
				const delta = quill.clipboard.convert({ html: initialValue });
				quill.setContents(delta);
				
				// Convert any existing images to resizable format
				setTimeout(() => {
					const images = quill.root.querySelectorAll('img:not(.ql-resizable-image)');
					images.forEach((img) => {
						const src = img.getAttribute('src');
						if (src) {
							try {
								const leaf = quill.getLeaf(img);
								if (leaf && leaf[0]) {
									const index = quill.getIndex(leaf[0]);
									const width = img.getAttribute('width');
									const height = img.getAttribute('height');
									quill.deleteText(index, 1, 'user');
									quill.insertEmbed(index, 'resizableImage', { url: src, width, height }, 'user');
								}
							} catch (error) {
								console.warn('Error converting image to resizable format:', error);
							}
						}
					});
				}, 100);
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
		quill.insertEmbed(range.index, 'resizableImage', imageUrl, 'user');
		showImageModal = false;
	}

	// Setup image resize functionality
	function setupImageResize(quillInstance, ResizableImageClass) {
		const editor = quillInstance.root;
		const editorContainer = quillInstance.container;
		let selectedImage = null;
		let resizeHandle = null;
		let isResizing = false;
		let startX = 0;
		let startY = 0;
		let startWidth = 0;
		let startHeight = 0;
		let aspectRatio = 1;

		// Create resize handle
		function createResizeHandle() {
			const handle = document.createElement('div');
			handle.className = 'ql-image-resize-handle';
			handle.innerHTML = `
				<div class="ql-resize-handle-top-left"></div>
				<div class="ql-resize-handle-top-right"></div>
				<div class="ql-resize-handle-bottom-left"></div>
				<div class="ql-resize-handle-bottom-right"></div>
			`;
			// Append to editor container for proper positioning
			editorContainer.style.position = 'relative';
			editorContainer.appendChild(handle);
			return handle;
		}

		// Show resize handle for selected image
		function showResizeHandle(img) {
			hideResizeHandle();
			selectedImage = img;
			resizeHandle = createResizeHandle();
			
			const updateHandlePosition = () => {
				if (!selectedImage || !resizeHandle) return;
				const rect = selectedImage.getBoundingClientRect();
				const containerRect = editorContainer.getBoundingClientRect();
				const scrollTop = editor.scrollTop || 0;
				const scrollLeft = editor.scrollLeft || 0;
				
				resizeHandle.style.position = 'absolute';
				resizeHandle.style.left = `${rect.left - containerRect.left + scrollLeft}px`;
				resizeHandle.style.top = `${rect.top - containerRect.top + scrollTop}px`;
				resizeHandle.style.width = `${rect.width}px`;
				resizeHandle.style.height = `${rect.height}px`;
				resizeHandle.style.display = 'block';
			};

			updateHandlePosition();
			
			// Update position on scroll
			const scrollHandler = () => updateHandlePosition();
			editor.addEventListener('scroll', scrollHandler);
			window.addEventListener('scroll', scrollHandler);
			
			// Store handler for cleanup
			resizeHandle._scrollHandler = scrollHandler;
		}

		// Hide resize handle
		function hideResizeHandle() {
			if (resizeHandle) {
				if (resizeHandle._scrollHandler) {
					editor.removeEventListener('scroll', resizeHandle._scrollHandler);
					window.removeEventListener('scroll', resizeHandle._scrollHandler);
				}
				resizeHandle.remove();
				resizeHandle = null;
			}
			selectedImage = null;
		}

		// Handle mouse down on resize handle
		function handleMouseDown(e, corner) {
			if (!selectedImage) return;
			
			e.preventDefault();
			e.stopPropagation();
			isResizing = true;
			
			const rect = selectedImage.getBoundingClientRect();
			startX = e.clientX;
			startY = e.clientY;
			startWidth = parseInt(window.getComputedStyle(selectedImage).width, 10);
			startHeight = parseInt(window.getComputedStyle(selectedImage).height, 10);
			aspectRatio = startWidth / startHeight;

			const handleMouseMove = (e) => {
				if (!isResizing || !selectedImage) return;
				
				const deltaX = e.clientX - startX;
				const deltaY = e.clientY - startY;
				let newWidth = startWidth;
				let newHeight = startHeight;

				// Calculate new dimensions based on corner
				if (corner.includes('right')) {
					newWidth = startWidth + deltaX;
				} else if (corner.includes('left')) {
					newWidth = startWidth - deltaX;
				}

				if (corner.includes('bottom')) {
					newHeight = startHeight + deltaY;
				} else if (corner.includes('top')) {
					newHeight = startHeight - deltaY;
				}

				// Maintain aspect ratio
				if (e.shiftKey) {
					const newAspectRatio = newWidth / newHeight;
					if (Math.abs(newAspectRatio - aspectRatio) > 0.1) {
						if (Math.abs(deltaX) > Math.abs(deltaY)) {
							newHeight = newWidth / aspectRatio;
						} else {
							newWidth = newHeight * aspectRatio;
						}
					}
				}

				// Minimum size
				newWidth = Math.max(50, newWidth);
				newHeight = Math.max(50, newHeight);

				// Apply new dimensions
				selectedImage.style.width = `${newWidth}px`;
				selectedImage.style.height = `${newHeight}px`;
				selectedImage.setAttribute('width', newWidth);
				selectedImage.setAttribute('height', newHeight);

				// Update handle position
				if (resizeHandle) {
					const rect = selectedImage.getBoundingClientRect();
					const containerRect = editorContainer.getBoundingClientRect();
					const scrollTop = editor.scrollTop || 0;
					const scrollLeft = editor.scrollLeft || 0;
					resizeHandle.style.left = `${rect.left - containerRect.left + scrollLeft}px`;
					resizeHandle.style.top = `${rect.top - containerRect.top + scrollTop}px`;
					resizeHandle.style.width = `${rect.width}px`;
					resizeHandle.style.height = `${rect.height}px`;
				}
			};

			const handleMouseUp = () => {
				isResizing = false;
				document.removeEventListener('mousemove', handleMouseMove);
				document.removeEventListener('mouseup', handleMouseUp);
				
				// Update Quill content
				if (selectedImage) {
					try {
						const leaf = quillInstance.getLeaf(selectedImage);
						if (leaf && leaf[0]) {
							const index = quillInstance.getIndex(leaf[0]);
							const value = ResizableImageClass.value(selectedImage);
							quillInstance.deleteText(index, 1, 'user');
							quillInstance.insertEmbed(index, 'resizableImage', value, 'user');
						}
					} catch (error) {
						console.warn('Error updating resized image:', error);
					}
				}
			};

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
		}

		// Click handler for images
		editor.addEventListener('click', (e) => {
			const img = e.target.closest('img.ql-resizable-image');
			if (img) {
				e.preventDefault();
				showResizeHandle(img);
			} else {
				hideResizeHandle();
			}
		});

		// Handle resize handle clicks - attach to document to catch all events
		const handleResizeMouseDown = (e) => {
			const handle = e.target.closest('.ql-resize-handle-top-left, .ql-resize-handle-top-right, .ql-resize-handle-bottom-left, .ql-resize-handle-bottom-right');
			if (handle) {
				let corner = '';
				if (handle.classList.contains('ql-resize-handle-top-left')) corner = 'top-left';
				else if (handle.classList.contains('ql-resize-handle-top-right')) corner = 'top-right';
				else if (handle.classList.contains('ql-resize-handle-bottom-left')) corner = 'bottom-left';
				else if (handle.classList.contains('ql-resize-handle-bottom-right')) corner = 'bottom-right';
				handleMouseDown(e, corner);
			}
		};
		document.addEventListener('mousedown', handleResizeMouseDown);

		// Hide handle when clicking outside
		document.addEventListener('click', (e) => {
			if (!editor.contains(e.target) && !e.target.closest('.ql-image-resize-handle')) {
				hideResizeHandle();
			}
		});

		// Cleanup on destroy
		return () => {
			hideResizeHandle();
			document.removeEventListener('mousedown', handleResizeMouseDown);
		};
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
		<div class="mb-2 flex gap-2 justify-between items-center">
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
						<div class="absolute z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg min-w-[350px]" on:click|stopPropagation>
							<div class="py-1">
								{#each placeholders as placeholder}
									<button
										type="button"
										on:click={() => insertPlaceholder(placeholder.value)}
										class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 whitespace-nowrap"
									>
										<code class="text-xs">{placeholder.value}</code> - {placeholder.label}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}
			<a
				href="/hub/images"
				target="_blank"
				class="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 flex items-center gap-1.5"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>
				Upload images
			</a>
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

	/* Resizable image styles */
	:global(.html-editor .ql-editor img.ql-resizable-image) {
		cursor: pointer;
		display: inline-block;
		max-width: 100%;
		height: auto;
	}

	:global(.ql-image-resize-handle) {
		position: absolute;
		border: 2px solid #4285f4;
		box-sizing: border-box;
		pointer-events: none;
		z-index: 1000;
	}

	:global(.ql-image-resize-handle .ql-resize-handle-top-left),
	:global(.ql-image-resize-handle .ql-resize-handle-top-right),
	:global(.ql-image-resize-handle .ql-resize-handle-bottom-left),
	:global(.ql-image-resize-handle .ql-resize-handle-bottom-right) {
		position: absolute;
		width: 12px;
		height: 12px;
		background: #4285f4;
		border: 2px solid white;
		border-radius: 50%;
		pointer-events: all;
		cursor: nwse-resize;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	:global(.ql-image-resize-handle .ql-resize-handle-top-left) {
		top: -6px;
		left: -6px;
		cursor: nwse-resize;
	}

	:global(.ql-image-resize-handle .ql-resize-handle-top-right) {
		top: -6px;
		right: -6px;
		cursor: nesw-resize;
	}

	:global(.ql-image-resize-handle .ql-resize-handle-bottom-left) {
		bottom: -6px;
		left: -6px;
		cursor: nesw-resize;
	}

	:global(.ql-image-resize-handle .ql-resize-handle-bottom-right) {
		bottom: -6px;
		right: -6px;
		cursor: nwse-resize;
	}

	:global(.ql-image-resize-handle .ql-resize-handle-top-left:hover),
	:global(.ql-image-resize-handle .ql-resize-handle-top-right:hover),
	:global(.ql-image-resize-handle .ql-resize-handle-bottom-left:hover),
	:global(.ql-image-resize-handle .ql-resize-handle-bottom-right:hover) {
		background: #1a73e8;
		transform: scale(1.2);
	}
</style>
