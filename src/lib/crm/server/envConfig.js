/**
 * Server-only environment configuration
 * This file should only be imported on the server side
 */

import { env } from '$env/dynamic/private';

/**
 * Get the super admin email from environment variable
 * Falls back to default for backward compatibility
 * @returns {string} Super admin email address
 */
export function getSuperAdminEmail() {
	return env.SUPER_ADMIN_EMAIL || 'john.watson@egcc.co.uk';
}
