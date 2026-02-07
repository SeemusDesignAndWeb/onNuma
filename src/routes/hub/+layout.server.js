import { getCsrfToken } from '$lib/crm/server/auth.js';
import { getSettings } from '$lib/crm/server/settings.js';
import { getRequestOrganisationId } from '$lib/crm/server/requestOrg.js';
import { getCachedOrganisations } from '$lib/crm/server/organisationsCache.js';
import { getPlanFromAreaPermissions, getAreaPermissionsForPlan } from '$lib/crm/server/permissions.js';

/** Strip Cloudinary logo URLs so Hub shows default logo until settings are updated. */
function sanitizeThemeLogoUrls(theme) {
	if (!theme || typeof theme !== 'object') return theme;
	const isCloudinary = (u) => typeof u === 'string' && u.includes('cloudinary.com');
	const t = { ...theme };
	if (isCloudinary(t.logoPath)) t.logoPath = '';
	if (isCloudinary(t.loginLogoPath)) t.loginLogoPath = '';
	return t;
}

export async function load({ cookies, locals }) {
	const csrfToken = getCsrfToken(cookies);
	let settings = {};
	let orgs = [];
	try {
		[settings, orgs] = await Promise.all([
			getSettings(),
			getCachedOrganisations()
		]);
	} catch (err) {
		// Don't break login page or other hub pages if DB/store is slow or fails (e.g. prod timeout)
		console.error('[hub layout] load failed:', err?.message || err);
	}
	const requestOrgId = getRequestOrganisationId();
	let organisationId = requestOrgId ?? settings?.currentOrganisationId ?? orgs?.[0]?.id ?? null;
	const orgById = organisationId ? orgs.find((o) => o.id === organisationId) : null;
	if (organisationId && !orgById) {
		organisationId = orgs?.[0]?.id ?? null;
	}
	const org = organisationId ? (orgs.find((o) => o.id === organisationId) || null) : null;
	let showOnboarding = false;
	if (organisationId && locals.admin && org) {
		showOnboarding = !org.onboardingDismissedAt;
	}
	// Hub navbar and access run off the organisation's plan (Free / Professional / Enterprise)
	const plan = org && Array.isArray(org.areaPermissions) ? getPlanFromAreaPermissions(org.areaPermissions) : null;
	const organisationAreaPermissions = plan ? getAreaPermissionsForPlan(plan) : (org && Array.isArray(org.areaPermissions) ? org.areaPermissions : null);
	const theme = sanitizeThemeLogoUrls(settings?.theme || null);
	return {
		csrfToken,
		admin: locals.admin || null,
		theme,
		superAdminEmail: locals.superAdminEmail || null,
		hubOrganisationFromDomain: locals.hubOrganisationFromDomain || null,
		currentOrganisation: org || null,
		showOnboarding: !!showOnboarding,
		organisationId: organisationId || null,
		organisationAreaPermissions,
		plan: plan || 'free'
	};
}

