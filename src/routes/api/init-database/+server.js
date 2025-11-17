// TEMPORARY endpoint to initialize database from git history
// DELETE THIS FILE AFTER USE
// Access: POST /api/init-database with ADMIN_PASSWORD in header

import { json } from '@sveltejs/kit';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

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
		
		// Try to restore from git history
		console.log('Restoring database from git history...');
		const gitDb = execSync('git show fc4b61b:data/database.json', { 
			encoding: 'utf-8',
			cwd: process.cwd()
		});
		
		// Validate JSON
		JSON.parse(gitDb);
		
		// Write to volume
		writeFileSync(DB_PATH, gitDb, 'utf-8');
		
		return json({ 
			success: true,
			message: 'Database initialized successfully',
			path: DB_PATH,
			size: gitDb.length
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

