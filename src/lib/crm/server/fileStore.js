/**
 * CRM data store facade. Routes to file store or database based on store mode.
 * When DATA_STORE=database (or store_mode.json), all collections use the database.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import * as fileStoreImpl from './fileStoreImpl.js';
import * as dbStore from './dbStore.js';
import { FILE_ONLY_COLLECTIONS } from './collections.js';
import { env } from '$env/dynamic/private';

let storeModeCache = null;

/** Resolve store mode: env DATA_STORE wins when set (ensures database-only when DATA_STORE=database), else data/store_mode.json, default 'file'. */
export async function getStoreMode() {
	if (storeModeCache !== null) {
		return storeModeCache;
	}
	const envMode = env.DATA_STORE;
	if (typeof envMode === 'string' && envMode.trim()) {
		storeModeCache = envMode.trim().toLowerCase() === 'database' ? 'database' : 'file';
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
		// fall through to default
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

/**
 * @param {string} collection - Collection name (e.g. 'contacts', 'events', 'rotas')
 * @param {{ organisationId?: string, search?: string, limit?: number, offset?: number }} [options] - Optional query options for database store (organisation filter, search, pagination). Ignored by file store.
 */
export async function readCollection(collection, options = {}) {
	const backend = await getBackend(collection);
	return backend.readCollection(collection, options);
}

export async function writeCollection(collection, records) {
	const backend = await getBackend(collection);
	return backend.writeCollection(collection, records);
}

/** Return count of records without loading rows (faster for dashboard stats / LCP). */
export async function readCollectionCount(collection, options = {}) {
	const backend = await getBackend(collection);
	return backend.readCollectionCount(collection, options);
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

/** Single-row body merge; avoids full read-modify-writeCollection race (dbStore only). */
export async function updatePartial(collection, id, bodyPatch) {
	const backend = await getBackend(collection);
	if (typeof backend.updatePartial === 'function') {
		return backend.updatePartial(collection, id, bodyPatch);
	}
	return backend.update(collection, id, { ...bodyPatch, updatedAt: new Date().toISOString() });
}

export async function remove(collection, id) {
	const backend = await getBackend(collection);
	return backend.remove(collection, id);
}
