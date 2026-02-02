import { error } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getSettings } from '$lib/crm/server/settings.js';
import { readCollection, getStoreMode } from '$lib/crm/server/fileStore.js';

export async function load({ cookies }) {
	const admin = await getAdminFromCookies(cookies);

	if (!admin) {
		throw error(401, 'Unauthorized');
	}

	if (!isSuperAdmin(admin)) {
		throw error(403, 'Forbidden: Superadmin access required');
	}

	const settings = await getSettings();
	const storeMode = await getStoreMode();

	// Get all unique rota roles for selection
	const rotas = await readCollection('rotas');
	const uniqueRoles = [...new Set(rotas.map((r) => r.role))].sort();

	return {
		admin,
		settings,
		availableRoles: uniqueRoles,
		storeMode
	};
}
