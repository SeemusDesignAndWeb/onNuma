import { readCollection, create, update, remove } from '$lib/crm/server/fileStore.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getWeekKey } from '$lib/crm/utils/weekUtils.js';

export async function load({ url, cookies }) {
	const events = await readCollection('events');
	const occurrences = await readCollection('occurrences');
	const weekNotes = await readCollection('week_notes');

	// Enrich occurrences with event data
	const eventsMap = new Map(events.map(e => [e.id, e]));
	const enrichedOccurrences = occurrences.map(occ => ({
		...occ,
		event: eventsMap.get(occ.eventId) || null
	})).filter(occ => occ.event !== null);

	return {
		events,
		occurrences: enrichedOccurrences,
		weekNotes: weekNotes.sort((a, b) => b.weekKey.localeCompare(a.weekKey)),
		csrfToken: getCsrfToken(cookies) || ''
	};
}

export const actions = {
	saveWeekNote: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const dateStr = data.get('date');
			const note = data.get('note') || '';

			if (!dateStr) {
				return { error: 'Date is required' };
			}

			const weekKey = getWeekKey(dateStr);
			const sanitizedNote = await sanitizeHtml(note);

			const weekNotes = await readCollection('week_notes');
			const existingNote = weekNotes.find(n => n.weekKey === weekKey);

			if (existingNote) {
				await update('week_notes', existingNote.id, {
					note: sanitizedNote,
					updatedAt: new Date().toISOString()
				});

				const adminId = locals?.admin?.id || null;
				const event = { getClientAddress: () => 'unknown', request };
				await logDataChange(adminId, 'update', 'week_note', existingNote.id, {
					weekKey: weekKey
				}, event);
			} else {
				const newNote = await create('week_notes', {
					weekKey: weekKey,
					note: sanitizedNote
				});

				const adminId = locals?.admin?.id || null;
				const event = { getClientAddress: () => 'unknown', request };
				await logDataChange(adminId, 'create', 'week_note', newNote.id, {
					weekKey: weekKey
				}, event);
			}

			return { success: true, type: 'weekNote', weekKey };
		} catch (error) {
			console.error('[Save Week Note] Error:', error);
			return { error: error.message || 'Failed to save week note' };
		}
	},

	deleteWeekNote: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const weekKey = data.get('weekKey');
			if (!weekKey) {
				return { error: 'Week key is required' };
			}

			const weekNotes = await readCollection('week_notes');
			const noteToDelete = weekNotes.find(n => n.weekKey === weekKey);

			if (!noteToDelete) {
				return { error: 'Week note not found' };
			}

			await remove('week_notes', noteToDelete.id);

			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'delete', 'week_note', noteToDelete.id, {
				weekKey: weekKey
			}, event);

			return { success: true, type: 'deleteWeekNote' };
		} catch (error) {
			console.error('[Delete Week Note] Error:', error);
			return { error: error.message || 'Failed to delete week note' };
		}
	}
};

