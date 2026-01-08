<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let docs = [];
	let selectedDoc = null;
	let content = '';
	let isHtml = false;
	let userGuideDropdownOpen = false;

	const userGuideSections = [
		{ id: 'getting-started', title: 'Getting Started', subsections: [
			{ id: 'login', title: 'Login' },
			{ id: 'forgot-password', title: 'Forgot Password' },
			{ id: 'dashboard', title: 'Dashboard' }
		]},
		{ id: 'admin-users', title: 'Admin Users', subsections: [
			{ id: 'managing-admin-users', title: 'Managing Admin Users' },
			{ id: 'creating-admin-users', title: 'Creating Admin Users' },
			{ id: 'editing-admin-users', title: 'Editing Admin Users' },
			{ id: 'admin-profile', title: 'Admin Profile' }
		]},
		{ id: 'contacts', title: 'Contacts', subsections: [
			{ id: 'creating-a-contact', title: 'Creating a Contact' },
			{ id: 'editing-a-contact', title: 'Editing a Contact' },
			{ id: 'importing-contacts', title: 'Importing Contacts' },
			{ id: 'managing-contacts', title: 'Managing Contacts' }
		]},
		{ id: 'lists', title: 'Lists', subsections: [
			{ id: 'creating-a-list', title: 'Creating a List' },
			{ id: 'adding-contacts-to-lists', title: 'Adding Contacts to Lists' },
			{ id: 'removing-contacts-from-lists', title: 'Removing Contacts from Lists' },
			{ id: 'managing-lists', title: 'Managing Lists' }
		]},
		{ id: 'newsletters', title: 'Newsletters', subsections: [
			{ id: 'creating-a-newsletter', title: 'Creating a Newsletter' },
			{ id: 'editing-a-newsletter', title: 'Editing a Newsletter' },
			{ id: 'previewing-a-newsletter', title: 'Previewing a Newsletter' },
			{ id: 'exporting-a-newsletter-to-pdf', title: 'Exporting to PDF' },
			{ id: 'sending-a-newsletter', title: 'Sending a Newsletter' },
			{ id: 'deleting-a-newsletter', title: 'Deleting a Newsletter' },
			{ id: 'newsletter-templates', title: 'Newsletter Templates' },
			{ id: 'html-editor-features', title: 'HTML Editor Features' }
		]},
		{ id: 'events', title: 'Events', subsections: [
			{ id: 'creating-an-event', title: 'Creating an Event' },
			{ id: 'event-calendar-views', title: 'Event Calendar Views' },
			{ id: 'adding-occurrences', title: 'Adding Occurrences' },
			{ id: 'editing-occurrences', title: 'Editing Occurrences' },
			{ id: 'downloading-events', title: 'Downloading Events' }
		]},
		{ id: 'rotas', title: 'Rotas', subsections: [
			{ id: 'creating-a-rota', title: 'Creating a Rota' },
			{ id: 'managing-rotas', title: 'Managing Rotas' },
			{ id: 'bulk-invitations', title: 'Bulk Invitations' }
		]},
		{ id: 'forms', title: 'Forms', subsections: [
			{ id: 'creating-a-form', title: 'Creating a Form' },
			{ id: 'viewing-form-submissions', title: 'Viewing Form Submissions' },
			{ id: 'public-form-submission', title: 'Public Form Submission' }
		]},
		{ id: 'public-signup', title: 'Public Signup' },
		{ id: 'help-and-documentation', title: 'Help and Documentation' },
		{ id: 'tips-and-best-practices', title: 'Tips and Best Practices' },
		{ id: 'keyboard-shortcuts', title: 'Keyboard Shortcuts' },
		{ id: 'troubleshooting', title: 'Troubleshooting' },
		{ id: 'additional-resources', title: 'Additional Resources' },
		{ id: 'recent-updates', title: 'Recent Updates' }
	];

	onMount(async () => {
		try {
			const response = await fetch('/docs/index.md');
			if (response.ok) {
				const text = await response.text();
				docs = [{ name: 'Index', path: 'index.md', content: text }];
				selectedDoc = docs[0];
				content = text;
				isHtml = false;
			}
		} catch (error) {
			console.error('Error loading docs:', error);
		}
	});

	async function loadDoc(path) {
		try {
			const response = await fetch(`/docs/${path}`);
			if (response.ok) {
				let text = await response.text();
				isHtml = path.endsWith('.html');
				
				if (isHtml) {
					// Extract the content, styles, and scripts from the HTML file
					const parser = new DOMParser();
					const doc = parser.parseFromString(text, 'text/html');
					const contentElement = doc.querySelector('.content');
					const styles = doc.querySelector('style');
					const scripts = doc.querySelectorAll('script');
					
					if (contentElement) {
						// Combine styles, content, and scripts
						let scriptContent = '';
						scripts.forEach(script => {
							if (script.textContent) {
								scriptContent += `<script>${script.textContent}</` + `script>`;
							}
						});
						
						content = `
${styles ? styles.outerHTML : ''}
${contentElement.outerHTML}
${scriptContent}
						`;
					} else {
						content = text;
					}
				} else {
					content = text;
				}
			}
		} catch (error) {
			console.error('Error loading doc:', error);
		}
	}

	async function scrollToSection(sectionId) {
		userGuideDropdownOpen = false;
		
		// First ensure User Guide is loaded
		if (!isHtml || !content.includes(`id="${sectionId}"`)) {
			await loadDoc('USER_GUIDE.html');
		}
		
		// Wait for DOM to update, then scroll
		setTimeout(() => {
			const contentContainer = document.querySelector('[class*="overflow-y-auto"]');
			if (contentContainer) {
				const element = contentContainer.querySelector(`#${sectionId}`);
				if (element) {
					element.scrollIntoView({ behavior: 'smooth', block: 'start' });
					// Also scroll the container to ensure visibility
					const containerRect = contentContainer.getBoundingClientRect();
					const elementRect = element.getBoundingClientRect();
					if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) {
						contentContainer.scrollTop = element.offsetTop - 20;
					}
				}
			}
		}, 150);
	}

	function toggleUserGuideDropdown() {
		userGuideDropdownOpen = !userGuideDropdownOpen;
	}

	function handleClickOutside(event) {
		if (!event.target.closest('.user-guide-dropdown')) {
			userGuideDropdownOpen = false;
		}
	}
</script>

<div class="flex flex-col h-full" on:click={handleClickOutside}>
	<nav class="bg-white shadow-sm border-b border-gray-200 px-6 py-4 mb-6">
		<div class="flex flex-wrap items-center gap-4">
			<span class="text-sm font-semibold text-gray-700 mr-2">Documentation:</span>
			
			<!-- User Guide Dropdown -->
			<div class="relative user-guide-dropdown">
				<button
					on:click={toggleUserGuideDropdown}
					class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-1"
				>
					User Guide
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
				
				{#if userGuideDropdownOpen}
					<div class="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
						<div class="py-1">
							<button
								on:click={() => { userGuideDropdownOpen = false; loadDoc('USER_GUIDE.html'); }}
								class="w-full text-left px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50 border-b border-gray-200"
							>
								User Guide (Full)
							</button>
							{#each userGuideSections as section}
								<div>
									<button
										on:click={() => scrollToSection(section.id)}
										class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-between"
									>
										<span class="font-medium">{section.title}</span>
										{#if section.subsections}
											<svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
											</svg>
										{/if}
									</button>
									{#if section.subsections}
										<div class="pl-4 bg-gray-50">
											{#each section.subsections as subsection}
												<button
													on:click={() => scrollToSection(subsection.id)}
													class="w-full text-left px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
												>
													{subsection.title}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
			
			<a href="/docs/ADMIN_GUIDE.md" on:click|preventDefault={() => loadDoc('ADMIN_GUIDE.md')} class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors">Admin Guide</a>
			<a href="/docs/TECHNICAL.md" on:click|preventDefault={() => loadDoc('TECHNICAL.md')} class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors">Technical</a>
			<a href="/docs/SECURITY.md" on:click|preventDefault={() => loadDoc('SECURITY.md')} class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors">Security Guide</a>
			<a href="/docs/SECURITY_AUDIT.md" on:click|preventDefault={() => loadDoc('SECURITY_AUDIT.md')} class="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors font-semibold">Security Audit</a>
		</div>
	</nav>
	<div class="flex-1 bg-white shadow rounded-lg overflow-hidden">
		{#if isHtml}
			<div class="h-full overflow-y-auto max-h-[calc(100vh-16rem)]" style="padding: 20px;">
				{@html content || 'Select a document to view'}
			</div>
		{:else}
			<div class="prose max-w-none h-full overflow-y-auto max-h-[calc(100vh-16rem)] p-6">
				<pre class="whitespace-pre-wrap">{content || 'Select a document to view'}</pre>
			</div>
		{/if}
	</div>
</div>

