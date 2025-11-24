import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { error } from '@sveltejs/kit';

// Determine upload directory (same logic as upload endpoint)
// Check if running on Railway by checking if DATABASE_PATH uses /data
// (Railway volumes are mounted at /data, and database is at /data/database.json)
const DB_PATH = process.env.DATABASE_PATH || './data/database.json';
const isRailway = DB_PATH.startsWith('/data') || process.env.DATABASE_PATH?.startsWith('/data');
const UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || (isRailway ? '/data/audio/uploaded' : 'static/audio/uploaded');

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
	let filePath = join(uploadPath, filename);
	
	// If file doesn't exist in primary location, check static directory as fallback
	// (for files that were uploaded before Railway volume was configured)
	if (!existsSync(filePath)) {
		const staticPath = join(process.cwd(), 'static/audio/uploaded', filename);
		if (existsSync(staticPath)) {
			filePath = staticPath;
		} else {
			throw error(404, 'Audio file not found');
		}
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

