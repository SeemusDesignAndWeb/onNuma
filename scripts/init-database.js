// One-time script to initialize database on Railway
// This can be run via: railway run node scripts/init-database.js

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const DB_PATH = '/data/database.json';

// Check if database already exists
if (existsSync(DB_PATH)) {
	console.log('Database already exists at', DB_PATH);
	process.exit(0);
}

// Try to restore from git history
try {
	console.log('Restoring database from git history...');
	const gitDb = execSync('git show fc4b61b:data/database.json', { 
		encoding: 'utf-8',
		cwd: process.cwd()
	});
	
	writeFileSync(DB_PATH, gitDb, 'utf-8');
	console.log('✅ Database restored successfully to', DB_PATH);
} catch (error) {
	console.error('❌ Failed to restore database:', error.message);
	process.exit(1);
}

