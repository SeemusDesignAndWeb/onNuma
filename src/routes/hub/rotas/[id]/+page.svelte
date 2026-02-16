<script>
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import FormField from '$lib/crm/components/FormField.svelte';
	import HtmlEditor from '$lib/crm/components/HtmlEditor.svelte';
	import Table from '$lib/crm/components/Table.svelte';
	import { notifications } from '$lib/crm/stores/notifications.js';
	import { dialog } from '$lib/crm/stores/notifications.js';

	$: rota = $page.data?.rota;
	$: rawRota = $page.data?.rawRota || rota; // Raw rota with original assignees format
	$: event = $page.data?.event;
	$: occurrence = $page.data?.occurrence;
	$: eventOccurrences = $page.data?.eventOccurrences || [];
	$: assigneesByOccurrence = $page.data?.assigneesByOccurrence || {};
	$: availableContacts = $page.data?.availableContacts || [];
	
	// Filter assigneesByOccurrence to only include current and future occurrences
	$: upcomingOccurrenceIds = new Set(eventOccurrences.map(occ => occ.id));
	$: filteredAssigneesByOccurrence = Object.keys(assigneesByOccurrence)
		.filter(occId => occId === 'unassigned' || upcomingOccurrenceIds.has(occId))
		.reduce((acc, occId) => {
			acc[occId] = assigneesByOccurrence[occId];
			return acc;
		}, {});
	
	// Calculate total assignees for current and future occurrences only (exclude unassigned from occurrence count)
	$: totalUpcomingAssignees = Object.entries(filteredAssigneesByOccurrence)
		.filter(([occId]) => occId !== 'unassigned')
		.reduce((sum, [, assignees]) => sum + (Array.isArray(assignees) ? assignees.length : 0), 0);
	$: upcomingOccurrenceCount = Object.keys(filteredAssigneesByOccurrence)
		.filter(key => key !== 'unassigned').length;
	$: lists = $page.data?.lists || [];
	$: owner = $page.data?.owner || null;
	$: signupLink = $page.data?.signupLink || '';
	$: csrfToken = $page.data?.csrfToken || '';
	$: formResult = $page.form;
	$: helpFiles = rota?.helpFiles || [];
	
	import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

	let linkCopied = false;

	async function copySignupLink() {
		if (!signupLink) return;
		try {
			await navigator.clipboard.writeText(signupLink);
			linkCopied = true;
			notifications.success('Signup link copied to clipboard!');
			setTimeout(() => {
				linkCopied = false;
			}, 2000);
		} catch (error) {
			notifications.error('Failed to copy link');
		}
	}
	
	// Track last processed form result to avoid duplicate notifications
	let lastProcessedFormResult = null;

		// Show notifications from form results
	$: if (formResult && browser && formResult !== lastProcessedFormResult) {
		lastProcessedFormResult = formResult;
		
		if (formResult?.success) {
			if (formResult?.type === 'addAssignees' || formResult?.type === 'removeAssignee') {
				const message = formResult.message || (formResult.type === 'addAssignees' ? 'Assignees added successfully' : 'Assignee removed successfully');
				notifications.success(message);
				// Reload to refresh the assignee list - only on client
				if (browser) {
					setTimeout(() => {
						invalidateAll();
					}, 500);
				}
			} else if (formResult?.type === 'addHelpFile' || formResult?.type === 'removeHelpFile') {
				const message = formResult.type === 'addHelpFile' ? 'Help file added successfully' : 'Help file removed successfully';
				notifications.success(message);
				// Reset form state
				showAddHelpFile = false;
				helpFileUrl = '';
				helpFileTitle = '';
				helpFileFile = null;
				helpFileUploading = false;
				// Reload to refresh the help files list - only on client
				if (browser) {
					setTimeout(() => {
						invalidateAll();
					}, 500);
				}
			} else if (formResult?.type !== 'addAssignees' && formResult?.type !== 'removeAssignee' && formResult?.type !== 'addHelpFile' && formResult?.type !== 'removeHelpFile') {
				notifications.success('Rota updated successfully');
				// Exit editing mode after successful save
				editing = false;
				// Invalidate to get fresh data, but preserve formData until data loads
				if (browser) {
					setTimeout(() => {
						invalidateAll();
					}, 100);
				}
			}
		} else if (formResult?.error) {
			notifications.error(formResult.error);
		}
	}

	let editing = false;
	let notes = rota?.notes || '';
	let ownerSearchTerm = '';
	let filteredOwnerContacts = [];
	let formData = {
		role: rota?.role || '',
		capacity: rota?.capacity || 1,
		ownerId: rota?.ownerId || '',
		visibility: rota?.visibility || 'public'
	};

	// Only update formData when rota changes AND we're not editing
	// This prevents the form from being cleared after a successful save
	$: if (rota && !editing) {
		// Only update if the values have actually changed to avoid unnecessary resets
		if (formData.role !== rota.role || 
		    formData.capacity !== rota.capacity || 
		    formData.ownerId !== rota.ownerId ||
		    formData.visibility !== (rota.visibility || 'public') ||
		    notes !== rota.notes) {
			formData = {
				role: rota.role || '',
				capacity: rota.capacity || 1,
				ownerId: rota.ownerId || '',
				visibility: rota.visibility || 'public'
			};
			notes = rota.notes || '';
		}
	}

	// Helper function to sort contacts by first name, then last name
	function sortContacts(contacts) {
		return contacts.sort((a, b) => {
			const aFirstName = (a.firstName || '').toLowerCase();
			const bFirstName = (b.firstName || '').toLowerCase();
			const aLastName = (a.lastName || '').toLowerCase();
			const bLastName = (b.lastName || '').toLowerCase();
			
			if (aFirstName !== bFirstName) {
				return aFirstName.localeCompare(bFirstName);
			}
			return aLastName.localeCompare(bLastName);
		});
	}

	$: filteredOwnerContacts = (() => {
		if (!availableContacts || availableContacts.length === 0) {
			return [];
		}
		
		// Start with all contacts or filtered by search term
		let filtered = ownerSearchTerm
			? availableContacts.filter(c => 
				(c.email || '').toLowerCase().includes(ownerSearchTerm.toLowerCase()) ||
				(c.firstName || '').toLowerCase().includes(ownerSearchTerm.toLowerCase()) ||
				(c.lastName || '').toLowerCase().includes(ownerSearchTerm.toLowerCase())
			)
			: [...availableContacts]; // Create a copy to avoid mutation issues
		
		// Always include the currently selected owner if they exist, even if they don't match the search
		if (formData.ownerId) {
			const selectedOwner = availableContacts.find(c => c.id === formData.ownerId);
			if (selectedOwner) {
				// Check if selected owner is already in the filtered list
				const isInFiltered = filtered.some(c => c.id === selectedOwner.id);
				if (!isInFiltered) {
					// Add selected owner at the beginning
					filtered = [selectedOwner, ...filtered];
				}
			}
		}
		
		// Sort by last name, then first name
		return sortContacts([...filtered]);
	})();

	async function handleDelete() {
		const confirmed = await dialog.confirm('Are you sure you want to delete this rota?', 'Delete Rota');
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/delete';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			document.body.appendChild(form);
			form.submit();
		}
	}

	const assigneeColumns = [
		{ 
			key: 'name', 
			label: 'Name',
			render: (val, row) => {
				if (row.id) {
					return `<a href="/hub/contacts/${row.id}" class="text-hub-green-600 hover:text-hub-green-700 underline">${val || 'Unknown'}</a>`;
				}
				return val || 'Unknown';
			}
		}
	];

	let showAddAssignees = false;
	let searchTerm = '';
	let guestName = '';
	let selectedContactIds = new Set();
	let selectedOccurrenceId = '';
	let selectedListId = '';
	
	// Help Files
	let showAddHelpFile = false;
	let helpFileType = 'link'; // 'link' or 'file'
	let helpFileUrl = '';
	let helpFileTitle = '';
	let helpFileUploading = false;
	let helpFileFile = null;
	
	// Initialize selected occurrence reactively (only if not already set)
	$: if (rota && eventOccurrences && !selectedOccurrenceId) {
		if (rota.occurrenceId) {
			selectedOccurrenceId = rota.occurrenceId;
		} else if (eventOccurrences.length > 0) {
			selectedOccurrenceId = eventOccurrences[0].id;
		}
	}
	
	// Filter contacts by list if a list is selected
	$: contactsFilteredByList = selectedListId
		? (() => {
			const selectedList = lists.find(l => l.id === selectedListId);
			if (!selectedList || !selectedList.contactIds) return availableContacts;
			return availableContacts.filter(c => selectedList.contactIds.includes(c.id));
		})()
		: availableContacts;
	
	$: filteredAvailableContacts = (() => {
		const filtered = searchTerm
			? contactsFilteredByList.filter(c => 
				(c.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
				(c.lastName || '').toLowerCase().includes(searchTerm.toLowerCase())
			)
			: contactsFilteredByList;
		// Sort by last name, then first name
		return sortContacts([...filtered]);
	})();
	
	function toggleContactSelection(contactId) {
		if (selectedContactIds.has(contactId)) {
			selectedContactIds.delete(contactId);
		} else {
			selectedContactIds.add(contactId);
		}
		selectedContactIds = selectedContactIds; // Trigger reactivity
	}
	
	function selectAllContacts() {
		filteredAvailableContacts.forEach(contact => {
			selectedContactIds.add(contact.id);
		});
		selectedContactIds = selectedContactIds; // Trigger reactivity
	}
	
	function deselectAllContacts() {
		filteredAvailableContacts.forEach(contact => {
			selectedContactIds.delete(contact.id);
		});
		selectedContactIds = selectedContactIds; // Trigger reactivity
	}
	
	async function handleAddAssignees() {
		if (selectedContactIds.size === 0) {
			await dialog.alert('Please select at least one contact to assign', 'No Contacts Selected');
			return;
		}

		// Check for conflicts if an occurrence is selected
		if (selectedOccurrenceId) {
			try {
				const response = await fetch('/api/rotas/check-availability', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contactIds: Array.from(selectedContactIds),
						occurrenceId: selectedOccurrenceId,
						currentRotaId: rota.id
					})
				});

				if (response.ok) {
					const { conflicts } = await response.json();
					if (conflicts && conflicts.length > 0) {
						let conflictMessage = 'The following issues were found:\n\n';
						conflicts.forEach(c => {
							if (c.type === 'holiday') {
								conflictMessage += `- ${c.contactName} is AWAY (booked holiday)\n`;
							} else {
								conflictMessage += `- ${c.contactName}: ${c.rotaRole} for ${c.eventName}\n`;
							}
						});
						conflictMessage += '\nAre you sure you want to proceed with these assignments?';

						const confirmed = await dialog.confirm(conflictMessage, 'Potential Rota Conflict');
						if (!confirmed) return;
					}
				}
			} catch (error) {
				console.error('Error checking availability:', error);
				// Continue with assignment if check fails - better to allow than to block
			}
		}
		
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/addAssignees';
		
		const csrfInput = document.createElement('input');
		csrfInput.type = 'hidden';
		csrfInput.name = '_csrf';
		csrfInput.value = csrfToken;
		form.appendChild(csrfInput);
		
		const contactIdsInput = document.createElement('input');
		contactIdsInput.type = 'hidden';
		contactIdsInput.name = 'contactIds';
		contactIdsInput.value = JSON.stringify(Array.from(selectedContactIds));
		form.appendChild(contactIdsInput);
		
		// Add occurrenceId if explicitly selected (when rota is for all occurrences, or when adding to a specific occurrence)
		// Always send it when selectedOccurrenceId is set, so the server knows which occurrence we're targeting
		if (selectedOccurrenceId) {
			const occurrenceIdInput = document.createElement('input');
			occurrenceIdInput.type = 'hidden';
			occurrenceIdInput.name = 'occurrenceId';
			occurrenceIdInput.value = selectedOccurrenceId;
			form.appendChild(occurrenceIdInput);
		}
		
		document.body.appendChild(form);
		form.submit();
	}

	async function handleAddGuest() {
		if (!guestName) {
			await dialog.alert('Please enter a guest name', 'Missing Name');
			return;
		}

		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/addAssignees';
		
		const csrfInput = document.createElement('input');
		csrfInput.type = 'hidden';
		csrfInput.name = '_csrf';
		csrfInput.value = csrfToken;
		form.appendChild(csrfInput);
		
		const contactIdsInput = document.createElement('input');
		contactIdsInput.type = 'hidden';
		contactIdsInput.name = 'contactIds';
		contactIdsInput.value = JSON.stringify([]);
		form.appendChild(contactIdsInput);

		const guestInput = document.createElement('input');
		guestInput.type = 'hidden';
		guestInput.name = 'guest';
		guestInput.value = JSON.stringify({ name: guestName });
		form.appendChild(guestInput);
		
		if (selectedOccurrenceId) {
			const occurrenceIdInput = document.createElement('input');
			occurrenceIdInput.type = 'hidden';
			occurrenceIdInput.name = 'occurrenceId';
			occurrenceIdInput.value = selectedOccurrenceId;
			form.appendChild(occurrenceIdInput);
		}
		
		document.body.appendChild(form);
		form.submit();
	}

	async function handleRemoveAssignee(assignee) {
		const confirmed = await dialog.confirm('Are you sure you want to remove this assignee?', 'Remove Assignee');
		if (confirmed) {
			console.log('[REMOVE ASSIGNEE] Starting removal process');
			console.log('[REMOVE ASSIGNEE] Assignee to remove:', JSON.stringify(assignee, null, 2));
			
			// Find the assignee in the original rota.assignees array
			// Use the raw rota data with original assignees format
			const rawAssignees = rawRota?.assignees || [];
			console.log('[REMOVE ASSIGNEE] Raw assignees array:', JSON.stringify(rawAssignees, null, 2));
			console.log('[REMOVE ASSIGNEE] Rota occurrenceId:', rota?.occurrenceId);
			console.log('[REMOVE ASSIGNEE] Raw rota object:', JSON.stringify(rawRota, null, 2));
			
			let originalIndex = -1;
			
			// Normalize occurrenceId for comparison
			const assigneeOccId = (assignee.occurrenceId === null || assignee.occurrenceId === undefined) ? null : assignee.occurrenceId;
			console.log('[REMOVE ASSIGNEE] Normalized assignee occurrenceId:', assigneeOccId);
			
			originalIndex = rawAssignees.findIndex((a, index) => {
				console.log(`[REMOVE ASSIGNEE] Checking index ${index}:`, JSON.stringify(a, null, 2));
				
				// Match by id/contactId/email and occurrenceId
				if (typeof a === 'string') {
					console.log(`[REMOVE ASSIGNEE] Index ${index}: Old format (string), value: "${a}", assignee.id: "${assignee.id}"`);
					// Old format - string is the contact ID
					// For old format, if rota has occurrenceId, use it; otherwise match any occurrenceId
					if (assignee.id && a === assignee.id) {
						console.log(`[REMOVE ASSIGNEE] Index ${index}: ID matches!`);
						// If rota is for a specific occurrence, check it matches
						if (rota.occurrenceId !== null && rota.occurrenceId !== undefined) {
							const matches = rota.occurrenceId === assigneeOccId;
							console.log(`[REMOVE ASSIGNEE] Index ${index}: Rota has occurrenceId ${rota.occurrenceId}, assignee has ${assigneeOccId}, match: ${matches}`);
							return matches;
						}
						// If rota is for all occurrences, match if assigneeOccId is null or matches rota's default
						const matches = assigneeOccId === null || assigneeOccId === rota.occurrenceId;
						console.log(`[REMOVE ASSIGNEE] Index ${index}: Rota for all occurrences, match: ${matches}`);
						return matches;
					}
					console.log(`[REMOVE ASSIGNEE] Index ${index}: ID does not match`);
					return false;
				}
				if (a && typeof a === 'object') {
					console.log(`[REMOVE ASSIGNEE] Index ${index}: New format (object)`);
					// New format - could be { contactId, occurrenceId } or { name, email, occurrenceId } for public signups
					const aOccurrenceId = (a.occurrenceId === null || a.occurrenceId === undefined) ? null : a.occurrenceId;
					console.log(`[REMOVE ASSIGNEE] Index ${index}: Object occurrenceId: ${aOccurrenceId}, assignee occurrenceId: ${assigneeOccId}`);
					
					// First check occurrenceId matches
					if (aOccurrenceId !== assigneeOccId) {
						console.log(`[REMOVE ASSIGNEE] Index ${index}: OccurrenceId does not match`);
						return false;
					}
					
					// Check if contactId is a string (contact) or object (public signup)
					if (typeof a.contactId === 'string') {
						// This is a contact assignee - contactId is a string ID
						if (assignee.id !== null && assignee.id !== undefined) {
							const aId = a.contactId || a.id;
							console.log(`[REMOVE ASSIGNEE] Index ${index}: Contact assignee - aId: "${aId}", assignee.id: "${assignee.id}"`);
							if (aId === assignee.id) {
								console.log(`[REMOVE ASSIGNEE] Index ${index}: Contact ID matches!`);
								return true;
							}
							console.log(`[REMOVE ASSIGNEE] Index ${index}: Contact ID does not match`);
						}
					} else if (a.contactId && typeof a.contactId === 'object') {
						// This is a public signup or guest - contactId is an object with { name, email }
						if (assignee.id === null || assignee.id === undefined) {
							const aEmail = a.contactId.email || a.email || '';
							const aName = a.contactId.name || a.name || '';
							const assigneeEmail = assignee.email || '';
							const assigneeName = assignee.name || '';
							
							console.log(`[REMOVE ASSIGNEE] Index ${index}: Public signup/guest - aEmail: "${aEmail}", assigneeEmail: "${assigneeEmail}"`);
							
							const emailMatch = aEmail.toLowerCase() === assigneeEmail.toLowerCase();
							const nameMatch = aName === assigneeName;
							console.log(`[REMOVE ASSIGNEE] Index ${index}: Email match: ${emailMatch}, Name match: ${nameMatch}`);
							
							if (emailMatch && nameMatch) {
								console.log(`[REMOVE ASSIGNEE] Index ${index}: Match found!`);
								return true;
							}
						}
					} else if (a.email && a.name) {
						// Legacy format: { name, email, occurrenceId } directly on the object
						if (assignee.id === null || assignee.id === undefined) {
							const aEmail = a.email || '';
							const aName = a.name || '';
							const assigneeEmail = assignee.email || '';
							const assigneeName = assignee.name || '';
							
							if (aEmail.toLowerCase() === assigneeEmail.toLowerCase() && aName === assigneeName) {
								return true;
							}
						}
					}
					return false;
				}
				console.log(`[REMOVE ASSIGNEE] Index ${index}: Unknown format`);
				return false;
			});
			
			console.log('[REMOVE ASSIGNEE] Final index found:', originalIndex);
			
			if (originalIndex === -1) {
				console.error('[REMOVE ASSIGNEE] Could not find assignee to remove');
				console.error('[REMOVE ASSIGNEE] Assignee object:', JSON.stringify(assignee, null, 2));
				console.error('[REMOVE ASSIGNEE] Raw assignees:', JSON.stringify(rawAssignees, null, 2));
				console.error('[REMOVE ASSIGNEE] Rota occurrenceId:', rota?.occurrenceId);
				console.error('[REMOVE ASSIGNEE] Assignee occurrenceId:', assigneeOccId);
				notifications.error('Could not find assignee to remove. Check console for details.');
				return;
			}
		// Use fetch to call the action without navigating away (prevents scroll jump)
		const formData = new FormData();
		formData.append('_csrf', csrfToken);
		formData.append('index', originalIndex);

		try {
			const response = await fetch('?/removeAssignee', {
				method: 'POST',
				headers: { accept: 'application/json' },
				body: formData
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData?.error || 'Failed to remove assignee');
			}

			const result = await response.json();
			notifications.success(result?.message || 'Assignee removed successfully');

			if (browser) {
				// Refresh data but keep the user’s scroll position
				setTimeout(() => {
					invalidateAll();
				}, 100);
			}
		} catch (error) {
			console.error('[REMOVE ASSIGNEE] Error during removal:', error);
			notifications.error(error?.message || 'Failed to remove assignee');
		}
		}
	}

	async function handleAddHelpFile() {
		if (helpFileType === 'link') {
			if (!helpFileUrl || !helpFileTitle) {
				await dialog.alert('Please provide both URL and title', 'Validation Error');
				return;
			}

			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/addHelpFile';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			const typeInput = document.createElement('input');
			typeInput.type = 'hidden';
			typeInput.name = 'type';
			typeInput.value = 'link';
			form.appendChild(typeInput);
			
			const urlInput = document.createElement('input');
			urlInput.type = 'hidden';
			urlInput.name = 'url';
			urlInput.value = helpFileUrl;
			form.appendChild(urlInput);
			
			const titleInput = document.createElement('input');
			titleInput.type = 'hidden';
			titleInput.name = 'title';
			titleInput.value = helpFileTitle;
			form.appendChild(titleInput);
			
			document.body.appendChild(form);
			form.submit();
		} else {
			// File upload
			if (!helpFileFile) {
				await dialog.alert('Please select a PDF file', 'Validation Error');
				return;
			}

			helpFileUploading = true;
			try {
				// First upload the file
				const uploadFormData = new FormData();
				uploadFormData.append('file', helpFileFile);

				const uploadResponse = await fetch(`/hub/rotas/${rota.id}/help-files/upload`, {
					method: 'POST',
					body: uploadFormData
				});

				if (!uploadResponse.ok) {
					const errorData = await uploadResponse.json().catch(() => ({}));
					throw new Error(errorData?.error || 'Failed to upload file');
				}

				const uploadResult = await uploadResponse.json();

				// Then add the help file to the rota
				const form = document.createElement('form');
				form.method = 'POST';
				form.action = '?/addHelpFile';
				
				const csrfInput = document.createElement('input');
				csrfInput.type = 'hidden';
				csrfInput.name = '_csrf';
				csrfInput.value = csrfToken;
				form.appendChild(csrfInput);
				
				const typeInput = document.createElement('input');
				typeInput.type = 'hidden';
				typeInput.name = 'type';
				typeInput.value = 'file';
				form.appendChild(typeInput);
				
				const filenameInput = document.createElement('input');
				filenameInput.type = 'hidden';
				filenameInput.name = 'filename';
				filenameInput.value = uploadResult.filename;
				form.appendChild(filenameInput);
				
				const originalNameInput = document.createElement('input');
				originalNameInput.type = 'hidden';
				originalNameInput.name = 'originalName';
				originalNameInput.value = uploadResult.originalName;
				form.appendChild(originalNameInput);
				
				const titleInput = document.createElement('input');
				titleInput.type = 'hidden';
				titleInput.name = 'title';
				titleInput.value = helpFileTitle || uploadResult.originalName;
				form.appendChild(titleInput);
				
				document.body.appendChild(form);
				form.submit();
			} catch (error) {
				helpFileUploading = false;
				notifications.error(error?.message || 'Failed to upload help file');
			}
		}
	}

	async function handleRemoveHelpFile(index) {
		const confirmed = await dialog.confirm('Are you sure you want to remove this help file?', 'Remove Help File');
		if (confirmed) {
			const form = document.createElement('form');
			form.method = 'POST';
			form.action = '?/removeHelpFile';
			
			const csrfInput = document.createElement('input');
			csrfInput.type = 'hidden';
			csrfInput.name = '_csrf';
			csrfInput.value = csrfToken;
			form.appendChild(csrfInput);
			
			const indexInput = document.createElement('input');
			indexInput.type = 'hidden';
			indexInput.name = 'index';
			indexInput.value = index.toString();
			form.appendChild(indexInput);
			
			document.body.appendChild(form);
			form.submit();
		}
	}
</script>

{#if rota}
	<div class="hub-top-panel p-6 mb-6">
		<div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
			<h2 class="text-xl sm:text-2xl font-bold text-gray-900">{rota.role || 'Unknown'} rota</h2>
			<div class="flex flex-wrap gap-2">
				{#if editing}
					<button
						type="submit"
						form="rota-edit-form"
						class="hub-btn bg-theme-button-2 text-white"
					>
						Save Changes
					</button>
					<button
						type="button"
						on:click={() => editing = false}
						class="hub-btn bg-theme-button-3 text-white"
					>
						Back
					</button>
				{:else}
					<button
						on:click={() => editing = true}
						class="hub-btn bg-theme-button-2 text-white"
					>
						Edit
					</button>
					<button
						on:click={handleDelete}
						class="hub-btn bg-hub-red-600 text-white hover:bg-hub-red-700"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>

		{#if editing}
			<form id="rota-edit-form" method="POST" action="?/update" use:enhance>
				<input type="hidden" name="_csrf" value={csrfToken} />
				<input type="hidden" name="notes" value={notes} />
				
				<!-- Basic Information Panel -->
				<div class="border border-gray-200 rounded-lg p-4 mb-4">
					<h3 class="text-base font-semibold text-gray-900 mb-3">Basic Information</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1.5fr_2fr] gap-4">
						<FormField label="Role" name="role" bind:value={formData.role} required />
						<div class="w-20">
							<FormField label="Capacity" name="capacity" type="number" bind:value={formData.capacity} required />
						</div>
						<div>
							<label for="visibility-select" class="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
							<select id="visibility-select" name="visibility" bind:value={formData.visibility} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm">
								<option value="public">Public</option>
								<option value="internal">Internal</option>
							</select>
							<p class="mt-1 text-xs text-gray-500">Public = signup links, Internal = admin only</p>
						</div>
						<div>
							<label for="owner-select" class="block text-sm font-medium text-gray-700 mb-1">Owner</label>
							<div class="flex gap-2">
								<select 
									id="owner-select"
									name="ownerId" 
									value={formData.ownerId || ''}
									on:change={(e) => {
										formData.ownerId = e.target.value || '';
									}}
									class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
								>
									<option value="">No owner</option>
									{#each filteredOwnerContacts as contact (contact.id)}
										{@const contactId = String(contact.id || '')}
										<option value={contactId} selected={formData.ownerId === contactId}>
											{`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}
										</option>
									{/each}
								</select>
								<input
									id="owner-search"
									type="text"
									bind:value={ownerSearchTerm}
									placeholder="Search..."
									class="w-32 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-2 text-sm"
									title="Search owner by name or email"
								/>
							</div>
							<p class="mt-1 text-xs text-gray-500">Owner gets update notifications</p>
						</div>
					</div>
				</div>

				<!-- Notes Panel -->
				<div class="border border-gray-200 rounded-lg p-4 mb-4">
					<h3 class="text-base font-semibold text-gray-900 mb-3">Notes</h3>
					<div>
						<HtmlEditor bind:value={notes} name="notes" />
					</div>
				</div>

				<!-- Help Files Panel -->
				<div class="border border-gray-200 rounded-lg p-4 mb-4">
					<h3 class="text-base font-semibold text-gray-900 mb-3">Help Files</h3>
					<p class="text-sm text-gray-600 mb-3">Add documents or links that people can download when signing up for this rota.</p>
					
					<!-- Existing Help Files -->
					{#if helpFiles.length > 0}
						<div class="space-y-2 mb-4">
							{#each helpFiles as helpFile, index}
								<div class="flex items-center justify-between p-3 bg-gray-50 rounded-md">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											{#if helpFile.type === 'link'}
												<svg class="w-5 h-5 text-hub-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
												</svg>
											{:else}
												<svg class="w-5 h-5 text-hub-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
												</svg>
											{/if}
											<div class="min-w-0 flex-1">
												<div class="font-medium text-sm text-gray-900 truncate">{helpFile.title || (helpFile.type === 'link' ? helpFile.url : helpFile.originalName)}</div>
												{#if helpFile.type === 'link'}
													<div class="text-xs text-gray-500 truncate">{helpFile.url}</div>
												{:else}
													<div class="text-xs text-gray-500">{helpFile.originalName}</div>
												{/if}
											</div>
										</div>
									</div>
									<button
										type="button"
										on:click={() => handleRemoveHelpFile(index)}
										class="text-hub-red-600 hover:text-hub-red-800 px-2 py-1 rounded text-sm ml-2 flex-shrink-0"
										title="Remove help file"
									>
										×
									</button>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Add Help File Form -->
					<div class="border-t border-gray-200 pt-4">
						<div class="mb-3">
							<div class="block text-sm font-medium text-gray-700 mb-2">Add Help File</div>
							<div class="flex gap-2 mb-2">
								<button
									type="button"
									on:click={() => { showAddHelpFile = true; helpFileType = 'link'; }}
									class="flex-1 bg-theme-button-1 text-white px-3 py-2 rounded-md hover:opacity-90 text-sm"
								>
									Add Link
								</button>
								<button
									type="button"
									on:click={() => { showAddHelpFile = true; helpFileType = 'file'; }}
									class="flex-1 bg-theme-button-2 text-white px-3 py-2 rounded-md hover:opacity-90 text-sm"
								>
									Upload PDF
								</button>
							</div>
						</div>
					</div>
				</div>
			</form>
		{:else}
			<dl class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_2fr_1.5fr] gap-4">
				<div>
					<dt class="text-sm font-medium text-gray-500">Event</dt>
					<dd class="mt-1 text-sm text-gray-900">{event?.title || 'Unknown'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500 whitespace-nowrap">Capacity per Occurrence</dt>
					<dd class="mt-1 text-sm text-gray-900">{rota.capacity} {rota.capacity === 1 ? 'person' : 'people'}</dd>
				</div>
				<div>
					<dt class="text-sm font-medium text-gray-500">Total Assigned</dt>
					<dd class="mt-1 text-sm text-gray-900">{totalUpcomingAssignees} across {upcomingOccurrenceCount} {upcomingOccurrenceCount === 1 ? 'occurrence' : 'occurrences'}</dd>
				</div>
				{#if owner}
					<div>
						<dt class="text-sm font-medium text-gray-500">Owner</dt>
						<dd class="mt-1 text-sm text-gray-900">
							<a href="/hub/contacts/{owner.id}" class="text-hub-green-600 hover:text-hub-green-700 underline">
								{`${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email}
							</a>
						</dd>
					</div>
				{/if}
				{#if rota.notes}
					<div class="sm:col-span-2 lg:col-span-4">
						<dt class="text-sm font-medium text-gray-500">Notes</dt>
						<dd class="mt-1 text-sm text-gray-900">{@html rota.notes}</dd>
					</div>
				{/if}
			</dl>
			
			{#if helpFiles.length > 0}
				<div class="mt-4 border-t border-gray-200 pt-4">
					<dt class="text-sm font-medium text-gray-500 mb-2">Help Files</dt>
					<dd class="mt-1">
						<div class="space-y-2">
							{#each helpFiles as helpFile}
								<div class="flex items-center gap-2">
									{#if helpFile.type === 'link'}
										<a
											href={helpFile.url}
											target="_blank"
											rel="noopener noreferrer"
											class="flex items-center gap-2 text-hub-blue-600 hover:text-hub-blue-700 underline text-sm"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
											</svg>
											<span>{helpFile.title}</span>
										</a>
									{:else}
										<a
											href="/hub/rotas/help-files/{helpFile.filename}"
											target="_blank"
											rel="noopener noreferrer"
											class="flex items-center gap-2 text-hub-green-600 hover:text-hub-green-700 underline text-sm"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
											</svg>
											<span>{helpFile.title || helpFile.originalName}</span>
										</a>
									{/if}
								</div>
							{/each}
						</div>
					</dd>
				</div>
			{/if}
		{/if}
	</div>


	<div class="bg-white shadow rounded-lg p-6">
		<div class="flex justify-between items-center mb-4">
			<h3 class="text-xl font-bold text-gray-900">Assignees by Occurrence</h3>
		</div>
		{#if eventOccurrences.length > 0}
			<div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
				{#each eventOccurrences as occ}
					{@const occAssignees = assigneesByOccurrence[occ.id] || []}
					{@const isFull = occAssignees.length >= rota.capacity}
					<div class="border border-gray-200 rounded-lg p-3">
						<div class="flex justify-between items-center mb-2">
							<h4 class="text-sm font-semibold text-gray-900">{formatDateTimeUK(occ.startsAt)}</h4>
							<div class="flex items-center gap-2">
								<span class="text-xs font-medium {isFull ? 'text-hub-red-600' : 'text-gray-700'} w-16">
									{occAssignees.length}/{rota.capacity}
								</span>
								{#if isFull}
									<span class="text-xs text-hub-red-600 font-medium">Full</span>
								{:else}
									<button
										on:click={() => {
											console.log('[CLIENT] + Add clicked for occurrence:', occ.id, 'Current assignees:', occAssignees.length, 'Assignees:', JSON.stringify(occAssignees));
											selectedOccurrenceId = occ.id;
											showAddAssignees = true;
											searchTerm = '';
											selectedContactIds = new Set();
											selectedListId = '';
										}}
										class="bg-theme-button-2 text-white px-2.5 py-1.5 rounded text-xs hover:opacity-90"
										title="Add assignees to this occurrence"
									>
										+ Add
									</button>
								{/if}
							</div>
						</div>
						{#if occAssignees.length > 0}
							<div class="space-y-1.5 max-h-64 overflow-y-auto">
								{#each occAssignees as assignee}
									<div class="flex items-center justify-between p-1.5 bg-gray-50 rounded text-sm">
										<div class="flex-1 min-w-0">
											{#if assignee.id}
												<a href="/hub/contacts/{assignee.id}" class="text-hub-green-600 hover:text-hub-green-700 underline font-medium truncate block">
													{assignee.name || 'Unknown'}
												</a>
											{:else}
												<span class="font-medium truncate block">{assignee.name || 'Unknown'}</span>
											{/if}
										</div>
										<button
											on:click={() => handleRemoveAssignee(assignee)}
											class="text-hub-red-600 hover:text-hub-red-800 px-1.5 py-0.5 rounded text-xs ml-2 flex-shrink-0"
											title="Remove assignee"
										>
											×
										</button>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-xs text-gray-400 italic py-2">No assignees</p>
						{/if}
					</div>
				{/each}
				
				{#if assigneesByOccurrence['unassigned'] && assigneesByOccurrence['unassigned'].length > 0}
					<div class="lg:col-span-2 xl:col-span-3 border border-hub-yellow-200 rounded-lg p-3 bg-hub-yellow-50">
						<div class="flex justify-between items-center mb-2">
							<div>
								<h4 class="text-sm font-semibold text-gray-900">Unassigned to Specific Occurrence</h4>
								<p class="text-xs text-gray-500">These assignees need to be assigned to a specific occurrence</p>
							</div>
							<div class="text-right">
								<span class="text-xs font-medium text-gray-700">
									{assigneesByOccurrence['unassigned'].length}
								</span>
							</div>
						</div>
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
							{#each assigneesByOccurrence['unassigned'] as assignee}
								<div class="flex items-center justify-between p-1.5 bg-white rounded text-sm">
									<div class="flex-1 min-w-0">
										{#if assignee.id}
											<a href="/hub/contacts/{assignee.id}" class="text-hub-green-600 hover:text-hub-green-700 underline font-medium truncate block">
												{assignee.name || 'Unknown'}
											</a>
										{:else}
											<span class="font-medium truncate block">{assignee.name || 'Unknown'}</span>
										{/if}
									</div>
									<button
										on:click={() => handleRemoveAssignee(assignee)}
										class="text-hub-red-600 hover:text-hub-red-800 px-1.5 py-0.5 rounded text-xs ml-2 flex-shrink-0"
										title="Remove assignee"
									>
										×
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else if (rota.assignees || []).length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
				{#each rota.assignees as assignee, index}
					<div class="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
						<div class="flex-1 min-w-0">
							{#if assignee.id}
								<a href="/hub/contacts/{assignee.id}" class="text-hub-green-600 hover:text-hub-green-700 underline font-medium truncate block">
									{assignee.name || 'Unknown'}
								</a>
							{:else}
								<span class="font-medium truncate block">{assignee.name || 'Unknown'}</span>
							{/if}
						</div>
						<button
							on:click={() => handleRemoveAssignee(assignee, index)}
							class="text-hub-red-600 hover:text-hub-red-800 px-1.5 py-0.5 rounded text-xs ml-2 flex-shrink-0"
							title="Remove assignee"
						>
							×
						</button>
					</div>
				{/each}
			</div>
		{:else}
			<p class="text-gray-500">No assignees yet. Click "Add Assignees" to assign people to this rota.</p>
		{/if}
	</div>

	{#if showAddAssignees}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="button" tabindex="0" on:click={() => { showAddAssignees = false; searchTerm = ''; guestName = ''; selectedContactIds = new Set(); selectedListId = ''; }} on:keydown={(e) => e.key === 'Escape' && (showAddAssignees = false)} aria-label="Close modal">
			<div class="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] flex flex-col" on:click|stopPropagation role="dialog" aria-modal="true">
				<!-- Header (fixed) -->
				<div class="p-6 border-b border-gray-200">
					<h3 class="text-xl font-bold text-gray-900 mb-4">Add Assignees</h3>
					
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 items-end">
						<div>
							<label for="list-filter" class="block text-sm font-medium text-gray-700 mb-1 text-xs">Filter by List</label>
							<select id="list-filter" bind:value={selectedListId} class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm">
								<option value="">All Contacts</option>
								{#each lists as list}
									<option value={list.id}>{list.name}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="contact-search" class="block text-sm font-medium text-gray-700 mb-1 text-xs">Search Contacts</label>
							<input
								id="contact-search"
								type="text"
								bind:value={searchTerm}
								placeholder="Search contacts..."
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-4 text-sm"
							/>
						</div>
					</div>
					
					<!-- Guest option only in Hub admin (hidden on any public signup pages if form is reused) -->
					{#if $page.url.pathname.startsWith('/hub/')}
						<div class="mt-4 pt-4 border-t border-gray-200">
							<label class="block text-sm font-medium text-gray-700 mb-2">Add Guest (not in contacts)</label>
							<div class="flex flex-col sm:flex-row gap-2">
								<input
									type="text"
									bind:value={guestName}
									placeholder="Guest Name *"
									class="flex-1 rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
								/>
								<button
									type="button"
									on:click={handleAddGuest}
									disabled={!guestName}
									class="bg-theme-button-1 text-white px-4 py-2 rounded-md hover:opacity-90 disabled:opacity-50 text-sm whitespace-nowrap"
								>
									Add Guest
								</button>
							</div>
						</div>
					{/if}
				</div>

				<!-- Scrollable content area -->
				<div class="flex-1 overflow-y-auto p-6">
					{#if filteredAvailableContacts.length > 0}
						<div class="mb-3 flex justify-between items-center">
							<span class="text-sm text-gray-600">
								Showing {filteredAvailableContacts.length} contact{filteredAvailableContacts.length !== 1 ? 's' : ''}
							</span>
							<div class="flex gap-2">
								<button
									on:click={selectAllContacts}
									class="text-sm text-hub-green-600 hover:text-hub-green-800 underline"
								>
									Select All
								</button>
								<button
									on:click={deselectAllContacts}
									class="text-sm text-gray-600 hover:text-gray-800 underline"
								>
									Deselect All
								</button>
							</div>
						</div>
						<div class="space-y-2">
							{#each filteredAvailableContacts as contact}
								<label class="flex items-center p-3 bg-gray-50 rounded-md hover:bg-gray-100 cursor-pointer">
									<input
										type="checkbox"
										checked={selectedContactIds.has(contact.id)}
										on:change={() => toggleContactSelection(contact.id)}
										class="mr-3"
									/>
									<div class="flex-1">
										<div class="font-medium">
											{`${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email}
										</div>
									</div>
								</label>
							{/each}
						</div>
					{:else}
						<p class="text-gray-500">No available contacts to assign.</p>
					{/if}
				</div>

				<!-- Footer with buttons (fixed at bottom) -->
				<div class="p-6 border-t border-gray-200 flex gap-2 justify-end">
					<button
						on:click={() => { 
							showAddAssignees = false; 
							searchTerm = ''; 
							guestName = '';
							selectedContactIds = new Set(); 
							selectedListId = '';
						}}
						class="hub-btn bg-theme-button-3 text-white"
					>
						Back
					</button>
					<button
						on:click={handleAddAssignees}
						disabled={selectedContactIds.size === 0}
						class="hub-btn bg-theme-button-2 text-white disabled:opacity-50"
					>
						Add Selected ({selectedContactIds.size})
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Add Help File Modal -->
	{#if showAddHelpFile}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="button" tabindex="0" on:click={() => { showAddHelpFile = false; helpFileUrl = ''; helpFileTitle = ''; helpFileFile = null; }} on:keydown={(e) => e.key === 'Escape' && (showAddHelpFile = false)} aria-label="Close modal">
			<div class="bg-white rounded-lg max-w-md w-full p-6" on:click|stopPropagation role="dialog" aria-modal="true">
				<h3 class="text-lg font-bold text-gray-900 mb-4">
					{helpFileType === 'link' ? 'Add Link' : 'Upload PDF'}
				</h3>
				
				{#if helpFileType === 'link'}
					<div class="space-y-4">
						<div>
							<label for="help-file-url" class="block text-sm font-medium text-gray-700 mb-1">URL <span class="text-hub-red-500">*</span></label>
							<input
								id="help-file-url"
								type="url"
								bind:value={helpFileUrl}
								placeholder="https://example.com/document.pdf"
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
							/>
						</div>
						<div>
							<label for="help-file-title" class="block text-sm font-medium text-gray-700 mb-1">Title <span class="text-hub-red-500">*</span></label>
							<input
								id="help-file-title"
								type="text"
								bind:value={helpFileTitle}
								placeholder="Document Title"
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
							/>
						</div>
					</div>
				{:else}
					<div class="space-y-4">
						<div>
							<label for="help-file-upload" class="block text-sm font-medium text-gray-700 mb-1">PDF File <span class="text-hub-red-500">*</span></label>
							<input
								id="help-file-upload"
								type="file"
								accept=".pdf,application/pdf"
								on:change={(e) => {
									const file = e.target.files?.[0];
									if (file) {
										helpFileFile = file;
										if (!helpFileTitle) {
											helpFileTitle = file.name.replace(/\.pdf$/i, '');
										}
									}
								}}
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
							/>
							<p class="mt-1 text-xs text-gray-500">Maximum file size: 10MB</p>
						</div>
						<div>
							<label for="help-file-title-file" class="block text-sm font-medium text-gray-700 mb-1">Title (optional)</label>
							<input
								id="help-file-title-file"
								type="text"
								bind:value={helpFileTitle}
								placeholder="Document Title"
								class="w-full rounded-md border border-gray-500 shadow-sm focus:border-theme-button-2 focus:ring-theme-button-2 py-2 px-3 text-sm"
							/>
							<p class="mt-1 text-xs text-gray-500">If not provided, the filename will be used</p>
						</div>
					</div>
				{/if}

				<div class="mt-6 flex gap-2 justify-end">
					<button
						type="button"
						on:click={() => { showAddHelpFile = false; helpFileUrl = ''; helpFileTitle = ''; helpFileFile = null; }}
						class="hub-btn bg-theme-button-3 text-white"
					>
						Cancel
					</button>
					<button
						type="button"
						on:click={handleAddHelpFile}
						disabled={helpFileUploading || (helpFileType === 'link' ? (!helpFileUrl || !helpFileTitle) : !helpFileFile)}
						class="hub-btn bg-theme-button-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{#if helpFileUploading}
							Uploading...
						{:else}
							Add
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}

