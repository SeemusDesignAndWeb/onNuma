/**
 * Admin level permissions system
 * 
 * Admin Levels (Display Names):
 * 1. Super Admin (super_admin) - Full access, can only create other super admins (John Watson)
 * 2. Events (level_2) - Contacts, lists, Rotas, events, meeting planner
 * 3. Communications (level_2b) - Events access + Newsletters
 * 4. Safeguarding (level_3) - Events access + Safeguarding (all safeguarding forms)
 * 5. Forms (level_4) - Events access + Forms (but not safeguarding)
 */

// Admin level constants
export const ADMIN_LEVELS = {
	SUPER_ADMIN: 'super_admin',
	LEVEL_2: 'level_2',
	LEVEL_2B: 'level_2b',
	LEVEL_3: 'level_3',
	LEVEL_4: 'level_4'
};

// Route to permission mapping
const ROUTE_PERMISSIONS = {
	// Contacts - Level 2+
	'/hub/contacts': [ADMIN_LEVELS.LEVEL_2, ADMIN_LEVELS.LEVEL_2B, ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN],
	
	// Lists - Level 2+
	'/hub/lists': [ADMIN_LEVELS.LEVEL_2, ADMIN_LEVELS.LEVEL_2B, ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN],
	
	// Rotas - Level 2+
	'/hub/rotas': [ADMIN_LEVELS.LEVEL_2, ADMIN_LEVELS.LEVEL_2B, ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN],
	
	// Events - Level 2+
	'/hub/events': [ADMIN_LEVELS.LEVEL_2, ADMIN_LEVELS.LEVEL_2B, ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN],
	
	// Meeting Planners - Level 2+
	'/hub/meeting-planners': [ADMIN_LEVELS.LEVEL_2, ADMIN_LEVELS.LEVEL_2B, ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN],
	
	// Newsletters - Level 2B+
	'/hub/newsletters': [ADMIN_LEVELS.LEVEL_2B, ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN],
	
	// Forms (non-safeguarding) - Level 4+ or Level 3+ (for safeguarding)
	// Note: Individual form access is checked in page load functions
	'/hub/forms': [ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN],
	
	// Users (admin management) - Super Admin only
	'/hub/users': [ADMIN_LEVELS.SUPER_ADMIN],
	
	// Profile - All authenticated users
	'/hub/profile': [ADMIN_LEVELS.LEVEL_2, ADMIN_LEVELS.LEVEL_2B, ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN],
	
	// Help - All authenticated users
	'/hub/help': [ADMIN_LEVELS.LEVEL_2, ADMIN_LEVELS.LEVEL_2B, ADMIN_LEVELS.LEVEL_3, ADMIN_LEVELS.LEVEL_4, ADMIN_LEVELS.SUPER_ADMIN]
};

/**
 * Get admin level from admin object
 * @param {object} admin - Admin user object
 * @returns {string} Admin level or 'level_2' as default
 */
export function getAdminLevel(admin) {
	if (!admin) return null;
	
	// Check if email is john.watson@egcc.co.uk for super admin
	if (admin.email && admin.email.toLowerCase() === 'john.watson@egcc.co.uk') {
		return ADMIN_LEVELS.SUPER_ADMIN;
	}
	
	// Return adminLevel from admin object, default to level_2
	return admin.adminLevel || ADMIN_LEVELS.LEVEL_2;
}

/**
 * Check if admin has access to a route
 * @param {object} admin - Admin user object
 * @param {string} pathname - Route pathname
 * @returns {boolean} True if admin has access
 */
export function hasRouteAccess(admin, pathname) {
	if (!admin) return false;
	
	const adminLevel = getAdminLevel(admin);
	
	// Super admin has access to everything
	if (adminLevel === ADMIN_LEVELS.SUPER_ADMIN) {
		return true;
	}
	
	// Check exact route match first
	if (ROUTE_PERMISSIONS[pathname]) {
		return ROUTE_PERMISSIONS[pathname].includes(adminLevel);
	}
	
	// Check route prefixes
	for (const [route, allowedLevels] of Object.entries(ROUTE_PERMISSIONS)) {
		if (pathname.startsWith(route)) {
			// Special handling for forms - check if it's a safeguarding form
			if (route === '/hub/forms') {
				// For form routes, we need to check if it's a safeguarding form
				// This will be checked in the page server load function
				return allowedLevels.includes(adminLevel);
			}
			return allowedLevels.includes(adminLevel);
		}
	}
	
	// Default: deny access if route not explicitly allowed
	return false;
}

/**
 * Check if admin can access safeguarding forms
 * @param {object} admin - Admin user object
 * @returns {boolean} True if admin can access safeguarding forms
 */
export function canAccessSafeguarding(admin) {
	if (!admin) return false;
	
	const adminLevel = getAdminLevel(admin);
	
	// Super admin and level 3 can access safeguarding
	return adminLevel === ADMIN_LEVELS.SUPER_ADMIN || adminLevel === ADMIN_LEVELS.LEVEL_3;
}

/**
 * Check if admin can access non-safeguarding forms
 * @param {object} admin - Admin user object
 * @returns {boolean} True if admin can access non-safeguarding forms
 */
export function canAccessForms(admin) {
	if (!admin) return false;
	
	const adminLevel = getAdminLevel(admin);
	
	// Super admin and level 4 can access forms (non-safeguarding)
	return adminLevel === ADMIN_LEVELS.SUPER_ADMIN || adminLevel === ADMIN_LEVELS.LEVEL_4;
}

/**
 * Check if admin can access newsletters
 * @param {object} admin - Admin user object
 * @returns {boolean} True if admin can access newsletters
 */
export function canAccessNewsletters(admin) {
	if (!admin) return false;
	
	const adminLevel = getAdminLevel(admin);
	
	// Super admin, level 2b, level 3, and level 4 can access newsletters
	return [
		ADMIN_LEVELS.SUPER_ADMIN,
		ADMIN_LEVELS.LEVEL_2B,
		ADMIN_LEVELS.LEVEL_3,
		ADMIN_LEVELS.LEVEL_4
	].includes(adminLevel);
}

/**
 * Check if admin is super admin
 * @param {object} admin - Admin user object
 * @returns {boolean} True if admin is super admin
 */
export function isSuperAdmin(admin) {
	return getAdminLevel(admin) === ADMIN_LEVELS.SUPER_ADMIN;
}

/**
 * Check if admin can create another admin with a specific level
 * @param {object} admin - Admin user object
 * @param {string} targetLevel - Level to assign to new admin
 * @returns {boolean} True if admin can create admin with that level
 */
export function canCreateAdminWithLevel(admin, targetLevel) {
	if (!admin) return false;
	
	const adminLevel = getAdminLevel(admin);
	
	// Only super admins can create other super admins
	if (targetLevel === ADMIN_LEVELS.SUPER_ADMIN) {
		return adminLevel === ADMIN_LEVELS.SUPER_ADMIN;
	}
	
	// Super admins can create any level
	if (adminLevel === ADMIN_LEVELS.SUPER_ADMIN) {
		return true;
	}
	
	// Non-super admins cannot create any admins
	return false;
}

/**
 * Get all available admin levels (for dropdowns)
 * @param {object} admin - Current admin user (to determine what they can create)
 * @returns {Array} Array of available admin levels
 */
export function getAvailableAdminLevels(admin) {
	const adminLevel = getAdminLevel(admin);
	
	// Super admin can create any level
	if (adminLevel === ADMIN_LEVELS.SUPER_ADMIN) {
		return [
			{ 
				value: ADMIN_LEVELS.SUPER_ADMIN, 
				label: 'Super Admin',
				description: 'Full access to all areas, can create other admins'
			},
			{ 
				value: ADMIN_LEVELS.LEVEL_2, 
				label: 'Events',
				description: 'Contacts, Lists, Rotas, Events, Meeting Planner'
			},
			{ 
				value: ADMIN_LEVELS.LEVEL_2B, 
				label: 'Communications',
				description: 'Contacts, Lists, Rotas, Events, Meeting Planner, Newsletters'
			},
			{ 
				value: ADMIN_LEVELS.LEVEL_3, 
				label: 'Safeguarding',
				description: 'Contacts, Lists, Rotas, Events, Meeting Planner, Newsletters, Safeguarding Forms'
			},
			{ 
				value: ADMIN_LEVELS.LEVEL_4, 
				label: 'Forms',
				description: 'Contacts, Lists, Rotas, Events, Meeting Planner, Newsletters, Forms (non-safeguarding)'
			}
		];
	}
	
	// Non-super admins cannot create admins
	return [];
}
