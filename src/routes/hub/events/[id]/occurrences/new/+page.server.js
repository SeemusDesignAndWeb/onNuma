import { redirect, fail } from '@sveltejs/kit';
import { findById, create } from '$lib/crm/server/fileStore.js';
import { validateOccurrence } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { generateOccurrences } from '$lib/crm/server/recurrence.js';

export async function load({ params, cookies }) {
	const event = await findById('events', params.id);
	if (!event) {
		throw redirect(302, '/hub/events');
	}

	const csrfToken = getCsrfToken(cookies) || '';
	return { event, csrfToken };
}

export const actions = {
	create: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const repeatType = data.get('repeatType') || 'none';
			const startsAt = data.get('startsAt');
			const endsAt = data.get('endsAt');
			const location = data.get('location') || '';
			const maxSpaces = data.get('maxSpaces') ? parseInt(data.get('maxSpaces')) : null;
			const information = data.get('information') || '';

			if (!startsAt || !endsAt) {
				return fail(400, { error: 'Start and end dates are required' });
			}

			// Convert datetime-local to ISO format
			const startISO = new Date(startsAt).toISOString();
			const endISO = new Date(endsAt).toISOString();

			// If recurrence is enabled, generate multiple occurrences
			if (repeatType !== 'none') {
				const occurrences = generateOccurrences({
					repeatType: repeatType,
					repeatInterval: data.get('repeatInterval') ? parseInt(data.get('repeatInterval')) : 1,
					startDate: new Date(startsAt),
					endDate: new Date(endsAt),
					repeatEndType: data.get('repeatEndType') || 'never',
					repeatEndDate: data.get('repeatEndDate') ? new Date(data.get('repeatEndDate')) : null,
					repeatCount: data.get('repeatCount') ? parseInt(data.get('repeatCount')) : null,
					repeatDayOfMonth: data.get('repeatDayOfMonth') ? parseInt(data.get('repeatDayOfMonth')) : null,
					repeatDayOfWeek: data.get('repeatDayOfWeek') || null,
					repeatWeekOfMonth: data.get('repeatWeekOfMonth') || null,
					location: location
				});

				// Create all occurrences
				for (const occ of occurrences) {
					const occurrenceData = {
						eventId: params.id,
						startsAt: occ.startsAt,
						endsAt: occ.endsAt,
						location: occ.location,
						maxSpaces: maxSpaces,
						information: information
					};
					const validated = validateOccurrence(occurrenceData);
					await create('occurrences', validated);
				}
			} else {
				// Single occurrence
				const occurrenceData = {
					eventId: params.id,
					startsAt: startISO,
					endsAt: endISO,
					location: location,
					maxSpaces: maxSpaces,
					information: information
				};

				const validated = validateOccurrence(occurrenceData);
				await create('occurrences', validated);
			}

			throw redirect(302, `/hub/events/${params.id}`);
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			return fail(400, { error: error.message });
		}
	}
};

