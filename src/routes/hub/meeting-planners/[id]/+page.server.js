import { redirect, fail } from '@sveltejs/kit';
import { findById, update, remove } from '$lib/crm/server/fileStore.js';
import { validateMeetingPlanner, validateRota } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';

export async function load({ params }) {
	const meetingPlanner = await findById('meeting_planners', params.id);
	const organisationId = await getCurrentOrganisationId();
	if (!meetingPlanner || (meetingPlanner.organisationId != null && meetingPlanner.organisationId !== organisationId)) {
		throw redirect(302, '/hub/planner');
	}
	// Planner is notes + attached schedules only; redirect to planner for this event
	const eventId = meetingPlanner.eventId;
	throw redirect(302, eventId ? `/hub/planner?eventId=${encodeURIComponent(eventId)}` : '/hub/planner');
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

			const organisationId = await getCurrentOrganisationId();
			const meetingPlanner = await findById('meeting_planners', params.id);
			if (!meetingPlanner) {
				return fail(404, { error: 'Meeting plan not found' });
			}
			if (meetingPlanner.organisationId != null && meetingPlanner.organisationId !== organisationId) {
				return fail(404, { error: 'Meeting plan not found' });
			}

			const meetingPlannerData = {
				eventId: meetingPlanner.eventId,
				occurrenceId: meetingPlanner.occurrenceId,
				communionHappening: data.get('communionHappening') === 'on' || data.get('communionHappening') === 'true',
				notes: sanitized,
				speakerTopic: data.get('speakerTopic') || '',
				speakerSeries: data.get('speakerSeries') || ''
			};

			const validated = validateMeetingPlanner(meetingPlannerData);
			await update('meeting_planners', params.id, validated);

			return { success: true };
		} catch (error) {
			console.error('Error updating meeting planner:', error);
			return fail(400, { error: error.message || 'Failed to update meeting plan' });
		}
	},

	delete: async ({ params, cookies, request }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const organisationId = await getCurrentOrganisationId();
			const meetingPlanner = await findById('meeting_planners', params.id);
			if (!meetingPlanner) {
				return fail(404, { error: 'Meeting plan not found' });
			}
			if (meetingPlanner.organisationId != null && meetingPlanner.organisationId !== organisationId) {
				return fail(404, { error: 'Meeting plan not found' });
			}

			// Optionally delete rotas (for now, we'll keep them)
			// If you want to delete rotas, uncomment:
			// if (meetingPlanner.meetingLeaderRotaId) await remove('rotas', meetingPlanner.meetingLeaderRotaId);
			// if (meetingPlanner.worshipLeaderRotaId) await remove('rotas', meetingPlanner.worshipLeaderRotaId);
			// if (meetingPlanner.speakerRotaId) await remove('rotas', meetingPlanner.speakerRotaId);
			// if (meetingPlanner.callToWorshipRotaId) await remove('rotas', meetingPlanner.callToWorshipRotaId);

			await remove('meeting_planners', params.id);
			throw redirect(302, '/hub/planner');
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			console.error('Error deleting meeting planner:', error);
			return fail(400, { error: error.message || 'Failed to delete meeting plan' });
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

			const guestJson = data.get('guest');
			let guestData = null;
			if (guestJson) {
				try {
					guestData = JSON.parse(guestJson);
				} catch (e) {
					return fail(400, { error: 'Invalid guest data' });
				}
			}

			const organisationId = await getCurrentOrganisationId();
			const rota = await findById('rotas', rotaId);
			if (!rota) {
				return fail(404, { error: 'Rota not found' });
			}
			if (rota.organisationId != null && rota.organisationId !== organisationId) {
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
			
			// Check if we have anything to add
			if (uniqueNewContactIds.length === 0 && !guestData) {
				return { success: true, type: 'addAssignee', message: 'No new assignees to add', skipped: newContactIds.length };
			}
			
			// Check capacity
			const totalToAdd = uniqueNewContactIds.length + (guestData ? 1 : 0);
			if (assigneesForOccurrence.length + totalToAdd > rota.capacity) {
				return fail(400, { error: `Cannot add ${totalToAdd} assignee(s). This occurrence can only have ${rota.capacity} assignee(s) and currently has ${assigneesForOccurrence.length}.` });
			}
			
			// Add new assignees
			const newAssignees = uniqueNewContactIds.map(contactId => ({
				contactId: contactId,
				occurrenceId: occurrenceId
			}));

			if (guestData) {
				newAssignees.push({
					contactId: { name: `Guest: ${guestData.name}`, email: '' },
					occurrenceId: occurrenceId
				});
			}
			
			const updatedAssignees = [...existingAssignees, ...newAssignees];

			const updatedRota = {
				...rota,
				assignees: updatedAssignees
			};
			const validated = validateRota(updatedRota);
			await update('rotas', rotaId, validated);

			// Build success message
			let message = `Added ${uniqueNewContactIds.length} contact(s) successfully.`;
			if (guestData && uniqueNewContactIds.length === 0) {
				message = 'Guest added successfully.';
			} else if (guestData) {
				message = `Added ${uniqueNewContactIds.length} contact(s) and guest successfully.`;
			} else if (uniqueNewContactIds.length < newContactIds.length) {
				const skipped = newContactIds.length - uniqueNewContactIds.length;
				message = `Added ${uniqueNewContactIds.length} contact(s). ${skipped} contact(s) were already assigned and skipped.`;
			}

			return { success: true, type: 'addAssignee', message: message, added: uniqueNewContactIds.length + (guestData ? 1 : 0) };
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

			const organisationId = await getCurrentOrganisationId();
			const rota = await findById('rotas', rotaId);
			if (!rota) {
				return fail(404, { error: 'Rota not found' });
			}
			if (rota.organisationId != null && rota.organisationId !== organisationId) {
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
