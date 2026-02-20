import { findMany, create, update, remove } from '$lib/crm/server/fileStore.js';
import { generateId } from '$lib/crm/server/ids.js';

export const SEEN_TYPES = ['pending_volunteer', 'pastoral_concern', 'form_submission', 'dbs_notification'];

/**
 * Mark a notification as seen for the given org/admin.
 * Upserts: updates existing seen record or creates a new one.
 */
export async function markSeen({ organisationId, notificationType, recordId, seenBy }) {
	if (!SEEN_TYPES.includes(notificationType)) return;
	const existing = await findMany('seen_notifications', (r) =>
		r.organisationId === organisationId &&
		r.notificationType === notificationType &&
		r.recordId === recordId
	);
	if (existing.length > 0) {
		await update('seen_notifications', existing[0].id, {
			...existing[0],
			seenAt: new Date().toISOString(),
			seenBy: seenBy || null
		});
	} else {
		await create('seen_notifications', {
			id: generateId(),
			organisationId,
			notificationType,
			recordId,
			seenAt: new Date().toISOString(),
			seenBy: seenBy || null
		});
	}
}

/**
 * Get a Set of record IDs that have been seen for a given org and notification type.
 */
export async function getSeenIds(organisationId, notificationType) {
	const records = await findMany('seen_notifications', (r) =>
		r.organisationId === organisationId && r.notificationType === notificationType
	);
	return new Set(records.map((r) => r.recordId));
}

/**
 * Delete seen records matching the given criteria (cleanup after resolution).
 * Non-fatal: silently ignores errors.
 */
export async function deleteSeenRecord(organisationId, notificationType, recordId) {
	try {
		const records = await findMany('seen_notifications', (r) =>
			r.organisationId === organisationId &&
			r.notificationType === notificationType &&
			r.recordId === recordId
		);
		await Promise.all(records.map((r) => remove('seen_notifications', r.id)));
	} catch (_) {
		// Non-fatal
	}
}
