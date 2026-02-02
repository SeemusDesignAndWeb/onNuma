/**
 * Postgres-backed store implementing the same API as fileStoreImpl.
 * Used when DATA_STORE=database or store_mode.json says "database".
 * Admins and sessions are always served from file store (see facade).
 */

import pg from 'pg';
import { join } from 'path';
import { generateId } from './ids.js';
import { getCreateTableSql, TABLE_NAME } from './dbSchema.js';
import { env } from '$env/dynamic/private';

const { Pool } = pg;

let pool = null;
let tableChecked = false;

function getPool() {
	if (!pool) {
		const url = env.DATABASE_URL;
		if (!url) throw new Error('DATABASE_URL is required when using database store');
		pool = new Pool({ connectionString: url });
	}
	return pool;
}

async function ensureTable() {
	if (tableChecked) return;
	tableChecked = true;
	const client = await getPool().connect();
	try {
		await client.query(getCreateTableSql());
	} finally {
		client.release();
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

export async function readCollection(collection) {
	await ensureTable();
	const res = await getPool().query(
		`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME} WHERE collection = $1 ORDER BY created_at ASC NULLS LAST`,
		[collection]
	);
	return res.rows.map(rowToRecord);
}

export async function writeCollection(collection, records) {
	await ensureTable();
	const client = await getPool().connect();
	try {
		await client.query('BEGIN');
		await client.query(`DELETE FROM ${TABLE_NAME} WHERE collection = $1`, [collection]);
		for (const rec of records) {
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
	const records = await readCollection(collection);
	return records.find((r) => r.id === id) || null;
}

export async function findMany(collection, predicate) {
	const records = await readCollection(collection);
	return records.filter(predicate);
}

export async function create(collection, data) {
	const records = await readCollection(collection);
	const record = {
		...data,
		id: data.id || generateId(),
		createdAt: data.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
	records.push(record);
	await writeCollection(collection, records);
	return record;
}

export async function update(collection, id, updates) {
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

export async function remove(collection, id) {
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
