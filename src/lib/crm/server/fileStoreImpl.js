/**
 * File-based NDJSON store. Used when DATA_STORE=file (deprecated for Hub; prefer database).
 */

import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { generateId } from './ids.js';
import { env } from '$env/dynamic/private';

export function getDataDir() {
	const envDataDir = env.CRM_DATA_DIR;
	if (envDataDir && envDataDir.trim()) {
		const trimmed = envDataDir.trim();
		if (trimmed.startsWith('/')) {
			return trimmed;
		}
		return join(process.cwd(), trimmed);
	}
	return join(process.cwd(), 'data');
}

const DATA_DIR = getDataDir();
const UPLOADS_DIR = join(DATA_DIR, 'uploads');

let dirsInitialized = false;
async function ensureDirs() {
	if (dirsInitialized) return;
	try {
		if (!existsSync(DATA_DIR)) {
			await mkdir(DATA_DIR, { recursive: true });
		}
		if (!existsSync(UPLOADS_DIR)) {
			await mkdir(UPLOADS_DIR, { recursive: true });
		}
	} catch (error) {
		console.error('[fileStoreImpl] Error creating data directories:', error);
		throw error;
	}
	dirsInitialized = true;
}

const writeQueues = new Map();

function getCollectionPath(collection) {
	if (!collection || typeof collection !== 'string') {
		throw new Error('Invalid collection name');
	}
	if (!/^[a-zA-Z0-9_-]+$/.test(collection)) {
		throw new Error('Invalid collection name: only alphanumeric characters, underscores, and hyphens are allowed');
	}
	return join(DATA_DIR, `${collection}.ndjson`);
}

async function queuedWrite(filePath, writeFn) {
	if (!writeQueues.has(filePath)) {
		writeQueues.set(filePath, Promise.resolve());
	}
	const queue = writeQueues.get(filePath);
	const newQueue = queue.then(async () => {
		try {
			const data = await writeFn();
			await writeFile(filePath, data, 'utf8');
		} catch (error) {
			console.error(`Error writing to ${filePath}:`, error);
			throw error;
		}
	});
	writeQueues.set(filePath, newQueue);
	return newQueue;
}

export async function readCollection(collection, _options = {}) {
	await ensureDirs();
	const filePath = getCollectionPath(collection);
	if (!existsSync(filePath)) {
		return [];
	}
	try {
		const content = await readFile(filePath, 'utf8');
		if (!content.trim()) return [];
		return content
			.trim()
			.split('\n')
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line));
	} catch (error) {
		if (error.code === 'ENOENT') return [];
		throw error;
	}
}

export async function writeCollection(collection, records) {
	await ensureDirs();
	const filePath = getCollectionPath(collection);
	await queuedWrite(filePath, async () => {
		return records.map((r) => JSON.stringify(r)).join('\n') + '\n';
	});
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

export async function getUploadsDir() {
	await ensureDirs();
	return UPLOADS_DIR;
}
