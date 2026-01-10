import { redirect } from '@sveltejs/kit';
import { findById, update, remove } from '$lib/crm/server/fileStore.js';
import { getAdminById, getAdminByEmail, updateAdminPassword, verifyAdminEmail, getCsrfToken, verifyCsrfToken, getAdminFromCookies } from '$lib/crm/server/auth.js';
import { getAdminLevel, isSuperAdmin, canCreateAdminWithLevel, getAvailableAdminLevels } from '$lib/crm/server/permissions.js';

export async function load({ params, cookies }) {
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

	// Remove sensitive data before sending to client
	const sanitized = {
		id: admin.id,
		email: admin.email,
		name: admin.name,
		role: admin.role,
		adminLevel: getAdminLevel(admin),
		emailVerified: admin.emailVerified || false,
		createdAt: admin.createdAt,
		passwordChangedAt: admin.passwordChangedAt,
		failedLoginAttempts: admin.failedLoginAttempts || 0,
		accountLockedUntil: admin.accountLockedUntil
	};

	const csrfToken = getCsrfToken(cookies) || '';
	const availableLevels = getAvailableAdminLevels(currentAdmin);
	return { admin: sanitized, csrfToken, availableLevels };
}

export const actions = {
	update: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const email = data.get('email');
			const name = data.get('name');
			const adminLevel = data.get('adminLevel');

			if (!email || !name) {
				return { error: 'Email and name are required' };
			}

			// Get current admin to check permissions
			const currentAdmin = await getAdminFromCookies(cookies);
			if (!currentAdmin) {
				return { error: 'Not authenticated' };
			}

			// Check if trying to change admin level
			if (adminLevel) {
				const targetLevel = adminLevel.toString();
				// Check if trying to set super admin
				if (targetLevel === 'super_admin') {
					// Only super admins can set other super admins
					if (!isSuperAdmin(currentAdmin)) {
						return { error: 'You do not have permission to set super admin level' };
					}
				}
			}

			// Check if email is already taken by another admin
			const existing = await getAdminByEmail(email.toString());
			if (existing && existing.id !== params.id) {
				return { error: 'An admin with this email already exists' };
			}

			// Prepare update data
			const updateData = {
				email: email.toString(),
				name: name.toString()
			};

			// Only update adminLevel if provided and current admin has permission
			if (adminLevel) {
				const targetLevel = adminLevel.toString();
				// Check if email is john.watson@egcc.co.uk - always super admin
				const normalizedEmail = email.toString().toLowerCase().trim();
				if (normalizedEmail === 'john.watson@egcc.co.uk') {
					updateData.adminLevel = 'super_admin';
				} else {
					updateData.adminLevel = targetLevel;
				}
			}

			await update('admins', params.id, updateData);

			return { success: true };
		} catch (error) {
			return { error: error.message || 'Failed to update admin user' };
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

			return { success: true, message: 'Admin user verified successfully' };
		} catch (error) {
			return { error: error.message || 'Failed to verify admin user' };
		}
	},

	delete: async ({ params, cookies, request }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		await remove('admins', params.id);
		throw redirect(302, '/hub/users');
	}
};

