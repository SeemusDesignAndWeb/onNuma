#!/usr/bin/env node

/**
 * Migration script to download existing MP3 files from external host
 * and upload them to Railway volume at /data/audio/uploaded/
 * 
 * Usage:
 *   Local: node scripts/migrate-audio-to-railway.js
 *   Railway: railway run node scripts/migrate-audio-to-railway.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, createWriteStream, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import https from 'https';
import http from 'http';

const DB_PATH = process.env.DATABASE_PATH || './data/database.json';
// Check if running on Railway by checking if DATABASE_PATH uses /data
// (Railway volumes are mounted at /data, and database is at /data/database.json)
const isRailway = DB_PATH.startsWith('/data') || process.env.DATABASE_PATH?.startsWith('/data');
const AUDIO_UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || 
	(isRailway ? '/data/audio/uploaded' : 'static/audio/uploaded');
const OLD_HOST = 'http://www.egcc.co.uk/company/egcc/audio/';

// Ensure upload directory exists
function ensureUploadDir() {
	let uploadPath;
	if (AUDIO_UPLOAD_DIR.startsWith('./') || AUDIO_UPLOAD_DIR.startsWith('../')) {
		uploadPath = join(process.cwd(), AUDIO_UPLOAD_DIR);
	} else {
		uploadPath = AUDIO_UPLOAD_DIR;
	}
	
	if (!existsSync(uploadPath)) {
		mkdirSync(uploadPath, { recursive: true });
		console.log(`📁 Created directory: ${uploadPath}`);
	}
	return uploadPath;
}

// Download file from URL (with redirect handling)
function downloadFile(url, filePath, redirectCount = 0) {
	return new Promise((resolve, reject) => {
		// Prevent infinite redirect loops
		if (redirectCount > 5) {
			reject(new Error('Too many redirects'));
			return;
		}
		
		// Encode URL to handle spaces and special characters
		try {
			const urlObj = new URL(url);
			// Encode the pathname part but preserve slashes
			const pathParts = urlObj.pathname.split('/').map(part => encodeURIComponent(part));
			urlObj.pathname = pathParts.join('/');
			url = urlObj.toString();
		} catch (e) {
			// If URL parsing fails, try basic encoding
			url = encodeURI(url);
		}
		
		const protocol = url.startsWith('https') ? https : http;
		
		const request = protocol.get(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; AudioMigration/1.0)',
				'Accept': '*/*'
			},
			timeout: 30000
		}, (response) => {
			// Handle redirects
			if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
				const redirectUrl = response.headers.location;
				if (!redirectUrl) {
					reject(new Error('Redirect without location header'));
					return;
				}
				// Resolve relative redirects
				const baseUrl = new URL(url);
				const redirectUrlObj = redirectUrl.startsWith('http') 
					? new URL(redirectUrl)
					: new URL(redirectUrl, baseUrl.origin);
				return downloadFile(redirectUrlObj.toString(), filePath, redirectCount + 1)
					.then(resolve)
					.catch(reject);
			}
			
			if (response.statusCode !== 200) {
				reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
				return;
			}
			
			const fileStream = createWriteStream(filePath);
			response.pipe(fileStream);
			
			fileStream.on('finish', () => {
				fileStream.close();
				resolve();
			});
			
			fileStream.on('error', (err) => {
				if (existsSync(filePath)) {
					unlinkSync(filePath);
				}
				reject(err);
			});
		});
		
		request.on('error', reject);
		request.on('timeout', () => {
			request.destroy();
			reject(new Error('Download timeout'));
		});
	});
}

// Get file size
function getFileSize(filePath) {
	try {
		const stats = statSync(filePath);
		return stats.size;
	} catch (err) {
		return 0;
	}
}

async function migrateAudioFiles() {
	try {
		console.log('🚀 Starting audio migration...\n');
		
		// Read database
		console.log('📖 Reading database...');
		const dbPath = join(process.cwd(), DB_PATH);
		if (!existsSync(dbPath)) {
			throw new Error(`Database not found at ${dbPath}`);
		}
		
		const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
		const podcasts = db.podcasts || [];
		
		console.log(`📊 Found ${podcasts.length} podcasts in database\n`);
		
		// Filter podcasts with external URLs
		const podcastsToMigrate = podcasts.filter(p => 
			p.audioUrl && p.audioUrl.startsWith('http://www.egcc.co.uk')
		);
		
		console.log(`🎵 Found ${podcastsToMigrate.length} podcasts with external audio URLs\n`);
		
		if (podcastsToMigrate.length === 0) {
			console.log('✅ No podcasts to migrate!');
			return;
		}
		
		// Ensure upload directory exists
		const uploadPath = ensureUploadDir();
		console.log(`📁 Upload directory: ${uploadPath}\n`);
		
		let successCount = 0;
		let skipCount = 0;
		let errorCount = 0;
		const errors = [];
		
		// Process each podcast
		for (let i = 0; i < podcastsToMigrate.length; i++) {
			const podcast = podcastsToMigrate[i];
			const oldUrl = podcast.audioUrl;
			const filename = podcast.filename || oldUrl.split('/').pop();
			
			console.log(`[${i + 1}/${podcastsToMigrate.length}] Processing: ${podcast.title || filename}`);
			console.log(`   Old URL: ${oldUrl}`);
			
			// Check if file already exists
			const filePath = join(uploadPath, filename);
			if (existsSync(filePath)) {
				const existingSize = getFileSize(filePath);
				if (existingSize > 0) {
					console.log(`   ⏭️  File already exists (${(existingSize / 1024 / 1024).toFixed(2)} MB), skipping download`);
					
					// Update database with new path
					const newUrl = `/audio/uploaded/${filename}`;
					podcast.audioUrl = newUrl;
					if (!podcast.size || podcast.size === 0) {
						podcast.size = existingSize;
					}
					
					skipCount++;
					console.log(`   ✅ Updated database: ${newUrl}\n`);
					continue;
				}
			}
			
			try {
				// Download file
				console.log(`   ⬇️  Downloading...`);
				await downloadFile(oldUrl, filePath);
				
				const fileSize = getFileSize(filePath);
				console.log(`   ✅ Downloaded (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
				
				// Update database with new path
				const newUrl = `/audio/uploaded/${filename}`;
				podcast.audioUrl = newUrl;
				podcast.size = fileSize;
				
				successCount++;
				console.log(`   ✅ Updated database: ${newUrl}\n`);
				
			} catch (error) {
				errorCount++;
				const errorMsg = error.message;
				console.error(`   ❌ Error: ${errorMsg}\n`);
				errors.push({ title: podcast.title || filename, url: oldUrl, error: errorMsg });
				
				// Continue with next file
				continue;
			}
		}
		
		// Save updated database
		console.log('\n💾 Saving updated database...');
		writeFileSync(dbPath, JSON.stringify(db, null, 2));
		console.log('✅ Database saved!\n');
		
		// Summary
		console.log('📊 Migration Summary:');
		console.log(`   ✅ Successfully migrated: ${successCount}`);
		console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
		console.log(`   ❌ Errors: ${errorCount}`);
		console.log(`   📁 Files location: ${uploadPath}\n`);
		
		if (errorCount > 0) {
			console.log('⚠️  Some files failed to download.');
			console.log('\n❌ Failed downloads (first 10):');
			errors.slice(0, 10).forEach((err, idx) => {
				console.log(`   ${idx + 1}. ${err.title}`);
				console.log(`      URL: ${err.url}`);
				console.log(`      Error: ${err.error}\n`);
			});
			if (errors.length > 10) {
				console.log(`   ... and ${errors.length - 10} more errors\n`);
			}
			console.log('💡 Note: If files return 404, they may not exist at those URLs.');
			console.log('   You may need to manually verify the URLs or upload files directly.\n');
		} else {
			console.log('🎉 Migration complete!');
		}
		
	} catch (error) {
		console.error('❌ Migration failed:', error);
		process.exit(1);
	}
}

// Run migration
migrateAudioFiles();

