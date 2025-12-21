import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Destination directory (Railway volume or configured path)
const UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || '/data/audio/uploaded';

// Ensure upload directory exists
function ensureUploadDir() {
	let uploadPath;
	if (UPLOAD_DIR.startsWith('./') || UPLOAD_DIR.startsWith('../')) {
		// Relative path - resolve from project root (local development)
		uploadPath = join(process.cwd(), UPLOAD_DIR);
	} else {
		// Absolute path (e.g., /data/audio/uploaded for Railway volume)
		uploadPath = UPLOAD_DIR;
	}
	
	// Create directory if it doesn't exist
	if (!existsSync(uploadPath)) {
		try {
			mkdirSync(uploadPath, { recursive: true });
		} catch (error) {
			// Directory might already exist, or volume might not be mounted yet (during build)
			console.warn('[Audio] Could not create upload directory:', error.message);
		}
	}
	return uploadPath;
}

function formatBytes(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export const POST = async ({ request, cookies }) => {
	requireAuth({ cookies });

	try {
		const formData = await request.formData();
		const files = formData.getAll('files');

		if (!files || files.length === 0) {
			return json({ error: 'No files provided' }, { status: 400 });
		}

		// Validate all files first
		for (const file of files) {
			if (!(file instanceof File)) {
				return json({ error: 'Invalid file provided' }, { status: 400 });
			}

			// Validate file type
			if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3') && !file.name.endsWith('.m4a') && !file.name.endsWith('.ogg') && !file.name.endsWith('.wav')) {
				return json({ error: `File ${file.name} must be an audio file (MP3, M4A, OGG, WAV)` }, { status: 400 });
			}

			// Validate file size (max 100MB for audio)
			if (file.size > 100 * 1024 * 1024) {
				return json({ error: `File ${file.name} is too large (max 100MB)` }, { status: 400 });
			}
		}

		const uploadPath = ensureUploadDir();
		const results = [];
		let totalSize = 0;
		const errors = [];

		// Process each file
		for (const file of files) {
			try {
				// Generate unique filename
				const fileExt = file.name.split('.').pop() || 'mp3';
				const filename = `${randomUUID()}.${fileExt}`;
				const filePath = join(uploadPath, filename);

				// Save file
				const arrayBuffer = await file.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);
				writeFileSync(filePath, buffer);

				const audioUrl = `/audio/uploaded/${filename}`;

				results.push({
					success: true,
					filename,
					originalName: file.name,
					audioUrl,
					size: file.size,
					sizeFormatted: formatBytes(file.size)
				});

				totalSize += file.size;
			} catch (error) {
				errors.push({
					filename: file.name,
					error: error.message
				});
			}
		}

		return json({
			success: true,
			uploaded: results.length,
			failed: errors.length,
			totalSize,
			totalSizeFormatted: formatBytes(totalSize),
			files: results,
			errors: errors.length > 0 ? errors : undefined
		});
	} catch (error) {
		console.error('Bulk upload error:', error);
		return json({ 
			error: 'Failed to upload files: ' + error.message 
		}, { status: 500 });
	}
};

