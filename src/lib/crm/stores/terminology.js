import { writable, derived } from 'svelte/store';

/**
 * Default terminology — mirrors getDefaultTerminology() in settings.js.
 * These are the fallback values used before layout data is available (SSR hydration gap).
 */
const DEFAULTS = {
	hub_name: 'TheHUB',
	organisation: 'Organisation',
	coordinator: 'Coordinator',
	team_leader: 'Team Leader',
	volunteer: 'Volunteer',
	team: 'Team',
	role: 'Role',
	event: 'Event',
	rota: 'Schedule',
	sign_up: 'Sign Up',
	session: 'Session',
	group: 'Group',
	multi_site: 'Multi-Site',
	meeting_planner: 'Meeting Planner'
};

/**
 * Hub terminology store. Populated from hub layout data in hub/+layout.svelte.
 * Components import this store and read terms reactively.
 *
 * Usage:
 *   import { terminology } from '$lib/crm/stores/terminology.js';
 *   $terminology.rota        // → "Schedule" (or "Rota", "Service", "Shift", etc.)
 *   $terminology.rota + 's'  // → "Schedules"
 */
export const terminology = writable({ ...DEFAULTS });

/**
 * Set terminology from server-loaded settings. Called once in hub/+layout.svelte.
 * Missing keys fall back to defaults so partial updates are safe.
 * @param {Record<string, string>} loaded
 */
export function setTerminology(loaded) {
	if (!loaded || typeof loaded !== 'object') return;
	const merged = { ...DEFAULTS };
	for (const key of Object.keys(DEFAULTS)) {
		const val = loaded[key];
		if (typeof val === 'string' && val.trim() !== '') {
			merged[key] = val.trim();
		}
	}
	terminology.set(merged);
}
