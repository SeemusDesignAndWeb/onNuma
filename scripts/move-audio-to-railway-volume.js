/**
 * Move audio files from static/audio/uploaded to /data/audio/uploaded
 * 
 * This script moves files that were uploaded to the static directory
 * to the Railway volume at /data/audio/uploaded for persistence.
 * 
 * IMPORTANT: Railway volumes are only accessible when the service is running,
 * not via `railway run`. This script should be run from within the running service.
 * 
 * Alternative: Create an admin API endpoint to trigger this move operation
 * when the service is actually running and has volume access.
 * 
 * Usage (if volume is accessible):
 *   railway run node scripts/move-audio-to-railway-volume.js
 */

import { readdirSync, statSync, copyFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const SOURCE_DIR = 'static/audio/uploaded';
const TARGET_DIR = '/data/audio/uploaded';

function ensureDir(dir) {
	try {
		if (!existsSync(dir)) {
			// Use recursive: true to create all parent directories
			mkdirSync(dir, { recursive: true });
			console.log(`📁 Created directory: ${dir}`);
		}
	} catch (error) {
		console.error(`❌ Could not create directory ${dir}:`, error.message);
		console.error(`   Error code: ${error.code}`);
		// If it's a permission issue or volume not accessible, suggest checking Railway volume setup
		if (error.code === 'ENOENT' || error.code === 'EACCES') {
			console.error(`\n💡 This might mean:`);
			console.error(`   1. The Railway volume isn't mounted at /data`);
			console.error(`   2. The volume exists but subdirectories need to be created manually`);
			console.error(`   3. railway run might not have access to the volume (try running in the service context)\n`);
		}
		throw error;
	}
}

function formatBytes(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function moveFiles() {
	// Check if source directory exists
	if (!existsSync(SOURCE_DIR)) {
		console.log(`❌ Source directory not found: ${SOURCE_DIR}`);
		return;
	}

	// Check if Railway volume is mounted by checking DATABASE_PATH
	const DB_PATH = process.env.DATABASE_PATH || './data/database.json';
	const isRailway = DB_PATH.startsWith('/data') || process.env.DATABASE_PATH?.startsWith('/data');
	
	if (!isRailway) {
		console.log(`\n⚠️  Not running on Railway (DATABASE_PATH: ${DB_PATH})`);
		console.log(`\nThis script is designed to move files from static/ to Railway volume.`);
		console.log(`If you're on Railway, ensure DATABASE_PATH is set to /data/database.json\n`);
		return;
	}

	// Ensure target directory exists
	ensureDir(TARGET_DIR);

	// Get all files in source directory
	const files = readdirSync(SOURCE_DIR).filter(file => {
		const filePath = join(SOURCE_DIR, file);
		return statSync(filePath).isFile();
	});

	if (files.length === 0) {
		console.log(`📂 No files found in ${SOURCE_DIR}`);
		return;
	}

	console.log(`\n📦 Found ${files.length} file(s) to move\n`);

	let moved = 0;
	let skipped = 0;
	let errors = 0;
	let totalSize = 0;

	for (const file of files) {
		const sourcePath = join(SOURCE_DIR, file);
		const targetPath = join(TARGET_DIR, file);

		try {
			// Check if file already exists in target
			if (existsSync(targetPath)) {
				console.log(`⏭️  Skipping (already exists): ${file}`);
				skipped++;
				continue;
			}

			// Get file size
			const stats = statSync(sourcePath);
			const fileSize = stats.size;
			totalSize += fileSize;

			// Copy file to target
			copyFileSync(sourcePath, targetPath);
			console.log(`✅ Moved: ${file} (${formatBytes(fileSize)})`);

			// Delete source file
			unlinkSync(sourcePath);
			moved++;
		} catch (error) {
			console.error(`❌ Error moving ${file}:`, error.message);
			errors++;
		}
	}

	console.log(`\n📊 Summary:`);
	console.log(`   ✅ Moved: ${moved}`);
	console.log(`   ⏭️  Skipped: ${skipped}`);
	console.log(`   ❌ Errors: ${errors}`);
	console.log(`   📦 Total size: ${formatBytes(totalSize)}`);
}

moveFiles();

