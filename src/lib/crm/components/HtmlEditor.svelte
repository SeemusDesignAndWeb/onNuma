<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	export let value = '';
	export let name = 'content';
	export let placeholder = 'Enter content...';
	export let showPlaceholders = false; // Show placeholder dropdown
	export let showImagePicker = false; // Show image picker
	export let customPlaceholders = null; // Optional custom placeholder list
	export let imageApiEndpoint = '/hub/api/images'; // API endpoint for image library
	export let imageManagerHref = '/hub/images'; // Optional image manager link
	export let showImageManagerLink = true; // Show/hide image manager link

	let quill = null;
	let quillContainer = null;
	let initialValue = value;
	let loaded = false;
	let showPlaceholderMenu = false;
	let showImageModal = false;
	let images = [];
	let loadingImages = false;
	let imageSearchTerm = '';
	let imageUploading = false;
	let imageUploadError = '';
	let isUpdatingFromExternal = false; // Track if we're updating from external source (reactive statement)
	let ResizableImageClass = null; // Store ResizableImage class for resize functionality
	let showSourceView = false;
	let sourceContent = value || '';
	let sourceTextarea = null;

	const defaultPlaceholders = [
		{ value: '{{firstName}}', label: 'First Name' },
		{ value: '{{lastName}}', label: 'Last Name' },
		{ value: '{{name}}', label: 'Full Name' },
		{ value: '{{email}}', label: 'Email' },
		{ value: '{{phone}}', label: 'Phone' },
		{ value: '{{rotaLinks}}', label: 'Upcoming Rotas' },
		{ value: '{{upcomingEvents}}', label: 'Upcoming Events' }
	];

	$: placeholders = Array.isArray(customPlaceholders) && customPlaceholders.length > 0
		? customPlaceholders
		: defaultPlaceholders;

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
							[{ 'color': [] }, { 'background': [] }],
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
						ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'style', 'width', 'height'],
						ALLOWED_CLASSES: {
							'*': ['ql-align-center', 'ql-align-right', 'ql-align-justify', 'ql-align-left', 'ql-resizable-image']
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
			// Use Quill's clipboard to properly parse HTML and preserve image attributes
			const delta = quill.clipboard.convert({ html: newValue });
			quill.setContents(delta);
			initialValue = newValue;
			
			// Convert any images to resizable format after update
			setTimeout(() => {
				if (quill && quill.root) {
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
				}
				isUpdatingFromExternal = false;
			}, 100);
		} else {
			initialValue = value;
		}
	}

	async function loadImages(forceReload = false) {
		if (!forceReload && (loadingImages || images.length > 0)) return;
		if (forceReload) images = [];
		loadingImages = true;
		try {
			const response = await fetch(imageApiEndpoint);
			if (response.ok) {
				images = await response.json();
			}
		} catch (error) {
			console.error('Failed to load images:', error);
		} finally {
			loadingImages = false;
		}
	}

	async function handleImageUpload(event) {
		const target = event.target;
		const file = target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith('image/')) {
			imageUploadError = 'Please select an image file (JPG, PNG, GIF, WebP).';
			return;
		}
		if (file.size > 10 * 1024 * 1024) {
			imageUploadError = 'Image must be under 10MB.';
			return;
		}
		imageUploadError = '';
		imageUploading = true;
		try {
			const formData = new FormData();
			formData.append('file', file);
			const response = await fetch(imageApiEndpoint, { method: 'POST', body: formData });
			if (response.ok) {
				const result = await response.json();
				images = [result.image, ...images];
				insertImage(result.image.path);
				closeImageModal();
			} else {
				const err = await response.json();
				imageUploadError = err.error || 'Upload failed';
			}
		} catch (err) {
			imageUploadError = err?.message || 'Upload failed';
		} finally {
			imageUploading = false;
			target.value = '';
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
		imageUploadError = '';
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

	// Format HTML with proper indentation
	function formatHTML(html) {
		if (!html || html.trim() === '') return '';
		
		try {
			// Use a simple parser approach
			let formatted = '';
			let indent = 0;
			const indentSize = 2;
			
			// Remove extra whitespace between tags
			let cleaned = html.replace(/>\s+</g, '><').trim();
			
			// Split into tokens (tags and text)
			const tokens = cleaned.split(/(<[^>]*>)/);
			
			for (let i = 0; i < tokens.length; i++) {
				const token = tokens[i];
				if (!token) continue;
				
				// Check if it's a tag
				if (token.startsWith('<')) {
					const isClosing = token.startsWith('</');
					const isSelfClosing = token.endsWith('/>') || /<(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)(\s|>)/i.test(token);
					
					if (isClosing) {
						indent = Math.max(0, indent - 1);
						formatted += ' '.repeat(indent * indentSize) + token + '\n';
					} else if (isSelfClosing) {
						formatted += ' '.repeat(indent * indentSize) + token + '\n';
					} else {
						formatted += ' '.repeat(indent * indentSize) + token + '\n';
						indent++;
					}
				} else {
					// It's text content
					const text = token.trim();
					if (text) {
						// Check if next token is a closing tag (inline content)
						const nextToken = tokens[i + 1];
						if (nextToken && nextToken.startsWith('</')) {
							formatted += ' '.repeat(indent * indentSize) + text;
						} else {
							formatted += ' '.repeat(indent * indentSize) + text + '\n';
						}
					}
				}
			}
			
			return formatted.trim();
		} catch (error) {
			// If formatting fails, return original HTML
			console.warn('HTML formatting error:', error);
			return html;
		}
	}

	function toggleSourceView() {
		if (!quill && !showSourceView) {
			// Can't switch to source if Quill isn't loaded yet
			return;
		}
		
		if (showSourceView) {
			// Switching from source to visual - update Quill with source content
			if (!quill) return;
			
			const html = sourceContent;
			isUpdatingFromExternal = true;
			const delta = quill.clipboard.convert({ html });
			quill.setContents(delta);
			value = html;
			initialValue = html;
			
			// Update hidden input
			const hiddenInput = quillContainer?.parentElement?.querySelector(`input[name="${name}"]`);
			if (hiddenInput) {
				hiddenInput.value = html;
			}
			
			setTimeout(() => {
				isUpdatingFromExternal = false;
			}, 0);
		} else {
			// Switching from visual to source - get HTML from Quill and format it
			if (quill) {
				const rawHTML = quill.root.innerHTML;
				sourceContent = formatHTML(rawHTML);
			} else {
				// If Quill isn't loaded, use current value
				sourceContent = formatHTML(value || '');
			}
		}
		
		showSourceView = !showSourceView;
	}

	function formatSourceCode() {
		if (sourceTextarea) {
			sourceContent = formatHTML(sourceContent);
			value = sourceContent;
			
			// Update hidden input
			const hiddenInput = quillContainer?.parentElement?.querySelector(`input[name="${name}"]`);
			if (hiddenInput) {
				hiddenInput.value = sourceContent;
			}
		}
	}

	function handleSourceChange() {
		if (sourceTextarea) {
			sourceContent = sourceTextarea.value;
			value = sourceContent;
			
			// Update hidden input
			const hiddenInput = quillContainer?.parentElement?.querySelector(`input[name="${name}"]`);
			if (hiddenInput) {
				hiddenInput.value = sourceContent;
			}
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
			{#if showImageManagerLink}
				<a
					href={imageManagerHref}
					target="_blank"
					class="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700 flex items-center gap-1.5"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
					</svg>
					Upload images
				</a>
			{/if}
		</div>
	{/if}
	<div class="html-editor-wrapper">
		<!-- View Source Button - Floating Right on Toolbar -->
		<button
			type="button"
			on:click={toggleSourceView}
			class="view-source-btn"
			title={showSourceView ? 'Switch to Visual Editor' : 'View Source'}
		>
			{#if showSourceView}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
				</svg>
				<span>Visual</span>
			{:else}
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
				</svg>
				<span>Source</span>
			{/if}
		</button>
		
		<div bind:this={quillContainer} class="bg-white quill-wrapper" dir="ltr" class:source-view-mode={showSourceView}></div>
		<div class="source-view-container" class:hidden={!showSourceView}>
			<div class="source-view-toolbar">
				<button
					type="button"
					on:click={formatSourceCode}
					class="format-btn"
					title="Format HTML code"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					<span>Format</span>
				</button>
			</div>
			<textarea
				bind:this={sourceTextarea}
				bind:value={sourceContent}
				on:input={handleSourceChange}
				class="source-textarea"
				placeholder="Enter HTML source code..."
				spellcheck="false"
			></textarea>
		</div>
	</div>
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

			<!-- Upload -->
			<div class="px-6 py-4 border-b bg-gray-50">
				<label for="html-editor-image-upload" class="block text-sm font-medium text-gray-700 mb-2">Upload new image</label>
				<div class="flex flex-wrap items-center gap-3">
					<input
						id="html-editor-image-upload"
						type="file"
						accept="image/*"
						on:change={handleImageUpload}
						disabled={imageUploading}
						class="text-sm text-gray-600 file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-green-600 file:text-white file:cursor-pointer hover:file:bg-green-700 disabled:opacity-50"
					/>
					{#if imageUploading}
						<span class="text-sm text-gray-500">Uploading…</span>
					{/if}
				</div>
				{#if imageUploadError}
					<p class="mt-2 text-sm text-red-600">{imageUploadError}</p>
				{/if}
				<p class="mt-1 text-xs text-gray-500">JPG, PNG, GIF or WebP. Max 10MB. Image will be inserted into the email.</p>
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
	.html-editor-wrapper {
		position: relative;
	}

	.quill-wrapper {
		position: relative;
	}

	/* Hide the container element itself when it has source-view-mode class */
	:global(.ql-container.source-view-mode),
	:global(.ql-snow.source-view-mode) {
		display: none !important;
	}

	/* Hide only the editor container (not toolbar) when in source view */
	.quill-wrapper.source-view-mode :global(.ql-container),
	.quill-wrapper.source-view-mode :global(.ql-editor) {
		display: none !important;
	}

	/* Ensure toolbar stays visible and has proper border when in source view */
	.quill-wrapper :global(.ql-toolbar) {
		display: flex !important;
	}

	/* Adjust toolbar border when in source view to connect with source container */
	.quill-wrapper.source-view-mode :global(.ql-toolbar) {
		border-bottom-left-radius: 0;
		border-bottom-right-radius: 0;
		border-bottom: 1px solid #d1d5db;
	}

	.view-source-btn {
		position: absolute;
		top: 8px;
		right: 12px;
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		font-size: 13px;
		color: #374151;
		background: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
	}

	.view-source-btn:hover {
		background: #f9fafb;
		color: #111827;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.hidden {
		display: none !important;
	}

	.source-view-container {
		position: relative;
		border: 1px solid #d1d5db;
		border-top: none;
		border-radius: 0 0 4px 4px;
		background: #1e1e1e;
		overflow: hidden;
		margin-top: -1px; /* Overlap with toolbar border */
		display: flex;
		flex-direction: column;
		height: calc(100vh - 300px); /* Expand to near bottom of screen */
		min-height: 400px;
		max-height: calc(100vh - 150px);
	}

	.source-view-toolbar {
		display: flex;
		justify-content: flex-end;
		padding: 8px;
		background: #252526;
		border-bottom: 1px solid #3e3e42;
	}

	.format-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 12px;
		font-size: 12px;
		color: #cccccc;
		background: #2d2d30;
		border: 1px solid #3e3e42;
		border-radius: 3px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.format-btn:hover {
		background: #37373d;
		border-color: #007acc;
		color: #ffffff;
	}

	.source-textarea {
		width: 100%;
		flex: 1;
		min-height: 400px;
		padding: 16px;
		font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
		font-size: 13px;
		line-height: 1.6;
		color: #d4d4d4;
		background: #1e1e1e;
		border: none;
		outline: none;
		resize: none;
		tab-size: 2;
		white-space: pre-wrap;
		overflow-wrap: break-word;
		word-wrap: break-word;
		overflow-y: auto;
		overflow-x: hidden;
	}

	.source-textarea::selection {
		background: #264f78;
	}

	.source-textarea:focus {
		outline: none;
	}

	.view-source-btn svg {
		flex-shrink: 0;
	}

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
