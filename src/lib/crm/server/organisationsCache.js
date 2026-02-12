/**
 * Cache for organisations list used by hub layout. Reduces DB round-trips on navigation.
 * Invalidate when theme or organisation/plan is updated so next load is fresh; combined with
 * invalidateAllSessions() so users re-login to see changes.
 */

import { readCollection } from './fileStore.js';

const CACHE_TTL_MS = 120 * 1000; // 120 seconds (increased from 30s for better performance)

let cache = null;
let cacheTimestamp = 0;

/**
 * Get organisations list (cached). Returns non-archived organisations.
 * @param {number} [ttlMs] - Cache TTL in ms (default 30s)
 * @returns {Promise<object[]>}
 */
export async function getCachedOrganisations(ttlMs = CACHE_TTL_MS) {
	const now = Date.now();
	if (cache !== null && now - cacheTimestamp < ttlMs) {
		return cache;
	}
	const raw = await readCollection('organisations');
	cache = (Array.isArray(raw) ? raw : []).filter((o) => o && !o.archivedAt);
	cacheTimestamp = now;
	return cache;
}

/**
 * Invalidate organisations cache. Call after theme or organisation/plan updates.
 */
export function invalidateOrganisationsCache() {
	cache = null;
	cacheTimestamp = 0;
}
