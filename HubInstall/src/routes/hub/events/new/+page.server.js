import { fail, redirect } from '@sveltejs/kit';
import { create } from '$lib/crm/server/fileStore.js';
import { validateEvent, validateOccurrence } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { generateOccurrences } from '$lib/crm/server/recurrence.js';
import { generateId } from '$lib/crm/server/ids.js';

export async function load({ cookies }) {
	const csrfToken = getCsrfToken(cookies) || '';
	return { csrfToken };
}

export const actions = {
	create: async ({ request, cookies }) => {
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

			// Generate occurrences if recurrence is enabled
			if (validated.repeatType !== 'none') {
				const firstStart = data.get('firstStart');
				const firstEnd = data.get('firstEnd');
				
				if (firstStart && firstEnd) {
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
							location: occ.location
						};
						const validatedOcc = validateOccurrence(occurrenceData);
						await create('occurrences', validatedOcc);
					}
				}
			}

			throw redirect(302, `/hub/events/${event.id}`);
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			return fail(400, { error: error.message });
		}
	}
};

