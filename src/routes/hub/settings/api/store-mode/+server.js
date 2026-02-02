import { json, error } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getDataDir } from '$lib/crm/server/fileStore.js';
import { invalidateStoreModeCache } from '$lib/crm/server/fileStore.js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export async function POST({ request, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) throw error(401, 'Unauthorized');
	if (!isSuperAdmin(admin)) throw error(403, 'Forbidden: Superadmin access required');

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}
	const dataStore = body.dataStore;
	if (dataStore !== 'file' && dataStore !== 'database') {
		return json({ error: 'dataStore must be "file" or "database"' }, { status: 400 });
	}

	const dataDir = getDataDir();
	if (!existsSync(dataDir)) {
		await mkdir(dataDir, { recursive: true });
	}
	const path = join(dataDir, 'store_mode.json');
	await writeFile(path, JSON.stringify({ dataStore }, null, 2), 'utf8');
	invalidateStoreModeCache();
	return json({ success: true, dataStore });
}
