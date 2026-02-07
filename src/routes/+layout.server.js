import { getEvents, getSettings } from '$lib/server/database';
import { getSettings as getHubSettings } from '$lib/crm/server/settings.js';

function isWebsitePath(pathname) {
	if (!pathname || pathname.startsWith('/hub') || pathname.startsWith('/admin') || pathname.startsWith('/multi-org') || pathname.startsWith('/api')) return false;
	return true;
}

export const load = async ({ locals, url }) => {
	const pathname = url.pathname || '/';
	const website = isWebsitePath(pathname);

	let highlightedEvent = null;
	let settings = {};
	let theme = null;

	if (website) {
		try {
			settings = getSettings();
			const allEvents = getEvents();
			// Skip Hub settings on marketing home (/) – theme not used there, saves a round trip and improves LCP/TTFB
			if (pathname !== '/') {
				const hubSettings = await getHubSettings();
				theme = hubSettings?.theme || null;
			}
			const highlighted = (allEvents || []).filter((e) => e.highlighted && e.published);
			highlightedEvent = highlighted.sort((a, b) =>
				new Date(a.date || '9999-12-31').getTime() - new Date(b.date || '9999-12-31').getTime()
			)[0] || null;
		} catch (err) {
			console.warn('[layout] Load failed, using defaults:', err?.message || err);
		}
	}

	return {
		highlightedEvent,
		settings: settings || {},
		theme,
		multiOrgAdminDomain: !!locals.multiOrgAdminDomain
	};
};












