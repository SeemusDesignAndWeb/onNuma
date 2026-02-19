import { json, error } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getSettings, writeSettings, getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { updatePartial } from '$lib/crm/server/fileStore.js';

export async function POST({ request, cookies }) {
	console.log('[settings POST] Checking auth...');
	const admin = await getAdminFromCookies(cookies);
	
	if (!admin) {
		console.log('[settings POST] No admin found, returning 401');
		throw error(401, 'Unauthorized');
	}
	console.log('[settings POST] Admin:', admin.email);
	
	if (!isSuperAdmin(admin)) {
		throw error(403, 'Forbidden: Superadmin access required');
	}
	
	const data = await request.json();
	const {
		emailRateLimitDelay,
		calendarColours,
		calendarColors,
		theme: themeUpdate,
		terminology: terminologyUpdate,
		privacyContactName: privacyContactNameUpdate,
		privacyContactEmail: privacyContactEmailUpdate,
		privacyContactPhone: privacyContactPhoneUpdate
	} = data;

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

	// Update theme if provided
	if (themeUpdate !== undefined) {
		if (typeof themeUpdate !== 'object' || themeUpdate === null) {
			throw error(400, 'Invalid theme: must be an object');
		}
		settings.theme = settings.theme || {};
		if (themeUpdate.logoPath !== undefined) {
			settings.theme.logoPath = typeof themeUpdate.logoPath === 'string' ? themeUpdate.logoPath : '';
		}
		if (themeUpdate.loginLogoPath !== undefined) {
			settings.theme.loginLogoPath = typeof themeUpdate.loginLogoPath === 'string' ? themeUpdate.loginLogoPath : '';
		}
		if (themeUpdate.primaryColor !== undefined) {
			const v = themeUpdate.primaryColor;
			if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v)) {
				throw error(400, 'Invalid theme.primaryColor: must be a hex colour (e.g. #4BB170)');
			}
			settings.theme.primaryColor = v;
		}
		if (themeUpdate.brandColor !== undefined) {
			const v = themeUpdate.brandColor;
			if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v)) {
				throw error(400, 'Invalid theme.brandColor: must be a hex colour (e.g. #4A97D2)');
			}
			settings.theme.brandColor = v;
		}
		if (themeUpdate.navbarBackgroundColor !== undefined) {
			const v = themeUpdate.navbarBackgroundColor;
			if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v)) {
				throw error(400, 'Invalid theme.navbarBackgroundColor: must be a hex colour');
			}
			settings.theme.navbarBackgroundColor = v;
		}
		if (themeUpdate.buttonColors !== undefined) {
			if (!Array.isArray(themeUpdate.buttonColors) || themeUpdate.buttonColors.length > 5) {
				throw error(400, 'Invalid theme.buttonColors: must be an array of up to 5 hex colours');
			}
			for (const v of themeUpdate.buttonColors) {
				if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v)) {
					throw error(400, 'Invalid theme.buttonColors: each item must be a hex colour');
				}
			}
			settings.theme.buttonColors = themeUpdate.buttonColors.slice(0, 5);
		}
		if (themeUpdate.panelHeadColors !== undefined) {
			if (!Array.isArray(themeUpdate.panelHeadColors) || themeUpdate.panelHeadColors.length > 3) {
				throw error(400, 'Invalid theme.panelHeadColors: must be an array of up to 3 hex colours');
			}
			for (const v of themeUpdate.panelHeadColors) {
				if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v)) {
					throw error(400, 'Invalid theme.panelHeadColors: each item must be a hex colour');
				}
			}
			settings.theme.panelHeadColors = themeUpdate.panelHeadColors.slice(0, 3);
		}
		if (themeUpdate.panelBackgroundColor !== undefined) {
			const v = themeUpdate.panelBackgroundColor;
			if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v)) {
				throw error(400, 'Invalid theme.panelBackgroundColor: must be a hex colour');
			}
			settings.theme.panelBackgroundColor = v;
		}
		if (themeUpdate.externalPagesLayout !== undefined) {
			const v = themeUpdate.externalPagesLayout;
			if (v !== 'integrated' && v !== 'standalone') {
				throw error(400, 'Invalid theme.externalPagesLayout: must be "integrated" or "standalone"');
			}
			settings.theme.externalPagesLayout = v;
		}
		if (themeUpdate.publicPagesBranding !== undefined) {
			// OnNuma: only Hub branding; accept 'hub' and normalise any legacy value to 'hub'
			settings.theme.publicPagesBranding = 'hub';
		}
	}

	// Update terminology if provided
	if (terminologyUpdate !== undefined) {
		if (typeof terminologyUpdate !== 'object' || terminologyUpdate === null || Array.isArray(terminologyUpdate)) {
			throw error(400, 'Invalid terminology: must be an object');
		}
		const { getDefaultTerminology } = await import('$lib/crm/server/settings.js');
		const defaults = getDefaultTerminology();
		const merged = {};
		for (const key of Object.keys(defaults)) {
			const val = terminologyUpdate[key];
			merged[key] = (typeof val === 'string' && val.trim() !== '') ? val.trim().slice(0, 50) : defaults[key];
		}
		settings.terminology = merged;
	}

	// Privacy policy contact (stored on current organisation; bolt-ons are managed in multi-org)
	const organisationId = await getCurrentOrganisationId();
	if (organisationId) {
		const orgUpdates = {};
		if (privacyContactNameUpdate !== undefined) orgUpdates.privacyContactName = String(privacyContactNameUpdate ?? '').trim() || null;
		if (privacyContactEmailUpdate !== undefined) orgUpdates.privacyContactEmail = String(privacyContactEmailUpdate ?? '').trim() || null;
		if (privacyContactPhoneUpdate !== undefined) orgUpdates.privacyContactPhone = String(privacyContactPhoneUpdate ?? '').trim() || null;
		if (Object.keys(orgUpdates).length > 0) {
			await updatePartial('organisations', organisationId, orgUpdates);
			const { invalidateOrganisationsCache } = await import('$lib/crm/server/organisationsCache.js');
			invalidateOrganisationsCache();
		}
	}

	await writeSettings(settings);

	// Store theme on current organisation so this org's Hub shows its own branding (not another org's)
	if (organisationId && themeUpdate !== undefined) {
		const { updatePartial } = await import('$lib/crm/server/fileStore.js');
		await updatePartial('organisations', organisationId, { theme: settings.theme });
		const { invalidateOrganisationsCache } = await import('$lib/crm/server/organisationsCache.js');
		invalidateOrganisationsCache();
	}

	return json({ success: true, settings });
}
