/**
 * Server entry for permissions. Re-exports from shared $lib/crm/permissions.js
 * and adds server-only helpers that include plan overrides from hub settings.
 */
import * as shared from '$lib/crm/permissions.js';
import { getSettings } from './settings.js';

const VALID_PLAN_IDS = new Set(['free', 'professional', 'enterprise', 'freebie']);

function normaliseOverrideAreaPermissions(value, fallback) {
	return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()) : fallback;
}

function mergePlanSetupOverrides(basePlans, overrides) {
	const safeOverrides = overrides && typeof overrides === 'object' ? overrides : {};
	return basePlans.map((plan) => {
		const patch = safeOverrides[plan.value];
		if (!patch || typeof patch !== 'object') return plan;
		return {
			...plan,
			description:
				typeof patch.description === 'string'
					? patch.description.trim() || plan.description
					: plan.description,
			maxContacts:
				typeof patch.maxContacts === 'number' && patch.maxContacts >= 0
					? patch.maxContacts
					: plan.maxContacts,
			maxAdmins:
				typeof patch.maxAdmins === 'number' && patch.maxAdmins >= 0
					? patch.maxAdmins
					: plan.maxAdmins,
			areaPermissions: normaliseOverrideAreaPermissions(patch.areaPermissions, plan.areaPermissions)
		};
	});
}

function listKey(values) {
	return [...values].sort().join(',');
}

/**
 * Full plan setup details merged with MultiOrg overrides from hub settings.
 * @returns {Promise<Array<{ value: string, label: string, description: string, maxContacts: number, maxAdmins: number, areaPermissions: string[] }>>}
 */
export async function getConfiguredPlanSetupDetails() {
	const base = shared.getPlanSetupDetails();
	const settings = await getSettings();
	return mergePlanSetupOverrides(base, settings?.planSetup);
}

/**
 * Get maximum contacts for a plan, honoring MultiOrg overrides.
 * @param {string} plan
 * @returns {Promise<number>}
 */
export async function getConfiguredPlanMaxContacts(plan) {
	const configured = await getConfiguredPlanSetupDetails();
	const byPlan = new Map(configured.map((p) => [p.value, p]));
	const resolvedPlan = VALID_PLAN_IDS.has(plan) ? plan : 'free';
	return byPlan.get(resolvedPlan)?.maxContacts ?? shared.getPlanMaxContacts(resolvedPlan);
}

/**
 * Get maximum admins for a plan, honoring MultiOrg overrides.
 * @param {string} plan
 * @returns {Promise<number>}
 */
export async function getConfiguredPlanMaxAdmins(plan) {
	const configured = await getConfiguredPlanSetupDetails();
	const byPlan = new Map(configured.map((p) => [p.value, p]));
	const resolvedPlan = VALID_PLAN_IDS.has(plan) ? plan : 'free';
	return byPlan.get(resolvedPlan)?.maxAdmins ?? shared.getPlanMaxAdmins(resolvedPlan);
}

/**
 * Get area permissions for a plan, honoring MultiOrg overrides.
 * @param {string} plan
 * @returns {Promise<string[]>}
 */
export async function getConfiguredAreaPermissionsForPlan(plan) {
	const configured = await getConfiguredPlanSetupDetails();
	const byPlan = new Map(configured.map((p) => [p.value, p]));
	const resolvedPlan = VALID_PLAN_IDS.has(plan) ? plan : 'free';
	const perms = byPlan.get(resolvedPlan)?.areaPermissions;
	return Array.isArray(perms) ? [...perms] : shared.getAreaPermissionsForPlan(resolvedPlan);
}

/**
 * Derive plan tier from area permissions using configured plan definitions.
 * Returns null for non-standard combinations.
 * @param {string[]} areaPermissions
 * @returns {Promise<'free' | 'professional' | 'enterprise' | 'freebie' | null>}
 */
export async function getConfiguredPlanFromAreaPermissions(areaPermissions) {
	if (!Array.isArray(areaPermissions)) return 'free';
	const configured = await getConfiguredPlanSetupDetails();
	const targetKey = listKey(areaPermissions);
	for (const plan of configured) {
		if (listKey(plan.areaPermissions || []) === targetKey) {
			return /** @type {'free' | 'professional' | 'enterprise' | 'freebie'} */ (plan.value);
		}
	}
	return null;
}

export const HUB_AREAS = shared.HUB_AREAS;
export const ADMIN_LEVELS = shared.ADMIN_LEVELS;
export const PLAN_MODULE_OPTIONS = shared.PLAN_MODULE_OPTIONS;
export const PLAN_MAX_ADMINS = shared.PLAN_MAX_ADMINS;
export const PLAN_MAX_CONTACTS = shared.PLAN_MAX_CONTACTS;

export const getSuperAdminEmail = shared.getSuperAdminEmail;
export const isSuperAdminEmail = shared.isSuperAdminEmail;
export const isSuperAdmin = shared.isSuperAdmin;
export const getAdminPermissions = shared.getAdminPermissions;
export const getAdminLevel = shared.getAdminLevel;
export const getEffectivePermissions = shared.getEffectivePermissions;
export const hasRouteAccess = shared.hasRouteAccess;
export const canAccessSafeguarding = shared.canAccessSafeguarding;
export const canAccessForms = shared.canAccessForms;
export const canAccessNewsletters = shared.canAccessNewsletters;
export const getAvailableHubAreas = shared.getAvailableHubAreas;
export const getOrganisationHubAreas = shared.getOrganisationHubAreas;
export const canCreateAdmin = shared.canCreateAdmin;
export const getAreaPermissionsForPlan = shared.getAreaPermissionsForPlan;
export const getPlanFromAreaPermissions = shared.getPlanFromAreaPermissions;
export const getHubPlanTiers = shared.getHubPlanTiers;
export const getHubPlanTiersForMultiOrg = shared.getHubPlanTiersForMultiOrg;
export const getPlanSetupDetails = shared.getPlanSetupDetails;
export const getPlanMaxAdmins = shared.getPlanMaxAdmins;
export const getPlanMaxContacts = shared.getPlanMaxContacts;
export const isTrialExpired = shared.isTrialExpired;
export const isInTrial = shared.isInTrial;
export const getTrialDaysRemaining = shared.getTrialDaysRemaining;
export const getEffectiveOrgPermissions = shared.getEffectiveOrgPermissions;
export const getTrialStatus = shared.getTrialStatus;
