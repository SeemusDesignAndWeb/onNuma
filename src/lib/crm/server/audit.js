import { create } from './fileStore.js';
import { generateId } from './ids.js';

/**
 * Log an audit event
 * @param {string} adminId - Admin user ID (null for system events)
 * @param {string} action - Action performed (e.g., 'login', 'create_contact', 'update_newsletter')
 * @param {object} details - Additional details about the action
 * @param {object} event - Optional SvelteKit event for IP and user agent
 * @returns {Promise<object>} Created audit log entry
 */
export async function logAuditEvent(adminId, action, details = {}, event = null) {
	const auditLog = {
		id: generateId(),
		adminId,
		action,
		details,
		ipAddress: event?.getClientAddress?.() || 'unknown',
		userAgent: event?.request?.headers?.get('user-agent') || 'unknown',
		timestamp: new Date().toISOString()
	};

	try {
		await create('audit_logs', auditLog);
		return auditLog;
	} catch (err) {
		// Never let audit logging break the main flow (e.g. login redirect)
		console.error('[audit] Failed to write audit_logs:', err?.message || err);
		return auditLog;
	}
}

/**
 * Log a data change (create, update, delete)
 * @param {string} adminId - Admin user ID
 * @param {string} operation - 'create', 'update', or 'delete'
 * @param {string} collection - Collection name (e.g., 'contacts', 'rotas')
 * @param {string} recordId - Record ID
 * @param {object} details - Additional details (e.g., oldData, newData, changes)
 * @param {object} event - Optional SvelteKit event
 * @returns {Promise<object>} Created audit log entry
 */
export async function logDataChange(adminId, operation, collection, recordId, details = {}, event = null) {
	const action = `${operation}_${collection}`;
	const logDetails = {
		collection,
		recordId,
		...details
	};
	return logAuditEvent(adminId, action, logDetails, event);
}

/**
 * Log system access (page views, API access)
 * @param {string} adminId - Admin user ID
 * @param {string} resource - Resource accessed (e.g., '/hub/contacts', '/api/contacts')
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {object} details - Additional details
 * @param {object} event - SvelteKit event
 * @returns {Promise<object>} Created audit log entry
 */
export async function logAccess(adminId, resource, method = 'GET', details = {}, event = null) {
	return logAuditEvent(adminId, 'access', {
		resource,
		method,
		...details
	}, event);
}

/**
 * Log sensitive operation (safeguarding access, admin management, etc.)
 * @param {string} adminId - Admin user ID
 * @param {string} operation - Sensitive operation name
 * @param {object} details - Additional details
 * @param {object} event - Optional SvelteKit event
 * @returns {Promise<object>} Created audit log entry
 */
export async function logSensitiveOperation(adminId, operation, details = {}, event = null) {
	return logAuditEvent(adminId, `sensitive_${operation}`, {
		...details
	}, event);
}

/**
 * Get admin ID from event locals or cookies
 * @param {object} event - SvelteKit event
 * @returns {string|null} Admin ID or null
 */
export function getAdminIdFromEvent(event) {
	if (event?.locals?.admin?.id) {
		return event.locals.admin.id;
	}
	return null;
}


