#!/usr/bin/env node

/**
 * Script to copy database from production to development using the /api/content endpoint
 * This works with the existing API without needing new endpoints
 * 
 * Usage: 
 *   node scripts/copy-prod-to-dev-content-api.js
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

// Helper to fetch with authentication
async function fetchWithAuth(url) {
	// Try cookie-based auth first (if we had a session)
	// Then try Bearer token
	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${ADMIN_PASSWORD}`
		}
	});
	
	if (!response.ok && response.status === 401) {
		// If Bearer doesn't work, we need to login first
		// For now, let's try without auth - the content endpoint might be public
		return fetch(url);
	}
	
	return response;
}

async function copyProductionToDev() {
	try {
		console.log('🔄 Copying database from production to development...\n');
		console.log(`   Production: ${PROD_URL}`);
		console.log(`   Development: ${DEV_URL}\n`);

		// Step 1: Fetch all data from production using /api/content
		console.log('📤 Step 1: Fetching all data from production...');
		
		const dataTypes = [
			'pages',
			'team',
			'services',
			'hero-slides',
			'contact',
			'service-times',
			'settings',
			'home',
			'activities',
			'community-groups',
			'events'
		];

		const db = {
			pages: [],
			team: [],
			services: [],
			heroSlides: [],
			images: [],
			podcasts: [],
			activities: [],
			communityGroups: [],
			events: [],
			contact: {},
			serviceTimes: {},
			settings: {},
			home: {}
		};

		// Fetch each data type
		for (const type of dataTypes) {
			try {
				const url = `${PROD_URL}/api/content?type=${type}`;
				console.log(`   Fetching ${type}...`);
				
				const response = await fetchWithAuth(url);
				
				if (response.ok) {
					const data = await response.json();
					
					// Map to database structure
					switch (type) {
						case 'pages':
							db.pages = Array.isArray(data) ? data : [];
							break;
						case 'team':
							db.team = Array.isArray(data) ? data : [];
							break;
						case 'services':
							db.services = Array.isArray(data) ? data : [];
							break;
						case 'hero-slides':
							db.heroSlides = Array.isArray(data) ? data : [];
							break;
						case 'contact':
							db.contact = data || {};
							break;
						case 'service-times':
							db.serviceTimes = data || {};
							break;
						case 'settings':
							db.settings = data || {};
							break;
						case 'home':
							db.home = data || {};
							break;
						case 'activities':
							db.activities = Array.isArray(data) ? data : [];
							break;
						case 'community-groups':
							db.communityGroups = Array.isArray(data) ? data : [];
							break;
						case 'events':
							db.events = Array.isArray(data) ? data : [];
							break;
					}
					
					const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
					console.log(`     ✓ ${type}: ${count} items`);
				} else {
					console.log(`     ⚠ ${type}: Failed (${response.status})`);
				}
			} catch (error) {
				console.log(`     ⚠ ${type}: Error - ${error.message}`);
			}
		}

		// Also fetch podcasts (separate endpoint)
		try {
			console.log(`   Fetching podcasts...`);
			const podcastsUrl = `${PROD_URL}/api/podcasts`;
			const podcastsResponse = await fetch(podcastsUrl);
			if (podcastsResponse.ok) {
				db.podcasts = await podcastsResponse.json();
				console.log(`     ✓ podcasts: ${db.podcasts.length} items`);
			}
		} catch (error) {
			console.log(`     ⚠ podcasts: Error - ${error.message}`);
		}

		console.log('\n✅ Successfully fetched production data');
		console.log(`   - Pages: ${db.pages.length}`);
		console.log(`   - Team: ${db.team.length}`);
		console.log(`   - Events: ${db.events.length}`);
		console.log(`   - Services: ${db.services.length}`);
		console.log(`   - Hero Slides: ${db.heroSlides.length}`);
		console.log(`   - Activities: ${db.activities.length}`);
		console.log(`   - Community Groups: ${db.communityGroups.length}`);
		console.log(`   - Podcasts: ${db.podcasts.length}`);

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
			console.error('\n💡 The database might already exist. Check the development site.');
			return false;
		}
	} catch (error) {
		console.error('❌ Failed to copy database:', error.message);
		console.error('\n💡 Troubleshooting:');
		console.error('   1. Check that both PROD_URL and DEV_URL are correct');
		console.error('   2. Verify ADMIN_PASSWORD is correct');
		console.error('   3. Ensure both sites are accessible');
		console.error('   4. Check that /api/content endpoint exists on production');
		console.error('   5. Check that /api/init-database exists on development');
		return false;
	}
}

copyProductionToDev().then(success => {
	process.exit(success ? 0 : 1);
});

