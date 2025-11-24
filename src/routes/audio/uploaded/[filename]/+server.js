import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { error } from '@sveltejs/kit';

// Determine upload directory (same logic as upload endpoint)
const UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || (process.env.NODE_ENV === 'production' ? '/data/audio/uploaded' : 'static/audio/uploaded');

function getUploadPath() {
	if (UPLOAD_DIR.startsWith('./') || UPLOAD_DIR.startsWith('../')) {
		return join(process.cwd(), UPLOAD_DIR);
	}
	return UPLOAD_DIR;
}

export async function GET({ params }) {
	const filename = params.filename;
	
	if (!filename) {
		throw error(400, 'Filename required');
	}
	
	// Security: prevent directory traversal
	if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
		throw error(400, 'Invalid filename');
	}
	
	const uploadPath = getUploadPath();
	const filePath = join(uploadPath, filename);
	
	if (!existsSync(filePath)) {
		throw error(404, 'Audio file not found');
	}
	
	try {
		const fileBuffer = readFileSync(filePath);
		
		// Determine content type based on file extension
		const ext = filename.split('.').pop()?.toLowerCase();
		const contentType = ext === 'mp3' ? 'audio/mpeg' : 
		                   ext === 'm4a' ? 'audio/mp4' :
		                   ext === 'wav' ? 'audio/wav' :
		                   'audio/mpeg';
		
		return new Response(fileBuffer, {
			headers: {
				'Content-Type': contentType,
				'Content-Length': fileBuffer.length.toString(),
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		});
	} catch (err) {
		console.error('Error serving audio file:', err);
		throw error(500, 'Failed to serve audio file');
	}
}

