import { error } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getSettings } from '$lib/crm/server/settings.js';

export async function load({ cookies }) {
	const admin = await getAdminFromCookies(cookies);
	
	if (!admin) {
		throw error(401, 'Unauthorized');
	}
	
	if (!isSuperAdmin(admin)) {
		throw error(403, 'Forbidden: Superadmin access required');
	}
	
	const settings = await getSettings();
	
	return {
		admin,
		settings
	};
}
