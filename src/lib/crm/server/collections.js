/**
 * CRM collection names. Used for init scripts, migration, and ensure-db.
 * All collections use the active store (file or database). When DATA_STORE=database
 * (or store_mode.json dataStore: "database"), every collection is read/written in Postgres.
 * NDJSON files are deprecated for Hub; use the database and migrate existing file data.
 */

/** No collections are forced to file store; all respect store mode. */
export const FILE_ONLY_COLLECTIONS = [];

export const ALL_COLLECTIONS = [
	'admins',
	'audit_logs',
	'hub_images',
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
	'hub_settings',
	'lists',
	'loom_videos',
	'meeting_planners',
	'members',
	'multi_org_admins',
	'multi_org_sessions',
	'occurrence_tokens',
	'occurrences',
	'organisations',
	'registers',
	'rota_tokens',
	'rotas',
	'sessions',
	'week_notes'
];

/** Collections to migrate when moving from file store to database (all of them). */
export const COLLECTIONS_FOR_DB = [...ALL_COLLECTIONS];

/**
 * Hub content collections that are scoped by organisationId.
 * All rows in these collections should have organisationId set (current Hub org).
 */
export const ORG_SCOPED_COLLECTIONS = [
	'contacts',
	'lists',
	'events',
	'occurrences',
	'rotas',
	'meeting_planners',
	'forms',
	'registers',
	'emails',
	'email_templates',
	'members',
	'event_signups',
	'rota_tokens',
	'event_tokens',
	'contact_tokens',
	'occurrence_tokens',
	'loom_videos',
	'week_notes',
	'email_stats',
	'holidays'
];
