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
	getPlanSetupDetails,
	PLAN_MODULE_OPTIONS,
	PLAN_MAX_ADMINS,
	PLAN_MAX_CONTACTS,
	PLAN_PRICING,
	getPlanMaxAdmins,
	getPlanMaxContacts,
	// Trial management
	isTrialExpired,
	isInTrial,
	getTrialDaysRemaining,
	getEffectiveOrgPermissions,
	getTrialStatus
} from '$lib/crm/permissions.js';
