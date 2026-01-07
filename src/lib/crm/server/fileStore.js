import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { generateId } from './ids.js';
import { env } from '$env/dynamic/private';

// Get data directory from environment variable or default to ./data
// In production (Railway), set CRM_DATA_DIR=/data to use the persistent volume
function getDataDir() {
	const envDataDir = env.CRM_DATA_DIR;
	if (envDataDir && envDataDir.trim()) {
		const trimmed = envDataDir.trim();
		let finalPath;
		// If it's an absolute path (starts with /), use it directly
		if (trimmed.startsWith('/')) {
			finalPath = trimmed;
		} else {
			// For relative paths, resolve relative to process.cwd()
			// join() will handle ./ and ../ correctly
			finalPath = join(process.cwd(), trimmed);
		}
		console.log('[fileStore] Using CRM_DATA_DIR:', trimmed, '-> resolved to:', finalPath);
		console.log('[fileStore] process.cwd():', process.cwd());
		return finalPath;
	}
	// Default to ./data for local development
	const defaultPath = join(process.cwd(), 'data');
	console.log('[fileStore] CRM_DATA_DIR not set, using default data directory:', defaultPath);
	console.log('[fileStore] process.cwd():', process.cwd());
	return defaultPath;
}

const DATA_DIR = getDataDir();
console.log('[fileStore] DATA_DIR initialized to:', DATA_DIR);
const UPLOADS_DIR = join(DATA_DIR, 'uploads');

// Ensure data directory exists (lazy initialization)
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
		console.error('[fileStore] Error creating data directories:', error);
		console.error('[fileStore] DATA_DIR:', DATA_DIR);
		// In production, if volume is not mounted, this will fail
		// We'll let the error propagate so it's clear what's wrong
		throw error;
	}
	dirsInitialized = true;
}

// Per-file write queues to ensure atomic writes
const writeQueues = new Map();

/**
 * Get the path to a collection file
 * @param {string} collection - Collection name (e.g., 'contacts')
 * @returns {string} File path
 */
function getCollectionPath(collection) {
	// Validate collection name to prevent path traversal
	if (!collection || typeof collection !== 'string') {
		throw new Error('Invalid collection name');
	}
	if (!/^[a-zA-Z0-9_-]+$/.test(collection)) {
		throw new Error('Invalid collection name: only alphanumeric characters, underscores, and hyphens are allowed');
	}
	return join(DATA_DIR, `${collection}.ndjson`);
}

/**
 * Queue a write operation for a file to ensure atomicity
 * @param {string} filePath - Path to the file
 * @param {Function} writeFn - Function that returns the data to write
 * @returns {Promise<void>}
 */
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

/**
 * Read all records from a collection
 * @param {string} collection - Collection name
 * @returns {Promise<Array>} Array of records
 */
export async function readCollection(collection) {
	await ensureDirs();
	const filePath = getCollectionPath(collection);
	
	if (!existsSync(filePath)) {
		console.warn(`[fileStore] Collection file not found: ${filePath}`);
		console.warn(`[fileStore] DATA_DIR is: ${DATA_DIR}`);
		return [];
	}

	try {
		const content = await readFile(filePath, 'utf8');
		if (!content.trim()) {
			return [];
		}

		return content
			.trim()
			.split('\n')
			.filter(line => line.trim())
			.map(line => JSON.parse(line));
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.warn(`[fileStore] Collection file not found (ENOENT): ${filePath}`);
			return [];
		}
		console.error(`[fileStore] Error reading collection ${collection} from ${filePath}:`, error);
		throw error;
	}
}

/**
 * Write all records to a collection (atomic)
 * @param {string} collection - Collection name
 * @param {Array} records - Array of records
 * @returns {Promise<void>}
 */
export async function writeCollection(collection, records) {
	await ensureDirs();
	const filePath = getCollectionPath(collection);
	
	await queuedWrite(filePath, async () => {
		return records.map(r => JSON.stringify(r)).join('\n') + '\n';
	});
}

/**
 * Find a record by ID
 * @param {string} collection - Collection name
 * @param {string} id - Record ID
 * @returns {Promise<object|null>} Record or null
 */
export async function findById(collection, id) {
	const records = await readCollection(collection);
	return records.find(r => r.id === id) || null;
}

/**
 * Find records matching a predicate
 * @param {string} collection - Collection name
 * @param {Function} predicate - Filter function
 * @returns {Promise<Array>} Matching records
 */
export async function findMany(collection, predicate) {
	const records = await readCollection(collection);
	return records.filter(predicate);
}

/**
 * Create a new record
 * @param {string} collection - Collection name
 * @param {object} data - Record data (id will be generated if not provided)
 * @returns {Promise<object>} Created record
 */
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

/**
 * Update a record by ID
 * @param {string} collection - Collection name
 * @param {string} id - Record ID
 * @param {object} updates - Partial record data
 * @returns {Promise<object|null>} Updated record or null
 */
export async function update(collection, id, updates) {
	const records = await readCollection(collection);
	const index = records.findIndex(r => r.id === id);
	
	if (index === -1) {
		return null;
	}

	records[index] = {
		...records[index],
		...updates,
		updatedAt: new Date().toISOString()
	};
	
	await writeCollection(collection, records);
	return records[index];
}

/**
 * Delete a record by ID
 * @param {string} collection - Collection name
 * @param {string} id - Record ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
export async function remove(collection, id) {
	const records = await readCollection(collection);
	const index = records.findIndex(r => r.id === id);
	
	if (index === -1) {
		return false;
	}

	records.splice(index, 1);
	await writeCollection(collection, records);
	return true;
}

/**
 * Get uploads directory path
 * @returns {Promise<string>} Uploads directory path
 */
export async function getUploadsDir() {
	await ensureDirs();
	return UPLOADS_DIR;
}

