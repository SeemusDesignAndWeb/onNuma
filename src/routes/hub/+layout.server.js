import { getCsrfToken } from '$lib/crm/server/auth.js';
import { getSettings } from '$lib/crm/server/settings.js';
import { getRequestOrganisationId } from '$lib/crm/server/requestOrg.js';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { getPlanFromAreaPermissions, getAreaPermissionsForPlan } from '$lib/crm/server/permissions.js';

export async function load({ cookies, locals }) {
	const csrfToken = getCsrfToken(cookies);
	// Fetch settings and organisations in parallel to avoid sequential store/DB round-trips
	const [settings, orgs] = await Promise.all([
		getSettings(),
		readCollection('organisations')
	]);
	const requestOrgId = getRequestOrganisationId();
	const organisationId =
		requestOrgId ?? settings?.currentOrganisationId ?? orgs?.[0]?.id ?? null;
	const org = organisationId ? (orgs.find((o) => o.id === organisationId) || null) : null;
	let showOnboarding = false;
	if (organisationId && locals.admin && org) {
		showOnboarding = !org.onboardingDismissedAt;
	}
	// Hub navbar and access run off the organisation's plan (Free / Professional / Enterprise)
	const plan = org && Array.isArray(org.areaPermissions) ? getPlanFromAreaPermissions(org.areaPermissions) : null;
	const organisationAreaPermissions = plan ? getAreaPermissionsForPlan(plan) : (org && Array.isArray(org.areaPermissions) ? org.areaPermissions : null);
	return {
		csrfToken,
		admin: locals.admin || null,
		theme: settings?.theme || null,
		superAdminEmail: locals.superAdminEmail || null,
		hubOrganisationFromDomain: locals.hubOrganisationFromDomain || null,
		currentOrganisation: org || null,
		showOnboarding: !!showOnboarding,
		organisationId: organisationId || null,
		organisationAreaPermissions,
		plan: plan || 'free'
	};
}

