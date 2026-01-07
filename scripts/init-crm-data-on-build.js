#!/usr/bin/env node
/**
 * Script to initialize CRM data files on Railway volume during build
 * Only copies files if they don't already exist (won't overwrite)
 * 
 * This runs automatically during Railway deployment
 * Or can be run manually: railway run node scripts/init-crm-data-on-build.js
 * 
 * TEST: This deployment will verify that existing admins.ndjson is NOT overwritten
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const RAILWAY_DATA_DIR = process.env.CRM_DATA_DIR || '/data';
const LOCAL_DATA_DIR = join(__dirname, '../data');

// Only initialize admins file (contains login credentials)
// Other files can be added later if needed, but admins is the critical one
const CRM_DATA_FILES = [
	'admins'        // Most important - contains login credentials
];

console.log('🔄 Initializing CRM data files on Railway volume...\n');
console.log('Source directory:', LOCAL_DATA_DIR);
console.log('Destination directory:', RAILWAY_DATA_DIR);
console.log('');

// Ensure destination directory exists
try {
	if (!existsSync(RAILWAY_DATA_DIR)) {
		mkdirSync(RAILWAY_DATA_DIR, { recursive: true });
		console.log(`✅ Created directory: ${RAILWAY_DATA_DIR}\n`);
	}
} catch (error) {
	console.error(`❌ Error creating directory ${RAILWAY_DATA_DIR}:`, error.message);
	// Continue anyway - directory might be created by volume mount
}

let copiedCount = 0;
let skippedCount = 0;
let errorCount = 0;

// Try to get data from git history if local files don't exist
function getDataFromGit(fileKey) {
	try {
		const gitPath = `data/${fileKey}.ndjson`;
		const gitContent = execSync(`git show HEAD:${gitPath}`, {
			encoding: 'utf-8',
			cwd: join(__dirname, '..'),
			stdio: 'pipe'
		});
		return gitContent.trim();
	} catch (error) {
		return null;
	}
}

// Initialize each file
for (const fileKey of CRM_DATA_FILES) {
	const sourcePath = join(LOCAL_DATA_DIR, `${fileKey}.ndjson`);
	const destPath = join(RAILWAY_DATA_DIR, `${fileKey}.ndjson`);

	try {
		// Check if destination file already exists
		if (existsSync(destPath)) {
			console.log(`⏭️  Skipping ${fileKey}.ndjson (already exists)`);
			skippedCount++;
			continue;
		}

		// Try to read from local data directory first
		let content = null;
		if (existsSync(sourcePath)) {
			content = readFileSync(sourcePath, 'utf-8');
		} else {
			// If local file doesn't exist, try git history
			console.log(`   Trying to get ${fileKey}.ndjson from git history...`);
			content = getDataFromGit(fileKey);
		}

		if (!content || !content.trim()) {
			console.log(`⏭️  Skipping ${fileKey}.ndjson (no source data found)`);
			skippedCount++;
			continue;
		}

		// Write to Railway volume
		writeFileSync(destPath, content, 'utf-8');
		console.log(`✅ Initialized ${fileKey}.ndjson`);
		copiedCount++;
	} catch (error) {
		if (error.code === 'ENOENT' && error.path === destPath) {
			console.error(`❌ Volume not accessible at ${RAILWAY_DATA_DIR}`);
			console.error('   This script should run inside Railway container where volume is mounted');
			errorCount++;
		} else {
			console.error(`❌ Error initializing ${fileKey}.ndjson:`, error.message);
			errorCount++;
		}
	}
}

console.log('\n📊 Summary:');
console.log(`   ✅ Initialized: ${copiedCount} files`);
console.log(`   ⏭️  Skipped (already exist): ${skippedCount} files`);
if (errorCount > 0) {
	console.log(`   ❌ Errors: ${errorCount} files`);
}

if (copiedCount > 0) {
	console.log('\n✅ CRM data initialization complete!');
	console.log('   Files have been copied to the Railway volume.\n');
} else if (skippedCount > 0) {
	console.log('\n✅ All CRM data files already exist - nothing to initialize.\n');
} else {
	console.log('\n⚠️  No data files were initialized.');
	console.log('   Make sure source files exist or are in git history.\n');
}

// Exit with success even if no files were copied (non-blocking)
process.exit(0);

