/**
 * Server entry for permissions. Re-exports from shared $lib/crm/permissions.js
 * so server-only code can keep importing from $lib/crm/server/permissions.js.
 * Client components should import from $lib/crm/permissions.js to avoid bundle chunk ordering issues.
 */
export {
	HUB_AREAS,
	ADMIN_LEVELS,
	getSuperAdminEmail,
	isSuperAdminEmail,
	isSuperAdmin,
	getAdminPermissions,
	getAdminLevel,
	getEffectivePermissions,
	hasRouteAccess,
	canAccessSafeguarding,
	canAccessForms,
	canAccessNewsletters,
	getAvailableHubAreas,
	getOrganisationHubAreas,
	canCreateAdmin,
	getAreaPermissionsForPlan,
	getPlanFromAreaPermissions,
	getHubPlanTiers,
	PLAN_MAX_USERS,
	getPlanMaxUsers
} from '$lib/crm/permissions.js';
