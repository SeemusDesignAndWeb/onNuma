/**
 * Personalized permissions system
 * 
 * Each admin can have personalized access to different areas of the hub.
 * Super Admin email is configurable via SUPER_ADMIN_EMAIL environment variable.
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
 * @param {string} email - Email address to check
 * @param {string} [superAdminEmail] - Optional super admin email to compare against
 * @returns {boolean} True if email matches super admin email
 */
export function isSuperAdminEmail(email, superAdminEmail = null) {
	if (!email) return false;
	const adminEmail = superAdminEmail || getSuperAdminEmail();
	return email.toLowerCase().trim() === adminEmail.toLowerCase().trim();
}

/**
 * Check if admin is super admin
 * @param {object} admin - Admin user object
 * @param {string} [superAdminEmail] - Optional super admin email to check against (from server)
 * @returns {boolean} True if admin is super admin
 */
export function isSuperAdmin(admin, superAdminEmail = null) {
	if (!admin) return false;
	
	// Check if email matches super admin email (from environment variable)
	if (admin.email && isSuperAdminEmail(admin.email, superAdminEmail)) {
		return true;
	}
	
	// Check if admin has super_admin permission
	if (admin.permissions && Array.isArray(admin.permissions) && admin.permissions.includes(HUB_AREAS.SUPER_ADMIN)) {
		return true;
	}
	
	// Check if adminLevel is super_admin (for backward compatibility)
	if (admin.adminLevel === ADMIN_LEVELS.SUPER_ADMIN) {
		return true;
	}
	
	return false;
}

/**
 * Get admin permissions array from admin object
 * Handles both new permissions array and legacy adminLevel
 * @param {object} admin - Admin user object
 * @returns {string[]} Array of permission area strings
 */
export function getAdminPermissions(admin) {
	if (!admin) return [];
	
	// Super admin has all permissions (check this first)
	if (isSuperAdmin(admin)) {
		// Return all permissions except SUPER_ADMIN itself (it's a meta-permission)
		return Object.values(HUB_AREAS).filter(p => p !== HUB_AREAS.SUPER_ADMIN);
	}
	
	// If admin has permissions array, use it (but filter out SUPER_ADMIN if they're not actually super admin)
	if (admin.permissions && Array.isArray(admin.permissions)) {
		// If they have SUPER_ADMIN permission but aren't recognized as super admin, something is wrong
		// But we'll still return their permissions as-is
		return admin.permissions.filter(p => p !== HUB_AREAS.SUPER_ADMIN);
	}
	
	// Legacy: Convert adminLevel to permissions array for backward compatibility
	if (admin.adminLevel) {
		return convertAdminLevelToPermissions(admin.adminLevel);
	}
	
	// Default: no permissions (shouldn't happen, but safe fallback)
	return [];
}

/**
 * Convert legacy adminLevel to permissions array
 * @param {string} adminLevel - Legacy admin level
 * @returns {string[]} Array of permission area strings
 */
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

/**
 * Get admin level from admin object (for backward compatibility)
 * @param {object} admin - Admin user object
 * @returns {string} Admin level or 'level_2' as default
 * @deprecated Use getAdminPermissions instead
 */
export function getAdminLevel(admin) {
	if (!admin) return null;
	
	if (isSuperAdmin(admin)) {
		return ADMIN_LEVELS.SUPER_ADMIN;
	}
	
	// Return adminLevel from admin object, default to level_2
	return admin.adminLevel || ADMIN_LEVELS.LEVEL_2;
}

/**
 * Get the hub area for a given route
 * @param {string} pathname - Route pathname
 * @returns {string|null} Hub area or null if not mapped
 */
function getAreaForRoute(pathname) {
	// Check exact route match first
	if (ROUTE_TO_AREA[pathname]) {
		return ROUTE_TO_AREA[pathname];
	}
	
	// Check route prefixes
	for (const [route, area] of Object.entries(ROUTE_TO_AREA)) {
		if (pathname.startsWith(route)) {
			return area;
		}
	}
	
	return null;
}

/**
 * Check if admin has access to a route
 * @param {object} admin - Admin user object
 * @param {string} pathname - Route pathname
 * @returns {boolean} True if admin has access
 */
export function hasRouteAccess(admin, pathname) {
	if (!admin) return false;
	
	// Super admin has access to everything
	if (isSuperAdmin(admin)) {
		return true;
	}
	
	// Dashboard, Profile, Help, and Video Tutorials (viewing) are accessible to all authenticated admins
	if (pathname === '/hub' || pathname === '/hub/profile' || pathname === '/hub/help' || pathname === '/hub/video-tutorials') {
		return true;
	}
	
	// Video management pages (/hub/videos) are only for super admin
	if (pathname.startsWith('/hub/videos')) {
		return isSuperAdmin(admin);
	}
	
	// Image management pages (/hub/images) are only for super admin
	if (pathname.startsWith('/hub/images')) {
		return isSuperAdmin(admin);
	}
	
	// Get the hub area for this route
	const area = getAreaForRoute(pathname);
	if (!area) {
		// Unknown route - deny access
		return false;
	}
	
	// Users area is only for super admin (already checked above)
	if (area === HUB_AREAS.USERS) {
		return false;
	}
	
	// Check if admin has permission for this area
	const permissions = getAdminPermissions(admin);
	return permissions.includes(area);
}

/**
 * Check if admin can access safeguarding forms
 * @param {object} admin - Admin user object
 * @returns {boolean} True if admin can access safeguarding forms
 */
export function canAccessSafeguarding(admin) {
	if (!admin) return false;
	
	// Super admin has access to everything
	if (isSuperAdmin(admin)) {
		return true;
	}
	
	const permissions = getAdminPermissions(admin);
	return permissions.includes(HUB_AREAS.SAFEGUARDING_FORMS);
}

/**
 * Check if admin can access non-safeguarding forms
 * @param {object} admin - Admin user object
 * @returns {boolean} True if admin can access non-safeguarding forms
 */
export function canAccessForms(admin) {
	if (!admin) return false;
	
	// Super admin has access to everything
	if (isSuperAdmin(admin)) {
		return true;
	}
	
	const permissions = getAdminPermissions(admin);
	return permissions.includes(HUB_AREAS.FORMS);
}

/**
 * Check if admin can access newsletters
 * @param {object} admin - Admin user object
 * @returns {boolean} True if admin can access newsletters
 */
export function canAccessNewsletters(admin) {
	if (!admin) return false;
	
	// Super admin has access to everything
	if (isSuperAdmin(admin)) {
		return true;
	}
	
	const permissions = getAdminPermissions(admin);
	return permissions.includes(HUB_AREAS.NEWSLETTERS);
}

/**
 * Get all available hub areas for permission selection
 * @param {object} currentAdmin - Current admin viewing the form (optional, for filtering super admin permission)
 * @returns {Array} Array of hub area objects
 */
export function getAvailableHubAreas(currentAdmin = null) {
	const areas = [
		{ 
			value: HUB_AREAS.CONTACTS, 
			label: 'Contacts',
			description: 'Manage contact database'
		},
		{ 
			value: HUB_AREAS.LISTS, 
			label: 'Lists',
			description: 'Manage contact lists'
		},
		{ 
			value: HUB_AREAS.ROTAS, 
			label: 'Rotas',
			description: 'Manage volunteer rotas'
		},
		{ 
			value: HUB_AREAS.EVENTS, 
			label: 'Events',
			description: 'Manage events and calendar'
		},
		{ 
			value: HUB_AREAS.MEETING_PLANNERS, 
			label: 'Meeting Planners',
			description: 'Plan and manage meetings'
		},
		{ 
			value: HUB_AREAS.NEWSLETTERS,
			label: 'Emails',
			description: 'Create and send emails'
		},
		{ 
			value: HUB_AREAS.FORMS, 
			label: 'Forms (Non-Safeguarding)',
			description: 'Manage general forms and submissions'
		},
		{ 
			value: HUB_AREAS.SAFEGUARDING_FORMS, 
			label: 'Safeguarding Forms',
			description: 'Access safeguarding forms and submissions'
		},
		{ 
			value: HUB_AREAS.MEMBERS, 
			label: 'Members',
			description: 'Manage church members and membership information'
		}
	];
	
	// Only include SUPER_ADMIN permission if current admin is a super admin
	if (currentAdmin && isSuperAdmin(currentAdmin)) {
		areas.push({
			value: HUB_AREAS.SUPER_ADMIN,
			label: 'Super Admin',
			description: 'Full access to all areas and can create other admins. Only super admins can grant this permission.'
		});
	}
	
	return areas;
}

/**
 * Check if admin can create another admin
 * @param {object} admin - Admin user object
 * @returns {boolean} True if admin can create other admins
 */
export function canCreateAdmin(admin) {
	if (!admin) return false;
	return isSuperAdmin(admin);
}
