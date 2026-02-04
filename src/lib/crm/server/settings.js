/**
 * Settings Management
 * Reads and writes Hub settings via the store facade (file store or database).
 * File store: data/hub_settings.ndjson (one record id='default').
 * Database: crm_records table, collection='hub_settings', id='default'.
 * Migrates from legacy hub_settings.json to hub_settings.ndjson on first read when in file mode.
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { readCollection, writeCollection, getDataDir } from './fileStore.js';

const HUB_SETTINGS_COLLECTION = 'hub_settings';
const DEFAULT_RECORD_ID = 'default';

// Cache settings to avoid reading store on every request
let settingsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds cache

function getDefaultCalendarColours() {
	return [
		{ value: '#9333ea', label: 'Purple' },
		{ value: '#3b82f6', label: 'Blue' },
		{ value: '#10b981', label: 'Green' },
		{ value: '#ef4444', label: 'Red' },
		{ value: '#f97316', label: 'Orange' },
		{ value: '#eab308', label: 'Yellow' },
		{ value: '#ec4899', label: 'Pink' },
		{ value: '#6366f1', label: 'Indigo' },
		{ value: '#14b8a6', label: 'Teal' },
		{ value: '#f59e0b', label: 'Amber' }
	];
}

function getDefaultMeetingPlannerRotas() {
	return [
		{ role: 'Meeting Leader', capacity: 1 },
		{ role: 'Worship Leader and Team', capacity: 8 },
		{ role: 'Speaker', capacity: 1 },
		{ role: 'Call to Worship', capacity: 1 }
	];
}

function getDefaultTheme() {
	return {
		logoPath: '',
		primaryColor: '#4BB170',
		brandColor: '#4A97D2',
		navbarBackgroundColor: '#4A97D2',
		buttonColors: ['#4A97D2', '#4BB170', '#3B79A8', '#3C8E5A', '#E6A324'],
		panelHeadColors: ['#4A97D2', '#3B79A8', '#2C5B7E'],
		panelBackgroundColor: '#E8F2F9', // Lighter shade of blue for all panels
		externalPagesLayout: 'integrated', // 'integrated' | 'standalone'
		publicPagesBranding: 'egcc' // 'egcc' | 'hub' - Hub public pages (signup, forms, etc.) only; main EGCC website is never affected
	};
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
function ensureHex(val, fallback) {
	return typeof val === 'string' && HEX_COLOR.test(val) ? val : fallback;
}
function ensureColorArray(arr, defaults) {
	if (!Array.isArray(arr)) return defaults;
	return defaults.map((d, i) => ensureHex(arr[i], d));
}

function getDefaultSettings() {
	return {
		emailRateLimitDelay: 500,
		calendarColours: getDefaultCalendarColours(),
		meetingPlannerRotas: getDefaultMeetingPlannerRotas(),
		theme: getDefaultTheme()
	};
}

/**
 * Merge raw record from store with defaults (validate and fill missing fields).
 */
function mergeWithDefaults(record) {
	const defaultSettings = getDefaultSettings();
	const defaultTheme = getDefaultTheme();
	const colours = record.calendarColours ?? record.calendarColors;
	const dt = defaultTheme;
	const t = record.theme && typeof record.theme === 'object' ? record.theme : {};
	const layout = t.externalPagesLayout === 'standalone' ? 'standalone' : 'integrated';
	const publicBranding = t.publicPagesBranding === 'hub' ? 'hub' : 'egcc';
	const theme = {
		logoPath: typeof t.logoPath === 'string' ? t.logoPath : dt.logoPath,
		primaryColor: ensureHex(t.primaryColor, dt.primaryColor),
		brandColor: ensureHex(t.brandColor, dt.brandColor),
		navbarBackgroundColor: ensureHex(t.navbarBackgroundColor, dt.navbarBackgroundColor),
		buttonColors: ensureColorArray(t.buttonColors, dt.buttonColors),
		panelHeadColors: ensureColorArray(t.panelHeadColors, dt.panelHeadColors),
		panelBackgroundColor: ensureHex(t.panelBackgroundColor, dt.panelBackgroundColor),
		externalPagesLayout: layout,
		publicPagesBranding: publicBranding
	};
	return {
		emailRateLimitDelay: record.emailRateLimitDelay ?? defaultSettings.emailRateLimitDelay,
		calendarColours: Array.isArray(colours) && colours.length > 0 ? colours : defaultSettings.calendarColours,
		meetingPlannerRotas: Array.isArray(record.meetingPlannerRotas)
			? record.meetingPlannerRotas
			: defaultSettings.meetingPlannerRotas,
		theme
	};
}

/**
 * Migrate legacy hub_settings.json into the store (file or database).
 * Runs when no hub_settings record exists; reads from data/hub_settings.json if present.
 */
async function migrateFromLegacyJsonIfNeeded() {
	const dataDir = getDataDir();
	const jsonPath = join(dataDir, 'hub_settings.json');
	if (!existsSync(jsonPath)) return null;
	try {
		const content = await readFile(jsonPath, 'utf8');
		const parsed = JSON.parse(content);
		const now = new Date().toISOString();
		const record = {
			id: DEFAULT_RECORD_ID,
			...parsed,
			createdAt: now,
			updatedAt: now
		};
		await writeCollection(HUB_SETTINGS_COLLECTION, [record]);
		return record;
	} catch (err) {
		console.error('[Settings] Migration from hub_settings.json failed:', err);
		return null;
	}
}

/**
 * Read settings from store (with caching).
 * @returns {Promise<object>} Settings object
 */
export async function getSettings() {
	const now = Date.now();
	if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
		return settingsCache;
	}

	const defaultSettings = getDefaultSettings();
	let records = await readCollection(HUB_SETTINGS_COLLECTION);
	let record = records.find((r) => r.id === DEFAULT_RECORD_ID);

	if (!record) {
		record = await migrateFromLegacyJsonIfNeeded();
	}
	// Seed store with current default theme/colours so they are persisted in database/filestore
	if (!record) {
		await writeSettings(defaultSettings);
		records = await readCollection(HUB_SETTINGS_COLLECTION);
		record = records.find((r) => r.id === DEFAULT_RECORD_ID);
	}
	if (!record) {
		settingsCache = defaultSettings;
		cacheTimestamp = now;
		return settingsCache;
	}

	settingsCache = mergeWithDefaults(record);
	cacheTimestamp = now;
	return settingsCache;
}

/**
 * Write full settings to store. Invalidates cache after write.
 * @param {object} settings - Full settings object (emailRateLimitDelay, calendarColours, meetingPlannerRotas, theme)
 */
export async function writeSettings(settings) {
	const records = await readCollection(HUB_SETTINGS_COLLECTION);
	const existing = records.find((r) => r.id === DEFAULT_RECORD_ID);
	const now = new Date().toISOString();
	const record = {
		id: DEFAULT_RECORD_ID,
		emailRateLimitDelay: settings.emailRateLimitDelay,
		calendarColours: settings.calendarColours,
		meetingPlannerRotas: settings.meetingPlannerRotas,
		theme: settings.theme,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now
	};
	await writeCollection(HUB_SETTINGS_COLLECTION, [record]);
	invalidateSettingsCache();
}

/**
 * Invalidate settings cache (call after updating settings)
 */
export function invalidateSettingsCache() {
	settingsCache = null;
	cacheTimestamp = 0;
}
