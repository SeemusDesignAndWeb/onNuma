#!/usr/bin/env node
/**
 * Replace all Cloudinary image URLs with volume/local paths (/images/uploads/...).
 * - Downloads each Cloudinary image and saves to static/images/uploads (local) or IMAGES_PATH/uploads (volume).
 * - Updates: database.json (main site); file store ndjson when present; when DATABASE_URL is set, all
 *   crm_records rows that contain Cloudinary URLs (hub_settings, hub_images, organisations, etc.).
 *
 * Usage:
 *   node scripts/replace-cloudinary-with-volume.js
 *   IMAGES_PATH=/data/images node scripts/replace-cloudinary-with-volume.js   # production volume
 *
 * Env:
 *   DATABASE_PATH - main site database (default ./data/database.json)
 *   IMAGES_PATH   - base dir for images (default: static/images; use /data/images for volume)
 *   CRM_DATA_DIR  - CRM data dir for ndjson (default data)
 *   DATABASE_URL  - when set (e.g. DATA_STORE=database), also read/update Cloudinary URLs in Postgres crm_records
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import pg from 'pg';
import { TABLE_NAME } from '../src/lib/crm/server/dbSchema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

dotenv.config({ path: join(projectRoot, '.env') });

const CLOUDINARY_REGEX = /https?:\/\/(?:res\.)?cloudinary\.com\/[^\s"']+/gi;

function getImagesBaseDir() {
	const path = process.env.IMAGES_PATH?.trim();
	if (path) {
		return path.startsWith('/') ? path : join(projectRoot, path);
	}
	return join(projectRoot, 'static', 'images');
}

function getUploadsDir() {
	return join(getImagesBaseDir(), 'uploads');
}

function isCloudinaryUrl(s) {
	return typeof s === 'string' && (s.includes('cloudinary.com') || s.includes('res.cloudinary.com'));
}

/** Collect all Cloudinary URLs from a value (recursive). */
function collectCloudinaryUrls(value, set) {
	if (value == null) return;
	if (typeof value === 'string') {
		const matches = value.match(CLOUDINARY_REGEX);
		if (matches) matches.forEach((url) => set.add(url));
		return;
	}
	if (Array.isArray(value)) {
		value.forEach((v) => collectCloudinaryUrls(v, set));
		return;
	}
	if (typeof value === 'object') {
		for (const k of Object.keys(value)) collectCloudinaryUrls(value[k], set);
	}
}

/** Replace Cloudinary URLs in a value with new paths (recursive, mutates). */
function replaceCloudinaryUrls(value, urlToPath) {
	if (value == null) return;
	if (typeof value === 'string') {
		for (const [url, path] of urlToPath) {
			value = value.split(url).join(path);
		}
		return value;
	}
	if (Array.isArray(value)) {
		for (let i = 0; i < value.length; i++) {
			const next = replaceCloudinaryUrls(value[i], urlToPath);
			if (next !== undefined) value[i] = next;
		}
		return value;
	}
	if (typeof value === 'object') {
		for (const k of Object.keys(value)) {
			const next = replaceCloudinaryUrls(value[k], urlToPath);
			if (next !== undefined) value[k] = next;
		}
		return value;
	}
}

/** Get file extension from URL or Content-Type. */
function getExtFromUrl(url) {
	try {
		const pathname = new URL(url).pathname;
		const m = pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)(?:\?|$)/i);
		return m ? m[1].toLowerCase() : 'jpg';
	} catch {
		return 'jpg';
	}
}

/** Get Postgres pool when DATABASE_URL is set (database store). */
function getDbPool() {
	const url = process.env.DATABASE_URL?.trim();
	if (!url) return null;
	try {
		const parsed = new URL(url.replace(/^postgres(ql)?:\/\//, 'https://'));
		if (parsed.hostname === 'base') return null;
	} catch {
		return null;
	}
	const isInternal = url.includes('railway.internal');
	const isLocalhost = /localhost|127\.0\.0\.1/.test(url);
	const useSsl = !isInternal && !isLocalhost;
	return new pg.Pool({
		connectionString: url,
		max: 2,
		...(useSsl ? { ssl: { rejectUnauthorized: false } } : {})
	});
}

/** Download image from URL and save to uploads dir. Returns /images/uploads/filename. */
async function downloadAndSave(url) {
	const uploadsDir = getUploadsDir();
	if (!existsSync(uploadsDir)) {
		mkdirSync(uploadsDir, { recursive: true });
	}
	const ext = getExtFromUrl(url);
	const filename = `${randomUUID().slice(0, 8)}_cloudinary.${ext}`;
	const filePath = join(uploadsDir, filename);

	const res = await fetch(url, { redirect: 'follow' });
	if (!res.ok) {
		throw new Error(`HTTP ${res.status} for ${url}`);
	}
	const buffer = Buffer.from(await res.arrayBuffer());
	writeFileSync(filePath, buffer);

	return `/images/uploads/${filename}`;
}

async function main() {
	const dbPath = process.env.DATABASE_PATH || './data/database.json';
	const resolvedDbPath = dbPath.startsWith('/') ? dbPath : join(projectRoot, dbPath);
	const crmDataDir = process.env.CRM_DATA_DIR?.trim()
		? (process.env.CRM_DATA_DIR.startsWith('/')
				? process.env.CRM_DATA_DIR
				: join(projectRoot, process.env.CRM_DATA_DIR))
		: join(projectRoot, 'data');

	console.log('Replace Cloudinary links with volume/local\n');
	console.log('Images base dir:', getImagesBaseDir());
	console.log('Main DB:', resolvedDbPath);
	console.log('CRM data dir:', crmDataDir);

	const urlToPath = new Map();
	const urlsToProcess = new Set();

	// 1) Collect URLs from database.json
	if (existsSync(resolvedDbPath)) {
		const db = JSON.parse(readFileSync(resolvedDbPath, 'utf-8'));
		collectCloudinaryUrls(db, urlsToProcess);
	}

	// 2) Collect from hub_settings.ndjson and hub_settings.json (theme.logoPath, theme.loginLogoPath)
	const hubSettingsNdjson = join(crmDataDir, 'hub_settings.ndjson');
	if (existsSync(hubSettingsNdjson)) {
		const content = readFileSync(hubSettingsNdjson, 'utf-8');
		for (const line of content.trim().split('\n').filter(Boolean)) {
			try {
				const rec = JSON.parse(line);
				collectCloudinaryUrls(rec, urlsToProcess);
			} catch (e) {
				// skip bad lines
			}
		}
	}
	const hubSettingsJson = join(crmDataDir, 'hub_settings.json');
	if (existsSync(hubSettingsJson)) {
		try {
			const data = JSON.parse(readFileSync(hubSettingsJson, 'utf-8'));
			collectCloudinaryUrls(data, urlsToProcess);
		} catch (e) {
			// skip
		}
	}

	// 3) Collect from hub_images.ndjson and images.ndjson
	for (const coll of ['hub_images', 'images']) {
		const ndjsonPath = join(crmDataDir, `${coll}.ndjson`);
		if (existsSync(ndjsonPath)) {
			const content = readFileSync(ndjsonPath, 'utf-8');
			for (const line of content.trim().split('\n').filter(Boolean)) {
				try {
					const rec = JSON.parse(line);
					collectCloudinaryUrls(rec, urlsToProcess);
				} catch (e) {
					// skip bad lines
				}
			}
		}
	}

	// 4) When using database store: collect from all crm_records (hub_settings, hub_images, organisations, etc.)
	const recordsWithCloudinary = [];
	const pool = getDbPool();
	if (pool) {
		try {
			const res = await pool.query(
				`SELECT collection, id, body FROM ${TABLE_NAME}`
			);
			for (const row of res.rows || []) {
				const body = row.body && typeof row.body === 'object' ? row.body : {};
				const set = new Set();
				collectCloudinaryUrls(body, set);
				if (set.size > 0) {
					for (const u of set) urlsToProcess.add(u);
					recordsWithCloudinary.push({ collection: row.collection, id: row.id, body });
				}
			}
			if (recordsWithCloudinary.length > 0) {
				console.log('Database store: found', recordsWithCloudinary.length, 'record(s) with Cloudinary URLs');
			}
		} catch (err) {
			console.error('Database read failed:', err.message);
		} finally {
			// keep pool for later update
		}
	}

	if (urlsToProcess.size === 0) {
		console.log('\nNo Cloudinary URLs found. Nothing to do.');
		if (pool) await pool.end();
		process.exit(0);
	}

	console.log(`\nFound ${urlsToProcess.size} unique Cloudinary URL(s). Downloading and saving...\n`);

	for (const url of urlsToProcess) {
		try {
			const path = await downloadAndSave(url);
			urlToPath.set(url, path);
			console.log('  OK', path, '<-', url.slice(0, 60) + '...');
		} catch (err) {
			console.error('  FAIL', url, err.message);
		}
	}

	const replacePairs = [...urlToPath.entries()];
	if (replacePairs.length === 0) {
		console.log('\nNo images could be downloaded. Exiting without changing data.');
		if (pool) await pool.end();
		process.exit(1);
	}

	// 5) Replace in database.json
	if (existsSync(resolvedDbPath)) {
		const db = JSON.parse(readFileSync(resolvedDbPath, 'utf-8'));
		replaceCloudinaryUrls(db, replacePairs);
		writeFileSync(resolvedDbPath, JSON.stringify(db, null, 2), 'utf-8');
		console.log('\nUpdated', resolvedDbPath);
	}

	// 6) Replace in hub_settings.ndjson and hub_settings.json
	if (existsSync(hubSettingsNdjson)) {
		const lines = readFileSync(hubSettingsNdjson, 'utf-8')
			.trim()
			.split('\n')
			.filter(Boolean)
			.map((line) => {
				try {
					const rec = JSON.parse(line);
					replaceCloudinaryUrls(rec, replacePairs);
					return JSON.stringify(rec);
				} catch {
					return line;
				}
			});
		writeFileSync(hubSettingsNdjson, lines.join('\n') + '\n', 'utf-8');
		console.log('Updated', hubSettingsNdjson);
	}
	if (existsSync(hubSettingsJson)) {
		const data = JSON.parse(readFileSync(hubSettingsJson, 'utf-8'));
		replaceCloudinaryUrls(data, replacePairs);
		writeFileSync(hubSettingsJson, JSON.stringify(data, null, 2), 'utf-8');
		console.log('Updated', hubSettingsJson);
	}

	// 7) Replace in ndjson files
	for (const coll of ['hub_images', 'images']) {
		const ndjsonPath = join(crmDataDir, `${coll}.ndjson`);
		if (existsSync(ndjsonPath)) {
			const lines = readFileSync(ndjsonPath, 'utf-8')
				.trim()
				.split('\n')
				.filter(Boolean)
				.map((line) => {
					try {
						const rec = JSON.parse(line);
						replaceCloudinaryUrls(rec, replacePairs);
						return JSON.stringify(rec);
					} catch {
						return line;
					}
				});
			writeFileSync(ndjsonPath, lines.join('\n') + '\n', 'utf-8');
			console.log('Updated', ndjsonPath);
		}
	}

	// 8) Replace in Postgres crm_records when using database store
	if (pool && replacePairs.length > 0 && recordsWithCloudinary.length > 0) {
		const now = new Date().toISOString();
		for (const rec of recordsWithCloudinary) {
			replaceCloudinaryUrls(rec.body, replacePairs);
			await pool.query(
				`UPDATE ${TABLE_NAME} SET body = $1::jsonb, updated_at = $2 WHERE collection = $3 AND id = $4`,
				[JSON.stringify(rec.body), now, rec.collection, rec.id]
			);
		}
		console.log('Updated', recordsWithCloudinary.length, 'record(s) in database (crm_records)');
	}
	if (pool) await pool.end();

	console.log('\nDone. Cloudinary URLs have been replaced with /images/uploads/... paths (files and/or database).');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
