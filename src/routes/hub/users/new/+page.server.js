import { redirect } from '@sveltejs/kit';
import { createAdmin, getAdminFromCookies, getAdminsForOrganisation, getAdminByEmail } from '$lib/crm/server/auth.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';
import {
	isSuperAdmin,
	canCreateAdmin,
	getAvailableHubAreas,
	HUB_AREAS,
	isSuperAdminEmail,
	getConfiguredPlanMaxAdmins,
	getConfiguredPlanFromAreaPermissions
} from '$lib/crm/server/permissions.js';
import { getEffectiveSuperAdminEmail, getSettings, getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { getRequestOrganisationId } from '$lib/crm/server/requestOrg.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { syncSubscriptionQuantity } from '$lib/crm/server/paddle.js';

export async function load({ cookies, parent }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) {
		throw redirect(302, '/hub/auth/login');
	}
	
	// Only super admins can create admins (use effective super admin from hub_settings/Multi-org)
	const superAdminEmail = await getEffectiveSuperAdminEmail();
	if (!isSuperAdmin(admin, superAdminEmail)) {
		throw redirect(302, '/hub/users');
	}
	
	const parentData = await parent();
	const plan = parentData.plan || 'free';
	const maxAdmins = await getConfiguredPlanMaxAdmins(plan);
	const organisationId = await getCurrentOrganisationId();
	const admins = await getAdminsForOrganisation(organisationId);
	const adminCount = admins.length;
	if (adminCount >= maxAdmins) {
		throw redirect(302, '/hub/users?limit=1');
	}
	
	const csrfToken = getCsrfToken(cookies) || '';
	const availableAreas = getAvailableHubAreas(admin, superAdminEmail);
	return { csrfToken, availableAreas, superAdminEmail, adminCount, maxAdmins };
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

		// Check if current admin can create admins (use effective super admin from hub_settings/Multi-org)
		const effectiveSuperAdminEmail = await getEffectiveSuperAdminEmail();
		if (!canCreateAdmin(currentAdmin, effectiveSuperAdminEmail)) {
			return { error: 'You do not have permission to create admins' };
		}

		// Enforce plan user limit (free: 30, professional: 500, etc.)
		const organisations = await readCollection('organisations');
		const settings = await getSettings();
		const requestOrgId = getRequestOrganisationId();
		const organisationId = requestOrgId ?? settings?.currentOrganisationId ?? organisations?.[0]?.id ?? null;
		const org = organisationId ? organisations.find((o) => o.id === organisationId) : null;
		const plan = org && Array.isArray(org.areaPermissions)
			? (await getConfiguredPlanFromAreaPermissions(org.areaPermissions)) || 'free'
			: 'free';
		const maxAdmins = await getConfiguredPlanMaxAdmins(plan);
		const admins = await getAdminsForOrganisation(organisationId);
		if (admins.length >= maxAdmins) {
			return { error: `Admin limit reached (${maxAdmins} for ${plan} plan). Upgrade your plan to add more admins.` };
		}

		// Check if email matches super admin email - always super admin (no permissions needed)
		const normalizedEmail = email.toString().toLowerCase().trim();
		const isSuperAdminEmailMatch = isSuperAdminEmail(normalizedEmail, effectiveSuperAdminEmail);

		// Validate permissions array
		const validAreas = getAvailableHubAreas(currentAdmin, effectiveSuperAdminEmail).map(a => a.value);
		let validPermissions = permissions.filter(p => validAreas.includes(p.toString()));
		
		// Check if SUPER_ADMIN permission is being set
		const hasSuperAdminPermission = validPermissions.includes(HUB_AREAS.SUPER_ADMIN);
		
		// Only super admins can grant SUPER_ADMIN permission
		if (hasSuperAdminPermission && !isSuperAdmin(currentAdmin, effectiveSuperAdminEmail)) {
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
				permissions: validPermissions,
				organisationId
			});

			// Check if admin already exists (createAdmin returns existing admin without error to prevent enumeration)
			const existing = await getAdminByEmail(email.toString());
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
					const hubBaseUrl = org?.hubDomain ? `https://${String(org.hubDomain).replace(/\/$/, '')}` : undefined;
					await sendAdminWelcomeEmail({
						to: email.toString(),
						name: name.toString(),
						email: email.toString(),
						verificationToken: fullAdmin.emailVerificationToken,
						password: password.toString(),
						hubBaseUrl,
						orgName: org?.name
					}, { url });
					emailSent = true;
				} catch (emailError) {
					// Log error but don't fail user creation if email fails
					console.error('Failed to send welcome email:', emailError);
					// Continue with redirect even if email fails
				}
			}

			// Sync seat quantity with Paddle (fire-and-forget – won't block or fail the action)
			if (organisationId) {
				syncSubscriptionQuantity(organisationId).catch(() => {});
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

