<script lang="js">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import ImagePicker from './ImagePicker.svelte';

	export let value = '';
	export let placeholder = 'Enter content...';
	export let height = '300px';

	let editorContainer;
	let quill = null;
	let showImagePicker = false;
	let Quill = null;

	let isUpdating = false;
	let lastExternalValue = '';

	onMount(async () => {
		if (!browser) return;

		// Dynamically import Quill only on client side
		const QuillModule = await import('quill');
		Quill = QuillModule.default;
		await import('quill/dist/quill.snow.css');

		// Wait for DOM to be ready
		await tick();

		if (editorContainer) {
			quill = new Quill(editorContainer, {
				theme: 'snow',
				placeholder,
				modules: {
					toolbar: {
						container: [
							[{ header: [1, 2, 3, 4, 5, 6, false] }],
							['bold', 'italic', 'underline', 'strike'],
							[{ list: 'ordered' }, { list: 'bullet' }],
							[{ script: 'sub' }, { script: 'super' }],
							[{ indent: '-1' }, { indent: '+1' }],
							[{ color: [] }, { background: [] }],
							[{ align: [] }],
							['link', 'image'],
							['clean']
						],
						handlers: {
							image: () => {
								showImagePicker = true;
							}
						}
					}
				}
			});

			// Set initial content
			const initialValue = value || '';
			quill.root.innerHTML = initialValue;
			lastExternalValue = initialValue;

			// Update value when content changes
			quill.on('text-change', () => {
				if (quill && !isUpdating) {
					isUpdating = true;
					const newContent = quill.root.innerHTML;
					value = newContent;
					lastExternalValue = newContent;
					// Use setTimeout to reset flag after Svelte processes the update
					setTimeout(() => {
						isUpdating = false;
					}, 0);
				}
			});
		}
	});

	onDestroy(() => {
		if (quill) {
			quill = null;
		}
	});

	// Update editor when value changes externally (but only if it's actually different)
	// Only update if the value changed from outside (not from our own text-change handler)
	$: if (quill && !isUpdating && value !== lastExternalValue) {
		const currentContent = quill.root.innerHTML;
		const newValue = value || '';
		// Only update if the value is actually different from what we have
		if (currentContent !== newValue) {
			isUpdating = true;
			quill.root.innerHTML = newValue;
			lastExternalValue = newValue;
			setTimeout(() => {
				isUpdating = false;
			}, 0);
		}
	}

	function handleImageSelect(imagePath) {
		if (quill) {
			const range = quill.getSelection(true);
			quill.insertEmbed(range.index, 'image', imagePath);
			quill.setSelection(range.index + 1);
		}
	}
</script>

<div class="rich-text-editor relative" style="height: {height}; overflow: hidden;">
	<div bind:this={editorContainer} class="relative w-full h-full"></div>
</div>

<ImagePicker open={showImagePicker} onSelect={handleImageSelect} />


<style>
	.rich-text-editor {
		position: relative;
		z-index: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	:global(.rich-text-editor .ql-container) {
		font-size: 14px;
		font-family: inherit;
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	:global(.rich-text-editor .ql-editor) {
		min-height: 200px;
		flex: 1;
		overflow-y: auto;
	}

	:global(.rich-text-editor .ql-toolbar) {
		border-top-left-radius: 0.375rem;
		border-top-right-radius: 0.375rem;
		border-bottom: none;
		background-color: #f9fafb;
		position: relative;
		z-index: 2;
	}

	:global(.rich-text-editor .ql-container) {
		border-bottom-left-radius: 0.375rem;
		border-bottom-right-radius: 0.375rem;
		border-top: 1px solid #ccc;
		position: relative;
		z-index: 1;
	}

	:global(.rich-text-editor .ql-snow) {
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		position: relative;
	}

	:global(.rich-text-editor .ql-snow .ql-stroke) {
		stroke: #374151;
	}

	:global(.rich-text-editor .ql-snow .ql-fill) {
		fill: #374151;
	}

	:global(.rich-text-editor .ql-snow .ql-picker-label) {
		color: #374151;
	}

	:global(.rich-text-editor .ql-snow .ql-picker-options) {
		background-color: white;
		border: 1px solid #d1d5db;
		z-index: 1000;
	}
</style>

