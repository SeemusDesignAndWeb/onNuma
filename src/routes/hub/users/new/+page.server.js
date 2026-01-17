import { redirect } from '@sveltejs/kit';
import { createAdmin, getAdminFromCookies } from '$lib/crm/server/auth.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';
import { isSuperAdmin, canCreateAdmin, getAvailableHubAreas, HUB_AREAS, isSuperAdminEmail } from '$lib/crm/server/permissions.js';
import { getSuperAdminEmail } from '$lib/crm/server/envConfig.js';
import { logDataChange } from '$lib/crm/server/audit.js';

export async function load({ cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) {
		throw redirect(302, '/hub/auth/login');
	}
	
	// Only super admins can create admins
	if (!isSuperAdmin(admin)) {
		throw redirect(302, '/hub/users');
	}
	
	const csrfToken = getCsrfToken(cookies) || '';
	const availableAreas = getAvailableHubAreas(admin);
	const superAdminEmail = getSuperAdminEmail();
	return { csrfToken, availableAreas, superAdminEmail };
}

export const actions = {
	create: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		const email = data.get('email');
		const password = data.get('password');
		const name = data.get('name');
		const permissions = data.getAll('permissions'); // Get all permissions checkboxes

		if (!email || !password || !name) {
			return { error: 'Email, password, and name are required' };
		}

		// Get current admin to check permissions
		const currentAdmin = await getAdminFromCookies(cookies);
		if (!currentAdmin) {
			return { error: 'Not authenticated' };
		}

		// Check if current admin can create admins
		if (!canCreateAdmin(currentAdmin)) {
			return { error: 'You do not have permission to create admins' };
		}

		// Check if email matches super admin email - always super admin (no permissions needed)
		const normalizedEmail = email.toString().toLowerCase().trim();
		const superAdminEmail = getSuperAdminEmail();
		const isSuperAdminEmailMatch = isSuperAdminEmail(normalizedEmail, superAdminEmail);

		// Validate permissions array
		const validAreas = getAvailableHubAreas(currentAdmin).map(a => a.value);
		let validPermissions = permissions.filter(p => validAreas.includes(p.toString()));
		
		// Check if SUPER_ADMIN permission is being set
		const hasSuperAdminPermission = validPermissions.includes(HUB_AREAS.SUPER_ADMIN);
		
		// Only super admins can grant SUPER_ADMIN permission
		if (hasSuperAdminPermission && !isSuperAdmin(currentAdmin)) {
			return { error: 'Only super admins can grant super admin permission' };
		}
		
		// If SUPER_ADMIN permission is set, grant all other permissions automatically
		if (hasSuperAdminPermission || isSuperAdminEmailMatch) {
			// Get all regular permissions (excluding SUPER_ADMIN)
			const allRegularPermissions = Object.values(HUB_AREAS).filter(p => p !== HUB_AREAS.SUPER_ADMIN);
			validPermissions = [...allRegularPermissions];
			// Add SUPER_ADMIN permission if it was explicitly set (not just the hardcoded email)
			if (hasSuperAdminPermission) {
				validPermissions.push(HUB_AREAS.SUPER_ADMIN);
			}
		}

		try {
			const admin = await createAdmin({
				email: email.toString(),
				password: password.toString(),
				name: name.toString(),
				permissions: validPermissions
			});

			// Check if admin already exists (createAdmin returns existing admin without error to prevent enumeration)
			const existing = await import('$lib/crm/server/auth.js').then(m => m.getAdminByEmail(email.toString()));
			if (existing && existing.id !== admin.id) {
				return { error: 'An admin with this email already exists' };
			}

			// Get the full admin record to access verification token
			const fullAdmin = await import('$lib/crm/server/auth.js').then(m => m.getAdminById(admin.id));

			// Log audit event
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(currentAdmin.id, 'create', 'admin', admin.id, {
				email: email.toString(),
				name: name.toString()
			}, event);

			// Send welcome email with verification link
			let emailSent = false;
			if (fullAdmin && fullAdmin.emailVerificationToken) {
				try {
					await sendAdminWelcomeEmail({
						to: email.toString(),
						name: name.toString(),
						email: email.toString(),
						verificationToken: fullAdmin.emailVerificationToken,
						password: password.toString() // Include password in welcome email
					}, { url });
					emailSent = true;
				} catch (emailError) {
					// Log error but don't fail user creation if email fails
					console.error('Failed to send welcome email:', emailError);
					// Continue with redirect even if email fails
				}
			}

			// Redirect with success message
			const redirectUrl = emailSent 
				? `/hub/users/${admin.id}?created=true&email=${encodeURIComponent(email.toString())}`
				: `/hub/users/${admin.id}?created=true&email=${encodeURIComponent(email.toString())}&email_failed=true`;
			throw redirect(302, redirectUrl);
		} catch (error) {
			if (error.status === 302) {
				throw error; // Re-throw redirects
			}
			return { error: error.message || 'Failed to create admin' };
		}
	}
};

