#!/usr/bin/env node
/**
 * On deploy: if store mode is "database", ensure crm_records table exists
 * and copy data from file store if the table was just created or is empty.
 * Run after init-crm-data-on-build, before the app.
 * Uses process.env (no Svelte); safe to run from Railway start command.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { getCreateTableSql, TABLE_NAME } from '../src/lib/crm/server/dbSchema.js';
import { COLLECTIONS_FOR_DB } from '../src/lib/crm/server/collections.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

function getDataDir() {
	const envDir = process.env.CRM_DATA_DIR;
	if (envDir && envDir.trim()) {
		const t = envDir.trim();
		return t.startsWith('/') ? t : join(projectRoot, t);
	}
	return join(projectRoot, 'data');
}

async function getStoreMode() {
	const dataDir = getDataDir();
	const modePath = join(dataDir, 'store_mode.json');
	if (existsSync(modePath)) {
		try {
			const content = readFileSync(modePath, 'utf8');
			const data = JSON.parse(content);
			return (data.dataStore || 'file').toLowerCase();
		} catch {
			// fall through to env
		}
	}
	const envMode = process.env.DATA_STORE;
	if (typeof envMode === 'string' && envMode.trim()) {
		return envMode.trim().toLowerCase();
	}
	return 'file';
}

function readNdjson(collection) {
	const dataDir = getDataDir();
	const filePath = join(dataDir, `${collection}.ndjson`);
	if (!existsSync(filePath)) return [];
	const content = readFileSync(filePath, 'utf8');
	if (!content.trim()) return [];
	return content
		.trim()
		.split('\n')
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line));
}

async function tableExists(client) {
	const res = await client.query(
		`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
		[TABLE_NAME]
	);
	return res.rows.length > 0;
}

async function tableRowCount(client) {
	const res = await client.query(`SELECT COUNT(*)::int AS n FROM ${TABLE_NAME}`);
	return res.rows[0].n;
}

async function main() {
	const mode = await getStoreMode();
	if (mode !== 'database') {
		console.log('[ensure-db-on-deploy] Store mode is not database, skipping.');
		process.exit(0);
	}

	const url = process.env.DATABASE_URL;
	if (!url) {
		console.warn('[ensure-db-on-deploy] DATA_STORE=database but DATABASE_URL not set, skipping.');
		process.exit(0);
	}

	let client;
	try {
		client = new pg.Client({ connectionString: url });
		await client.connect();
	} catch (err) {
		console.error('[ensure-db-on-deploy] Could not connect to database:', err.message);
		process.exit(0);
	}

	try {
		const exists = await tableExists(client);
		if (!exists) {
			console.log('[ensure-db-on-deploy] Creating table', TABLE_NAME, '...');
			await client.query(getCreateTableSql());
		}

		const count = await tableRowCount(client);
		if (count > 0) {
			console.log('[ensure-db-on-deploy] Table already has data, skipping migration.');
			process.exit(0);
		}

		console.log('[ensure-db-on-deploy] Copying file store data to database...');
		let total = 0;
		for (const collection of COLLECTIONS_FOR_DB) {
			const records = readNdjson(collection);
			if (records.length === 0) continue;
			await client.query('BEGIN');
			try {
				for (const rec of records) {
					const id = rec.id;
					const createdAt = rec.createdAt ?? null;
					const updatedAt = rec.updatedAt ?? null;
					const body = { ...rec };
					delete body.id;
					delete body.createdAt;
					delete body.updatedAt;
					await client.query(
						`INSERT INTO ${TABLE_NAME} (collection, id, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (collection, id) DO UPDATE SET body = EXCLUDED.body, updated_at = EXCLUDED.updated_at`,
						[collection, id, JSON.stringify(body), createdAt, updatedAt]
					);
				}
				await client.query('COMMIT');
				total += records.length;
				console.log('[ensure-db-on-deploy]', collection, ':', records.length, 'records');
			} catch (e) {
				await client.query('ROLLBACK');
				throw e;
			}
		}
		console.log('[ensure-db-on-deploy] Done. Total records copied:', total);
	} finally {
		await client.end();
	}
	process.exit(0);
}

main().catch((err) => {
	console.error('[ensure-db-on-deploy]', err);
	process.exit(0);
});
