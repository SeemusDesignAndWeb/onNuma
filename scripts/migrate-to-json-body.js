#!/usr/bin/env node
/**
 * Migration script: Move data from dedicated tables (crm_contacts, crm_events, crm_rotas)
 * back to the generic crm_records table with JSONB body storage.
 * 
 * Usage:
 *   DATABASE_URL=postgresql://... node scripts/migrate-to-json-body.js
 * 
 * This script:
 * 1. Reads all records from crm_contacts, crm_events, crm_rotas
 * 2. Inserts them into crm_records with proper JSONB body
 * 3. Optionally drops the old tables (with --drop-tables flag)
 */

import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('ERROR: DATABASE_URL environment variable is required');
	process.exit(1);
}

const DROP_TABLES = process.argv.includes('--drop-tables');

const pool = new Pool({
	connectionString: DATABASE_URL,
	ssl: DATABASE_URL.includes('railway.internal') || /localhost|127\.0\.0\.1/.test(DATABASE_URL)
		? false
		: { rejectUnauthorized: false }
});

async function migrate() {
	const client = await pool.connect();
	
	try {
		console.log('Starting migration to JSON body storage...\n');
		
		// Ensure crm_records table exists
		await client.query(`
			CREATE TABLE IF NOT EXISTS crm_records (
				collection VARCHAR(128) NOT NULL,
				id VARCHAR(64) NOT NULL,
				body JSONB NOT NULL,
				created_at TIMESTAMPTZ,
				updated_at TIMESTAMPTZ,
				PRIMARY KEY (collection, id)
			);
			CREATE INDEX IF NOT EXISTS idx_crm_records_collection ON crm_records (collection);
			CREATE INDEX IF NOT EXISTS idx_crm_records_org ON crm_records ((body->>'organisationId'));
			CREATE INDEX IF NOT EXISTS idx_crm_records_updated ON crm_records (updated_at DESC NULLS LAST);
		`);
		
		// Check if dedicated tables exist
		const tablesRes = await client.query(`
			SELECT table_name FROM information_schema.tables 
			WHERE table_schema = 'public' AND table_name IN ('crm_contacts', 'crm_events', 'crm_rotas')
		`);
		const existingTables = tablesRes.rows.map(r => r.table_name);
		
		if (existingTables.length === 0) {
			console.log('No dedicated tables found (crm_contacts, crm_events, crm_rotas).');
			console.log('Nothing to migrate.');
			return;
		}
		
		console.log(`Found tables to migrate: ${existingTables.join(', ')}\n`);
		
		await client.query('BEGIN');
		
		// Migrate contacts
		if (existingTables.includes('crm_contacts')) {
			const contactsRes = await client.query('SELECT * FROM crm_contacts');
			console.log(`Migrating ${contactsRes.rows.length} contacts...`);
			
			for (const row of contactsRes.rows) {
				const extra = typeof row.extra === 'string' ? JSON.parse(row.extra || '{}') : (row.extra || {});
				const body = {
					organisationId: row.organisation_id ?? null,
					email: row.email ?? '',
					firstName: row.first_name ?? '',
					lastName: row.last_name ?? '',
					phone: row.phone ?? '',
					addressLine1: row.address_line1 ?? '',
					addressLine2: row.address_line2 ?? '',
					city: row.city ?? '',
					county: row.county ?? '',
					postcode: row.postcode ?? '',
					country: row.country ?? '',
					membershipStatus: row.membership_status ?? '',
					notes: row.notes ?? '',
					subscribed: row.subscribed !== false,
					spouseId: row.spouse_id ?? null,
					...extra
				};
				
				await client.query(
					`INSERT INTO crm_records (collection, id, body, created_at, updated_at) 
					 VALUES ($1, $2, $3, $4, $5) 
					 ON CONFLICT (collection, id) DO UPDATE SET body = $3, updated_at = $5`,
					['contacts', row.id, JSON.stringify(body), row.created_at, row.updated_at]
				);
			}
			console.log(`  ✓ Migrated ${contactsRes.rows.length} contacts`);
		}
		
		// Migrate events
		if (existingTables.includes('crm_events')) {
			const eventsRes = await client.query('SELECT * FROM crm_events');
			console.log(`Migrating ${eventsRes.rows.length} events...`);
			
			for (const row of eventsRes.rows) {
				const extra = typeof row.extra === 'string' ? JSON.parse(row.extra || '{}') : (row.extra || {});
				const body = {
					organisationId: row.organisation_id ?? null,
					title: row.title ?? '',
					location: row.location ?? '',
					visibility: row.visibility ?? '',
					...extra
				};
				
				await client.query(
					`INSERT INTO crm_records (collection, id, body, created_at, updated_at) 
					 VALUES ($1, $2, $3, $4, $5) 
					 ON CONFLICT (collection, id) DO UPDATE SET body = $3, updated_at = $5`,
					['events', row.id, JSON.stringify(body), row.created_at, row.updated_at]
				);
			}
			console.log(`  ✓ Migrated ${eventsRes.rows.length} events`);
		}
		
		// Migrate rotas
		if (existingTables.includes('crm_rotas')) {
			const rotasRes = await client.query('SELECT * FROM crm_rotas');
			console.log(`Migrating ${rotasRes.rows.length} rotas...`);
			
			for (const row of rotasRes.rows) {
				const extra = typeof row.extra === 'string' ? JSON.parse(row.extra || '{}') : (row.extra || {});
				const body = {
					organisationId: row.organisation_id ?? null,
					eventId: row.event_id ?? '',
					occurrenceId: row.occurrence_id ?? null,
					role: row.role ?? '',
					capacity: typeof row.capacity === 'number' ? row.capacity : 1,
					...extra
				};
				
				await client.query(
					`INSERT INTO crm_records (collection, id, body, created_at, updated_at) 
					 VALUES ($1, $2, $3, $4, $5) 
					 ON CONFLICT (collection, id) DO UPDATE SET body = $3, updated_at = $5`,
					['rotas', row.id, JSON.stringify(body), row.created_at, row.updated_at]
				);
			}
			console.log(`  ✓ Migrated ${rotasRes.rows.length} rotas`);
		}
		
		await client.query('COMMIT');
		console.log('\n✓ Migration completed successfully!');
		
		// Optionally drop old tables
		if (DROP_TABLES) {
			console.log('\nDropping old tables...');
			for (const table of existingTables) {
				await client.query(`DROP TABLE IF EXISTS ${table}`);
				console.log(`  ✓ Dropped ${table}`);
			}
			console.log('✓ Old tables dropped');
		} else {
			console.log('\nNote: Old tables were NOT dropped. Run with --drop-tables to remove them.');
			console.log('Tables remaining: ' + existingTables.join(', '));
		}
		
	} catch (err) {
		await client.query('ROLLBACK');
		console.error('Migration failed:', err);
		process.exit(1);
	} finally {
		client.release();
		await pool.end();
	}
}

migrate();
