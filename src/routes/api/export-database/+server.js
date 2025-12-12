import { json } from '@sveltejs/kit';
import { isAuthenticated } from '$lib/server/auth';
import { readFileSync } from 'fs';
import { getDbPath } from '$lib/server/database';
import { env } from '$env/dynamic/private';

/**
 * Export database endpoint
 * GET /api/export-database
 * Returns the full database as JSON
 * Requires admin authentication (cookie or Bearer token)
 */
export async function GET({ cookies, request }) {
	// Check authentication via cookie or Bearer token
	const authHeader = request.headers.get('authorization');
	const password = env.ADMIN_PASSWORD;
	
	let authenticated = false;
	
	if (authHeader && authHeader.startsWith('Bearer ')) {
		// Bearer token authentication (for API-to-API calls)
		const token = authHeader.substring(7);
		authenticated = token === password;
	} else {
		// Cookie-based authentication (for browser requests)
		authenticated = isAuthenticated(cookies);
	}
	
	if (!authenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const dbPath = getDbPath();
		const dbContent = readFileSync(dbPath, 'utf-8');
		const db = JSON.parse(dbContent);

		return json({
			success: true,
			database: db,
			path: dbPath,
			exportedAt: new Date().toISOString()
		});
	} catch (error) {
		console.error('Error exporting database:', error);
		return json(
			{
				error: error.message,
				code: error.code
			},
			{ status: 500 }
		);
	}
}

