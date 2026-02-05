#!/usr/bin/env node
/**
 * Deploy script: when DATA_STORE=database, ensure the database is set up and
 * a Multi-org super admin exists. Loads SUPER_ADMIN_EMAIL and ADMIN_PASSWORD from .env.
 *
 * - If crm_records table does not exist, creates it.
 * - If no Multi-org admin exists for SUPER_ADMIN_EMAIL, creates one (idempotent by email).
 *
 * Run: node scripts/deploy.js
 * Or with env: SUPER_ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Secret123! node scripts/deploy.js
 *
 * Safe to run on every deploy (e.g. in Railway startCommand before the app).
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { ulid } from 'ulid';
import { getCreateTableSql, TABLE_NAME } from '../src/lib/crm/server/dbSchema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
config({ path: join(projectRoot, '.env') });

/** Use env only; no JSON file checks (Postgres-only deploy). */
function isDatabaseStore() {
	const envMode = process.env.DATA_STORE;
	return typeof envMode === 'string' && envMode.trim().toLowerCase() === 'database';
}

async function tableExists(client) {
	const res = await client.query(
		`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
		[TABLE_NAME]
	);
	return res.rows.length > 0;
}

function validatePassword(password) {
	if (!password || password.length < 12) {
		throw new Error('ADMIN_PASSWORD must be at least 12 characters long');
	}
	if (!/[a-z]/.test(password)) {
		throw new Error('ADMIN_PASSWORD must contain at least one lowercase letter');
	}
	if (!/[A-Z]/.test(password)) {
		throw new Error('ADMIN_PASSWORD must contain at least one uppercase letter');
	}
	if (!/[0-9]/.test(password)) {
		throw new Error('ADMIN_PASSWORD must contain at least one number');
	}
	if (!/[^a-zA-Z0-9]/.test(password)) {
		throw new Error('ADMIN_PASSWORD must contain at least one special character');
	}
	return true;
}

async function getMultiOrgAdminByEmail(client, email) {
	const normalized = (email || '').toLowerCase().trim();
	const res = await client.query(
		`SELECT id, body FROM ${TABLE_NAME} WHERE collection = $1`,
		['multi_org_admins']
	);
	for (const row of res.rows) {
		const body = row.body || {};
		if ((body.email || '').toLowerCase().trim() === normalized) {
			return { id: row.id, ...body };
		}
	}
	return null;
}

async function createMultiOrgSuperAdmin(client, { email, password, name }) {
	validatePassword(password);
	const existing = await getMultiOrgAdminByEmail(client, email);
	if (existing) {
		return { id: existing.id, email: existing.email, name: existing.name };
	}
	const hashedPassword = await bcrypt.hash(password, 10);
	const now = new Date().toISOString();
	const id = ulid();
	const body = {
		email: email.trim(),
		passwordHash: hashedPassword,
		name: (name || email).trim(),
		role: 'super_admin',
		createdAt: now,
		updatedAt: now
	};
	await client.query(
		`INSERT INTO ${TABLE_NAME} (collection, id, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		['multi_org_admins', id, JSON.stringify(body), now, now]
	);
	return { id, email: body.email, name: body.name };
}

async function main() {
	if (!isDatabaseStore()) {
		console.log('[deploy] DATA_STORE is not database, skipping.');
		process.exit(0);
	}

	const url = process.env.DATABASE_URL;
	if (!url) {
		console.warn('[deploy] DATA_STORE=database but DATABASE_URL not set, skipping.');
		process.exit(0);
	}

	try {
		const parsed = new URL(url.replace(/^postgres(ql)?:\/\//, 'https://'));
		if (parsed.hostname === 'base') {
			console.error('[deploy] DATABASE_URL has placeholder host "base". Set a real Postgres URL.');
			process.exit(1);
		}
	} catch (e) {
		if (e.message && e.message.includes('DATABASE_URL')) throw e;
	}

	const isInternal = url.includes('railway.internal');
	const isLocalhost = /localhost|127\.0\.0\.1/.test(url);
	const useSsl = !isInternal && !isLocalhost;

	let client;
	try {
		client = new pg.Client({
			connectionString: url,
			...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
		});
		await client.connect();
	} catch (err) {
		console.error('[deploy] Could not connect to database:', err.message);
		process.exit(1);
	}

	try {
		const exists = await tableExists(client);
		if (!exists) {
			console.log('[deploy] Creating table', TABLE_NAME, '...');
			await client.query(getCreateTableSql());
			console.log('[deploy] Table created.');
		}

		const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim();
		const adminPassword = process.env.ADMIN_PASSWORD;

		if (superAdminEmail) {
			const existing = await getMultiOrgAdminByEmail(client, superAdminEmail);
			if (existing) {
				console.log('[deploy] Multi-org super admin already exists:', superAdminEmail);
			} else if (adminPassword) {
				const admin = await createMultiOrgSuperAdmin(client, {
					email: superAdminEmail,
					password: adminPassword,
					name: 'MultiOrg Super Admin'
				});
				console.log('[deploy] Multi-org super admin created:', admin.email);
			} else {
				console.warn(
					'[deploy] No Multi-org admin for SUPER_ADMIN_EMAIL. Set ADMIN_PASSWORD in .env to create one.'
				);
			}
		} else {
			console.warn('[deploy] Set SUPER_ADMIN_EMAIL in .env to ensure Multi-org super admin.');
		}
	} finally {
		await client.end();
	}

	console.log('[deploy] Done.');
	process.exit(0);
}

main().catch((err) => {
	console.error('[deploy]', err);
	process.exit(1);
});
