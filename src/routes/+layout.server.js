import { getEvents, getSettings } from '$lib/server/database';
import { getSettings as getHubSettings } from '$lib/crm/server/settings.js';

export const load = async ({ locals }) => {
	let highlightedEvent = null;
	let settings = {};
	let theme = null;

	try {
		const allEvents = getEvents();
		settings = getSettings();
		const hubSettings = await getHubSettings();
		theme = hubSettings?.theme || null;

		// Get highlighted event (for banner)
		const highlightedEvents = (allEvents || []).filter((e) => e.highlighted && e.published);
		highlightedEvent =
			highlightedEvents.sort((a, b) => {
				const dateA = new Date(a.date || '9999-12-31');
				const dateB = new Date(b.date || '9999-12-31');
				return dateA.getTime() - dateB.getTime();
			})[0] || null;
	} catch (err) {
		// CRM store or main DB may be unavailable (e.g. production deploy, missing DATABASE_URL).
		// Return safe defaults so public pages (/, /signup, etc.) still render.
		console.warn('[layout] Load failed, using defaults:', err?.message || err);
	}

	return {
		highlightedEvent,
		settings: settings || {},
		theme,
		/** When true (admin subdomain), root layout hides website navbar/banner so multi-org layout is full page. */
		multiOrgAdminDomain: !!locals.multiOrgAdminDomain
	};
};












