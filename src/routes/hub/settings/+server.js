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
	const { emailRateLimitDelay, calendarColours, calendarColors, meetingPlannerRotas } = data; // Support both for backward compatibility
	
	const settings = await getSettings();
	
	// Update email rate limit delay if provided
	if (emailRateLimitDelay !== undefined) {
		// Validate delay (must be between 100ms and 10000ms)
		if (typeof emailRateLimitDelay !== 'number' || emailRateLimitDelay < 100 || emailRateLimitDelay > 10000) {
			throw error(400, 'Invalid delay: must be between 100 and 10000 milliseconds');
		}
		settings.emailRateLimitDelay = emailRateLimitDelay;
	}
	
	// Update calendar colours if provided (support both calendarColours and calendarColors for backward compatibility)
	const coloursToUpdate = calendarColours !== undefined ? calendarColours : calendarColors;
	if (coloursToUpdate !== undefined) {
		// Validate calendar colours array
		if (!Array.isArray(coloursToUpdate)) {
			throw error(400, 'Invalid calendarColours: must be an array');
		}
		
		// Validate each colour object
		for (const colour of coloursToUpdate) {
			if (!colour || typeof colour !== 'object') {
				throw error(400, 'Invalid colour: each colour must be an object');
			}
			if (!colour.value || typeof colour.value !== 'string') {
				throw error(400, 'Invalid colour: each colour must have a value (hex colour)');
			}
			// Validate hex colour format
			if (!/^#[0-9A-Fa-f]{6}$/.test(colour.value)) {
				throw error(400, `Invalid colour format: ${colour.value} must be a valid hex colour (e.g., #9333ea)`);
			}
			if (!colour.label || typeof colour.label !== 'string' || colour.label.trim().length === 0) {
				throw error(400, 'Invalid colour: each colour must have a non-empty label');
			}
		}
		
		settings.calendarColours = coloursToUpdate;
	}

	// Update meeting planner rotas if provided
	if (meetingPlannerRotas !== undefined) {
		if (!Array.isArray(meetingPlannerRotas)) {
			throw error(400, 'Invalid meetingPlannerRotas: must be an array');
		}

		for (const rota of meetingPlannerRotas) {
			if (!rota || typeof rota !== 'object') {
				throw error(400, 'Invalid rota: each rota must be an object');
			}
			if (!rota.role || typeof rota.role !== 'string' || rota.role.trim().length === 0) {
				throw error(400, 'Invalid rota: each rota must have a role name');
			}
			if (typeof rota.capacity !== 'number' || rota.capacity < 1) {
				throw error(400, 'Invalid rota: each rota must have a capacity of at least 1');
			}
		}

		settings.meetingPlannerRotas = meetingPlannerRotas;
	}
	
	await writeSettings(settings);
	
	return json({ success: true, settings });
}
