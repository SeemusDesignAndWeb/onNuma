<script>
	import { page } from '$app/stores';
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
	import { goto } from '$app/navigation';
	
	$: newsletter = $page.data?.newsletter;
	$: contacts = $page.data?.contacts || [];
	$: selectedContact = $page.data?.selectedContact;
	$: personalizedContent = $page.data?.personalizedContent;
	
	function getStatusBadgeClass(status) {
		switch (status) {
			case 'sent':
				return 'bg-hub-green-100 text-hub-green-800 border-hub-green-300';
			case 'draft':
				return 'bg-gray-100 text-gray-800 border-gray-300';
			case 'scheduled':
				return 'bg-hub-blue-100 text-hub-blue-800 border-hub-blue-300';
			default:
				return 'bg-gray-100 text-gray-800 border-gray-300';
		}
	}
	
	function getStatusLabel(status) {
		return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Draft';
	}
	
	function handleContactChange(event) {
		const contactId = event.target.value;
		const url = new URL(window.location.href);
		if (contactId) {
			url.searchParams.set('contactId', contactId);
		} else {
			url.searchParams.delete('contactId');
		}
		goto(url.pathname + url.search);
	}
	
	function getContactDisplayName(contact) {
		if (contact.firstName || contact.lastName) {
			return `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
		}
		return contact.email || 'Unknown';
	}
</script>

{#if newsletter}
	<div class="space-y-6">
		<!-- Header Card -->
		<div class="bg-gradient-to-r from-hub-blue-500 to-hub-blue-600 shadow-lg rounded-lg p-6 text-white">
			<div class="flex justify-between items-start mb-4">
				<div class="flex-1">
					<h1 class="text-3xl font-bold mb-2 text-white">{newsletter.subject || 'Untitled Email'}</h1>
					<div class="flex items-center gap-4 mt-3 text-white">
						<span class="text-sm">
							<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							{#if newsletter.createdAt}
								Created: {formatDateTimeUK(newsletter.createdAt)}
							{/if}
						</span>
						{#if newsletter.updatedAt && newsletter.updatedAt !== newsletter.createdAt}
							<span class="text-sm">
								<svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								Updated: {formatDateTimeUK(newsletter.updatedAt)}
							</span>
						{/if}
					</div>
				</div>
				<div class="flex flex-col items-end gap-2">
					<span class="px-3 py-1 rounded-full text-sm font-semibold border-2 bg-white/20 text-white border-white/30">
						{getStatusLabel(newsletter.status)}
					</span>
					{#if newsletter.logs && newsletter.logs.length > 0}
						<span class="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white border border-white/30">
							{newsletter.logs.length} {newsletter.logs.length === 1 ? 'send' : 'sends'}
						</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Preview Card -->
		<div class="bg-white shadow-lg rounded-lg overflow-hidden border-2 border-gray-200">
			<div class="bg-gray-50 border-b border-gray-200 px-[18px] py-2.5">
				<div class="flex justify-between items-center">
					<h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
						<svg class="w-5 h-5 text-hub-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
						</svg>
						Email Preview
					</h2>
					<div class="text-xs text-gray-500">
						{#if selectedContact}
							Previewing as: {getContactDisplayName(selectedContact)}
						{:else}
							This is how the email will appear to recipients
						{/if}
					</div>
				</div>
			</div>
			<div class="px-6 py-4 bg-white border-b border-gray-200">
				<div class="flex items-center gap-3">
					<label for="contact-selector" class="text-sm font-medium text-gray-700">
						Preview as user:
					</label>
					<select
						id="contact-selector"
						on:change={handleContactChange}
						value={selectedContact?.id || ''}
						class="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-hub-blue-500 focus:border-hub-blue-500 text-sm"
					>
						<option value="">-- Select a user to preview --</option>
						{#each contacts as contact}
							<option value={contact.id}>
								{getContactDisplayName(contact)} {contact.email ? `(${contact.email})` : ''}
							</option>
						{/each}
					</select>
					{#if selectedContact}
						<button
							on:click={() => {
								const url = new URL(window.location.href);
								url.searchParams.delete('contactId');
								goto(url.pathname + url.search);
							}}
							class="text-sm text-gray-600 hover:text-gray-800 underline"
						>
							Clear selection
						</button>
					{/if}
				</div>
			</div>
			<div class="p-8 bg-gray-50">
				<div class="max-w-2xl mx-auto bg-white shadow-md rounded-lg overflow-hidden">
					<div class="newsletter-preview p-6">
						{#if personalizedContent}
							{@html personalizedContent}
						{:else}
							{@html newsletter.htmlContent || newsletter.textContent || '<p class="text-gray-500 italic">No content available</p>'}
						{/if}
					</div>
				</div>
			</div>
		</div>

		<!-- Action Bar -->
		<div class="bg-white shadow rounded-lg p-4">
			<div class="flex justify-between items-center">
				<a href="/hub/emails/{newsletter.id}" class="inline-flex items-center gap-2 text-hub-blue-600 hover:text-hub-blue-800 font-medium transition-colors">
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
					</svg>
					Back to Email
				</a>
				<div class="flex gap-2">
					<a 
						href="/hub/emails/{newsletter.id}/export-pdf" 
						target="_blank"
						class="bg-hub-red-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-red-700 transition-colors font-medium inline-flex items-center gap-2"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
						</svg>
						Export PDF
					</a>
					<a href="/hub/emails/{newsletter.id}" class="bg-hub-green-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-green-700 transition-colors font-medium">
						Edit Email
					</a>
					{#if newsletter.status === 'draft' || !newsletter.status}
						<a href="/hub/emails/{newsletter.id}/send" class="bg-hub-blue-600 text-white px-[18px] py-2.5 rounded-md hover:bg-hub-blue-700 transition-colors font-medium">
							Send Email
						</a>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.newsletter-preview .ql-align-center) {
		text-align: center;
	}
	
	:global(.newsletter-preview .ql-align-right) {
		text-align: right;
	}
	
	:global(.newsletter-preview .ql-align-justify) {
		text-align: justify;
	}
	
	:global(.newsletter-preview .ql-align-left) {
		text-align: left;
	}
	
	/* Ensure consistent text color unless explicitly set in editor */
	/* Set default color on container - inline styles will override */
	:global(.newsletter-preview) {
		color: #1f2937; /* gray-800 - consistent default color */
	}
	
	/* Apply consistent color to all text elements - inline styles will override */
	:global(.newsletter-preview p) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview span) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview div) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview li) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview td) {
		color: #1f2937;
	}
	
	:global(.newsletter-preview th) {
		color: #1f2937;
	}
	
	/* Ensure consistent heading sizes matching editor and PDF */
	:global(.newsletter-preview h1) {
		font-size: 2em;
		line-height: 1.2;
		font-weight: 600;
		margin-top: 0.67em;
		margin-bottom: 0.67em;
		color: #1f2937; /* Consistent heading color - inline styles will override */
	}
	
	:global(.newsletter-preview h2) {
		font-size: 1.5em;
		line-height: 1.3;
		font-weight: 600;
		margin-top: 0.83em;
		margin-bottom: 0.83em;
		color: #1f2937; /* Consistent heading color - inline styles will override */
	}
	
	:global(.newsletter-preview h3) {
		font-size: 1.17em;
		line-height: 1.4;
		font-weight: 600;
		margin-top: 1em;
		margin-bottom: 1em;
		color: #1f2937; /* Consistent heading color - inline styles will override */
	}
	
	:global(.newsletter-preview h4) {
		font-size: 1em;
		line-height: 1.5;
		font-weight: 600;
		margin-top: 1.33em;
		margin-bottom: 1.33em;
		color: #1f2937; /* Consistent heading color - inline styles will override */
	}
</style>
