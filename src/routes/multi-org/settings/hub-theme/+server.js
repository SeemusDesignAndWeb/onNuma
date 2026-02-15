import { json } from '@sveltejs/kit';
import { getSettings, writeSettings, getDefaultTheme } from '$lib/crm/server/settings.js';

const HEX = /^#[0-9A-Fa-f]{6}$/;
function ensureHex(val, fallback) {
	return typeof val === 'string' && HEX.test(val.trim()) ? val.trim() : fallback;
}
function ensureColorArray(arr, defaults) {
	if (!Array.isArray(arr)) return defaults;
	return defaults.map((d, i) => ensureHex(arr[i], d));
}

/** POST: update Hub theme colours (multi-org admin only). */
export async function POST({ request, locals }) {
	if (!locals.multiOrgAdmin) {
		return json({ error: 'Forbidden' }, { status: 403 });
	}
	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}
	if (!body || typeof body !== 'object') {
		return json({ error: 'Body must be an object' }, { status: 400 });
	}

	const defaults = getDefaultTheme();
	const settings = await getSettings();
	const theme = settings.theme || { ...defaults };

	if (body.primaryColor !== undefined) theme.primaryColor = ensureHex(body.primaryColor, defaults.primaryColor);
	if (body.brandColor !== undefined) theme.brandColor = ensureHex(body.brandColor, defaults.brandColor);
	if (body.navbarBackgroundColor !== undefined) theme.navbarBackgroundColor = ensureHex(body.navbarBackgroundColor, defaults.navbarBackgroundColor);
	if (body.buttonColors !== undefined) theme.buttonColors = ensureColorArray(body.buttonColors, defaults.buttonColors);
	if (body.panelHeadColors !== undefined) theme.panelHeadColors = ensureColorArray(body.panelHeadColors, defaults.panelHeadColors);
	if (body.panelBackgroundColor !== undefined) theme.panelBackgroundColor = ensureHex(body.panelBackgroundColor, defaults.panelBackgroundColor);

	settings.theme = theme;
	await writeSettings(settings);
	return json({ ok: true });
}
