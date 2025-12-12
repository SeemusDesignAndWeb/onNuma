#!/usr/bin/env node

/**
 * Script to copy database from production to development using API endpoints
 * This is the recommended method as it works regardless of volume setup
 * 
 * Usage: 
 *   1. Set environment variables:
 *      - PROD_URL: Production site URL (e.g., https://new.egcc.co.uk)
 *      - DEV_URL: Development site URL (e.g., https://egcc-new-website-production.up.railway.app)
 *      - ADMIN_PASSWORD: Your admin password
 *   2. node scripts/copy-prod-to-dev-api.js
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PROD_URL = process.env.PROD_URL || 'https://www.egcc.co.uk';
const DEV_URL = process.env.DEV_URL || 'https://dev.egcc.co.uk';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Haran153!';
const TEMP_DB_FILE = join(__dirname, '../data/database-temp-prod.json');

async function copyProductionToDev() {
	try {
		console.log('🔄 Copying database from production to development using API...\n');
		console.log(`   Production: ${PROD_URL}`);
		console.log(`   Development: ${DEV_URL}\n`);

		// Step 1: Export database from production
		console.log('📤 Step 1: Exporting database from production...');
		const exportUrl = `${PROD_URL}/api/export-database`;
		
		const exportResponse = await fetch(exportUrl, {
			method: 'GET',
			headers: {
				'Cookie': `admin_token=${ADMIN_PASSWORD}` // Admin auth via cookie
			}
		});

		if (!exportResponse.ok) {
			// Try with Authorization header instead
			const exportResponse2 = await fetch(exportUrl, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${ADMIN_PASSWORD}`
				}
			});

			if (!exportResponse2.ok) {
				const errorText = await exportResponse2.text();
				console.error('❌ Failed to export from production:', exportResponse2.status);
				console.error('   Response:', errorText);
				console.error('\n💡 Make sure:');
				console.error('   1. Production site is accessible');
				console.error('   2. ADMIN_PASSWORD is correct');
				console.error('   3. /api/export-database endpoint exists');
				return false;
			}

			const exportResult = await exportResponse2.json();
			const db = exportResult.database;

			console.log('✅ Successfully exported production database');
			console.log(`   - Pages: ${db.pages?.length || 0}`);
			console.log(`   - Team: ${db.team?.length || 0}`);
			console.log(`   - Events: ${db.events?.length || 0}`);
			console.log(`   - Services: ${db.services?.length || 0}`);
			console.log(`   - Hero Slides: ${db.heroSlides?.length || 0}`);
			console.log(`   - Activities: ${db.activities?.length || 0}`);
			console.log(`   - Community Groups: ${db.communityGroups?.length || 0}`);
			console.log(`   - Podcasts: ${db.podcasts?.length || 0}`);

			// Save backup
			writeFileSync(TEMP_DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
			console.log(`\n💾 Saved backup to: ${TEMP_DB_FILE}\n`);

			// Step 2: Import to development
			console.log('📥 Step 2: Importing database to development...');
			const importUrl = `${DEV_URL}/api/init-database?force=true`;

			const importResponse = await fetch(importUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${ADMIN_PASSWORD}`
				},
				body: JSON.stringify({ database: db })
			});

			const importResult = await importResponse.json();

			if (importResponse.ok) {
				console.log('✅ Success:', importResult.message);
				console.log('   Path:', importResult.path);
				console.log('   Size:', importResult.size, 'bytes');
				console.log('\n🎉 Database successfully copied to development!');
				return true;
			} else {
				console.error('❌ Error importing to development:', importResult.error);
				if (importResult.code) {
					console.error('   Code:', importResult.code);
				}
				return false;
			}
		} else {
			const exportResult = await exportResponse.json();
			const db = exportResult.database;

			console.log('✅ Successfully exported production database');
			console.log(`   - Pages: ${db.pages?.length || 0}`);
			console.log(`   - Team: ${db.team?.length || 0}`);
			console.log(`   - Events: ${db.events?.length || 0}`);
			console.log(`   - Services: ${db.services?.length || 0}`);
			console.log(`   - Hero Slides: ${db.heroSlides?.length || 0}`);

			// Save backup
			writeFileSync(TEMP_DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
			console.log(`\n💾 Saved backup to: ${TEMP_DB_FILE}\n`);

			// Step 2: Import to development
			console.log('📥 Step 2: Importing database to development...');
			const importUrl = `${DEV_URL}/api/init-database?force=true`;

			const importResponse = await fetch(importUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${ADMIN_PASSWORD}`
				},
				body: JSON.stringify({ database: db })
			});

			const importResult = await importResponse.json();

			if (importResponse.ok) {
				console.log('✅ Success:', importResult.message);
				console.log('   Path:', importResult.path);
				console.log('   Size:', importResult.size, 'bytes');
				console.log('\n🎉 Database successfully copied to development!');
				return true;
			} else {
				console.error('❌ Error importing to development:', importResult.error);
				if (importResult.code) {
					console.error('   Code:', importResult.code);
				}
				return false;
			}
		}
	} catch (error) {
		console.error('❌ Failed to copy database:', error.message);
		console.error('\n💡 Troubleshooting:');
		console.error('   1. Check that both PROD_URL and DEV_URL are correct');
		console.error('   2. Verify ADMIN_PASSWORD is correct for both sites');
		console.error('   3. Ensure both sites are accessible');
		console.error('   4. Check that /api/export-database exists on production');
		console.error('   5. Check that /api/init-database exists on development');
		return false;
	}
}

copyProductionToDev().then(success => {
	process.exit(success ? 0 : 1);
});

