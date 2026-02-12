/**
 * Import marketing collection data into the CRM store (database or file).
 * Used to upload marketing data from localhost to production.
 *
 * POST /api/admin/import-marketing
 * Body: { "marketing_sequences": [...], "marketing_email_templates": [...], ... }
 * Auth: Bearer ADMIN_PASSWORD
 *
 * Each key must be a marketing collection name; each value must be an array of records
 * with at least an `id` field. Existing records for that collection are replaced.
 */

import { json } from '@sveltejs/kit';
import { writeCollection } from '$lib/crm/server/fileStore.js';
import { invalidateOrganisationsCache } from '$lib/crm/server/organisationsCache.js';
import { env } from '$env/dynamic/private';

const MARKETING_COLLECTIONS = [
	'marketing_content_blocks',
	'marketing_email_templates',
	'marketing_links',
	'marketing_org_branding',
	'marketing_send_logs',
	'marketing_send_queue',
	'marketing_sequence_steps',
	'marketing_sequences',
	'marketing_template_variables',
	'marketing_template_versions',
	'marketing_user_preferences'
];

export async function POST({ request }) {
	const authHeader = request.headers.get('authorization');
	const password = env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

	if (!password || !authHeader || authHeader !== `Bearer ${password}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	let body;
	try {
		body = await request.json();
	} catch (e) {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	if (!body || typeof body !== 'object') {
		return json({ error: 'Body must be an object' }, { status: 400 });
	}

	const results = { written: [], errors: [] };

	for (const collection of MARKETING_COLLECTIONS) {
		const records = body[collection];
		if (records === undefined) continue;
		if (!Array.isArray(records)) {
			results.errors.push({ collection, error: 'Value must be an array' });
			continue;
		}
		try {
			await writeCollection(collection, records);
			results.written.push({ collection, count: records.length });
		} catch (err) {
			results.errors.push({ collection, error: err?.message || String(err) });
		}
	}

	// Invalidate caches that might include marketing-derived data
	try {
		invalidateOrganisationsCache();
	} catch {
		// ignore
	}

	return json({
		success: results.errors.length === 0,
		message: 'Marketing data import completed',
		results
	});
}
