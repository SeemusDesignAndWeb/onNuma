import { getCsrfToken } from '$lib/crm/server/auth.js';
import { getSettings, getDefaultTheme } from '$lib/crm/server/settings.js';
import { getRequestOrganisationId } from '$lib/crm/server/requestOrg.js';
import { getCachedOrganisations } from '$lib/crm/server/organisationsCache.js';
import {
	getConfiguredPlanFromAreaPermissions,
	isSuperAdmin,
	getTrialStatus,
	getEffectiveOrgPermissions
} from '$lib/crm/server/permissions.js';
import { env } from '$env/dynamic/private';

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
	// Use getEffectiveOrgPermissions to account for trial expiry (reverts to Free if trial expired)
	const effectivePermissions = org ? getEffectiveOrgPermissions(org) : null;
	const plan = effectivePermissions ? await getConfiguredPlanFromAreaPermissions(effectivePermissions) : null;
	const organisationAreaPermissions = effectivePermissions || null;
	
	// Get trial status for UI banner
	const trialStatus = org ? getTrialStatus(org) : { inTrial: false, expired: false, daysRemaining: 0, trialPlan: null };
	
	const theme = sanitizeThemeLogoUrls(settings?.theme || getDefaultTheme());
	const sundayPlannersLabel =
		typeof settings?.sundayPlannersLabel === 'string' && settings.sundayPlannersLabel.trim() !== ''
			? settings.sundayPlannersLabel.trim()
			: 'Meeting Planners';
	const showBilling =
		!!(env.PADDLE_API_KEY && (env.PADDLE_PRICE_ID_PROFESSIONAL || env.PADDLE_PRICE_ID_ENTERPRISE));
	const showBillingPortal = !!(env.BOATHOUSE_PORTAL_ID && env.BOATHOUSE_SECRET);
	const privacyContactSet = !!(org?.privacyContactName || org?.privacyContactEmail || org?.privacyContactPhone);
	return {
		csrfToken,
		admin: locals.admin || null,
		theme,
		superAdminEmail: locals.superAdminEmail || null,
		hubOrganisationFromDomain: locals.hubOrganisationFromDomain || null,
		currentOrganisation: org || null,
		organisations: orgs || [],
		showOnboarding: !!showOnboarding,
		organisationId: organisationId || null,
		organisationAreaPermissions,
		plan: plan || 'free',
		trialStatus,
		sundayPlannersLabel,
		showBilling: !!showBilling,
		showBillingPortal: !!showBillingPortal,
		isSuperAdmin: locals.admin ? isSuperAdmin(locals.admin) : false,
		privacyContactSet
	};
}

