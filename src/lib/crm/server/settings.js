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
import { env } from '$env/dynamic/private';
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
	return [];
}

function getDefaultTheme() {
	return {
		logoPath: '',
		loginLogoPath: '',
		primaryColor: '#4BB170',
		brandColor: '#4A97D2',
		navbarBackgroundColor: '#4A97D2',
		buttonColors: ['#4A97D2', '#4BB170', '#3B79A8', '#3C8E5A', '#E6A324'],
		panelHeadColors: ['#4A97D2', '#3B79A8', '#2C5B7E'],
		panelBackgroundColor: '#E8F2F9', // Lighter shade of blue for all panels
		externalPagesLayout: 'integrated', // 'integrated' | 'standalone'
		publicPagesBranding: 'hub' // Hub public pages (signup, forms, etc.) always use theme; main website is never affected
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
		emailProvider: 'mailgun',
		calendarColours: getDefaultCalendarColours(),
		meetingPlannerRotas: getDefaultMeetingPlannerRotas(),
		theme: getDefaultTheme(),
		rotaReminderDaysAhead: 3
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
	const publicBranding = 'hub'; // OnNuma: public hub pages always use theme branding
	const theme = {
		logoPath: typeof t.logoPath === 'string' ? t.logoPath : dt.logoPath,
		loginLogoPath: typeof t.loginLogoPath === 'string' ? t.loginLogoPath : dt.loginLogoPath,
		primaryColor: ensureHex(t.primaryColor, dt.primaryColor),
		brandColor: ensureHex(t.brandColor, dt.brandColor),
		navbarBackgroundColor: ensureHex(t.navbarBackgroundColor, dt.navbarBackgroundColor),
		buttonColors: ensureColorArray(t.buttonColors, dt.buttonColors),
		panelHeadColors: ensureColorArray(t.panelHeadColors, dt.panelHeadColors),
		panelBackgroundColor: ensureHex(t.panelBackgroundColor, dt.panelBackgroundColor),
		externalPagesLayout: layout,
		publicPagesBranding: publicBranding
	};
	const emailProvider = record.emailProvider === 'resend' ? 'resend' : 'mailgun';
	const rotaReminderDays = record.rotaReminderDaysAhead;
	const rotaReminderDaysAhead =
		typeof rotaReminderDays === 'number' && rotaReminderDays >= 0 && rotaReminderDays <= 90
			? rotaReminderDays
			: defaultSettings.rotaReminderDaysAhead;
	return {
		emailRateLimitDelay: record.emailRateLimitDelay ?? defaultSettings.emailRateLimitDelay,
		emailProvider,
		calendarColours: Array.isArray(colours) && colours.length > 0 ? colours : defaultSettings.calendarColours,
		meetingPlannerRotas: Array.isArray(record.meetingPlannerRotas)
			? record.meetingPlannerRotas
			: defaultSettings.meetingPlannerRotas,
		theme,
		rotaReminderDaysAhead,
		hubSuperAdminEmail: record.hubSuperAdminEmail ?? null,
		currentOrganisationId: record.currentOrganisationId ?? null
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
		emailProvider: settings.emailProvider === 'resend' ? 'resend' : 'mailgun',
		calendarColours: settings.calendarColours,
		meetingPlannerRotas: settings.meetingPlannerRotas,
		theme: settings.theme,
		rotaReminderDaysAhead: settings.rotaReminderDaysAhead,
		hubSuperAdminEmail: existing?.hubSuperAdminEmail ?? settings.hubSuperAdminEmail ?? null,
		currentOrganisationId: existing?.currentOrganisationId ?? settings.currentOrganisationId ?? null,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now
	};
	await writeCollection(HUB_SETTINGS_COLLECTION, [record]);
	invalidateSettingsCache();
}

/**
 * Get Hub super admin email from settings (set by MultiOrg when creating Hub super admin).
 * @returns {Promise<string|null>}
 */
export async function getHubSuperAdminEmail() {
	const s = await getSettings();
	return s.hubSuperAdminEmail ?? null;
}

/**
 * Set Hub super admin email in settings (used by MultiOrg when creating Hub super admin).
 * @param {string} email
 */
export async function setHubSuperAdminEmail(email) {
	let records = await readCollection(HUB_SETTINGS_COLLECTION);
	let defaultRecord = records.find((r) => r.id === DEFAULT_RECORD_ID);
	if (!defaultRecord) {
		// Ensure default record exists (getSettings creates one if missing)
		await getSettings();
		records = await readCollection(HUB_SETTINGS_COLLECTION);
		defaultRecord = records.find((r) => r.id === DEFAULT_RECORD_ID);
	}
	if (defaultRecord) {
		defaultRecord.hubSuperAdminEmail = email || null;
		defaultRecord.updatedAt = new Date().toISOString();
		await writeCollection(HUB_SETTINGS_COLLECTION, records);
	}
	invalidateSettingsCache();
}

/**
 * Get Hub super admin email for a specific organisation (per-org super admin).
 * @param {string|null} organisationId
 * @returns {Promise<string|null>}
 */
export async function getHubSuperAdminEmailForOrganisation(organisationId) {
	if (!organisationId) return null;
	const orgs = await readCollection('organisations');
	const org = orgs.find((o) => o.id === organisationId) || null;
	return (org && org.hubSuperAdminEmail) ? org.hubSuperAdminEmail : null;
}

/**
 * Effective super admin email: current organisation's hubSuperAdminEmail, then hub_settings, then env.
 * Used by permissions so Hub recognises the Hub organisation's super admin.
 * @returns {Promise<string>}
 */
export async function getEffectiveSuperAdminEmail() {
	const currentOrgId = await getCurrentOrganisationId();
	const fromOrg = await getHubSuperAdminEmailForOrganisation(currentOrgId);
	if (fromOrg) return fromOrg;
	const fromSettings = await getHubSuperAdminEmail();
	return fromSettings || env.SUPER_ADMIN_EMAIL || 'john.watson@egcc.co.uk';
}

/**
 * Get the current Hub organisation ID (which org's data the Hub shows).
 * When the request is on a custom hub domain (e.g. hub.egcc.co.uk), the org is
 * taken from request context (set in the hook); we never use hub_settings or
 * client input in that case. Otherwise from hub_settings.currentOrganisationId,
 * or the first organisation if not set.
 * @returns {Promise<string|null>}
 */
export async function getCurrentOrganisationId() {
	const { getRequestOrganisationId } = await import('./requestOrg.js');
	const requestOrgId = getRequestOrganisationId();
	if (requestOrgId) {
		if (env.DEBUG_ORG_SCOPE === '1') {
			console.log('[org] getCurrentOrganisationId:', requestOrgId, '(from hub domain)');
		}
		return requestOrgId;
	}
	const records = await readCollection(HUB_SETTINGS_COLLECTION);
	const defaultRecord = records.find((r) => r.id === DEFAULT_RECORD_ID);
	const currentOrganisationId = defaultRecord?.currentOrganisationId ?? null;
	if (currentOrganisationId) {
		if (env.DEBUG_ORG_SCOPE === '1') {
			console.log('[org] getCurrentOrganisationId:', currentOrganisationId, '(from hub_settings)');
		}
		return currentOrganisationId;
	}
	const orgs = await readCollection('organisations');
	const first = orgs && orgs.length > 0 ? orgs[0] : null;
	const fallback = first ? first.id : null;
	if (env.DEBUG_ORG_SCOPE === '1' && fallback) {
		console.log('[org] getCurrentOrganisationId:', fallback, '(fallback first org)');
	}
	return fallback;
}

/**
 * Set the current Hub organisation ID in hub_settings.
 * @param {string|null} organisationId
 */
export async function setCurrentOrganisationId(organisationId) {
	const records = await readCollection(HUB_SETTINGS_COLLECTION);
	const defaultRecord = records.find((r) => r.id === DEFAULT_RECORD_ID);
	if (!defaultRecord) {
		await getSettings();
		const recs = await readCollection(HUB_SETTINGS_COLLECTION);
		const def = recs.find((r) => r.id === DEFAULT_RECORD_ID);
		if (def) {
			def.currentOrganisationId = organisationId || null;
			def.updatedAt = new Date().toISOString();
			await writeCollection(HUB_SETTINGS_COLLECTION, recs);
		}
	} else {
		defaultRecord.currentOrganisationId = organisationId || null;
		defaultRecord.updatedAt = new Date().toISOString();
		await writeCollection(HUB_SETTINGS_COLLECTION, records);
	}
	invalidateSettingsCache();
}

/**
 * Invalidate settings cache (call after updating settings)
 */
export function invalidateSettingsCache() {
	settingsCache = null;
	cacheTimestamp = 0;
}
