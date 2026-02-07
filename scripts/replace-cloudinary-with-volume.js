#!/usr/bin/env node
/**
 * Replace all Cloudinary image URLs with volume/local paths (/images/uploads/...).
 * - Downloads each Cloudinary image and saves to static/images/uploads (local) or IMAGES_PATH/uploads (volume).
 * - Updates database.json and data/hub_images.ndjson (and data/images.ndjson if present).
 *
 * Usage:
 *   node scripts/replace-cloudinary-with-volume.js
 *   IMAGES_PATH=/data/images node scripts/replace-cloudinary-with-volume.js   # production volume
 *
 * Env:
 *   DATABASE_PATH - main site database (default ./data/database.json)
 *   IMAGES_PATH   - base dir for images (default: static/images; use /data/images for volume)
 *   CRM_DATA_DIR  - CRM data dir for ndjson (default data)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

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

	// 2) Collect from hub_images.ndjson and images.ndjson
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

	if (urlsToProcess.size === 0) {
		console.log('\nNo Cloudinary URLs found. Nothing to do.');
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
		process.exit(1);
	}

	// 3) Replace in database.json
	if (existsSync(resolvedDbPath)) {
		const db = JSON.parse(readFileSync(resolvedDbPath, 'utf-8'));
		replaceCloudinaryUrls(db, replacePairs);
		writeFileSync(resolvedDbPath, JSON.stringify(db, null, 2), 'utf-8');
		console.log('\nUpdated', resolvedDbPath);
	}

	// 4) Replace in ndjson files
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

	console.log('\nDone. Cloudinary URLs in data have been replaced with /images/uploads/... paths.');
	console.log('If you use Postgres for CRM (hub_images), run a separate migration or update records via the app.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
