import { badgeCounts } from '$lib/crm/stores/badgeCounts.js';

const TYPE_TO_KEY = {
	pending_volunteer: 'pendingVolunteers',
	pastoral_concern: 'pastoralConcerns',
	form_submission: 'formSubmissions',
	dbs_notification: 'dbsNotifications'
};

/**
 * Mark one or more record IDs as seen for a notification type.
 * Fire-and-continue: never blocks rendering.
 * On success, decrements the badge count store by the number of record IDs.
 *
 * @param {string} notificationType - e.g. 'pending_volunteer'
 * @param {string|string[]} recordIds - one or more record IDs to mark as seen
 */
export function markNotificationSeen(notificationType, recordIds) {
	const ids = Array.isArray(recordIds) ? recordIds : [recordIds];
	if (ids.length === 0) return;

	const storeKey = TYPE_TO_KEY[notificationType];

	fetch('/hub/api/notifications/seen', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ notificationType, recordIds: ids })
	})
		.then((res) => {
			if (res.ok && storeKey) {
				for (let i = 0; i < ids.length; i++) {
					badgeCounts.decrement(storeKey);
				}
			}
		})
		.catch(console.error);
}
