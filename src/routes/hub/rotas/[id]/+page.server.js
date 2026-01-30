import { redirect, fail } from '@sveltejs/kit';
import { findById, update, remove, readCollection } from '$lib/crm/server/fileStore.js';
import { validateRota } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { ensureRotaToken } from '$lib/crm/server/tokens.js';
import { env } from '$env/dynamic/private';
import { logDataChange } from '$lib/crm/server/audit.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';

export async function load({ params, cookies, url }) {
	const rota = await findById('rotas', params.id);
	if (!rota) {
		throw redirect(302, '/hub/rotas');
	}

	const event = await findById('events', rota.eventId);
	const occurrence = rota.occurrenceId ? await findById('occurrences', rota.occurrenceId) : null;
	
	// Load all occurrences for this event to show capacity per occurrence
	// Filter to only show upcoming occurrences (today or future)
	// But always include the rota's specific occurrence if it has one (even if in the past)
	const allOccurrences = await readCollection('occurrences');
	const allEventOccurrences = allOccurrences.filter(o => o.eventId === rota.eventId);
	let eventOccurrences = filterUpcomingOccurrences(allEventOccurrences);
	
	// If rota is for a specific occurrence, make sure it's included even if it's in the past
	if (rota.occurrenceId) {
		const specificOccurrence = allEventOccurrences.find(o => o.id === rota.occurrenceId);
		if (specificOccurrence && !eventOccurrences.find(o => o.id === rota.occurrenceId)) {
			// Add it to the beginning of the list
			eventOccurrences = [specificOccurrence, ...eventOccurrences];
		}
	}

	// Load contact details for assignees
	// New structure: assignees are objects with { contactId, occurrenceId }
	const contacts = await readCollection('contacts');
	
	// Process assignees - handle both old format (backward compatibility) and new format
	const processedAssignees = (rota.assignees || []).map(assignee => {
		let contactId, occurrenceId;
		
		// Handle old format (backward compatibility)
		if (typeof assignee === 'string') {
			contactId = assignee;
			// If rota is for all occurrences (occurrenceId is null), we can't assign to a specific occurrence
			// For now, we'll leave it as null and handle it in the display
			occurrenceId = rota.occurrenceId;
		} else if (assignee && typeof assignee === 'object') {
			// New format: { contactId, occurrenceId } or old public signup format { name, email }
			if (assignee.contactId) {
				contactId = assignee.contactId;
				occurrenceId = assignee.occurrenceId || rota.occurrenceId;
			} else if (assignee.id) {
				contactId = assignee.id;
				occurrenceId = assignee.occurrenceId || rota.occurrenceId;
			} else if (assignee.name && assignee.email) {
				// Public signup format
				contactId = { name: assignee.name, email: assignee.email };
				occurrenceId = assignee.occurrenceId || rota.occurrenceId;
			} else {
				return null;
			}
		} else {
			return null;
		}
		
		// Resolve contact details
		let contactDetails = null;
		if (typeof contactId === 'string') {
			const contact = contacts.find(c => c.id === contactId);
			if (contact) {
				contactDetails = {
					id: contact.id,
					name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
					email: contact.email
				};
			} else {
				contactDetails = {
					id: contactId,
					name: 'Unknown Contact',
					email: ''
				};
			}
		} else {
			// Public signup
			contactDetails = {
				id: null,
				name: contactId.name || 'Unknown',
				email: contactId.email || ''
			};
		}
		
		return {
			...contactDetails,
			occurrenceId: occurrenceId
		};
	}).filter(a => a !== null);
	
	// Group assignees by occurrence
	const assigneesByOccurrence = {};
	const unassignedAssignees = []; // Assignees without a specific occurrence (old format, rota for all occurrences)
	
	console.log('[LOAD DEBUG] Grouping assignees by occurrence');
	console.log('[LOAD DEBUG] Processed assignees:', JSON.stringify(processedAssignees, null, 2));
	console.log('[LOAD DEBUG] Event occurrences:', eventOccurrences.map(o => ({ id: o.id, startsAt: o.startsAt })));
	
	processedAssignees.forEach(assignee => {
		const occId = assignee.occurrenceId;
		console.log('[LOAD DEBUG] Processing assignee:', assignee.name || assignee.email, 'occurrenceId:', occId);
		if (occId === null || occId === undefined) {
			// Assignee doesn't have an occurrenceId - this happens with old format when rota is for all occurrences
			unassignedAssignees.push(assignee);
			console.log('[LOAD DEBUG] Added to unassigned');
		} else {
			if (!assigneesByOccurrence[occId]) {
				assigneesByOccurrence[occId] = [];
			}
			assigneesByOccurrence[occId].push(assignee);
			console.log('[LOAD DEBUG] Added to occurrence', occId, 'Current count:', assigneesByOccurrence[occId].length);
		}
	});
	
	console.log('[LOAD DEBUG] Final assigneesByOccurrence:', JSON.stringify(Object.keys(assigneesByOccurrence).reduce((acc, key) => {
		acc[key] = assigneesByOccurrence[key].map(a => ({ name: a.name, email: a.email, id: a.id }));
		return acc;
	}, {}), null, 2));
	console.log('[LOAD DEBUG] Unassigned assignees:', unassignedAssignees.length);
	
	// If there are unassigned assignees and the rota is for all occurrences, 
	// we need to handle them - for now, show them separately or distribute them
	// For display purposes, if there are unassigned and only one occurrence, assign them to that occurrence
	if (unassignedAssignees.length > 0 && rota.occurrenceId === null && eventOccurrences.length === 1) {
		// Auto-assign to the only occurrence
		const onlyOccId = eventOccurrences[0].id;
		if (!assigneesByOccurrence[onlyOccId]) {
			assigneesByOccurrence[onlyOccId] = [];
		}
		assigneesByOccurrence[onlyOccId].push(...unassignedAssignees);
	} else if (unassignedAssignees.length > 0) {
		// Multiple occurrences - show unassigned separately
		assigneesByOccurrence['unassigned'] = unassignedAssignees;
	}

	// Get all contacts for the add assignees search (excluding those already assigned to this occurrence)
	// For now, we'll show all contacts - filtering by occurrence will be handled in the UI
	// Sort contacts alphabetically by first name, then last name
	const availableContacts = contacts.sort((a, b) => {
		const aFirstName = (a.firstName || '').toLowerCase();
		const bFirstName = (b.firstName || '').toLowerCase();
		const aLastName = (a.lastName || '').toLowerCase();
		const bLastName = (b.lastName || '').toLowerCase();
		
		if (aFirstName !== bFirstName) {
			return aFirstName.localeCompare(bFirstName);
		}
		return aLastName.localeCompare(bLastName);
	});

	// Load all lists for filtering contacts
	const lists = await readCollection('lists');

	// Ensure a token exists for this rota and generate signup link
	let signupLink = '';
	try {
		const token = await ensureRotaToken(rota.eventId, rota.id, rota.occurrenceId);
		const baseUrl = env.APP_BASE_URL || url.origin || 'http://localhost:5173';
		signupLink = `${baseUrl}/signup/rota/${token.token}`;
	} catch (error) {
		console.error('Error generating rota token:', error);
		// Continue without signup link if token generation fails
	}

	// Load owner contact if rota has an owner
	let owner = null;
	if (rota.ownerId) {
		owner = await findById('contacts', rota.ownerId);
	}

	const csrfToken = getCsrfToken(cookies) || '';
	return { 
		rota: { ...rota, assignees: processedAssignees }, 
		rawRota: rota, // Keep raw rota for operations that need original assignees
		event, 
		occurrence, 
		eventOccurrences,
		assigneesByOccurrence,
		availableContacts, 
		lists,
		owner,
		signupLink, 
		csrfToken 
	};
}

export const actions = {
	update: async ({ request, params, cookies, url, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const notes = data.get('notes') || '';
			const sanitized = await sanitizeHtml(notes);

			const rota = await findById('rotas', params.id);
			if (!rota) {
				return fail(404, { error: 'Rota not found' });
			}

			const rotaData = {
				role: data.get('role'),
				capacity: parseInt(data.get('capacity') || '1', 10),
				notes: sanitized,
				assignees: rota.assignees || [], // Preserve existing assignees
				ownerId: data.get('ownerId') || null,
				visibility: data.get('visibility') || rota.visibility || 'public', // Preserve existing visibility or default to public
				helpFiles: rota.helpFiles || [] // Preserve existing help files
			};

			const validated = validateRota({ ...rotaData, eventId: rota.eventId });
			const oldOwnerId = rota.ownerId;
			await update('rotas', params.id, validated);

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			const eventRecord = await findById('events', rota.eventId);
			await logDataChange(adminId, 'update', 'rota', params.id, {
				role: validated.role,
				eventId: rota.eventId,
				eventName: eventRecord?.title || 'unknown'
			}, event);

			// Send notification to owner if rota was updated
			if (validated.ownerId) {
				try {
					const { sendRotaUpdateNotification } = await import('$lib/crm/server/email.js');
					const updatedRota = await findById('rotas', params.id);
					const owner = await findById('contacts', validated.ownerId);
					if (owner) {
						await sendRotaUpdateNotification({
							to: owner.email,
							name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email
							}, {
								rota: updatedRota,
								event,
								occurrence
							}, { url: new URL(url.toString(), 'http://localhost') });
					}
				} catch (error) {
					console.error('Error sending rota update notification:', error);
					// Don't fail the update if notification fails
				}
			}

			return { success: true };
		} catch (error) {
			console.error('Error updating rota:', error);
			return fail(400, { error: error.message || 'Failed to update rota' });
		}
	},

		delete: async ({ params, cookies, request, locals }) => {
			const data = await request.formData();
			const csrfToken = data.get('_csrf');

			if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
				return fail(403, { error: 'CSRF token validation failed' });
			}

			try {
				// Get rota data before deletion for audit log
				const rota = await findById('rotas', params.id);
				const eventRecord = rota ? await findById('events', rota.eventId) : null;
				
				await remove('rotas', params.id);

				// Log audit event
				const adminId = locals?.admin?.id || null;
				const event = { getClientAddress: () => 'unknown', request };
				await logDataChange(adminId, 'delete', 'rota', params.id, {
					role: rota?.role || 'unknown',
					eventId: rota?.eventId,
					eventName: eventRecord?.title || 'unknown'
				}, event);

				throw redirect(302, '/hub/rotas');
			} catch (error) {
				if (error.status === 302) throw error; // Re-throw redirects
				console.error('Error deleting rota:', error);
				return fail(400, { error: error.message || 'Failed to delete rota' });
			}
		},

		addAssignees: async ({ request, params, cookies, url }) => {
			const data = await request.formData();
			const csrfToken = data.get('_csrf');

			if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
				return fail(403, { error: 'CSRF token validation failed' });
			}

			try {
				const rota = await findById('rotas', params.id);
				if (!rota) {
					return fail(404, { error: 'Rota not found' });
				}

				const contactIdsJson = data.get('contactIds');
				if (!contactIdsJson) {
					return fail(400, { error: 'No contacts provided' });
				}

				let newContactIds;
				try {
					newContactIds = JSON.parse(contactIdsJson);
				} catch (parseError) {
					return fail(400, { error: 'Invalid contact IDs format' });
				}

				if (!Array.isArray(newContactIds)) {
					return fail(400, { error: 'Contact IDs must be an array' });
				}

				const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
				
				// Get occurrenceId from form or use rota's occurrenceId
				const occurrenceIdStr = data.get('occurrenceId');
				const targetOccurrenceId = occurrenceIdStr || rota.occurrenceId || null;
				
				// If this rota is linked to a meeting planner for a specific occurrence,
				// default to that occurrence so the assignment shows up in both places
				const meetingPlanners = await readCollection('meeting_planners');
				const linkedMeetingPlanner = meetingPlanners.find(mp => 
					mp.meetingLeaderRotaId === params.id ||
					mp.worshipLeaderRotaId === params.id ||
					mp.speakerRotaId === params.id ||
					mp.callToWorshipRotaId === params.id
				);
				
				// When linked to a single-occurrence meeting planner and no occurrence was supplied,
				// use that occurrence so the rota and meeting planner stay in sync
				if (linkedMeetingPlanner && linkedMeetingPlanner.occurrenceId && !targetOccurrenceId) {
					console.log('[ADD ASSIGNEES DEBUG] Defaulting occurrence to meeting planner occurrence', linkedMeetingPlanner.occurrenceId);
					targetOccurrenceId = linkedMeetingPlanner.occurrenceId;
				}
				
				console.log('[ADD ASSIGNEES DEBUG] ===========================================');
				console.log('[ADD ASSIGNEES DEBUG] Rota ID:', params.id);
				console.log('[ADD ASSIGNEES DEBUG] Rota occurrenceId:', rota.occurrenceId);
				console.log('[ADD ASSIGNEES DEBUG] Target occurrenceId (from form):', occurrenceIdStr);
				console.log('[ADD ASSIGNEES DEBUG] Final targetOccurrenceId:', targetOccurrenceId);
				console.log('[ADD ASSIGNEES DEBUG] Rota capacity:', rota.capacity);
				console.log('[ADD ASSIGNEES DEBUG] New contact IDs to add:', newContactIds);
				console.log('[ADD ASSIGNEES DEBUG] Existing assignees count:', existingAssignees.length);
				console.log('[ADD ASSIGNEES DEBUG] Existing assignees:', JSON.stringify(existingAssignees, null, 2));
				
				// Check capacity per occurrence before adding
				const assigneesForOccurrence = existingAssignees.filter((a, index) => {
					console.log(`[ADD ASSIGNEES DEBUG] Checking assignee ${index}:`, JSON.stringify(a, null, 2));
					
					if (typeof a === 'string') {
						// Old format: string is contact ID
						// If rota is for a specific occurrence, only count if it matches
						// If rota is for all occurrences (null), don't count old format for specific occurrences
						if (rota.occurrenceId === null) {
							// Rota is for all occurrences, old format assignees don't have occurrenceId
							// They should not be counted for a specific occurrence
							console.log(`[ADD ASSIGNEES DEBUG] Assignee ${index}: Old format string, rota.occurrenceId is null, returning false`);
							return false;
						}
						const matches = rota.occurrenceId === targetOccurrenceId;
						console.log(`[ADD ASSIGNEES DEBUG] Assignee ${index}: Old format string, rota.occurrenceId (${rota.occurrenceId}) === targetOccurrenceId (${targetOccurrenceId}): ${matches}`);
						return matches;
					}
					if (a && typeof a === 'object') {
						// New format: object with occurrenceId
						// If assignee has explicit occurrenceId, use it
						// If assignee occurrenceId is null/undefined, fall back to rota.occurrenceId
						const aOccurrenceId = a.occurrenceId !== null && a.occurrenceId !== undefined 
							? a.occurrenceId 
							: rota.occurrenceId;
						const matches = aOccurrenceId === targetOccurrenceId;
						console.log(`[ADD ASSIGNEES DEBUG] Assignee ${index}: New format object, a.occurrenceId: ${a.occurrenceId}, rota.occurrenceId: ${rota.occurrenceId}, resolved aOccurrenceId: ${aOccurrenceId}, matches targetOccurrenceId (${targetOccurrenceId}): ${matches}`);
						return matches;
					}
					console.log(`[ADD ASSIGNEES DEBUG] Assignee ${index}: Unknown format, returning false`);
					return false;
				});
				
				console.log('[ADD ASSIGNEES DEBUG] Assignees for occurrence after filter:', assigneesForOccurrence.length);
				console.log('[ADD ASSIGNEES DEBUG] Filtered assignees:', JSON.stringify(assigneesForOccurrence, null, 2));
				console.log('[ADD ASSIGNEES DEBUG] Current count:', assigneesForOccurrence.length);
				console.log('[ADD ASSIGNEES DEBUG] Trying to add:', newContactIds.length);
				
				// Get existing contact IDs for this occurrence to check for duplicates
				const existingContactIdsForOcc = assigneesForOccurrence
					.map(a => typeof a === 'string' ? a : (a.contactId && typeof a.contactId === 'string' ? a.contactId : null))
					.filter(id => id !== null);
				
				// Filter out duplicates from new contact IDs BEFORE checking capacity
				const uniqueNewContactIds = newContactIds.filter(contactId => !existingContactIdsForOcc.includes(contactId));
				
				console.log('[ADD ASSIGNEES DEBUG] Unique new contact IDs (after filtering duplicates):', uniqueNewContactIds.length);
				console.log('[ADD ASSIGNEES DEBUG] Total would be:', assigneesForOccurrence.length + uniqueNewContactIds.length);
				console.log('[ADD ASSIGNEES DEBUG] Capacity:', rota.capacity);
				console.log('[ADD ASSIGNEES DEBUG] ===========================================');
				
				// If all were duplicates, return early
				if (uniqueNewContactIds.length === 0) {
					return { success: true, type: 'addAssignees', message: 'All selected contacts are already assigned to this occurrence', skipped: newContactIds.length };
				}
				
				// If some were duplicates, include that in the response
				if (uniqueNewContactIds.length < newContactIds.length) {
					const skipped = newContactIds.length - uniqueNewContactIds.length;
					return { success: true, type: 'addAssignees', message: `Added ${uniqueNewContactIds.length} contact(s). ${skipped} contact(s) were already assigned and skipped.`, added: uniqueNewContactIds.length, skipped: skipped };
				}
				
				// Check capacity with only the unique new assignees
				if (assigneesForOccurrence.length + uniqueNewContactIds.length > rota.capacity) {
					return fail(400, { error: `Cannot add ${uniqueNewContactIds.length} contact(s). This occurrence can only have ${rota.capacity} assignee(s) and currently has ${assigneesForOccurrence.length}.` });
				}
				
				// Add new assignees with occurrenceId (only unique ones)
				const uniqueNewAssignees = uniqueNewContactIds.map(contactId => ({
					contactId: contactId,
					occurrenceId: targetOccurrenceId
				}));
				
				const updatedAssignees = [...existingAssignees, ...uniqueNewAssignees];

				// Update with all rota fields to preserve them
				const updatedRota = {
					...rota,
					assignees: updatedAssignees
				};
				const validated = validateRota(updatedRota);
				await update('rotas', params.id, validated);

				// Send notification to owner if rota has an owner
				if (validated.ownerId) {
					try {
						const { sendRotaUpdateNotification } = await import('$lib/crm/server/email.js');
						const event = await findById('events', rota.eventId);
						const occurrence = targetOccurrenceId ? await findById('occurrences', targetOccurrenceId) : null;
						const owner = await findById('contacts', validated.ownerId);
						if (owner) {
							await sendRotaUpdateNotification({
								to: owner.email,
								name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email
							}, {
								rota: validated,
								event,
								occurrence
							}, { url: new URL(url.toString(), 'http://localhost') });
						}
					} catch (error) {
						console.error('Error sending rota update notification:', error);
						// Don't fail the update if notification fails
					}
				}

				return { success: true, type: 'addAssignees', message: `Added ${uniqueNewContactIds.length} contact(s) successfully.`, added: uniqueNewContactIds.length };
			} catch (error) {
				console.error('Error adding assignees:', error);
				return fail(400, { error: error.message || 'Failed to add assignees' });
			}
		},

		removeAssignee: async ({ request, params, cookies, url }) => {
			console.log('[SERVER] removeAssignee action called');
			const data = await request.formData();
			const csrfToken = data.get('_csrf');

			if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
				console.error('[SERVER] CSRF token validation failed');
				return fail(403, { error: 'CSRF token validation failed' });
			}

			try {
				const rota = await findById('rotas', params.id);
				if (!rota) {
					console.error('[SERVER] Rota not found:', params.id);
					return fail(404, { error: 'Rota not found' });
				}

				console.log('[SERVER] Rota found:', {
					id: rota.id,
					role: rota.role,
					occurrenceId: rota.occurrenceId,
					assigneesCount: Array.isArray(rota.assignees) ? rota.assignees.length : 0
				});

				const indexStr = data.get('index');
				console.log('[SERVER] Index from form data:', indexStr);
				if (indexStr === null || indexStr === undefined) {
					console.error('[SERVER] Index is missing');
					return fail(400, { error: 'Index required' });
				}

				const index = parseInt(indexStr, 10);
				console.log('[SERVER] Parsed index:', index);
				if (isNaN(index) || index < 0) {
					console.error('[SERVER] Invalid index:', index);
					return fail(400, { error: 'Invalid index' });
				}

				const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
				console.log('[SERVER] Existing assignees:', JSON.stringify(existingAssignees, null, 2));
				console.log('[SERVER] Assignees length:', existingAssignees.length);
				
				if (index >= existingAssignees.length) {
					console.error('[SERVER] Index out of range:', { 
						index, 
						length: existingAssignees.length, 
						assignees: JSON.stringify(existingAssignees, null, 2) 
					});
					return fail(400, { error: 'Index out of range' });
				}

				// Log what we're removing for debugging
				console.log('[SERVER] Removing assignee at index', index, ':', JSON.stringify(existingAssignees[index], null, 2));

				// Remove assignee at the specified index
				existingAssignees.splice(index, 1);
				const updatedAssignees = existingAssignees;

				console.log('[SERVER] Updated assignees after removal:', JSON.stringify(updatedAssignees, null, 2));

				// Update with all rota fields to preserve them
				const updatedRota = {
					...rota,
					assignees: updatedAssignees
				};
				const validated = validateRota(updatedRota);
				await update('rotas', params.id, validated);

				// Do NOT send notification when a contact is unassigned
				// (Email notifications are only sent when contacts are added, not removed)

				console.log('[SERVER] Rota updated successfully');
				return { success: true, type: 'removeAssignee' };
			} catch (error) {
				console.error('[SERVER] Error removing assignee:', error);
				console.error('[SERVER] Error stack:', error.stack);
				return fail(400, { error: error.message || 'Failed to remove assignee' });
			}
		},

		addHelpFile: async ({ request, params, cookies, locals }) => {
			const data = await request.formData();
			const csrfToken = data.get('_csrf');

			if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
				return fail(403, { error: 'CSRF token validation failed' });
			}

			try {
				const rota = await findById('rotas', params.id);
				if (!rota) {
					return fail(404, { error: 'Rota not found' });
				}

				const type = data.get('type'); // 'link' or 'file'
				if (!type || (type !== 'link' && type !== 'file')) {
					return fail(400, { error: 'Invalid help file type' });
				}

				const existingHelpFiles = Array.isArray(rota.helpFiles) ? [...rota.helpFiles] : [];
				let newHelpFile;

				if (type === 'link') {
					const url = data.get('url');
					const title = data.get('title');
					if (!url || !title) {
						return fail(400, { error: 'URL and title are required for link help files' });
					}
					newHelpFile = {
						type: 'link',
						url: url.trim(),
						title: title.trim()
					};
				} else {
					// type === 'file'
					const filename = data.get('filename');
					const originalName = data.get('originalName');
					const title = data.get('title') || originalName;
					if (!filename || !originalName) {
						return fail(400, { error: 'Filename and original name are required for file help files' });
					}
					newHelpFile = {
						type: 'file',
						filename: filename.trim(),
						originalName: originalName.trim(),
						title: title.trim()
					};
				}

				const updatedHelpFiles = [...existingHelpFiles, newHelpFile];
				const updatedRota = {
					...rota,
					helpFiles: updatedHelpFiles
				};
				const validated = validateRota(updatedRota);
				await update('rotas', params.id, validated);

				return { success: true, type: 'addHelpFile', helpFile: newHelpFile };
			} catch (error) {
				console.error('Error adding help file:', error);
				return fail(400, { error: error.message || 'Failed to add help file' });
			}
		},

		removeHelpFile: async ({ request, params, cookies, locals }) => {
			const data = await request.formData();
			const csrfToken = data.get('_csrf');

			if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
				return fail(403, { error: 'CSRF token validation failed' });
			}

			try {
				const rota = await findById('rotas', params.id);
				if (!rota) {
					return fail(404, { error: 'Rota not found' });
				}

				const indexStr = data.get('index');
				if (indexStr === null || indexStr === undefined) {
					return fail(400, { error: 'Index required' });
				}

				const index = parseInt(indexStr, 10);
				if (isNaN(index) || index < 0) {
					return fail(400, { error: 'Invalid index' });
				}

				const existingHelpFiles = Array.isArray(rota.helpFiles) ? [...rota.helpFiles] : [];
				if (index >= existingHelpFiles.length) {
					return fail(400, { error: 'Index out of range' });
				}

				existingHelpFiles.splice(index, 1);
				const updatedRota = {
					...rota,
					helpFiles: existingHelpFiles
				};
				const validated = validateRota(updatedRota);
				await update('rotas', params.id, validated);

				return { success: true, type: 'removeHelpFile' };
			} catch (error) {
				console.error('Error removing help file:', error);
				return fail(400, { error: error.message || 'Failed to remove help file' });
			}
		}
	};

