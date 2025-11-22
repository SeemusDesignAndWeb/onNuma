#!/usr/bin/env node

/**
 * Script to initialize the production database via the API endpoint
 * Usage: node scripts/init-production-db.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_FILE = join(__dirname, '../data/database-restore.json');
const API_URL = process.env.API_URL || 'https://new.egcc.co.uk/api/init-database';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Haran153!';

async function initDatabase() {
	try {
		console.log('Reading database file...');
		const dbContent = readFileSync(DB_FILE, 'utf-8');
		const db = JSON.parse(dbContent);
		
		console.log('Sending to production API...');
		const response = await fetch(API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${ADMIN_PASSWORD}`
			},
			body: JSON.stringify({ database: db })
		});
		
		const result = await response.json();
		
		if (response.ok) {
			console.log('✅ Success:', result.message);
			console.log('   Path:', result.path);
			console.log('   Size:', result.size, 'bytes');
		} else {
			console.error('❌ Error:', result.error);
			if (result.code) {
				console.error('   Code:', result.code);
			}
		}
		
		return response.ok;
	} catch (error) {
		console.error('❌ Failed to initialize database:', error.message);
		return false;
	}
}

initDatabase().then(success => {
	process.exit(success ? 0 : 1);
});

