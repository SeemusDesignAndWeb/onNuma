import { redirect, fail } from '@sveltejs/kit';
import { findById, update, remove, readCollection, findMany } from '$lib/crm/server/fileStore.js';
import { validateEvent, getEventColors } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { ensureEventToken, ensureOccurrenceToken } from '$lib/crm/server/tokens.js';
import { env } from '$env/dynamic/private';
import { logDataChange } from '$lib/crm/server/audit.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';

export async function load({ params, cookies, url }) {
	const event = await findById('events', params.id);
	if (!event) {
		throw redirect(302, '/hub/events');
	}

	const eventOccurrences = await findMany('occurrences', o => o.eventId === params.id);
	const occurrences = filterUpcomingOccurrences(eventOccurrences);
	const rotas = await findMany('rotas', r => r.eventId === params.id);
	const eventSignups = await findMany('event_signups', s => s.eventId === params.id);
	const meetingPlanners = await findMany('meeting_planners', mp => mp.eventId === params.id);

	// Calculate rota statistics and signup statistics for each occurrence
	const occurrencesWithStats = occurrences.map(occ => {
		// Find rotas that apply to this occurrence
		// A rota applies if:
		// 1. It has no occurrenceId (applies to all occurrences)
		// 2. It has an occurrenceId matching this occurrence
		const applicableRotas = rotas.filter(rota => {
			return !rota.occurrenceId || rota.occurrenceId === occ.id;
		});

		// Calculate stats for this occurrence
		let totalCapacity = 0;
		let totalAssigned = 0;
		let rotaCount = applicableRotas.length;

		applicableRotas.forEach(rota => {
			totalCapacity += rota.capacity || 0;
			
			// Count assignees for this specific occurrence
			const assignees = rota.assignees || [];
			const assigneesForOcc = assignees.filter(a => {
				if (typeof a === 'string') {
					// Old format - if rota has occurrenceId, only count for that occurrence
					return rota.occurrenceId === occ.id;
				}
				if (a && typeof a === 'object') {
					const aOccId = a.occurrenceId || rota.occurrenceId;
					return aOccId === occ.id;
				}
				return false;
			});
			
			totalAssigned += assigneesForOcc.length;
		});

		const spotsRemaining = totalCapacity - totalAssigned;

		// Calculate event signup statistics for this occurrence
		const occSignups = eventSignups.filter(s => s.occurrenceId === occ.id);
		const totalAttendees = occSignups.reduce((sum, s) => sum + (s.guestCount || 0) + 1, 0); // +1 for the signup person
		// Use occurrence maxSpaces if set, otherwise use event maxSpaces
		const effectiveMaxSpaces = occ.maxSpaces !== null && occ.maxSpaces !== undefined ? occ.maxSpaces : event.maxSpaces;
		const availableSpots = effectiveMaxSpaces ? effectiveMaxSpaces - totalAttendees : null;
		const isFull = effectiveMaxSpaces ? totalAttendees >= effectiveMaxSpaces : false;

		return {
			...occ,
			rotaStats: {
				rotaCount,
				totalCapacity,
				totalAssigned,
				spotsRemaining
			},
			signupStats: {
				signupCount: occSignups.length,
				totalAttendees,
				availableSpots,
				isFull,
				signups: occSignups
			}
		};
	});

	// Ensure an event token exists and generate links
	let rotaSignupLink = '';
	let publicEventLink = '';
	const occurrenceLinks = [];
	
	try {
		const token = await ensureEventToken(params.id);
		const baseUrl = url.origin || env.APP_BASE_URL || 'http://localhost:5173';
		rotaSignupLink = `${baseUrl}/signup/event/${token.token}`;
		publicEventLink = `${baseUrl}/event/${token.token}`;
		
		// Generate occurrence-specific links
		for (const occ of occurrences) {
			try {
				const occToken = await ensureOccurrenceToken(params.id, occ.id);
				occurrenceLinks.push({
					occurrenceId: occ.id,
					link: `${baseUrl}/event/${occToken.token}`
				});
			} catch (error) {
				console.error(`Error generating token for occurrence ${occ.id}:`, error);
			}
		}
	} catch (error) {
		console.error('Error generating event token:', error);
		// Continue without links if token generation fails
	}

	const csrfToken = getCsrfToken(cookies) || '';
	const eventColors = await getEventColors();
	const lists = await readCollection('lists');
	return { event, occurrences: occurrencesWithStats, rotas, meetingPlanners, rotaSignupLink, publicEventLink, occurrenceLinks, csrfToken, eventColors, lists };
}

export const actions = {
	update: async ({ request, params, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			// Get existing event to preserve fields not in the form
			const existingEvent = await findById('events', params.id);
			if (!existingEvent) {
				return { error: 'Event not found' };
			}

			const description = data.get('description') || '';
			const sanitized = await sanitizeHtml(description);

			// Handle listIds - can be multiple form values with the same name
			const listIds = data.getAll('listIds').filter(id => id && id.trim().length > 0);

			const eventData = {
				title: data.get('title'),
				description: sanitized,
				location: data.get('location'),
				visibility: ['public', 'private', 'internal'].includes(data.get('visibility')) ? data.get('visibility') : 'private',
				enableSignup: data.get('enableSignup') === 'on' || data.get('enableSignup') === 'true',
				hideFromEmail: data.get('hideFromEmail') === 'on' || data.get('hideFromEmail') === 'true',
				maxSpaces: data.get('maxSpaces') ? parseInt(data.get('maxSpaces')) : null,
				color: data.get('color') || existingEvent.color || '#9333ea',
				listIds: listIds,
				// Preserve recurrence fields if they exist
				repeatType: existingEvent.repeatType || 'none',
				repeatInterval: existingEvent.repeatInterval || 1,
				repeatEndType: existingEvent.repeatEndType || 'never',
				repeatEndDate: existingEvent.repeatEndDate || null,
				repeatCount: existingEvent.repeatCount || null,
				repeatDayOfMonth: existingEvent.repeatDayOfMonth || null,
				repeatDayOfWeek: existingEvent.repeatDayOfWeek || null,
				repeatWeekOfMonth: existingEvent.repeatWeekOfMonth || null,
				meta: existingEvent.meta || {}
			};

			const validated = await validateEvent(eventData);
			await update('events', params.id, validated);

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'update', 'event', params.id, {
				title: validated.title
			}, event);

			return { success: true };
		} catch (error) {
			console.error('[Update Event] Error:', error);
			return { error: error.message || 'Failed to update event' };
		}
	},

	delete: async ({ params, cookies, request, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		// Get event data before deletion for audit log
		const event = await findById('events', params.id);
		
		await remove('events', params.id);

		// Log audit event
		const adminId = locals?.admin?.id || null;
		const eventObj = { getClientAddress: () => 'unknown', request };
		await logDataChange(adminId, 'delete', 'event', params.id, {
			title: event?.title || 'unknown'
		}, eventObj);

		throw redirect(302, '/hub/events');
	},

	deleteSignup: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const signupId = data.get('signupId');
			if (!signupId) {
				return fail(400, { error: 'Signup ID is required' });
			}

			// Verify the signup belongs to this event
			const signup = await findById('event_signups', signupId);
			if (!signup) {
				return fail(404, { error: 'Signup not found' });
			}

			if (signup.eventId !== params.id) {
				return fail(403, { error: 'Signup does not belong to this event' });
			}

			await remove('event_signups', signupId);
			return { success: true, type: 'deleteSignup' };
		} catch (error) {
			console.error('Error deleting signup:', error);
			return fail(400, { error: error.message || 'Failed to delete signup' });
		}
	}
};

