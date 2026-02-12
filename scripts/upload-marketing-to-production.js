#!/usr/bin/env node
/**
 * Export marketing collections from local database and upload to production
 * via POST /api/admin/import-marketing.
 *
 * Usage:
 *   1. Ensure local .env has DATABASE_URL (local Postgres with marketing data).
 *   2. Set PROD_URL to your production app URL (e.g. https://admin.onnuma.com or Railway URL).
 *   3. ADMIN_PASSWORD must match production's ADMIN_PASSWORD.
 *   node scripts/upload-marketing-to-production.js
 *
 * Requires: pg (npm install pg), dotenv (optional, for .env)
 */

import pg from 'pg';
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

const TABLE_NAME = 'crm_records';

const MARKETING_COLLECTIONS = [
	'marketing_content_blocks',
	'marketing_email_templates',
	'marketing_links',
	'marketing_org_branding',
	'marketing_send_logs',
	'marketing_send_queue',
	'marketing_sequence_steps',
	'marketing_sequences',
	'marketing_template_variables',
	'marketing_template_versions',
	'marketing_user_preferences'
];

function rowToRecord(row) {
	const rec = { ...row.body, id: row.id };
	if (row.created_at) rec.createdAt = row.created_at;
	if (row.updated_at) rec.updatedAt = row.updated_at;
	return rec;
}

async function exportMarketingFromLocal() {
	const url = process.env.DATABASE_URL;
	if (!url) {
		throw new Error('DATABASE_URL is required in .env (local Postgres)');
	}
	const pool = new pg.Pool({
		connectionString: url,
		ssl: url.includes('localhost') ? false : { rejectUnauthorized: false }
	});
	const client = await pool.connect();
	try {
		const payload = {};
		for (const collection of MARKETING_COLLECTIONS) {
			const res = await client.query(
				`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME} WHERE collection = $1 ORDER BY created_at ASC NULLS LAST`,
				[collection]
			);
			payload[collection] = res.rows.map(rowToRecord);
			if (payload[collection].length > 0) {
				console.log(`   ${collection}: ${payload[collection].length} record(s)`);
			}
		}
		return payload;
	} finally {
		client.release();
		await pool.end();
	}
}

async function uploadToProduction(payload) {
	const prodUrl = (process.env.PROD_URL || process.env.VITE_PROD_URL || '').replace(/\/$/, '');
	const adminPassword = process.env.ADMIN_PASSWORD;

	if (!prodUrl) {
		throw new Error('PROD_URL is required (e.g. https://admin.onnuma.com)');
	}
	if (!adminPassword) {
		throw new Error('ADMIN_PASSWORD is required (must match production)');
	}

	const response = await fetch(`${prodUrl}/api/admin/import-marketing`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${adminPassword}`
		},
		body: JSON.stringify(payload)
	});

	const data = await response.json().catch(() => ({}));
	if (!response.ok) {
		throw new Error(data.error || data.message || `HTTP ${response.status}`);
	}
	return data;
}

async function main() {
	console.log('Upload marketing data from local DB to production\n');

	console.log('1. Exporting from local database...');
	const payload = await exportMarketingFromLocal();

	const total = Object.values(payload).reduce((n, arr) => n + arr.length, 0);
	if (total === 0) {
		console.log('\nNo marketing records found in local database.');
		console.log('   Add data via the multi-org marketing pages (e.g. Sequences, Templates) then run this again.');
		process.exit(0);
	}
	console.log(`   Total: ${total} record(s) across collections\n`);

	console.log('2. Uploading to production...');
	const prodUrl = (process.env.PROD_URL || process.env.VITE_PROD_URL || '').replace(/\/$/, '');
	console.log(`   URL: ${prodUrl}/api/admin/import-marketing`);

	const result = await uploadToProduction(payload);

	console.log('\n3. Result:');
	if (result.results?.written?.length) {
		result.results.written.forEach(({ collection, count }) => {
			console.log(`   ${collection}: ${count} record(s) written`);
		});
	}
	if (result.results?.errors?.length) {
		result.results.errors.forEach(({ collection, error }) => {
			console.error(`   ${collection}: ${error}`);
		});
		process.exit(1);
	}
	console.log('\nDone. Marketing data is now on production.');
}

main().catch((err) => {
	console.error('\nError:', err.message);
	process.exit(1);
});
