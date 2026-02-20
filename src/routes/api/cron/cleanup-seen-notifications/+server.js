// Cron job to clean up stale seen_notifications records.
// Access: GET /api/cron/cleanup-seen-notifications?secret=CRON_SECRET
//
// Removes seen records where the underlying notification source has been resolved:
//   - pending_volunteer: record approved, declined, or deleted
//   - pastoral_concern: flag dismissed, followed-up, or deleted
//   - form_submission: submission archived or deleted
//   - dbs_notification: DBS renewed (green status) or contact deleted
// Also removes any seen records older than 90 days as a general failsafe.

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { findMany, findById, remove } from '$lib/crm/server/fileStore.js';
import { getDbsStatus } from '$lib/crm/server/dbs.js';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET({ url }) {
	const secret = url.searchParams.get('secret');
	const expected = env.CRON_SECRET || env.DBS_RENEWAL_CRON_SECRET || '';
	if (!expected || secret !== expected) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let deleted = 0;
	const cutoff = new Date(Date.now() - NINETY_DAYS_MS).toISOString();

	try {
		const allSeen = await findMany('seen_notifications', () => true);

		await Promise.all(
			allSeen.map(async (record) => {
				let shouldDelete = false;

				// Age-based failsafe: delete records older than 90 days
				if (record.seenAt && record.seenAt < cutoff) {
					shouldDelete = true;
				}

				if (!shouldDelete) {
					switch (record.notificationType) {
						case 'pending_volunteer': {
							const pv = await findById('pending_volunteers', record.recordId);
							if (!pv || pv.status !== 'pending') shouldDelete = true;
							break;
						}
						case 'pastoral_concern': {
							const flag = await findById('volunteer_pastoral_flags', record.recordId);
							if (!flag || flag.status !== 'active') shouldDelete = true;
							break;
						}
						case 'form_submission': {
							const reg = await findById('registers', record.recordId);
							if (!reg || reg.archived) shouldDelete = true;
							break;
						}
						case 'dbs_notification': {
							const contact = await findById('contacts', record.recordId);
							if (!contact) {
								shouldDelete = true;
							} else if (contact.dbs) {
								// Default to 3 years renewal; exact org value not needed for cleanup
								const dbsStatus = getDbsStatus(contact.dbs, 3);
								if (dbsStatus?.status === 'green') shouldDelete = true;
							} else {
								// No DBS record — no longer a notification
								shouldDelete = true;
							}
							break;
						}
						default:
							// Unknown type — delete it
							shouldDelete = true;
					}
				}

				if (shouldDelete) {
					await remove('seen_notifications', record.id);
					deleted++;
				}
			})
		);

		console.log(`[cleanup-seen-notifications] Removed ${deleted} stale records`);
		return json({ success: true, deleted });
	} catch (err) {
		console.error('[cleanup-seen-notifications] error:', err?.message || err);
		return json({ error: 'Internal error' }, { status: 500 });
	}
}
