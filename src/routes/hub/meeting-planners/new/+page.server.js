import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection } from '$lib/crm/server/fileStore.js';
import { validateMeetingPlanner, validateRota } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { getSettings } from '$lib/crm/server/settings.js';
import { getCurrentOrganisationId, filterByOrganisation, withOrganisationId } from '$lib/crm/server/orgContext.js';

export async function load({ cookies, url }) {
	const organisationId = await getCurrentOrganisationId();
	const events = filterByOrganisation(await readCollection('events'), organisationId);
	const occurrences = filterByOrganisation(await readCollection('occurrences'), organisationId);
	const meetingPlanners = filterByOrganisation(await readCollection('meeting_planners'), organisationId);
	const eventId = url.searchParams.get('eventId') || '';
	
	// Get occurrence IDs that already have a meeting planner attached
	const occurrenceIdsWithPlanners = new Set(
		meetingPlanners
			.filter(mp => mp.occurrenceId !== null && mp.occurrenceId !== undefined)
			.map(mp => mp.occurrenceId)
	);
	
	// Filter out occurrences that already have a meeting planner
	const availableOccurrences = occurrences.filter(occ => 
		!occurrenceIdsWithPlanners.has(occ.id)
	);
	
	const csrfToken = getCsrfToken(cookies) || '';
	return { events, occurrences: availableOccurrences, eventId, csrfToken };
}

export const actions = {
	create: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const notes = data.get('notes') || '';
			const sanitized = await sanitizeHtml(notes);

			const eventId = data.get('eventId');
			const occurrenceId = data.get('occurrenceId') || null;

			if (!eventId) {
				return fail(400, { error: 'Event is required' });
			}

			const organisationId = await getCurrentOrganisationId();

			// Verify event exists and belongs to current org
			const events = filterByOrganisation(await readCollection('events'), organisationId);
			const event = events.find(e => e.id === eventId);
			if (!event) {
				return fail(400, { error: 'Event not found' });
			}

			// Verify occurrence exists if provided
			if (occurrenceId) {
				const occurrences = filterByOrganisation(await readCollection('occurrences'), organisationId);
				const occurrence = occurrences.find(o => o.id === occurrenceId && o.eventId === eventId);
				if (!occurrence) {
					return fail(400, { error: 'Occurrence not found or does not belong to event' });
				}
				
				// Check if this occurrence already has a meeting planner
				const meetingPlanners = filterByOrganisation(await readCollection('meeting_planners'), organisationId);
				const existingPlanner = meetingPlanners.find(mp => mp.occurrenceId === occurrenceId);
				if (existingPlanner) {
					return fail(400, { error: 'This occurrence already has a meeting planner attached' });
				}
			}

			// Create the standard rotas from settings (or use existing ones)
			// Rotas are always for the entire event (occurrenceId = null) to match all event occurrences
			// Individual assignees specify their occurrenceId
			const settings = await getSettings();
			const rotaRoles = settings.meetingPlannerRotas || [];

			// Load existing rotas to check for duplicates (scoped to current org)
			const existingRotas = filterByOrganisation(await readCollection('rotas'), organisationId);

			const rotaIds = {};
			const dynamicRotas = [];

			for (const rotaRole of rotaRoles) {
				// Check if a rota with the same role and eventId already exists
				// Match by eventId and role only - rotas are for all occurrences (occurrenceId = null)
				const existingRota = existingRotas.find(r => 
					r.role === rotaRole.role &&
					r.eventId === eventId &&
					r.occurrenceId === null // Only match rotas for all occurrences
				);

				let rotaId;
				if (existingRota) {
					// Use existing rota
					rotaId = existingRota.id;
				} else {
					// Create new rota - always for all occurrences (occurrenceId = null)
					// Meeting planner rotas are internal by default
					const rotaData = {
						eventId: eventId,
						occurrenceId: null, // Always null - rota applies to all occurrences
						role: rotaRole.role,
						capacity: rotaRole.capacity || 1,
						assignees: [],
						notes: '',
						visibility: 'internal'
					};

					const validated = validateRota(rotaData);
					const rota = await create('rotas', withOrganisationId(validated, organisationId));
					rotaId = rota.id;
				}

				// Store for dynamic rotas array
				dynamicRotas.push({
					role: rotaRole.role,
					rotaId: rotaId
				});

				// Maintain backward compatibility for the 4 standard roles
				if (rotaRole.role === 'Meeting Leader') {
					rotaIds.meetingLeaderRotaId = rotaId;
				} else if (rotaRole.role === 'Worship Leader and Team') {
					rotaIds.worshipLeaderRotaId = rotaId;
				} else if (rotaRole.role === 'Speaker') {
					rotaIds.speakerRotaId = rotaId;
				} else if (rotaRole.role === 'Call to Worship') {
					rotaIds.callToWorshipRotaId = rotaId;
				}
			}

			// Create the meeting planner
			const meetingPlannerData = {
				eventId: eventId,
				occurrenceId: occurrenceId,
				communionHappening: false,
				notes: sanitized,
				speakerTopic: '',
				speakerSeries: ''
			};

			const validated = validateMeetingPlanner(meetingPlannerData);
			const meetingPlanner = await create('meeting_planners', withOrganisationId(validated, organisationId));

			throw redirect(302, `/hub/meeting-planners/${meetingPlanner.id}`);
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			return fail(400, { error: error.message || 'Failed to create meeting planner' });
		}
	}
};
