// Script to write database to Railway volume
// Run with: railway run --service EGCCNewWebsite node scripts/write-db-to-railway.js

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = '/data/database.json';
const LOCAL_DB = join(__dirname, '../data/database-restore.json');

console.log('🔄 Writing database to Railway volume...\n');
console.log('Target path:', DB_PATH);
console.log('Source file:', LOCAL_DB);

try {
	// Read the local database file
	const dbContent = readFileSync(LOCAL_DB, 'utf-8');
	
	// Validate JSON
	JSON.parse(dbContent);
	console.log('✅ Database file is valid JSON\n');
	
	// Write to Railway volume
	writeFileSync(DB_PATH, dbContent, 'utf-8');
	
	console.log('✅ Database successfully written to', DB_PATH);
	console.log('   File size:', (dbContent.length / 1024).toFixed(2), 'KB');
	
	// Verify
	const verify = readFileSync(DB_PATH, 'utf-8');
	if (verify === dbContent) {
		console.log('✅ Verification successful - file written correctly\n');
	} else {
		console.error('❌ Verification failed - file content mismatch\n');
		process.exit(1);
	}
	
} catch (error) {
	if (error.code === 'ENOENT' && error.path === DB_PATH) {
		console.error('❌ Volume not mounted at /data');
		console.error('   Please ensure:');
		console.error('   1. Volume is created and attached to the service');
		console.error('   2. Volume mount path is set to /data');
		console.error('   3. Service has been redeployed after volume creation\n');
	} else if (error.code === 'ENOENT' && error.path === LOCAL_DB) {
		console.error('❌ Local database file not found:', LOCAL_DB);
		console.error('   Please restore it first: git show fc4b61b:data/database.json > data/database-restore.json\n');
	} else {
		console.error('❌ Error:', error.message);
		console.error('   Full error:', error);
	}
	process.exit(1);
}

