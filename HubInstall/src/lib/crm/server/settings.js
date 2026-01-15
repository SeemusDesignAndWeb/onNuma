/**
 * Settings Management
 * Reads and manages Hub settings from file storage
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { env } from '$env/dynamic/private';

function getDataDir() {
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
const SETTINGS_FILE = join(DATA_DIR, 'hub_settings.json');

// Cache settings to avoid reading file on every request
let settingsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds cache

/**
 * Read settings from file (with caching)
 * @returns {Promise<object>} Settings object
 */
export async function getSettings() {
	const now = Date.now();
	
	// Return cached settings if still valid
	if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
		return settingsCache;
	}
	
	// Default settings
	const defaultSettings = {
		emailRateLimitDelay: 500 // Default: 500ms (2 requests per second)
	};
	
	if (!existsSync(SETTINGS_FILE)) {
		settingsCache = defaultSettings;
		cacheTimestamp = now;
		return settingsCache;
	}
	
	try {
		const content = await readFile(SETTINGS_FILE, 'utf8');
		const settings = JSON.parse(content);
		settingsCache = {
			emailRateLimitDelay: settings.emailRateLimitDelay || defaultSettings.emailRateLimitDelay
		};
		cacheTimestamp = now;
		return settingsCache;
	} catch (error) {
		console.error('[Settings] Error reading settings:', error);
		settingsCache = defaultSettings;
		cacheTimestamp = now;
		return settingsCache;
	}
}

/**
 * Invalidate settings cache (call after updating settings)
 */
export function invalidateSettingsCache() {
	settingsCache = null;
	cacheTimestamp = 0;
}
