import { error } from '@sveltejs/kit';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getDataDir } from '$lib/crm/server/fileStore.js';

/**
 * Serve/download PDF help files
 * Public endpoint - no auth required (help files are meant to be downloadable)
 */
export async function GET({ params }) {
	try {
		const filename = params.filename;
		
		// Security: prevent directory traversal
		if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			throw error(400, 'Invalid filename');
		}

		// Only allow PDF files
		if (!filename.toLowerCase().endsWith('.pdf')) {
			throw error(400, 'Invalid file type');
		}

		const DATA_DIR = getDataDir();
		const filePath = join(DATA_DIR, 'uploads', 'rota-help-files', filename);

		// Check if file exists
		if (!existsSync(filePath)) {
			throw error(404, 'File not found');
		}

		// Read the file
		const fileBuffer = readFileSync(filePath);

		// Return the file with appropriate headers
		return new Response(fileBuffer, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Length': fileBuffer.length.toString(),
				'Content-Disposition': `inline; filename="${filename}"`,
				'Cache-Control': 'public, max-age=31536000, immutable' // Cache for 1 year
			}
		});
	} catch (err) {
		console.error('Error serving help file:', err);
		if (err.status) {
			throw err;
		}
		throw error(500, 'Error serving file');
	}
}
