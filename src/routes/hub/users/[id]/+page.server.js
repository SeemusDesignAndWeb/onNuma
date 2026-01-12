import { redirect } from '@sveltejs/kit';
import { findById, update, remove } from '$lib/crm/server/fileStore.js';
import { getAdminById, getAdminByEmail, updateAdminPassword, verifyAdminEmail, getCsrfToken, verifyCsrfToken, getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin, getAdminPermissions, getAvailableHubAreas } from '$lib/crm/server/permissions.js';
import { logDataChange, logSensitiveOperation } from '$lib/crm/server/audit.js';

export async function load({ params, cookies, request }) {
	const admin = await getAdminById(params.id);
	if (!admin) {
		throw redirect(302, '/hub/users');
	}

	const currentAdmin = await getAdminFromCookies(cookies);
	if (!currentAdmin) {
		throw redirect(302, '/hub/auth/login');
	}

	// Only super admins can view/edit other admins
	if (!isSuperAdmin(currentAdmin)) {
		throw redirect(302, '/hub/users');
	}

	// Log sensitive operation - viewing admin user
	const event = { getClientAddress: () => 'unknown', request };
	await logSensitiveOperation(currentAdmin.id, 'admin_user_view', {
		viewedAdminId: params.id,
		viewedAdminEmail: admin.email
	}, event);

	// Get permissions (handles both new permissions array and legacy adminLevel)
	const permissions = admin.permissions || getAdminPermissions(admin) || [];
	
	// Remove sensitive data before sending to client
	const sanitized = {
		id: admin.id,
		email: admin.email,
		name: admin.name,
		role: admin.role,
		permissions: permissions,
		emailVerified: admin.emailVerified || false,
		createdAt: admin.createdAt,
		passwordChangedAt: admin.passwordChangedAt,
		failedLoginAttempts: admin.failedLoginAttempts || 0,
		accountLockedUntil: admin.accountLockedUntil
	};

	const csrfToken = getCsrfToken(cookies) || '';
	const availableAreas = getAvailableHubAreas();
	return { admin: sanitized, csrfToken, availableAreas };
}

export const actions = {
	update: async ({ request, params, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const email = data.get('email');
			const name = data.get('name');
			const permissions = data.getAll('permissions'); // Get all permissions checkboxes

			if (!email || !name) {
				return { error: 'Email and name are required' };
			}

			// Get current admin to check permissions
			const currentAdmin = await getAdminFromCookies(cookies);
			if (!currentAdmin) {
				return { error: 'Not authenticated' };
			}

			// Check if email is already taken by another admin
			const existing = await getAdminByEmail(email.toString());
			if (existing && existing.id !== params.id) {
				return { error: 'An admin with this email already exists' };
			}

			// Check if email is john.watson@egcc.co.uk - always super admin (no permissions needed)
			const normalizedEmail = email.toString().toLowerCase().trim();
			const isSuperAdminEmail = normalizedEmail === 'john.watson@egcc.co.uk';

			// Prepare update data
			const updateData = {
				email: email.toString(),
				name: name.toString()
			};

			// Only update permissions if not super admin email
			// Super admin email automatically gets all permissions via isSuperAdmin check
			if (!isSuperAdminEmail) {
				// Validate permissions array
				const validPermissions = permissions.filter(p => {
					const validAreas = getAvailableHubAreas().map(a => a.value);
					return validAreas.includes(p.toString());
				});
				updateData.permissions = validPermissions;
			}

			await update('admins', params.id, updateData);

			// Log audit event
			const adminId = currentAdmin.id;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'update', 'admin', params.id, {
				email: email.toString(),
				name: name.toString()
			}, event);

			return { success: true };
		} catch (error) {
			return { error: error.message || 'Failed to update admin' };
		}
	},

	resetPassword: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const newPassword = data.get('newPassword');
			const confirmPassword = data.get('confirmPassword');

			if (!newPassword || !confirmPassword) {
				return { error: 'Both password fields are required' };
			}

			if (newPassword.toString() !== confirmPassword.toString()) {
				return { error: 'Passwords do not match' };
			}

			await updateAdminPassword(params.id, newPassword.toString());

			return { success: true, message: 'Password reset successfully' };
		} catch (error) {
			return { error: error.message || 'Failed to reset password' };
		}
	},

	unlock: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			await update('admins', params.id, {
				failedLoginAttempts: 0,
				accountLockedUntil: null
			});

			return { success: true, message: 'Account unlocked successfully' };
		} catch (error) {
			return { error: error.message || 'Failed to unlock account' };
		}
	},

	verify: async ({ params, cookies, request }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			await update('admins', params.id, {
				emailVerified: true,
				emailVerificationToken: null,
				emailVerificationTokenExpires: null
			});

			return { success: true, message: 'Admin verified successfully' };
		} catch (error) {
			return { error: error.message || 'Failed to verify admin' };
		}
	},

	delete: async ({ params, cookies, request, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		// Get admin data before deletion for audit log
		const admin = await getAdminById(params.id);
		
		await remove('admins', params.id);

		// Log audit event
		const adminId = locals?.admin?.id || null;
		const event = { getClientAddress: () => 'unknown', request };
		await logDataChange(adminId, 'delete', 'admin', params.id, {
			email: admin?.email || 'unknown',
			name: admin?.name || 'unknown'
		}, event);

		throw redirect(302, '/hub/users');
	}
};

