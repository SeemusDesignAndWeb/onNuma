import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { readdirSync, copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Source directory (where files currently are)
// Try multiple possible locations
function getSourcePath() {
	const possiblePaths = [
		process.env.AUDIO_SOURCE_DIR,
		join(process.cwd(), 'static/audio/uploaded'),
		join(process.cwd(), '../static/audio/uploaded'),
		'/app/static/audio/uploaded',
		join(process.cwd(), 'build/client/audio/uploaded'),
		join(process.cwd(), 'public/audio/uploaded')
	];

	for (const path of possiblePaths) {
		if (!path) continue;
		
		let resolvedPath;
		if (path.startsWith('./') || path.startsWith('../')) {
			resolvedPath = join(process.cwd(), path);
		} else if (path.startsWith('/')) {
			resolvedPath = path;
		} else {
			resolvedPath = join(process.cwd(), path);
		}

		if (existsSync(resolvedPath)) {
			return resolvedPath;
		}
	}

	// If none found, return the default
	const defaultPath = process.env.AUDIO_SOURCE_DIR || join(process.cwd(), 'static/audio/uploaded');
	if (defaultPath.startsWith('./') || defaultPath.startsWith('../')) {
		return join(process.cwd(), defaultPath);
	}
	return defaultPath;
}

// Destination directory (Railway volume or configured path)
const DEST_DIR = process.env.AUDIO_UPLOAD_DIR || '/data/audio/uploaded';

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

export const POST = async ({ cookies }) => {
	requireAuth({ cookies });

	try {
		const sourcePath = getSourcePath();
		const destPath = getDestPath();

		// Check if source directory exists
		if (!existsSync(sourcePath)) {
			// Try to find any audio files in common locations
			const searchPaths = [
				join(process.cwd(), 'static/audio/uploaded'),
				join(process.cwd(), '../static/audio/uploaded'),
				'/app/static/audio/uploaded',
				join(process.cwd(), 'build/client/audio/uploaded'),
				join(process.cwd(), 'public/audio/uploaded')
			];

			const foundPaths = searchPaths.filter(p => {
				try {
					return existsSync(p);
				} catch {
					return false;
				}
			});
			
			// If no source directory found, return success with message (no files to migrate)
			if (foundPaths.length === 0) {
				return json({
					success: true,
					migrated: 0,
					skipped: 0,
					errors: 0,
					message: 'No source directory found. This is normal if files have already been migrated or if you are uploading files directly. Use the bulk upload feature to add files.',
					sourcePath,
					destPath,
					note: 'If you have files in a different location, set the AUDIO_SOURCE_DIR environment variable.'
				});
			}
			
			return json({ 
				error: `Source directory not found: ${sourcePath}`,
				sourcePath,
				destPath,
				searchedPaths: searchPaths,
				foundPaths: foundPaths,
				message: `Source directory not found. However, found potential directories at: ${foundPaths.join(', ')}. Please set AUDIO_SOURCE_DIR environment variable to one of these paths, or use the bulk upload feature to add files directly.`
			}, { status: 404 });
		}

		// Create destination directory if it doesn't exist
		if (!existsSync(destPath)) {
			try {
				mkdirSync(destPath, { recursive: true });
			} catch (error) {
				return json({ 
					error: `Failed to create destination directory: ${error.message}`,
					destPath
				}, { status: 500 });
			}
		}

		// Get list of files in source directory
		let files;
		try {
			files = readdirSync(sourcePath).filter(file => {
				const ext = file.split('.').pop()?.toLowerCase();
				return ['mp3', 'm4a', 'ogg', 'wav', 'aac', 'flac'].includes(ext);
			});
		} catch (error) {
			return json({ error: `Error reading source directory: ${error.message}` }, { status: 500 });
		}

		if (files.length === 0) {
			return json({
				success: true,
				migrated: 0,
				skipped: 0,
				errors: 0,
				message: 'No audio files found in source directory'
			});
		}

		let migrated = 0;
		let skipped = 0;
		let errors = 0;
		let totalSize = 0;
		const errorDetails = [];

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
						skipped++;
						continue;
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
						migrated++;
						totalSize += fileSize;
					} else {
						errors++;
						errorDetails.push(`${file}: size mismatch`);
					}
				} else {
					errors++;
					errorDetails.push(`${file}: failed to verify after copy`);
				}
			} catch (error) {
				errors++;
				errorDetails.push(`${file}: ${error.message}`);
			}
		}

		return json({
			success: true,
			migrated,
			skipped,
			errors,
			totalSize,
			totalSizeFormatted: formatBytes(totalSize),
			errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
			sourcePath,
			destPath
		});
	} catch (error) {
		console.error('Migration error:', error);
		return json({ 
			error: 'Migration failed: ' + error.message 
		}, { status: 500 });
	}
};

