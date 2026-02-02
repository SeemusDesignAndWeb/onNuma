/**
 * CRM collection names. Used for init scripts, migration, and ensure-db.
 * Admins and sessions stay in file store for resilience when DB is unavailable.
 */

export const FILE_ONLY_COLLECTIONS = ['admins', 'sessions'];

export const ALL_COLLECTIONS = [
	'admins',
	'audit_logs',
	'contact_tokens',
	'contacts',
	'email_stats',
	'email_templates',
	'emails',
	'event_signups',
	'event_tokens',
	'events',
	'forms',
	'holidays',
	'lists',
	'loom_videos',
	'meeting_planners',
	'members',
	'occurrence_tokens',
	'occurrences',
	'registers',
	'rota_tokens',
	'rotas',
	'sessions',
	'week_notes'
];

/** Collections that are migrated to DB (all except file-only). */
export const COLLECTIONS_FOR_DB = ALL_COLLECTIONS.filter(
	(c) => !FILE_ONLY_COLLECTIONS.includes(c)
);
