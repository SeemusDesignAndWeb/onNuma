import { json, error } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import * as fileStoreImpl from '$lib/crm/server/fileStoreImpl.js';
import * as dbStore from '$lib/crm/server/dbStore.js';
import { COLLECTIONS_FOR_DB } from '$lib/crm/server/collections.js';

export async function POST({ cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) throw error(401, 'Unauthorized');
	if (!isSuperAdmin(admin)) throw error(403, 'Forbidden: Superadmin access required');

	try {
		await dbStore.createTableIfNotExists();
	} catch (err) {
		console.error('[migrate-to-database] createTable failed:', err);
		return json({ success: false, error: `Database table creation failed: ${err.message}` }, { status: 500 });
	}

	const results = { migrated: [], skipped: [], errors: [] };
	for (const collection of COLLECTIONS_FOR_DB) {
		try {
			const records = await fileStoreImpl.readCollection(collection);
			if (records.length === 0) {
				results.skipped.push({ collection, count: 0 });
				continue;
			}
			await dbStore.writeCollection(collection, records);
			results.migrated.push({ collection, count: records.length });
		} catch (err) {
			console.error(`[migrate-to-database] ${collection}:`, err);
			results.errors.push({ collection, error: err.message });
		}
	}
	return json({ success: true, results });
}
