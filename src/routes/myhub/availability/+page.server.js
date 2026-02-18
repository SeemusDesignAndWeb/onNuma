import { fail } from '@sveltejs/kit';
import { findById, update } from '$lib/crm/server/fileStore.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { getHolidaysByContact, addHoliday, deleteHoliday } from '$lib/crm/server/holidays.js';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const TIMES = ['morning', 'afternoon', 'evening'];

export async function load({ cookies }) {
	const contactId = getMemberContactIdFromCookie(cookies);
	if (!contactId) return { holidays: [], unavailability: {} };
	try {
		const [holidays, contact] = await Promise.all([
			getHolidaysByContact(contactId),
			findById('contacts', contactId)
		]);
		// Sort: future first, then past
		const now = new Date();
		const sorted = holidays
			.map((h) => ({
				id: h.id,
				startDate: h.startDate,
				endDate: h.endDate,
				allDay: h.allDay ?? true
			}))
			.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
		return {
			holidays: sorted,
			unavailability: contact?.unavailability || {}
		};
	} catch (err) {
		console.error('[myhub/availability] load failed:', err?.message || err);
		return { holidays: [], unavailability: {} };
	}
}

export const actions = {
	add: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.' });
		}
		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in to set away dates.' });
		}
		try {
			const contact = await findById('contacts', contactId);
			if (!contact) return fail(404, { error: 'Contact not found.' });

			const startDate = data.get('startDate');
			const endDate = data.get('endDate');
			if (!startDate || !endDate) {
				return fail(400, { error: 'Start and end dates are required.' });
			}
			const start = new Date(startDate);
			const end = new Date(endDate);
			if (isNaN(start.getTime()) || isNaN(end.getTime())) {
				return fail(400, { error: 'Invalid dates. Please try again.' });
			}
			if (end < start) {
				return fail(400, { error: 'End date must be after start date.' });
			}

			// Normalize to all-day ranges
			const normalizedStart = startDate.includes('T')
				? startDate.split('T')[0] + 'T00:00:00.000Z'
				: startDate + 'T00:00:00.000Z';
			const normalizedEnd = endDate.includes('T')
				? endDate.split('T')[0] + 'T23:59:59.999Z'
				: endDate + 'T23:59:59.999Z';

			const organisationId = await getCurrentOrganisationId();
			const holiday = await addHoliday({
				contactId,
				startDate: normalizedStart,
				endDate: normalizedEnd,
				allDay: true,
				...(organisationId ? { organisationId } : {})
			});

			return { success: true, message: 'Away dates added.' };
		} catch (err) {
			console.error('[myhub/availability] add failed:', err?.message || err);
			return fail(500, { error: err?.message || 'Failed to add away dates.' });
		}
	},

	remove: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.' });
		}
		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in.' });
		}
		try {
			const holidayId = data.get('holidayId');
			if (!holidayId) return fail(400, { error: 'Holiday ID is required.' });

			const holiday = await findById('holidays', holidayId);
			if (!holiday) return fail(404, { error: 'Away period not found.' });
			if (holiday.contactId !== contactId) {
				return fail(403, { error: 'You can only remove your own away dates.' });
			}

			await deleteHoliday(holidayId);
			return { success: true, message: 'Away dates removed.' };
		} catch (err) {
			console.error('[myhub/availability] remove failed:', err?.message || err);
			return fail(500, { error: err?.message || 'Failed to remove away dates.' });
		}
	},

	updateUnavailability: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.' });
		}
		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in to update availability.' });
		}
		try {
			const contact = await findById('contacts', contactId);
			if (!contact) return fail(404, { error: 'Contact not found.' });

			const unavailability = {};
			for (const day of DAYS) {
				unavailability[day] = {};
				for (const time of TIMES) {
					unavailability[day][time] = data.get(`unavail_${day}_${time}`) === 'on';
				}
			}

			const updated = {
				...contact,
				unavailability,
				updatedAt: new Date().toISOString()
			};
			await update('contacts', contactId, updated);
			return { success: true, message: 'Days and times saved.', unavailability };
		} catch (err) {
			console.error('[myhub/availability] updateUnavailability failed:', err?.message || err);
			return fail(500, { error: err?.message || 'Failed to save.' });
		}
	}
};
