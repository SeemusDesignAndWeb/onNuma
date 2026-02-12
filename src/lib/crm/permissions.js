/**
 * Shared permissions logic (client- and server-safe).
 * Used by hub components to avoid importing from server/ and prevent bundle chunk ordering issues.
 * Server code should still import from $lib/crm/server/permissions.js which re-exports this.
 */

// Hub area permission constants
export const HUB_AREAS = {
	CONTACTS: 'contacts',
	LISTS: 'lists',
	ROTAS: 'rotas',
	EVENTS: 'events',
	MEETING_PLANNERS: 'meeting_planners',
	NEWSLETTERS: 'emails',
	FORMS: 'forms',
	SAFEGUARDING_FORMS: 'safeguarding_forms',
	MEMBERS: 'members',
	USERS: 'users', // Admin management - only super admin
	SUPER_ADMIN: 'super_admin' // Super admin permission - grants all permissions
};

// Route to hub area mapping
const ROUTE_TO_AREA = {
	'/hub/contacts': HUB_AREAS.CONTACTS,
	'/hub/lists': HUB_AREAS.LISTS,
	'/hub/rotas': HUB_AREAS.ROTAS,
	'/hub/events': HUB_AREAS.EVENTS,
	'/hub/meeting-planners': HUB_AREAS.MEETING_PLANNERS,
	'/hub/emails': HUB_AREAS.NEWSLETTERS,
	'/hub/forms': HUB_AREAS.FORMS,
	'/hub/members': HUB_AREAS.MEMBERS,
	'/hub/users': HUB_AREAS.USERS
};

// Legacy admin level constants (for backward compatibility during migration)
export const ADMIN_LEVELS = {
	SUPER_ADMIN: 'super_admin',
	LEVEL_2: 'level_2',
	LEVEL_2B: 'level_2b',
	LEVEL_3: 'level_3',
	LEVEL_4: 'level_4'
};

// Default super admin email (used on client-side)
const DEFAULT_SUPER_ADMIN_EMAIL = 'john.watson@egcc.co.uk';

/**
 * Get the super admin email
 * On server-side, this should be called with the email from envConfig
 * On client-side, uses default or provided value from page data
 * @param {string} [providedEmail] - Optional email to use (from server/env)
 * @returns {string} Super admin email address
 */
export function getSuperAdminEmail(providedEmail = null) {
	// If provided (from server), use it
	if (providedEmail) {
		return providedEmail;
	}
	// Client-side fallback
	return DEFAULT_SUPER_ADMIN_EMAIL;
}

/**
 * Check if an email is the super admin email
 */
export function isSuperAdminEmail(email, superAdminEmail = null) {
	if (!email) return false;
	const adminEmail = superAdminEmail || getSuperAdminEmail();
	return email.toLowerCase().trim() === adminEmail.toLowerCase().trim();
}

/**
 * Check if admin is super admin
 */
export function isSuperAdmin(admin, superAdminEmail = null) {
	if (!admin) return false;

	if (admin.email && isSuperAdminEmail(admin.email, superAdminEmail)) {
		return true;
	}
	if (admin.permissions && Array.isArray(admin.permissions) && admin.permissions.includes(HUB_AREAS.SUPER_ADMIN)) {
		return true;
	}
	if (admin.adminLevel === ADMIN_LEVELS.SUPER_ADMIN) {
		return true;
	}
	return false;
}

/**
 * Get admin permissions array from admin object
 */
export function getAdminPermissions(admin, superAdminEmail = null) {
	if (!admin) return [];

	if (isSuperAdmin(admin, superAdminEmail)) {
		return Object.values(HUB_AREAS).filter(p => p !== HUB_AREAS.SUPER_ADMIN);
	}
	if (admin.permissions && Array.isArray(admin.permissions)) {
		return admin.permissions.filter(p => p !== HUB_AREAS.SUPER_ADMIN);
	}
	if (admin.adminLevel) {
		return convertAdminLevelToPermissions(admin.adminLevel);
	}
	return [];
}

function convertAdminLevelToPermissions(adminLevel) {
	switch (adminLevel) {
		case ADMIN_LEVELS.SUPER_ADMIN:
			return Object.values(HUB_AREAS);
		case ADMIN_LEVELS.LEVEL_2:
			return [HUB_AREAS.CONTACTS, HUB_AREAS.LISTS, HUB_AREAS.ROTAS, HUB_AREAS.EVENTS, HUB_AREAS.MEETING_PLANNERS];
		case ADMIN_LEVELS.LEVEL_2B:
			return [HUB_AREAS.CONTACTS, HUB_AREAS.LISTS, HUB_AREAS.ROTAS, HUB_AREAS.EVENTS, HUB_AREAS.MEETING_PLANNERS, HUB_AREAS.NEWSLETTERS];
		case ADMIN_LEVELS.LEVEL_3:
			return [HUB_AREAS.CONTACTS, HUB_AREAS.LISTS, HUB_AREAS.ROTAS, HUB_AREAS.EVENTS, HUB_AREAS.MEETING_PLANNERS, HUB_AREAS.NEWSLETTERS, HUB_AREAS.SAFEGUARDING_FORMS];
		case ADMIN_LEVELS.LEVEL_4:
			return [HUB_AREAS.CONTACTS, HUB_AREAS.LISTS, HUB_AREAS.ROTAS, HUB_AREAS.EVENTS, HUB_AREAS.MEETING_PLANNERS, HUB_AREAS.NEWSLETTERS, HUB_AREAS.FORMS];
		default:
			return [];
	}
}

/** @deprecated Use getAdminPermissions instead */
export function getAdminLevel(admin) {
	if (!admin) return null;
	if (isSuperAdmin(admin)) {
		return ADMIN_LEVELS.SUPER_ADMIN;
	}
	return admin.adminLevel || ADMIN_LEVELS.LEVEL_2;
}

function getAreaForRoute(pathname) {
	if (ROUTE_TO_AREA[pathname]) {
		return ROUTE_TO_AREA[pathname];
	}
	for (const [route, area] of Object.entries(ROUTE_TO_AREA)) {
		if (pathname.startsWith(route)) {
			return area;
		}
	}
	return null;
}

export function getEffectivePermissions(admin, organisationAreaPermissions, superAdminEmail = null) {
	const userPerms = getAdminPermissions(admin, superAdminEmail);
	if (!admin) return [];
	if (isSuperAdmin(admin, superAdminEmail)) {
		return organisationAreaPermissions && organisationAreaPermissions.length >= 0
			? organisationAreaPermissions
			: userPerms;
	}
	if (!organisationAreaPermissions || !Array.isArray(organisationAreaPermissions)) {
		return userPerms;
	}
	return userPerms.filter((p) => organisationAreaPermissions.includes(p));
}

export function hasRouteAccess(admin, pathname, superAdminEmail = null, organisationAreaPermissions = null) {
	if (!admin) return false;

	const effectivePerms = getEffectivePermissions(admin, organisationAreaPermissions, superAdminEmail);

	if (isSuperAdmin(admin, superAdminEmail)) {
		if (Array.isArray(organisationAreaPermissions)) {
			const area = getAreaForRoute(pathname);
			if (area && area !== HUB_AREAS.USERS) {
				return organisationAreaPermissions.includes(area);
			}
		}
		return true;
	}

	if (pathname === '/hub' || pathname === '/hub/profile' || pathname === '/hub/billing' || pathname === '/hub/help' || pathname === '/hub/video-tutorials') {
		return true;
	}
	if (pathname.startsWith('/hub/settings') || pathname.startsWith('/hub/users') || pathname.startsWith('/hub/audit-logs')) {
		return isSuperAdmin(admin, superAdminEmail);
	}
	if (pathname.startsWith('/hub/videos')) {
		return isSuperAdmin(admin, superAdminEmail);
	}
	if (pathname.startsWith('/hub/images')) {
		return isSuperAdmin(admin, superAdminEmail);
	}

	const area = getAreaForRoute(pathname);
	if (!area) return false;
	if (area === HUB_AREAS.USERS) {
		return isSuperAdmin(admin, superAdminEmail);
	}
	return effectivePerms.includes(area);
}

export function canAccessSafeguarding(admin) {
	if (!admin) return false;
	if (isSuperAdmin(admin)) return true;
	return getAdminPermissions(admin).includes(HUB_AREAS.SAFEGUARDING_FORMS);
}

export function canAccessForms(admin) {
	if (!admin) return false;
	if (isSuperAdmin(admin)) return true;
	return getAdminPermissions(admin).includes(HUB_AREAS.FORMS);
}

export function canAccessNewsletters(admin) {
	if (!admin) return false;
	if (isSuperAdmin(admin)) return true;
	return getAdminPermissions(admin).includes(HUB_AREAS.NEWSLETTERS);
}

export function getAvailableHubAreas(currentAdmin = null) {
	const areas = [
		{ value: HUB_AREAS.CONTACTS, label: 'Contacts', description: 'Manage contact database' },
		{ value: HUB_AREAS.LISTS, label: 'Lists', description: 'Manage contact lists' },
		{ value: HUB_AREAS.ROTAS, label: 'Rotas', description: 'Manage volunteer rotas' },
		{ value: HUB_AREAS.EVENTS, label: 'Events', description: 'Manage events and calendar' },
		{ value: HUB_AREAS.MEETING_PLANNERS, label: 'Meeting Planners', description: 'Plan and manage meetings' },
		{ value: HUB_AREAS.NEWSLETTERS, label: 'Emails', description: 'Create and send emails' },
		{ value: HUB_AREAS.FORMS, label: 'Forms (Non-Safeguarding)', description: 'Manage general forms and submissions' },
		{ value: HUB_AREAS.SAFEGUARDING_FORMS, label: 'Safeguarding Forms', description: 'Access safeguarding forms and submissions' },
		{ value: HUB_AREAS.MEMBERS, label: 'Members', description: 'Manage church members and membership information' }
	];
	if (currentAdmin && isSuperAdmin(currentAdmin)) {
		areas.push({
			value: HUB_AREAS.SUPER_ADMIN,
			label: 'Super Admin',
			description: 'Full access to all areas and can create other admins. Only super admins can grant this permission.'
		});
	}
	return areas;
}

export function getOrganisationHubAreas() {
	return [
		{ value: HUB_AREAS.CONTACTS, label: 'Contacts', description: 'Manage contact database' },
		{ value: HUB_AREAS.LISTS, label: 'Lists', description: 'Manage contact lists' },
		{ value: HUB_AREAS.ROTAS, label: 'Rotas', description: 'Manage volunteer rotas' },
		{ value: HUB_AREAS.EVENTS, label: 'Events', description: 'Manage events and calendar' },
		{ value: HUB_AREAS.MEETING_PLANNERS, label: 'Meeting Planners', description: 'Plan and manage meetings' },
		{ value: HUB_AREAS.NEWSLETTERS, label: 'Emails', description: 'Create and send emails' },
		{ value: HUB_AREAS.FORMS, label: 'Forms (Non-Safeguarding)', description: 'Manage general forms and submissions' },
		{ value: HUB_AREAS.SAFEGUARDING_FORMS, label: 'Safeguarding Forms', description: 'Access safeguarding forms and submissions' },
		{ value: HUB_AREAS.MEMBERS, label: 'Members', description: 'Manage church members and membership information' }
	];
}

// Pricing plan tiers – map to area permissions (aligned with marketing pricing page)
const FREE_AREAS = [
	HUB_AREAS.CONTACTS,
	HUB_AREAS.LISTS,
	HUB_AREAS.ROTAS,
	HUB_AREAS.EVENTS,
	HUB_AREAS.MEETING_PLANNERS
];
const PROFESSIONAL_AREAS = [...FREE_AREAS, HUB_AREAS.NEWSLETTERS, HUB_AREAS.FORMS, HUB_AREAS.MEMBERS];
const ENTERPRISE_AREAS = [...PROFESSIONAL_AREAS, HUB_AREAS.SAFEGUARDING_FORMS];

const PLAN_AREAS = {
	free: FREE_AREAS,
	professional: PROFESSIONAL_AREAS,
	enterprise: ENTERPRISE_AREAS
};

const VALID_PLANS = new Set(Object.keys(PLAN_AREAS));

/** Maximum number of admins per plan. */
export const PLAN_MAX_ADMINS = {
	free: 1,
	professional: 5,
	enterprise: 50
};

/** Maximum contacts accessible per plan (over-the-limit contacts are not shown or deleted). */
export const PLAN_MAX_CONTACTS = {
	free: 30,
	professional: 500,
	enterprise: 5000
};

/** Maximum admins allowed for a plan (free | professional | enterprise). Defaults to free limit if unknown. */
export function getPlanMaxAdmins(plan) {
	if (!plan || !VALID_PLANS.has(plan)) return PLAN_MAX_ADMINS.free;
	return PLAN_MAX_ADMINS[plan] ?? PLAN_MAX_ADMINS.free;
}

/** Maximum contacts allowed for a plan. Excess contacts are not shown but are not deleted. */
export function getPlanMaxContacts(plan) {
	if (!plan || !VALID_PLANS.has(plan)) return PLAN_MAX_CONTACTS.free;
	return PLAN_MAX_CONTACTS[plan] ?? PLAN_MAX_CONTACTS.free;
}

/** Area permissions for a given plan (free | professional | enterprise). */
export function getAreaPermissionsForPlan(plan) {
	if (!plan || !VALID_PLANS.has(plan)) return FREE_AREAS;
	return [...PLAN_AREAS[plan]];
}

/** Derive plan from organisation area permissions; returns 'free' | 'professional' | 'enterprise' | null (null = custom). */
export function getPlanFromAreaPermissions(areaPermissions) {
	if (!Array.isArray(areaPermissions)) return 'free';
	const sorted = (arr) => [...arr].sort();
	const key = (arr) => sorted(arr).join(',');
	const permsKey = key(areaPermissions);
	for (const [plan, areas] of Object.entries(PLAN_AREAS)) {
		if (key(areas) === permsKey) return plan;
	}
	return null;
}

/** Module (Hub area) options that can be assigned to a plan. Excludes USERS and SUPER_ADMIN. */
export const PLAN_MODULE_OPTIONS = [
	{ value: HUB_AREAS.CONTACTS, label: 'Contacts' },
	{ value: HUB_AREAS.LISTS, label: 'Lists' },
	{ value: HUB_AREAS.ROTAS, label: 'Rotas' },
	{ value: HUB_AREAS.EVENTS, label: 'Events' },
	{ value: HUB_AREAS.MEETING_PLANNERS, label: 'Meeting Planners' },
	{ value: HUB_AREAS.NEWSLETTERS, label: 'Emails' },
	{ value: HUB_AREAS.FORMS, label: 'Forms' },
	{ value: HUB_AREAS.MEMBERS, label: 'Members' },
	{ value: HUB_AREAS.SAFEGUARDING_FORMS, label: 'Safeguarding Forms' }
];

/** Plan options for multi-org admin (select Free, Professional or Enterprise). */
export function getHubPlanTiers() {
	return [
		{ value: 'free', label: 'Free', description: 'Contacts, Lists, Events, Rotas, Meeting Planners, Email reminders. No forms or email campaigns.' },
		{ value: 'professional', label: 'Professional', description: 'Everything in Free plus Forms, Email templates and campaigns, Members, your branding.' },
		{ value: 'enterprise', label: 'Enterprise', description: 'Everything in Professional plus Safeguarding forms. Custom solutions for larger needs.' }
	];
}

/**
 * Professional contact tiers: fixed price per band. Minimum £15 (never below).
 * Up to 100 = £15; up to 250 = £25; up to 500 = £50.
 */
export const PROFESSIONAL_CONTACT_TIERS = [
	{ min: 1, max: 100, price: 15 },
	{ min: 101, max: 250, price: 25 },
	{ min: 251, max: 500, price: 50 }
];

/** Get Professional plan price (£) for a given contact count (fixed tier pricing, min £15). */
export function getProfessionalPriceForContactCount(contactCount) {
	const n = Math.max(0, Math.min(500, Math.floor(Number(contactCount) || 0)));
	const tier = PROFESSIONAL_CONTACT_TIERS.find((t) => n >= t.min && n <= t.max);
	return tier ? tier.price : 15;
}

/** Tier cap for display: returns 100, 250, or 500 so "Up to N" only shows the three tiers. */
export function getProfessionalContactTierCap(contactCount) {
	const n = Math.max(0, Math.min(500, Math.floor(Number(contactCount) || 0)));
	if (n <= 100) return 100;
	if (n <= 250) return 250;
	return 500;
}

/** Optional pricing per plan (cost per contact / per admin). null = not set, managed in Paddle. */
export const PLAN_PRICING = {
	free: { costPerContact: 0, costPerAdmin: 0 },
	professional: { costPerContact: null, costPerAdmin: null },
	enterprise: { costPerContact: null, costPerAdmin: null }
};

/**
 * Full plan setup detail for multi-org admin: description, limits, and pricing.
 * Pricing may be null (display as "Managed in Paddle").
 */
export function getPlanSetupDetails() {
	const tiers = getHubPlanTiers();
	return tiers.map((t) => {
		const value = t.value;
		const pricing = PLAN_PRICING[value] || {};
		return {
			...t,
			maxContacts: getPlanMaxContacts(value),
			maxAdmins: getPlanMaxAdmins(value),
			costPerContact: pricing.costPerContact ?? null,
			costPerAdmin: pricing.costPerAdmin ?? null,
			areaPermissions: getAreaPermissionsForPlan(value)
		};
	});
}

export function canCreateAdmin(admin, superAdminEmail = null) {
	if (!admin) return false;
	return isSuperAdmin(admin, superAdminEmail);
}

// ============================================================================
// TRIAL MANAGEMENT
// ============================================================================

/**
 * Check if an organisation's trial has expired.
 * @param {object} organisation - Organisation object with trialEndsAt field
 * @returns {boolean} True if trial has expired
 */
export function isTrialExpired(organisation) {
	if (!organisation?.trialEndsAt) return false;
	const trialEnd = new Date(organisation.trialEndsAt);
	return Date.now() > trialEnd.getTime();
}

/**
 * Check if an organisation is currently in a trial period.
 * @param {object} organisation - Organisation object
 * @returns {boolean} True if in active trial (has trial that hasn't expired)
 */
export function isInTrial(organisation) {
	if (!organisation?.trialEndsAt) return false;
	return !isTrialExpired(organisation);
}

/**
 * Get the number of days remaining in trial.
 * @param {object} organisation - Organisation object
 * @returns {number} Days remaining (0 if expired or no trial)
 */
export function getTrialDaysRemaining(organisation) {
	if (!organisation?.trialEndsAt) return 0;
	const trialEnd = new Date(organisation.trialEndsAt);
	const remaining = trialEnd.getTime() - Date.now();
	if (remaining <= 0) return 0;
	return Math.ceil(remaining / (24 * 60 * 60 * 1000));
}

/**
 * Get effective area permissions for an organisation, accounting for trial status.
 * If trial has expired, returns Free plan permissions.
 * @param {object} organisation - Organisation object
 * @returns {string[]} Effective area permissions
 */
export function getEffectiveOrgPermissions(organisation) {
	if (!organisation) return getAreaPermissionsForPlan('free');
	
	// If organisation has a trial that has expired, return Free permissions
	if (organisation.trialEndsAt && isTrialExpired(organisation)) {
		return getAreaPermissionsForPlan('free');
	}
	
	// Otherwise return the organisation's stored permissions
	return organisation.areaPermissions || getAreaPermissionsForPlan('free');
}

/**
 * Get trial status info for display in UI.
 * @param {object} organisation - Organisation object
 * @returns {{ inTrial: boolean, expired: boolean, daysRemaining: number, trialPlan: string|null }}
 */
export function getTrialStatus(organisation) {
	if (!organisation?.trialEndsAt) {
		return { inTrial: false, expired: false, daysRemaining: 0, trialPlan: null };
	}
	
	const expired = isTrialExpired(organisation);
	const daysRemaining = getTrialDaysRemaining(organisation);
	
	return {
		inTrial: !expired,
		expired,
		daysRemaining,
		trialPlan: organisation.trialPlan || 'professional'
	};
}
