// TEMPORARY endpoint to initialize database
// DELETE THIS FILE AFTER USE
// Access: POST /api/init-database with database content in body

import { json } from '@sveltejs/kit';
import { writeFileSync, existsSync } from 'fs';

export async function POST({ request }) {
	// Simple password check (use your admin password)
	const authHeader = request.headers.get('authorization');
	const password = process.env.ADMIN_PASSWORD;
	
	if (!authHeader || authHeader !== `Bearer ${password}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	
	const DB_PATH = process.env.DATABASE_PATH || '/data/database.json';
	
	try {
		// Check if database already exists
		if (existsSync(DB_PATH)) {
			return json({ 
				message: 'Database already exists',
				path: DB_PATH,
				exists: true
			});
		}
		
		// Get database content from request body
		const body = await request.json();
		
		// Accept either a JSON object directly, or a string that needs parsing
		let parsed;
		if (body.database) {
			// If it's a string, parse it; if it's already an object, use it
			parsed = typeof body.database === 'string' ? JSON.parse(body.database) : body.database;
		} else if (body.content) {
			parsed = typeof body.content === 'string' ? JSON.parse(body.content) : body.content;
		} else if (body.pages || body.images || body.events) {
			// If the body itself is the database object
			parsed = body;
		} else {
			return json({ 
				error: 'Database content required in body.database, body.content, or as root object'
			}, { status: 400 });
		}
		
		// Write to volume
		writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
		
		return json({ 
			success: true,
			message: 'Database initialized successfully',
			path: DB_PATH,
			size: dbContent.length
		});
		
	} catch (error) {
		console.error('Error initializing database:', error);
		return json({ 
			error: error.message,
			path: DB_PATH,
			code: error.code
		}, { status: 500 });
	}
}

