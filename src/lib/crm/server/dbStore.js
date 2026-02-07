/**
 * Postgres-backed store implementing the same API as fileStoreImpl.
 * Used when DATA_STORE=database or store_mode.json says "database".
 * Contacts, events, and rotas are stored as proper records (dedicated tables with indexed columns)
 * for fast search and filtering; other collections use the generic crm_records table.
 */

import pg from 'pg';
import { join } from 'path';
import { generateId } from './ids.js';
import { getCreateTableSql, TABLE_NAME } from './dbSchema.js';
import {
	isRecordCollection,
	getTableName,
	recordToRow as recordToTableRow,
	rowToRecord as tableRowToRecord,
	buildExtraPatch,
	buildColumnUpdates,
	getCreateContactsTableSql,
	getCreateEventsTableSql,
	getCreateRotasTableSql
} from './dbRecordTables.js';
import { env } from '$env/dynamic/private';

const { Pool } = pg;

let pool = null;
let tableChecked = false;

function getPool() {
	if (!pool) {
		const url = env.DATABASE_URL;
		if (!url) throw new Error('DATABASE_URL is required when using database store');
		// Catch placeholder or wrong host (e.g. "base" from a template or unexpanded variable)
		try {
			const parsed = new URL(url.replace(/^postgresql:\/\//, 'https://'));
			if (parsed.hostname === 'base' || parsed.hostname === 'localhost' && url.includes('base')) {
				throw new Error(
					'DATABASE_URL has host "base" or looks like a placeholder. Set DATABASE_URL to your real Postgres URL: on Railway use the Postgres service Variables (Connect → Copy URL); locally use e.g. postgresql://user@localhost:5432/dbname'
				);
			}
		} catch (e) {
			if (e.message.includes('DATABASE_URL')) throw e;
		}
		// Use SSL only for remote hosts. Localhost and Railway internal URLs do not use SSL.
		const isInternal = url.includes('railway.internal');
		const isLocalhost = /localhost|127\.0\.0\.1/.test(url);
		const useSsl = !isInternal && !isLocalhost;
		pool = new Pool({
			connectionString: url,
			max: 20,
			idleTimeoutMillis: 30000,
			...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
		});
	}
	return pool;
}

async function ensureTable() {
	if (tableChecked) return;
	tableChecked = true;
	const client = await getPool().connect();
	try {
		await client.query(getCreateTableSql());
		await client.query(getCreateContactsTableSql());
		await client.query(getCreateEventsTableSql());
		await client.query(getCreateRotasTableSql());
		await migrateFromCrmRecordsToRecordTables(client);
	} finally {
		client.release();
	}
}

/** One-time: copy contacts, events, rotas from crm_records into dedicated tables if the latter are empty. */
async function migrateFromCrmRecordsToRecordTables(client) {
	for (const collection of ['contacts', 'events', 'rotas']) {
		const table = getTableName(collection);
		const countRes = await client.query(`SELECT 1 FROM ${table} LIMIT 1`);
		if (countRes.rows.length > 0) continue;
		const res = await client.query(
			`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME} WHERE collection = $1`,
			[collection]
		);
		if (res.rows.length === 0) continue;
		for (const row of res.rows) {
			const record = {
				...row.body,
				id: row.id,
				createdAt: row.created_at ?? row.body?.createdAt,
				updatedAt: row.updated_at ?? row.body?.updatedAt
			};
			const r = recordToTableRow(collection, record);
			const keys = Object.keys(r);
			const cols = keys.join(', ');
			const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
			const values = keys.map((k) => r[k]);
			await client.query(
				`INSERT INTO ${table} (${cols}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
				values
			);
		}
	}
}

function rowToRecord(row) {
	const rec = { ...row.body, id: row.id };
	if (row.created_at) rec.createdAt = row.created_at;
	if (row.updated_at) rec.updatedAt = row.updated_at;
	return rec;
}

function recordToRow(record) {
	const id = record.id;
	const createdAt = record.createdAt ?? null;
	const updatedAt = record.updatedAt ?? null;
	const body = { ...record };
	delete body.id;
	delete body.createdAt;
	delete body.updatedAt;
	return { id, body, created_at: createdAt, updated_at: updatedAt };
}

async function readCollectionRecordTable(collection, options = {}) {
	const table = getTableName(collection);
	await ensureTable();
	const pool = getPool();
	if (collection === 'contacts' && (options.organisationId != null || options.search != null)) {
		const conditions = [];
		const values = [];
		let param = 1;
		if (options.organisationId != null) {
			conditions.push(`organisation_id = $${param++}`);
			values.push(options.organisationId);
		}
		if (options.search != null && String(options.search).trim()) {
			const term = '%' + String(options.search).trim().toLowerCase() + '%';
			conditions.push(`(LOWER(first_name) LIKE $${param} OR LOWER(last_name) LIKE $${param})`);
			values.push(term);
			param++;
		}
		const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
		const order = ' ORDER BY LOWER(first_name) ASC NULLS LAST, LOWER(last_name) ASC NULLS LAST';
		let sql = `SELECT * FROM ${table}${where}${order}`;
		if (options.limit != null) {
			sql += ` LIMIT $${param}`;
			values.push(options.limit);
			param++;
		}
		if (options.offset != null) {
			sql += ` OFFSET $${param}`;
			values.push(options.offset);
		}
		const res = await pool.query(sql, values);
		return res.rows.map((row) => tableRowToRecord(collection, row));
	}
	if (collection === 'events' && options.organisationId != null) {
		const res = await pool.query(
			`SELECT * FROM ${table} WHERE organisation_id = $1 ORDER BY updated_at DESC NULLS LAST, created_at ASC NULLS LAST`,
			[options.organisationId]
		);
		return res.rows.map((row) => tableRowToRecord(collection, row));
	}
	if (collection === 'rotas' && options.organisationId != null) {
		const res = await pool.query(
			`SELECT * FROM ${table} WHERE organisation_id = $1 ORDER BY updated_at DESC NULLS LAST, created_at ASC NULLS LAST`,
			[options.organisationId]
		);
		return res.rows.map((row) => tableRowToRecord(collection, row));
	}
	const res = await pool.query(
		`SELECT * FROM ${table} ORDER BY created_at ASC NULLS LAST`
	);
	return res.rows.map((row) => tableRowToRecord(collection, row));
}

/**
 * Return count of records for a collection (no rows loaded). Use for dashboard stats to improve LCP.
 * For record tables uses SELECT COUNT(*); for others loads collection and returns length.
 */
export async function readCollectionCount(collection, options = {}) {
	await ensureTable();
	if (isRecordCollection(collection)) {
		const table = getTableName(collection);
		if (options.organisationId != null) {
			const res = await getPool().query(
				`SELECT COUNT(*)::int AS n FROM ${table} WHERE organisation_id = $1`,
				[options.organisationId]
			);
			return res.rows[0]?.n ?? 0;
		}
		const res = await getPool().query(`SELECT COUNT(*)::int AS n FROM ${table}`);
		return res.rows[0]?.n ?? 0;
	}
	const res = await getPool().query(
		`SELECT id FROM ${TABLE_NAME} WHERE collection = $1`,
		[collection]
	);
	return res.rows.length;
}

export async function readCollection(collection, options = {}) {
	await ensureTable();
	if (isRecordCollection(collection)) {
		return readCollectionRecordTable(collection, options);
	}
	const res = await getPool().query(
		`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME} WHERE collection = $1 ORDER BY created_at ASC NULLS LAST`,
		[collection]
	);
	return res.rows.map(rowToRecord);
}

async function writeCollectionRecordTable(collection, records) {
	const table = getTableName(collection);
	const byId = new Map();
	for (const rec of records) {
		if (rec?.id != null) byId.set(rec.id, rec);
	}
	const uniqueRecords = [...byId.values()];
	const client = await getPool().connect();
	try {
		await client.query('BEGIN');
		await client.query(`DELETE FROM ${table}`);
		for (const rec of uniqueRecords) {
			const r = recordToTableRow(collection, rec);
			const keys = Object.keys(r);
			const cols = keys.join(', ');
			const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
			await client.query(
				`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
				keys.map((k) => r[k])
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}

export async function writeCollection(collection, records) {
	await ensureTable();
	if (isRecordCollection(collection)) {
		return writeCollectionRecordTable(collection, records);
	}
	const byId = new Map();
	for (const rec of records) {
		const id = rec?.id;
		if (id != null) byId.set(id, rec);
	}
	const uniqueRecords = [...byId.values()];
	const client = await getPool().connect();
	try {
		await client.query('BEGIN');
		await client.query(`DELETE FROM ${TABLE_NAME} WHERE collection = $1`, [collection]);
		for (const rec of uniqueRecords) {
			const row = recordToRow(rec);
			await client.query(
				`INSERT INTO ${TABLE_NAME} (collection, id, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
				[collection, row.id, JSON.stringify(row.body), row.created_at, row.updated_at]
			);
		}
		await client.query('COMMIT');
	} catch (e) {
		await client.query('ROLLBACK');
		throw e;
	} finally {
		client.release();
	}
}

export async function findById(collection, id) {
	if (id == null) return null;
	await ensureTable();
	if (isRecordCollection(collection)) {
		const table = getTableName(collection);
		const res = await getPool().query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
		return res.rows.length > 0 ? tableRowToRecord(collection, res.rows[0]) : null;
	}
	const res = await getPool().query(
		`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME} WHERE collection = $1 AND id = $2`,
		[collection, id]
	);
	return res.rows.length > 0 ? rowToRecord(res.rows[0]) : null;
}

export async function findMany(collection, predicate) {
	const records = await readCollection(collection);
	return records.filter(predicate);
}

export async function create(collection, data) {
	const record = {
		...data,
		id: data.id || generateId(),
		createdAt: data.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
	await ensureTable();
	if (isRecordCollection(collection)) {
		const table = getTableName(collection);
		const r = recordToTableRow(collection, record);
		const keys = Object.keys(r);
		const cols = keys.join(', ');
		const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
		await getPool().query(
			`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
			keys.map((k) => r[k])
		);
		return record;
	}
	const row = recordToRow(record);
	await getPool().query(
		`INSERT INTO ${TABLE_NAME} (collection, id, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		[collection, row.id, JSON.stringify(row.body), row.created_at, row.updated_at]
	);
	return record;
}

export async function update(collection, id, updates) {
	if (isRecordCollection(collection)) {
		const existing = await findById(collection, id);
		if (!existing) return null;
		const merged = {
			...existing,
			...updates,
			updatedAt: new Date().toISOString()
		};
		const table = getTableName(collection);
		const r = recordToTableRow(collection, merged);
		const keys = Object.keys(r);
		const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
		await getPool().query(
			`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`,
			[...keys.map((k) => r[k]), id]
		);
		return merged;
	}
	const records = await readCollection(collection);
	const index = records.findIndex((r) => r.id === id);
	if (index === -1) return null;
	records[index] = {
		...records[index],
		...updates,
		updatedAt: new Date().toISOString()
	};
	await writeCollection(collection, records);
	return records[index];
}

/**
 * Update a single row by merging a partial body and updated_at. Avoids read-modify-writeCollection
 * so concurrent requests (e.g. session activity updates) don't race and hit duplicate key.
 */
export async function updatePartial(collection, id, bodyPatch) {
	if (!bodyPatch || typeof bodyPatch !== 'object') return null;
	await ensureTable();
	const updatedAt = new Date().toISOString();
	const patch = { ...bodyPatch, updatedAt };
	if (isRecordCollection(collection)) {
		const table = getTableName(collection);
		const { updates: colUpdates, values: colValues } = buildColumnUpdates(collection, patch);
		const extraPatch = buildExtraPatch(collection, patch);
		const setParts = [...colUpdates];
		const values = [...colValues];
		if (Object.keys(extraPatch).length > 0) {
			setParts.push(`extra = extra || $${values.length + 1}::jsonb`);
			values.push(JSON.stringify(extraPatch));
		}
		values.push(id);
		const res = await getPool().query(
			`UPDATE ${table} SET ${setParts.join(', ')} WHERE id = $${values.length} RETURNING *`,
			values
		);
		return res.rows.length > 0 ? tableRowToRecord(collection, res.rows[0]) : null;
	}
	const patchJson = JSON.stringify(patch);
	const res = await getPool().query(
		`UPDATE ${TABLE_NAME} SET body = body || $3::jsonb, updated_at = $4 WHERE collection = $1 AND id = $2 RETURNING id, body, created_at, updated_at`,
		[collection, id, patchJson, updatedAt]
	);
	if (res.rows.length === 0) return null;
	return rowToRecord(res.rows[0]);
}

export async function remove(collection, id) {
	await ensureTable();
	if (isRecordCollection(collection)) {
		const table = getTableName(collection);
		const res = await getPool().query(`DELETE FROM ${table} WHERE id = $1 RETURNING 1`, [id]);
		return res.rows.length > 0;
	}
	const records = await readCollection(collection);
	const index = records.findIndex((r) => r.id === id);
	if (index === -1) return false;
	records.splice(index, 1);
	await writeCollection(collection, records);
	return true;
}

/** Uploads stay on disk; return same path as file store. */
export async function getUploadsDir() {
	const dataDir = env.CRM_DATA_DIR?.trim() || 'data';
	const base = dataDir.startsWith('/') ? dataDir : join(process.cwd(), dataDir);
	return join(base, 'uploads');
}

/** Create table if not exists. Used by migrate API and ensure-db script. */
export async function createTableIfNotExists() {
	await ensureTable();
}
