/**
 * Postgres schema for CRM store. No env - safe to use from scripts and app.
 * All collections use the generic crm_records table with JSONB body for simplicity and speed.
 */

export const TABLE_NAME = 'crm_records';

export function getCreateTableSql() {
	return `
		CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
			collection VARCHAR(128) NOT NULL,
			id VARCHAR(64) NOT NULL,
			body JSONB NOT NULL,
			created_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ,
			PRIMARY KEY (collection, id)
		);
		CREATE INDEX IF NOT EXISTS idx_crm_records_collection ON ${TABLE_NAME} (collection);
		CREATE INDEX IF NOT EXISTS idx_crm_records_org ON ${TABLE_NAME} ((body->>'organisationId'));
		CREATE INDEX IF NOT EXISTS idx_crm_records_updated ON ${TABLE_NAME} (updated_at DESC NULLS LAST);
	`.trim();
}
