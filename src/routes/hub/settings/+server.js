import { json, error } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getSettings, invalidateSettingsCache } from '$lib/crm/server/settings.js';
import { readFile, writeFile } from 'fs/promises';
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

/**
 * Write settings to file
 */
async function writeSettings(settings) {
	await writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
	// Invalidate cache so next read gets fresh data
	invalidateSettingsCache();
}

export async function POST({ request, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	
	if (!admin) {
		throw error(401, 'Unauthorized');
	}
	
	if (!isSuperAdmin(admin)) {
		throw error(403, 'Forbidden: Superadmin access required');
	}
	
	const data = await request.json();
	const { emailRateLimitDelay } = data;
	
	// Validate delay (must be between 100ms and 10000ms)
	if (typeof emailRateLimitDelay !== 'number' || emailRateLimitDelay < 100 || emailRateLimitDelay > 10000) {
		throw error(400, 'Invalid delay: must be between 100 and 10000 milliseconds');
	}
	
	const settings = await getSettings();
	settings.emailRateLimitDelay = emailRateLimitDelay;
	
	await writeSettings(settings);
	
	return json({ success: true, settings });
}
