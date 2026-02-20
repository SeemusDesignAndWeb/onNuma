import { json } from '@sveltejs/kit';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';
import { markSeen, SEEN_TYPES } from '$lib/crm/server/seenNotifications.js';

export async function POST({ request, locals }) {
	if (!locals.admin) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid request body' }, { status: 400 });
	}

	const { notificationType, recordIds } = body;

	if (!SEEN_TYPES.includes(notificationType)) {
		return json({ error: 'Invalid notification type' }, { status: 400 });
	}
	if (!Array.isArray(recordIds) || recordIds.length === 0) {
		return json({ error: 'recordIds must be a non-empty array' }, { status: 400 });
	}

	try {
		const organisationId = await getCurrentOrganisationId();
		await Promise.all(
			recordIds.map((recordId) =>
				markSeen({
					organisationId,
					notificationType,
					recordId: String(recordId),
					seenBy: locals.admin.id || null
				})
			)
		);
		return json({ success: true });
	} catch (err) {
		console.error('[notifications/seen] error:', err?.message || err);
		return json({ error: 'Internal error' }, { status: 500 });
	}
}
