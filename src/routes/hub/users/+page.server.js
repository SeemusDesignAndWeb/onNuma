import { getCsrfToken } from '$lib/crm/server/auth.js';
import { getAdminPermissions, isSuperAdmin, getPlanMaxAdmins } from '$lib/crm/server/permissions.js';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { getAdminsForOrganisation } from '$lib/crm/server/auth.js';

const ITEMS_PER_PAGE = 20;

export async function load({ url, cookies, parent }) {
	const parentData = await parent();
	const plan = parentData.plan || 'free';
	const maxAdmins = getPlanMaxAdmins(plan);

	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';

	const organisationId = await getCurrentOrganisationId();
	const admins = await getAdminsForOrganisation(organisationId);
	const adminCount = admins.length;
	
	let filtered = admins;
	if (search) {
		const searchLower = search.toLowerCase();
		filtered = admins.filter(a => 
			a.email?.toLowerCase().includes(searchLower) ||
			a.name?.toLowerCase().includes(searchLower)
		);
	}

	const total = filtered.length;
	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const paginated = filtered.slice(start, end);

	// Remove sensitive data before sending to client
	const sanitized = paginated.map(admin => {
		// Get permissions (handles both new permissions array and legacy adminLevel)
		const permissions = admin.permissions || getAdminPermissions(admin) || [];
		const isSuperAdminUser = isSuperAdmin(admin);
		
		return {
			id: admin.id,
			email: admin.email,
			name: admin.name,
			role: admin.role,
			permissions: permissions,
			isSuperAdmin: isSuperAdminUser,
			emailVerified: admin.emailVerified || false,
			createdAt: admin.createdAt,
			passwordChangedAt: admin.passwordChangedAt,
			failedLoginAttempts: admin.failedLoginAttempts || 0,
			accountLockedUntil: admin.accountLockedUntil
		};
	});

	const csrfToken = getCsrfToken(cookies) || '';
	return {
		admins: sanitized,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		search,
		csrfToken,
		adminCount,
		maxAdmins,
		plan
	};
}

