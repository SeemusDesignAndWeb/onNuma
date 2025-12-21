import { existsSync, readdirSync, copyFileSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Source directory (where files currently are)
const SOURCE_DIR = process.env.AUDIO_SOURCE_DIR || join(process.cwd(), 'static/audio/uploaded');

// Destination directory (Railway volume or configured path)
const DEST_DIR = process.env.AUDIO_UPLOAD_DIR || '/data/audio/uploaded';

function getSourcePath() {
	if (SOURCE_DIR.startsWith('./') || SOURCE_DIR.startsWith('../')) {
		return join(process.cwd(), SOURCE_DIR);
	}
	return SOURCE_DIR;
}

function getDestPath() {
	if (DEST_DIR.startsWith('./') || DEST_DIR.startsWith('../')) {
		return join(process.cwd(), DEST_DIR);
	}
	return DEST_DIR;
}

function formatBytes(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function migrateAudioFiles() {
	console.log('🚀 Starting audio files migration to volume...\n');
	console.log(`📂 Source directory: ${getSourcePath()}`);
	console.log(`📂 Destination directory: ${getDestPath()}\n`);

	const sourcePath = getSourcePath();
	const destPath = getDestPath();

	// Check if source directory exists
	if (!existsSync(sourcePath)) {
		console.error(`❌ Source directory not found: ${sourcePath}`);
		console.error('   Please check AUDIO_SOURCE_DIR environment variable or ensure files exist in static/audio/uploaded');
		process.exit(1);
	}

	// Create destination directory if it doesn't exist
	if (!existsSync(destPath)) {
		console.log(`📁 Creating destination directory: ${destPath}`);
		try {
			mkdirSync(destPath, { recursive: true });
			console.log('✅ Destination directory created\n');
		} catch (error) {
			console.error(`❌ Failed to create destination directory: ${error.message}`);
			console.error('   Make sure you have write permissions or the volume is mounted correctly');
			process.exit(1);
		}
	}

	// Get list of files in source directory
	let files;
	try {
		files = readdirSync(sourcePath).filter(file => {
			// Only process audio files
			const ext = file.split('.').pop()?.toLowerCase();
			return ['mp3', 'm4a', 'ogg', 'wav', 'aac', 'flac'].includes(ext);
		});
	} catch (error) {
		console.error(`❌ Error reading source directory: ${error.message}`);
		process.exit(1);
	}

	if (files.length === 0) {
		console.log('ℹ️  No audio files found in source directory');
		console.log('   Migration complete (nothing to migrate)\n');
		return;
	}

	console.log(`📊 Found ${files.length} audio file(s) to migrate\n`);

	let migrated = 0;
	let skipped = 0;
	let errors = 0;
	let totalSize = 0;

	for (const file of files) {
		const sourceFile = join(sourcePath, file);
		const destFile = join(destPath, file);

		try {
			// Check if file already exists in destination
			if (existsSync(destFile)) {
				const sourceStats = statSync(sourceFile);
				const destStats = statSync(destFile);

				// If source and dest are the same size, skip
				if (sourceStats.size === destStats.size) {
					console.log(`⏭️  Skipping ${file} (already exists with same size)`);
					skipped++;
					continue;
				} else {
					console.log(`⚠️  ${file} exists but sizes differ (source: ${formatBytes(sourceStats.size)}, dest: ${formatBytes(destStats.size)})`);
					console.log(`   Overwriting with source file...`);
				}
			}

			// Get file size before copying
			const fileStats = statSync(sourceFile);
			const fileSize = fileStats.size;

			// Copy file
			copyFileSync(sourceFile, destFile);

			// Verify copy
			if (existsSync(destFile)) {
				const destStats = statSync(destFile);
				if (destStats.size === fileSize) {
					console.log(`✅ Migrated ${file} (${formatBytes(fileSize)})`);
					migrated++;
					totalSize += fileSize;
				} else {
					console.error(`❌ Size mismatch for ${file} (expected ${fileSize}, got ${destStats.size})`);
					errors++;
				}
			} else {
				console.error(`❌ Failed to verify ${file} after copy`);
				errors++;
			}
		} catch (error) {
			console.error(`❌ Error migrating ${file}: ${error.message}`);
			errors++;
		}
	}

	// Summary
	console.log('\n' + '='.repeat(50));
	console.log('📊 Migration Summary:');
	console.log(`   ✅ Migrated: ${migrated} file(s)`);
	console.log(`   ⏭️  Skipped: ${skipped} file(s)`);
	console.log(`   ❌ Errors: ${errors} file(s)`);
	console.log(`   📦 Total size: ${formatBytes(totalSize)}`);
	console.log('='.repeat(50) + '\n');

	if (errors > 0) {
		console.error('⚠️  Some files failed to migrate. Please check the errors above.');
		process.exit(1);
	}

	if (migrated === 0 && skipped > 0) {
		console.log('ℹ️  All files were already migrated (skipped).');
	}

	console.log('🎉 Migration complete!');
	console.log(`\n💡 Note: Audio files are now stored in: ${destPath}`);
	console.log('   The source files in static/audio/uploaded can be removed if desired.');
	console.log('   (They are not automatically deleted for safety)\n');
}

// Run the migration
migrateAudioFiles().catch(error => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});

