<script>
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';

	export let value = '';
	export let name = 'body_html';
	export let rows = 14;
	/** Pass content blocks array for the block picker */
	export let blocks = [];
	/** Allow inserting link references */
	export let links = [];
	/** Optional: base path for the preview API endpoint */
	export let previewEndpoint = '/multi-org/marketing/preview';

	const dispatch = createEventDispatcher();

	let mode = 'split'; // 'code' | 'preview' | 'split'
	let previewWidth = 'desktop'; // 'desktop' | 'tablet' | 'mobile'
	let editorEl;
	let editorView;
	let hiddenInput;
	let showBlockPicker = false;
	let showLinkPicker = false;
	let internalValue = value;
	let resolvedPreviewHtml = '';
	let previewTimer = null;

	// Sync external value changes
	$: if (value !== internalValue && editorView) {
		internalValue = value;
		const current = editorView.state.doc.toString();
		if (current !== value) {
			editorView.dispatch({
				changes: { from: 0, to: current.length, insert: value }
			});
		}
	}

	// Debounced preview resolution whenever value changes
	$: if (internalValue !== undefined && (mode === 'preview' || mode === 'split')) {
		schedulePreviewResolve(internalValue);
	}

	// When resolved HTML changes or mode changes, build the preview srcdoc
	$: displayHtml = resolvedPreviewHtml || internalValue || '';
	$: previewSrcdoc = buildPreviewDoc(displayHtml);

	function schedulePreviewResolve(html) {
		if (previewTimer) clearTimeout(previewTimer);
		previewTimer = setTimeout(() => resolvePreview(html), 400);
	}

	async function resolvePreview(html) {
		if (!html) { resolvedPreviewHtml = ''; return; }
		// Only call API if there are block or link references to resolve
		if (!html.includes('{{block:') && !html.includes('{{link:')) {
			resolvedPreviewHtml = html;
			return;
		}
		try {
			const res = await fetch(previewEndpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ html })
			});
			if (res.ok) {
				const data = await res.json();
				resolvedPreviewHtml = data.html || html;
			} else {
				resolvedPreviewHtml = html;
			}
		} catch {
			resolvedPreviewHtml = html;
		}
	}

	const previewWidths = {
		desktop: '100%',
		tablet: '768px',
		mobile: '375px'
	};

	function buildPreviewDoc(html) {
		if (!html) return '';
		return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
	body {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		margin: 0;
		padding: 24px;
		color: #272838;
		font-size: 15px;
		line-height: 1.6;
		background: #ffffff;
	}
	img { max-width: 100%; height: auto; }
	a { color: #EB9486; }
	* { box-sizing: border-box; }
</style>
</head>
<body>${html}</body>
</html>`;
	}

	function insertAtCursor(text) {
		if (!editorView) return;
		const pos = editorView.state.selection.main.head;
		editorView.dispatch({
			changes: { from: pos, insert: text }
		});
		editorView.focus();
	}

	function insertBlock(blockKey) {
		insertAtCursor(`{{block:${blockKey}}}`);
		showBlockPicker = false;
	}

	function insertLink(linkKey) {
		insertAtCursor(`{{link:${linkKey}}}`);
		showLinkPicker = false;
	}

	onMount(async () => {
		// Dynamically import CodeMirror to avoid SSR issues
		const [
			{ EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection },
			{ EditorState },
			{ html },
			{ oneDark },
			{ defaultKeymap, history, historyKeymap, indentWithTab },
			{ syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap },
			{ closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap },
			{ searchKeymap, highlightSelectionMatches }
		] = await Promise.all([
			import('@codemirror/view'),
			import('@codemirror/state'),
			import('@codemirror/lang-html'),
			import('@codemirror/theme-one-dark'),
			import('@codemirror/commands'),
			import('@codemirror/language'),
			import('@codemirror/autocomplete'),
			import('@codemirror/search')
		]);

		const updateListener = EditorView.updateListener.of((update) => {
			if (update.docChanged) {
				internalValue = update.state.doc.toString();
				if (hiddenInput) hiddenInput.value = internalValue;
				dispatch('change', internalValue);
			}
		});

		const theme = EditorView.theme({
			'&': {
				fontSize: '13px',
				height: `${rows * 1.5}em`,
				minHeight: '200px'
			},
			'.cm-scroller': {
				overflow: 'auto',
				fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace"
			},
			'.cm-content': {
				padding: '8px 0'
			},
			'.cm-gutters': {
				borderRight: '1px solid #e2e4e9',
				backgroundColor: '#fafbfc'
			},
			'&.cm-focused': {
				outline: 'none'
			}
		});

		const lightHighlight = syntaxHighlighting(defaultHighlightStyle, { fallback: true });

		editorView = new EditorView({
			parent: editorEl,
			state: EditorState.create({
				doc: value || '',
				extensions: [
					lineNumbers(),
					highlightActiveLine(),
					highlightActiveLineGutter(),
					drawSelection(),
					rectangularSelection(),
					history(),
					foldGutter(),
					bracketMatching(),
					closeBrackets(),
					autocompletion(),
					highlightSelectionMatches(),
					html(),
					lightHighlight,
					theme,
					keymap.of([
						...defaultKeymap,
						...historyKeymap,
						...foldKeymap,
						...closeBracketsKeymap,
						...completionKeymap,
						...searchKeymap,
						indentWithTab
					]),
					updateListener,
					EditorView.lineWrapping
				]
			})
		});

		// Initial preview resolution
		if (internalValue) {
			resolvePreview(internalValue);
		}
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
		}
	});
</script>

<!-- Hidden input to carry the value in form submissions -->
<input type="hidden" {name} bind:this={hiddenInput} bind:value={internalValue} />

<div class="html-editor rounded-xl border border-slate-200 overflow-hidden bg-white">
	<!-- Toolbar -->
	<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
		<div class="flex items-center gap-1">
			<!-- Mode buttons -->
			<button
				type="button"
				on:click={() => mode = 'code'}
				class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {mode === 'code' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}"
			>
				<svg class="w-3.5 h-3.5 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
				Code
			</button>
			<button
				type="button"
				on:click={() => { mode = 'split'; schedulePreviewResolve(internalValue); }}
				class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {mode === 'split' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}"
			>
				<svg class="w-3.5 h-3.5 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" /></svg>
				Split
			</button>
			<button
				type="button"
				on:click={() => { mode = 'preview'; schedulePreviewResolve(internalValue); }}
				class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors {mode === 'preview' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}"
			>
				<svg class="w-3.5 h-3.5 inline -mt-0.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
				Preview
			</button>
		</div>

		<div class="flex items-center gap-2">
			<!-- Insert buttons -->
			{#if blocks.length > 0}
				<div class="relative">
					<button
						type="button"
						on:click={() => { showBlockPicker = !showBlockPicker; showLinkPicker = false; }}
						class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
					>
						<svg class="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
						Block
					</button>
					{#if showBlockPicker}
						<div class="absolute right-0 top-full mt-1 z-30 w-64 bg-white rounded-xl border border-slate-200 shadow-lg p-3">
							<p class="text-xs font-semibold text-slate-500 mb-2">Insert Content Block</p>
							<div class="max-h-48 overflow-y-auto space-y-1">
								{#each blocks as block}
									<button
										type="button"
										on:click={() => insertBlock(block.key || block.id)}
										class="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-purple-50 hover:text-purple-700 transition-colors text-slate-700"
									>
										<span class="font-medium">{block.title || block.key}</span>
										{#if block.tags?.length}
											<span class="ml-1 text-slate-400">· {block.tags.join(', ')}</span>
										{/if}
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			{#if links.length > 0}
				<div class="relative">
					<button
						type="button"
						on:click={() => { showLinkPicker = !showLinkPicker; showBlockPicker = false; }}
						class="px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
					>
						<svg class="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
						Link
					</button>
					{#if showLinkPicker}
						<div class="absolute right-0 top-full mt-1 z-30 w-64 bg-white rounded-xl border border-slate-200 shadow-lg p-3">
							<p class="text-xs font-semibold text-slate-500 mb-2">Insert Link Reference</p>
							<div class="max-h-48 overflow-y-auto space-y-1">
								{#each links as link}
									<button
										type="button"
										on:click={() => insertLink(link.key)}
										class="w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-amber-50 hover:text-amber-700 transition-colors text-slate-700"
									>
										<span class="font-medium">{link.name}</span>
										<span class="ml-1 text-slate-400 truncate">· {link.url}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Preview width (only in preview/split mode) -->
			{#if mode === 'preview' || mode === 'split'}
				<div class="flex items-center border border-slate-200 rounded-lg overflow-hidden ml-1">
					<button
						type="button"
						on:click={() => previewWidth = 'desktop'}
						class="px-2 py-1.5 text-xs transition-colors {previewWidth === 'desktop' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}"
						title="Desktop"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
					</button>
					<button
						type="button"
						on:click={() => previewWidth = 'tablet'}
						class="px-2 py-1.5 text-xs transition-colors {previewWidth === 'tablet' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}"
						title="Tablet (768px)"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
					</button>
					<button
						type="button"
						on:click={() => previewWidth = 'mobile'}
						class="px-2 py-1.5 text-xs transition-colors {previewWidth === 'mobile' ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:text-slate-600'}"
						title="Mobile (375px)"
					>
						<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Editor / Preview panels -->
	<div class="flex" style="min-height: {rows * 1.5}em;">
		<!-- Code editor (always rendered, hidden via CSS to preserve CodeMirror state) -->
		<div
			class="flex-1 overflow-auto {mode === 'split' ? 'border-r border-slate-200' : ''}"
			style="{mode === 'split' ? 'max-width: 50%;' : ''}{mode === 'preview' ? 'display: none;' : ''}"
			bind:this={editorEl}
		></div>

		<!-- Preview -->
		{#if mode === 'preview' || mode === 'split'}
			<div
				class="flex-1 bg-slate-50 overflow-auto flex justify-center p-4"
				style="min-height: {rows * 1.5}em; {mode === 'split' ? 'max-width: 50%;' : ''}"
			>
				<div
					class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden transition-all"
					style="width: {previewWidths[previewWidth]}; max-width: 100%;"
				>
					<!-- Email client chrome -->
					<div class="bg-slate-100 border-b border-slate-200 px-4 py-2">
						<div class="flex items-center gap-1.5 mb-2">
							<div class="w-2.5 h-2.5 rounded-full bg-red-400"></div>
							<div class="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
							<div class="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
						</div>
						<div class="text-xs text-slate-500">
							<div class="flex gap-2"><span class="font-medium text-slate-600 w-12">From:</span> <span>TheHUB &lt;noreply@thehub.app&gt;</span></div>
							<div class="flex gap-2"><span class="font-medium text-slate-600 w-12">To:</span> <span class="text-slate-400">recipient@example.com</span></div>
							<div class="flex gap-2"><span class="font-medium text-slate-600 w-12">Subject:</span> <span class="text-slate-700 font-medium">Email Preview</span></div>
						</div>
					</div>
					<iframe
						title="Email preview"
						class="w-full border-0"
						style="height: {Math.max(rows * 1.5, 25)}em;"
						sandbox=""
						srcdoc={previewSrcdoc}
					></iframe>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Close pickers on outside click -->
<svelte:window on:click={(e) => {
	if (showBlockPicker && !e.target.closest('.relative')) showBlockPicker = false;
	if (showLinkPicker && !e.target.closest('.relative')) showLinkPicker = false;
}} />

<style>
	.html-editor :global(.cm-editor) {
		height: 100%;
		border: none;
	}
	.html-editor :global(.cm-editor.cm-focused) {
		outline: none;
	}
</style>
