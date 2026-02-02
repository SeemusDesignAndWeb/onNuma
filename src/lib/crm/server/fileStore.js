/**
 * CRM data store facade. Routes to file store or database based on store mode.
 * Admins and sessions always use file store so login works when DB is unavailable.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import * as fileStoreImpl from './fileStoreImpl.js';
import * as dbStore from './dbStore.js';
import { FILE_ONLY_COLLECTIONS } from './collections.js';
import { env } from '$env/dynamic/private';

let storeModeCache = null;

/** Resolve store mode: data/store_mode.json (persists across restarts), then env DATA_STORE, default 'file'. */
export async function getStoreMode() {
	if (storeModeCache !== null) {
		return storeModeCache;
	}
	try {
		const dataDir = fileStoreImpl.getDataDir();
		const modePath = join(dataDir, 'store_mode.json');
		if (existsSync(modePath)) {
			const content = await readFile(modePath, 'utf8');
			const data = JSON.parse(content);
			const mode = (data.dataStore || 'file').toLowerCase();
			storeModeCache = mode === 'database' ? 'database' : 'file';
			return storeModeCache;
		}
	} catch {
		// fall through to env
	}
	const envMode = env.DATA_STORE;
	if (typeof envMode === 'string' && envMode.trim()) {
		storeModeCache = envMode.trim().toLowerCase() === 'database' ? 'database' : 'file';
		return storeModeCache;
	}
	storeModeCache = 'file';
	return storeModeCache;
}

/** Invalidate store mode cache (call after writing store_mode.json). */
export function invalidateStoreModeCache() {
	storeModeCache = null;
}

function isFileOnlyCollection(collection) {
	return FILE_ONLY_COLLECTIONS.includes(collection);
}

async function getBackend(collection) {
	if (isFileOnlyCollection(collection)) {
		return fileStoreImpl;
	}
	const mode = await getStoreMode();
	return mode === 'database' ? dbStore : fileStoreImpl;
}

export function getDataDir() {
	return fileStoreImpl.getDataDir();
}

export async function getUploadsDir() {
	return fileStoreImpl.getUploadsDir();
}

export async function readCollection(collection) {
	const backend = await getBackend(collection);
	return backend.readCollection(collection);
}

export async function writeCollection(collection, records) {
	const backend = await getBackend(collection);
	return backend.writeCollection(collection, records);
}

export async function findById(collection, id) {
	const backend = await getBackend(collection);
	return backend.findById(collection, id);
}

export async function findMany(collection, predicate) {
	const backend = await getBackend(collection);
	return backend.findMany(collection, predicate);
}

export async function create(collection, data) {
	const backend = await getBackend(collection);
	return backend.create(collection, data);
}

export async function update(collection, id, updates) {
	const backend = await getBackend(collection);
	return backend.update(collection, id, updates);
}

export async function remove(collection, id) {
	const backend = await getBackend(collection);
	return backend.remove(collection, id);
}
