import { fail, redirect } from '@sveltejs/kit';
import { create } from '$lib/crm/server/fileStore.js';
import { validateEvent, validateOccurrence } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { generateOccurrences } from '$lib/crm/server/recurrence.js';
import { generateId } from '$lib/crm/server/ids.js';
import { logDataChange } from '$lib/crm/server/audit.js';

export async function load({ cookies }) {
	const csrfToken = getCsrfToken(cookies) || '';
	return { csrfToken };
}

export const actions = {
	create: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const description = data.get('description') || '';
			const sanitized = await sanitizeHtml(description);

			const eventData = {
				title: data.get('title'),
				description: sanitized,
				location: data.get('location'),
				visibility: ['public', 'private', 'internal'].includes(data.get('visibility')) ? data.get('visibility') : 'private',
				enableSignup: data.get('enableSignup') === 'on' || data.get('enableSignup') === 'true',
				hideFromEmail: data.get('hideFromEmail') === 'on' || data.get('hideFromEmail') === 'true',
				color: data.get('color') || '#9333ea',
				// Recurrence fields
				repeatType: data.get('repeatType') || 'none',
				repeatInterval: data.get('repeatInterval') ? parseInt(data.get('repeatInterval')) : 1,
				repeatEndType: data.get('repeatEndType') || 'never',
				repeatEndDate: data.get('repeatEndDate') || null,
				repeatCount: data.get('repeatCount') ? parseInt(data.get('repeatCount')) : null,
				repeatDayOfMonth: data.get('repeatDayOfMonth') ? parseInt(data.get('repeatDayOfMonth')) : null,
				repeatDayOfWeek: data.get('repeatDayOfWeek') || null,
				repeatWeekOfMonth: data.get('repeatWeekOfMonth') || null
			};

			const validated = validateEvent(eventData);
			const event = await create('events', validated);

			// Get first occurrence dates
			let firstStart = data.get('firstStart');
			let firstEnd = data.get('firstEnd');
			const allDay = data.get('allDay') === 'true';
			const firstDate = data.get('firstDate');
			
			// If all-day and firstDate is provided but firstStart/firstEnd are missing, create them
			if (allDay && firstDate && (!firstStart || !firstEnd)) {
				firstStart = `${firstDate}T00:00`;
				firstEnd = `${firstDate}T23:59`;
			}
			
			if (firstStart && firstEnd) {
				// Generate occurrences if recurrence is enabled
				if (validated.repeatType !== 'none') {
					const occurrences = generateOccurrences({
						repeatType: validated.repeatType,
						repeatInterval: validated.repeatInterval,
						startDate: new Date(firstStart),
						endDate: new Date(firstEnd),
						repeatEndType: validated.repeatEndType,
						repeatEndDate: validated.repeatEndDate ? new Date(validated.repeatEndDate) : null,
						repeatCount: validated.repeatCount,
						repeatDayOfMonth: validated.repeatDayOfMonth,
						repeatDayOfWeek: validated.repeatDayOfWeek,
						repeatWeekOfMonth: validated.repeatWeekOfMonth,
						location: validated.location
					});

					// Create all occurrences
					for (const occ of occurrences) {
						const occurrenceData = {
							eventId: event.id,
							startsAt: occ.startsAt,
							endsAt: occ.endsAt,
							location: occ.location,
							allDay: allDay
						};
						const validatedOcc = validateOccurrence(occurrenceData);
						await create('occurrences', validatedOcc);
					}
				} else {
					// Create a single occurrence for non-recurring events
					const occurrenceData = {
						eventId: event.id,
						startsAt: new Date(firstStart).toISOString(),
						endsAt: new Date(firstEnd).toISOString(),
						location: validated.location,
						allDay: allDay
					};
					const validatedOcc = validateOccurrence(occurrenceData);
					await create('occurrences', validatedOcc);
				}
			} else if (allDay && firstDate) {
				// Fallback: if we have firstDate but no firstStart/firstEnd, create occurrence from firstDate
				const occurrenceData = {
					eventId: event.id,
					startsAt: new Date(`${firstDate}T00:00`).toISOString(),
					endsAt: new Date(`${firstDate}T23:59`).toISOString(),
					location: validated.location,
					allDay: true
				};
				const validatedOcc = validateOccurrence(occurrenceData);
				await create('occurrences', validatedOcc);
			}

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const eventObj = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'create', 'event', event.id, {
				title: event.title
			}, eventObj);

			throw redirect(302, `/hub/events/${event.id}`);
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			return fail(400, { error: error.message });
		}
	}
};

