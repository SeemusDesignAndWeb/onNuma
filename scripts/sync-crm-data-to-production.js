#!/usr/bin/env node
/**
 * Script to copy CRM data files (NDJSON) from local to Railway volume
 * This copies all .ndjson files from ./data to /data on Railway
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CRM data files to copy
const CRM_DATA_FILES = [
	'admins.ndjson',
	'contacts.ndjson',
	'events.ndjson',
	'occurrences.ndjson',
	'rotas.ndjson',
	'lists.ndjson',
	'forms.ndjson',
	'newsletters.ndjson',
	'newsletter_templates.ndjson',
	'event_signups.ndjson',
	'event_tokens.ndjson',
	'occurrence_tokens.ndjson',
	'rota_tokens.ndjson',
	'sessions.ndjson',
	'audit_logs.ndjson'
];

const LOCAL_DATA_DIR = join(__dirname, '../data');
const RAILWAY_DATA_DIR = '/data';

async function syncCrmDataToProduction() {
	try {
		console.log('🔄 Syncing CRM data files to Railway volume...\n');

		// Check if Railway CLI is available
		try {
			execSync('railway --version', { stdio: 'ignore' });
		} catch (error) {
			console.error('❌ Railway CLI not found!');
			console.error('   Please install Railway CLI: npm i -g @railway/cli');
			console.error('   Then run: railway login && railway link');
			process.exit(1);
		}

		// Check if local data directory exists
		if (!existsSync(LOCAL_DATA_DIR)) {
			console.error(`❌ Local data directory not found: ${LOCAL_DATA_DIR}`);
			process.exit(1);
		}

		let copiedCount = 0;
		let skippedCount = 0;
		let errorCount = 0;

		// Copy each data file
		for (const filename of CRM_DATA_FILES) {
			const localPath = join(LOCAL_DATA_DIR, filename);
			const railwayPath = join(RAILWAY_DATA_DIR, filename);

			if (!existsSync(localPath)) {
				console.log(`⏭️  Skipping ${filename} (not found locally)`);
				skippedCount++;
				continue;
			}

			try {
				// Read the local file
				const fileContent = readFileSync(localPath, 'utf-8');
				
				// Validate it's valid NDJSON (at least check it's not empty)
				if (!fileContent.trim()) {
					console.log(`⏭️  Skipping ${filename} (empty file)`);
					skippedCount++;
					continue;
				}

				// Use base64 encoding to avoid shell escaping issues
				const base64Content = Buffer.from(fileContent).toString('base64');
				
				console.log(`📤 Copying ${filename}...`);
				
				// Write to Railway volume
				execSync(
					`railway run sh -c 'echo "${base64Content}" | base64 -d > ${railwayPath}'`,
					{
						cwd: join(__dirname, '..'),
						stdio: 'inherit'
					}
				);

				console.log(`✅ Copied ${filename}`);
				copiedCount++;
			} catch (error) {
				console.error(`❌ Error copying ${filename}:`, error.message);
				errorCount++;
			}
		}

		console.log('\n📊 Summary:');
		console.log(`   ✅ Copied: ${copiedCount} files`);
		console.log(`   ⏭️  Skipped: ${skippedCount} files`);
		if (errorCount > 0) {
			console.log(`   ❌ Errors: ${errorCount} files`);
		}

		if (copiedCount > 0) {
			console.log('\n✅ CRM data successfully synced to Railway!');
			console.log('   Your production application should now be able to read the CRM data.\n');
		} else {
			console.log('\n⚠️  No files were copied. Make sure your local data files exist.\n');
		}
	} catch (error) {
		console.error('\n❌ Error syncing CRM data:', error);
		console.error('\n💡 Make sure:');
		console.error('   1. You are logged in: railway login');
		console.error('   2. Project is linked: railway link');
		console.error('   3. Volume is mounted at /data');
		process.exit(1);
	}
}

// Run the sync
syncCrmDataToProduction();

