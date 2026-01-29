import { redirect, fail } from '@sveltejs/kit';
import { findById, update, remove, readCollection } from '$lib/crm/server/fileStore.js';
import { validateMeetingPlanner, validateRota } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { getSettings } from '$lib/crm/server/settings.js';

export async function load({ params, cookies, url }) {
	const meetingPlanner = await findById('meeting_planners', params.id);
	if (!meetingPlanner) {
		throw redirect(302, '/hub/meeting-planners');
	}

	const event = await findById('events', meetingPlanner.eventId);
	const occurrence = meetingPlanner.occurrenceId ? await findById('occurrences', meetingPlanner.occurrenceId) : null;
	
	// Load all occurrences for this event
	const allOccurrences = await readCollection('occurrences');
	const eventOccurrences = allOccurrences.filter(o => o.eventId === meetingPlanner.eventId);

	// Load all rotas
	const rotas = await readCollection('rotas');
	const settings = await getSettings();
	const settingsRotas = settings.meetingPlannerRotas || [];
	
	// Determine which rotas to load
	let rotasToLoad = [];
	
	if (meetingPlanner.rotas && Array.isArray(meetingPlanner.rotas) && meetingPlanner.rotas.length > 0) {
		// New dynamic rotas format
		rotasToLoad = meetingPlanner.rotas.map(r => ({
			key: r.role.toLowerCase().replace(/[^a-z0-9]/g, ''),
			role: r.role,
			rota: rotas.find(rota => rota.id === r.rotaId)
		}));

		// Sort based on settings order if available
		if (settingsRotas.length > 0) {
			const settingsRolesOrder = settingsRotas.map(sr => (sr.role || '').trim());
			
			rotasToLoad.sort((a, b) => {
				let roleA = (a.role || '').trim();
				let roleB = (b.role || '').trim();
				
				// Fuzzy match for Worship Team legacy name
				if (roleA === 'Worship Leader and Team') roleA = 'Worship Team';
				if (roleB === 'Worship Leader and Team') roleB = 'Worship Team';

				const indexA = settingsRolesOrder.indexOf(roleA);
				const indexB = settingsRolesOrder.indexOf(roleB);
				
				// If both found in settings, sort by settings order
				if (indexA !== -1 && indexB !== -1) return indexA - indexB;
				// If only one found, put the found one first
				if (indexA !== -1) return -1;
				if (indexB !== -1) return 1;
				// If neither found, sort alphabetically by role
				return roleA.localeCompare(roleB);
			});
		}
	} else {
		// Old fixed rotas format
		rotasToLoad = [
			{ key: 'meetingLeader', role: 'Meeting Leader', rota: meetingPlanner.meetingLeaderRotaId ? rotas.find(r => r.id === meetingPlanner.meetingLeaderRotaId) : null },
			{ key: 'worshipLeader', role: 'Worship Leader and Team', rota: meetingPlanner.worshipLeaderRotaId ? rotas.find(r => r.id === meetingPlanner.worshipLeaderRotaId) : null },
			{ key: 'speaker', role: 'Speaker', rota: meetingPlanner.speakerRotaId ? rotas.find(r => r.id === meetingPlanner.speakerRotaId) : null },
			{ key: 'callToWorship', role: 'Call to Worship', rota: meetingPlanner.callToWorshipRotaId ? rotas.find(r => r.id === meetingPlanner.callToWorshipRotaId) : null }
		];

		// Also sort the fixed rotas based on settings order
		if (settingsRotas.length > 0) {
			const settingsRolesOrder = settingsRotas.map(sr => (sr.role || '').trim());
			rotasToLoad.sort((a, b) => {
				let roleA = (a.role || '').trim();
				let roleB = (b.role || '').trim();

				// Fuzzy match for Worship Team legacy name
				if (roleA === 'Worship Leader and Team') roleA = 'Worship Team';
				if (roleB === 'Worship Leader and Team') roleB = 'Worship Team';

				const indexA = settingsRolesOrder.indexOf(roleA);
				const indexB = settingsRolesOrder.indexOf(roleB);
				
				if (indexA !== -1 && indexB !== -1) return indexA - indexB;
				if (indexA !== -1) return -1;
				if (indexB !== -1) return 1;
				return 0; // Keep fixed order for others
			});
		}
	}

	// Load contacts for assignee selection
	const contactsRaw = await readCollection('contacts');
	
	// Sort contacts alphabetically by last name, then first name
	const contacts = contactsRaw.sort((a, b) => {
		const aLastName = (a.lastName || '').toLowerCase();
		const bLastName = (b.lastName || '').toLowerCase();
		const aFirstName = (a.firstName || '').toLowerCase();
		const bFirstName = (b.firstName || '').toLowerCase();
		
		if (aLastName !== bLastName) {
			return aLastName.localeCompare(bLastName);
		}
		return aFirstName.localeCompare(bFirstName);
	});
	
	// Load all lists for filtering contacts
	const lists = await readCollection('lists');

	// Process assignees for each rota, filtering by meeting planner's occurrence
	function processAssignees(rota) {
		if (!rota || !rota.assignees) {
			return [];
		}
		
		const processed = (rota.assignees || []).map((assignee) => {
			let contactId, occurrenceId;
			
			if (typeof assignee === 'string') {
				contactId = assignee;
				occurrenceId = rota.occurrenceId;
			} else if (assignee && typeof assignee === 'object') {
				if (assignee.contactId) {
					contactId = assignee.contactId;
					occurrenceId = assignee.occurrenceId || rota.occurrenceId;
				} else if (assignee.id) {
					contactId = assignee.id;
					occurrenceId = assignee.occurrenceId || rota.occurrenceId;
				} else if (assignee.name && assignee.email) {
					contactId = { name: assignee.name, email: assignee.email };
					occurrenceId = assignee.occurrenceId || rota.occurrenceId;
				} else {
					return null;
				}
			} else {
				return null;
			}
			
			// Filter: If meeting planner is for a specific occurrence, only show assignees for that occurrence
			// If meeting planner is for all occurrences (occurrenceId is null), show all assignees
			if (meetingPlanner.occurrenceId !== null && occurrenceId !== meetingPlanner.occurrenceId) {
				return null; // Filter out assignees from other occurrences
			}
			
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
		
		return processed;
	}

	const processedRotas = {};
	const rawRotas = {};
	
	for (const item of rotasToLoad) {
		if (item.rota) {
			processedRotas[item.key] = {
				...item.rota,
				assignees: processAssignees(item.rota)
			};
			rawRotas[item.key] = item.rota;
		} else {
			processedRotas[item.key] = null;
			rawRotas[item.key] = null;
		}
	}

	// Get unique speaker series from all meeting planners (excluding current one)
	const allMeetingPlanners = await readCollection('meeting_planners');
	const speakerSeries = [...new Set(
		allMeetingPlanners
			.filter(mp => mp.id !== params.id) // Exclude current meeting planner
			.map(mp => mp.speakerSeries)
			.filter(series => series && series.trim() !== '')
	)].sort();

	const csrfToken = getCsrfToken(cookies) || '';

	return { 
		meetingPlanner, 
		event, 
		occurrence,
		eventOccurrences,
		rotas: processedRotas,
		rawRotas: rawRotas,
		rotasToLoad, // Include this so the UI knows the order and roles
		availableContacts: contacts,
		lists,
		speakerSeries,
		csrfToken 
	};
}

export const actions = {
	update: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const notes = data.get('notes') || '';
			const sanitized = await sanitizeHtml(notes);

			const meetingPlanner = await findById('meeting_planners', params.id);
			if (!meetingPlanner) {
				return fail(404, { error: 'Meeting planner not found' });
			}

			const meetingPlannerData = {
				eventId: meetingPlanner.eventId,
				occurrenceId: meetingPlanner.occurrenceId,
				communionHappening: data.get('communionHappening') === 'on' || data.get('communionHappening') === 'true',
				notes: sanitized,
				speakerTopic: data.get('speakerTopic') || '',
				speakerSeries: data.get('speakerSeries') || '',
				meetingLeaderRotaId: meetingPlanner.meetingLeaderRotaId,
				worshipLeaderRotaId: meetingPlanner.worshipLeaderRotaId,
				speakerRotaId: meetingPlanner.speakerRotaId,
				callToWorshipRotaId: meetingPlanner.callToWorshipRotaId,
				rotas: meetingPlanner.rotas || []
			};

			const validated = validateMeetingPlanner(meetingPlannerData);
			await update('meeting_planners', params.id, validated);

			return { success: true };
		} catch (error) {
			console.error('Error updating meeting planner:', error);
			return fail(400, { error: error.message || 'Failed to update meeting planner' });
		}
	},

	delete: async ({ params, cookies, request }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const meetingPlanner = await findById('meeting_planners', params.id);
			if (!meetingPlanner) {
				return fail(404, { error: 'Meeting planner not found' });
			}

			// Optionally delete rotas (for now, we'll keep them)
			// If you want to delete rotas, uncomment:
			// if (meetingPlanner.meetingLeaderRotaId) await remove('rotas', meetingPlanner.meetingLeaderRotaId);
			// if (meetingPlanner.worshipLeaderRotaId) await remove('rotas', meetingPlanner.worshipLeaderRotaId);
			// if (meetingPlanner.speakerRotaId) await remove('rotas', meetingPlanner.speakerRotaId);
			// if (meetingPlanner.callToWorshipRotaId) await remove('rotas', meetingPlanner.callToWorshipRotaId);

			await remove('meeting_planners', params.id);
			throw redirect(302, '/hub/meeting-planners');
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			console.error('Error deleting meeting planner:', error);
			return fail(400, { error: error.message || 'Failed to delete meeting planner' });
		}
	},

	addAssignee: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const rotaId = data.get('rotaId');
			const contactIdsJson = data.get('contactIds');
			const occurrenceId = data.get('occurrenceId') || null;

			if (!rotaId || !contactIdsJson) {
				return fail(400, { error: 'Missing required fields' });
			}

			let newContactIds;
			try {
				newContactIds = JSON.parse(contactIdsJson);
			} catch (parseError) {
				console.error('Error parsing contact IDs:', parseError);
				return fail(400, { error: 'Invalid contact IDs format' });
			}

			if (!Array.isArray(newContactIds)) {
				return fail(400, { error: 'Contact IDs must be an array' });
			}

			const rota = await findById('rotas', rotaId);
			if (!rota) {
				return fail(404, { error: 'Rota not found' });
			}

			const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
			
			// Get existing assignees for this occurrence
			const assigneesForOccurrence = existingAssignees.filter(a => {
				if (typeof a === 'string') {
					return rota.occurrenceId === occurrenceId;
				}
				if (a && typeof a === 'object') {
					const aOccurrenceId = a.occurrenceId || rota.occurrenceId;
					return aOccurrenceId === occurrenceId;
				}
				return false;
			});
			
			// Get existing contact IDs for this occurrence to check for duplicates
			const existingContactIdsForOcc = assigneesForOccurrence
				.map(a => typeof a === 'string' ? a : (a.contactId && typeof a.contactId === 'string' ? a.contactId : null))
				.filter(id => id !== null);
			
			// Filter out duplicates from new contact IDs BEFORE checking capacity
			const uniqueNewContactIds = newContactIds.filter(contactId => !existingContactIdsForOcc.includes(contactId));
			
			// If all were duplicates, return early
			if (uniqueNewContactIds.length === 0) {
				return { success: true, type: 'addAssignee', message: 'All selected contacts are already assigned to this occurrence', skipped: newContactIds.length };
			}
			
			// Check capacity with only the unique new assignees
			if (assigneesForOccurrence.length + uniqueNewContactIds.length > rota.capacity) {
				return fail(400, { error: `Cannot add ${uniqueNewContactIds.length} contact(s). This occurrence can only have ${rota.capacity} assignee(s) and currently has ${assigneesForOccurrence.length}.` });
			}
			
			// Add new assignees with occurrenceId (only unique ones)
			const uniqueNewAssignees = uniqueNewContactIds.map(contactId => ({
				contactId: contactId,
				occurrenceId: occurrenceId
			}));
			
			const updatedAssignees = [...existingAssignees, ...uniqueNewAssignees];

			const updatedRota = {
				...rota,
				assignees: updatedAssignees
			};
			const validated = validateRota(updatedRota);
			await update('rotas', rotaId, validated);

			// Build success message - include info about skipped duplicates if any
			let message = `Added ${uniqueNewContactIds.length} contact(s) successfully.`;
			if (uniqueNewContactIds.length < newContactIds.length) {
				const skipped = newContactIds.length - uniqueNewContactIds.length;
				message = `Added ${uniqueNewContactIds.length} contact(s). ${skipped} contact(s) were already assigned and skipped.`;
			}

			return { success: true, type: 'addAssignee', message: message, added: uniqueNewContactIds.length };
		} catch (error) {
			console.error('Error adding assignee:', error);
			return fail(400, { error: error.message || 'Failed to add assignee' });
		}
	},

	removeAssignee: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const rotaId = data.get('rotaId');
			const indexStr = data.get('index');

			if (!rotaId || indexStr === null || indexStr === undefined) {
				return fail(400, { error: 'Missing required fields' });
			}

			const index = parseInt(indexStr, 10);
			if (isNaN(index) || index < 0) {
				return fail(400, { error: 'Invalid index' });
			}

			const rota = await findById('rotas', rotaId);
			if (!rota) {
				return fail(404, { error: 'Rota not found' });
			}

			const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
			
			if (index >= existingAssignees.length) {
				return fail(400, { error: 'Index out of range' });
			}

			existingAssignees.splice(index, 1);
			const updatedRota = {
				...rota,
				assignees: existingAssignees
			};
			const validated = validateRota(updatedRota);
			await update('rotas', rotaId, validated);

			return { success: true, type: 'removeAssignee' };
		} catch (error) {
			console.error('Error removing assignee:', error);
			return fail(400, { error: error.message || 'Failed to remove assignee' });
		}
	}
};
