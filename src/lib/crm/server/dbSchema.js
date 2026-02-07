/**
 * Postgres schema for CRM store. No env - safe to use from scripts and app.
 * Contacts, events, and rotas use dedicated tables with indexed columns for fast search/filter.
 */

export const TABLE_NAME = 'crm_records';

export const CONTACTS_TABLE = 'crm_contacts';
export const EVENTS_TABLE = 'crm_events';
export const ROTAS_TABLE = 'crm_rotas';

/** Collections that use dedicated record tables instead of the generic crm_records blob table. */
export const RECORD_TABLE_COLLECTIONS = ['contacts', 'events', 'rotas'];

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
	`.trim();
}

/**
 * Contacts as records: indexed columns for organisation, search (name, email), and filtering.
 */
export function getCreateContactsTableSql() {
	return `
		CREATE TABLE IF NOT EXISTS ${CONTACTS_TABLE} (
			id VARCHAR(64) PRIMARY KEY,
			organisation_id VARCHAR(64),
			email VARCHAR(255) NOT NULL,
			first_name VARCHAR(100),
			last_name VARCHAR(100),
			phone VARCHAR(50),
			address_line1 VARCHAR(200),
			address_line2 VARCHAR(200),
			city VARCHAR(100),
			county VARCHAR(100),
			postcode VARCHAR(20),
			country VARCHAR(100),
			membership_status VARCHAR(50),
			notes TEXT,
			subscribed BOOLEAN DEFAULT true,
			spouse_id VARCHAR(64),
			created_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ,
			extra JSONB DEFAULT '{}'
		);
		CREATE INDEX IF NOT EXISTS idx_crm_contacts_organisation ON ${CONTACTS_TABLE} (organisation_id);
		CREATE INDEX IF NOT EXISTS idx_crm_contacts_email ON ${CONTACTS_TABLE} (email);
		CREATE INDEX IF NOT EXISTS idx_crm_contacts_org_updated ON ${CONTACTS_TABLE} (organisation_id, updated_at DESC NULLS LAST);
	`.trim();
}

/**
 * Events as records: indexed columns for organisation, title, visibility, and filtering.
 */
export function getCreateEventsTableSql() {
	return `
		CREATE TABLE IF NOT EXISTS ${EVENTS_TABLE} (
			id VARCHAR(64) PRIMARY KEY,
			organisation_id VARCHAR(64),
			title VARCHAR(200) NOT NULL,
			location VARCHAR(500),
			visibility VARCHAR(50),
			created_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ,
			extra JSONB DEFAULT '{}'
		);
		CREATE INDEX IF NOT EXISTS idx_crm_events_organisation ON ${EVENTS_TABLE} (organisation_id);
		CREATE INDEX IF NOT EXISTS idx_crm_events_org_updated ON ${EVENTS_TABLE} (organisation_id, updated_at DESC NULLS LAST);
	`.trim();
}

/**
 * Rotas as records: indexed columns for organisation, event, occurrence, role, and filtering.
 */
export function getCreateRotasTableSql() {
	return `
		CREATE TABLE IF NOT EXISTS ${ROTAS_TABLE} (
			id VARCHAR(64) PRIMARY KEY,
			organisation_id VARCHAR(64),
			event_id VARCHAR(64) NOT NULL,
			occurrence_id VARCHAR(64),
			role VARCHAR(100) NOT NULL,
			capacity INTEGER DEFAULT 1,
			created_at TIMESTAMPTZ,
			updated_at TIMESTAMPTZ,
			extra JSONB DEFAULT '{}'
		);
		CREATE INDEX IF NOT EXISTS idx_crm_rotas_organisation ON ${ROTAS_TABLE} (organisation_id);
		CREATE INDEX IF NOT EXISTS idx_crm_rotas_event ON ${ROTAS_TABLE} (event_id);
		CREATE INDEX IF NOT EXISTS idx_crm_rotas_occurrence ON ${ROTAS_TABLE} (occurrence_id);
		CREATE INDEX IF NOT EXISTS idx_crm_rotas_org_updated ON ${ROTAS_TABLE} (organisation_id, updated_at DESC NULLS LAST);
	`.trim();
}

/** All table creation SQL (generic + contacts + events + rotas). */
export function getAllCreateTableSql() {
	return [
		getCreateTableSql(),
		getCreateContactsTableSql(),
		getCreateEventsTableSql(),
		getCreateRotasTableSql()
	].join(';\n');
}
