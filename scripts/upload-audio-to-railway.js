#!/usr/bin/env node

/**
 * Script to upload manually downloaded MP3 files to Railway volume
 * 
 * Usage:
 *   Single file: railway run node scripts/upload-audio-to-railway.js /path/to/file.mp3
 *   Directory: railway run node scripts/upload-audio-to-railway.js /path/to/directory
 *   With filename mapping: railway run node scripts/upload-audio-to-railway.js /path/to/file.mp3 --filename "20251012_JohnWatson_Nehemiah4.mp3"
 * 
 * For local testing (uploads to static/audio/uploaded):
 *   node scripts/upload-audio-to-railway.js /path/to/file.mp3
 */

import { readFileSync, writeFileSync, readdirSync, statSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, basename, extname, isAbsolute } from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = process.env.DATABASE_PATH || './data/database.json';
// Check if running on Railway by checking if DATABASE_PATH uses /data
// (Railway volumes are mounted at /data, and database is at /data/database.json)
const isRailway = DB_PATH.startsWith('/data') || process.env.DATABASE_PATH?.startsWith('/data');
const AUDIO_UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || 
	(isRailway ? '/data/audio/uploaded' : 'static/audio/uploaded');

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

// Get file size
function getFileSize(filePath) {
	try {
		const stats = statSync(filePath);
		return stats.size;
	} catch (err) {
		return 0;
	}
}

// Find podcast by filename in database
function findPodcastByFilename(db, filename) {
	const podcasts = db.podcasts || [];
	
	// Try exact match first
	let podcast = podcasts.find(p => 
		p.filename === filename || 
		p.originalName === filename ||
		p.audioUrl?.endsWith(filename)
	);
	
	// Try partial match (filename without extension)
	if (!podcast) {
		const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
		podcast = podcasts.find(p => {
			const pFilename = p.filename?.replace(/\.[^/.]+$/, '') || '';
			const pOriginal = p.originalName?.replace(/\.[^/.]+$/, '') || '';
			return pFilename === nameWithoutExt || pOriginal === nameWithoutExt;
		});
	}
	
	return podcast;
}

// Upload a single file
function uploadFile(filePath, targetFilename = null) {
	try {
		if (!existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}
		
		const stats = statSync(filePath);
		if (!stats.isFile()) {
			throw new Error(`Not a file: ${filePath}`);
		}
		
		// Check if it's an audio file
		const ext = extname(filePath).toLowerCase();
		if (!['.mp3', '.m4a', '.wav', '.ogg'].includes(ext)) {
			throw new Error(`Not an audio file: ${filePath}`);
		}
		
		// Determine target filename
		const filename = targetFilename || basename(filePath);
		
		// Ensure upload directory exists
		const uploadPath = ensureUploadDir();
		const targetPath = join(uploadPath, filename);
		
		// Copy file
		console.log(`📤 Uploading: ${basename(filePath)}`);
		console.log(`   → ${targetPath}`);
		copyFileSync(filePath, targetPath);
		
		const fileSize = getFileSize(targetPath);
		console.log(`   ✅ Uploaded (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
		
		// Update database
		console.log(`   🔄 Updating database...`);
		const dbPath = join(process.cwd(), DB_PATH);
		if (!existsSync(dbPath)) {
			console.log(`   ⚠️  Database not found at ${dbPath}, skipping database update`);
			return { filename, fileSize, updated: false };
		}
		
		const db = JSON.parse(readFileSync(dbPath, 'utf-8'));
		const podcast = findPodcastByFilename(db, filename);
		
		if (podcast) {
			const newUrl = `/audio/uploaded/${filename}`;
			podcast.audioUrl = newUrl;
			podcast.filename = filename;
			if (!podcast.originalName) {
				podcast.originalName = filename;
			}
			podcast.size = fileSize;
			
			writeFileSync(dbPath, JSON.stringify(db, null, 2));
			console.log(`   ✅ Updated podcast: "${podcast.title || 'Unknown'}"`);
			console.log(`      New URL: ${newUrl}`);
			return { filename, fileSize, updated: true, podcast };
		} else {
			console.log(`   ⚠️  No matching podcast found in database for: ${filename}`);
			console.log(`   💡 File uploaded but database not updated. You may need to update manually.`);
			return { filename, fileSize, updated: false };
		}
		
	} catch (error) {
		console.error(`   ❌ Error: ${error.message}`);
		throw error;
	}
}

// Main function
function main() {
	const args = process.argv.slice(2);
	
	if (args.length === 0) {
		console.log('📤 Audio Upload Script');
		console.log('');
		console.log('Usage:');
		console.log('  Single file:');
		console.log('    node scripts/upload-audio-to-railway.js /path/to/file.mp3');
		console.log('');
		console.log('  With custom filename:');
		console.log('    node scripts/upload-audio-to-railway.js /path/to/file.mp3 --filename "20251012_JohnWatson_Nehemiah4.mp3"');
		console.log('');
		console.log('  Directory (uploads all MP3 files):');
		console.log('    node scripts/upload-audio-to-railway.js /path/to/directory');
		console.log('');
		console.log('  On Railway:');
		console.log('    railway run node scripts/upload-audio-to-railway.js /path/to/file.mp3');
		console.log('');
		console.log('Environment variables:');
		console.log('  DATABASE_PATH - Path to database (default: ./data/database.json)');
		console.log('  AUDIO_UPLOAD_DIR - Upload directory (default: /data/audio/uploaded in production)');
		process.exit(1);
	}
	
	const inputPath = args[0];
	let targetFilename = null;
	
	// Check for --filename flag
	const filenameIndex = args.indexOf('--filename');
	if (filenameIndex !== -1 && args[filenameIndex + 1]) {
		targetFilename = args[filenameIndex + 1];
	}
	
	try {
		const stats = statSync(inputPath);
		
		if (stats.isDirectory()) {
			// Upload all MP3 files in directory
			console.log(`📁 Processing directory: ${inputPath}\n`);
			const files = readdirSync(inputPath).filter(f => 
				['.mp3', '.m4a', '.wav', '.ogg'].includes(extname(f).toLowerCase())
			);
			
			if (files.length === 0) {
				console.log('❌ No audio files found in directory');
				process.exit(1);
			}
			
			console.log(`Found ${files.length} audio file(s)\n`);
			
			let successCount = 0;
			let errorCount = 0;
			
			for (const file of files) {
				const filePath = join(inputPath, file);
				try {
					uploadFile(filePath);
					successCount++;
					console.log('');
				} catch (error) {
					errorCount++;
					console.log(`   ❌ Failed: ${error.message}\n`);
				}
			}
			
			console.log('📊 Summary:');
			console.log(`   ✅ Success: ${successCount}`);
			console.log(`   ❌ Errors: ${errorCount}`);
			
		} else if (stats.isFile()) {
			// Upload single file
			console.log(`📤 Uploading single file\n`);
			uploadFile(inputPath, targetFilename);
			console.log('\n✅ Upload complete!');
		} else {
			throw new Error('Invalid path: not a file or directory');
		}
		
	} catch (error) {
		console.error(`❌ Error: ${error.message}`);
		process.exit(1);
	}
}

main();

