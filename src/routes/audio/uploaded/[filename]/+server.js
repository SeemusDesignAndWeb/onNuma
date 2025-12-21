import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Determine upload directory (same logic as in api/audio/+server.js)
// Use Railway volume path for persistence
// Default to /data/audio/uploaded (Railway volume) or ./data/audio/uploaded (local dev)
// Can be overridden with AUDIO_UPLOAD_DIR environment variable
const UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || '/data/audio/uploaded';

function getAudioPath(filename) {
	let uploadPath;
	if (UPLOAD_DIR.startsWith('./') || UPLOAD_DIR.startsWith('../')) {
		// Relative path - resolve from project root (local development)
		uploadPath = join(process.cwd(), UPLOAD_DIR);
	} else {
		// Absolute path (e.g., /data/audio/uploaded for Railway volume)
		uploadPath = UPLOAD_DIR;
	}
	return join(uploadPath, filename);
}

export const GET = async ({ params, request }) => {
	try {
		const filename = params.filename;
		
		// Security: prevent directory traversal
		if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
			return new Response('Invalid filename', { status: 400 });
		}

		const filePath = getAudioPath(filename);

		// Check if file exists
		if (!existsSync(filePath)) {
			return new Response('Audio file not found', { status: 404 });
		}

		// Read the file
		const fileBuffer = readFileSync(filePath);
		const fileSize = fileBuffer.length;

		// Determine content type based on file extension
		const ext = filename.split('.').pop()?.toLowerCase();
		let contentType = 'audio/mpeg'; // default to mp3
		if (ext === 'mp3') {
			contentType = 'audio/mpeg';
		} else if (ext === 'm4a') {
			contentType = 'audio/mp4';
		} else if (ext === 'ogg') {
			contentType = 'audio/ogg';
		} else if (ext === 'wav') {
			contentType = 'audio/wav';
		}

		// Handle range requests for audio streaming
		const rangeHeader = request.headers.get('range');
		if (rangeHeader) {
			const parts = rangeHeader.replace(/bytes=/, '').split('-');
			const start = parseInt(parts[0], 10);
			const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
			const chunkSize = (end - start) + 1;
			const chunk = fileBuffer.slice(start, end + 1);

			return new Response(chunk, {
				status: 206, // Partial Content
				headers: {
					'Content-Type': contentType,
					'Content-Length': chunkSize.toString(),
					'Content-Range': `bytes ${start}-${end}/${fileSize}`,
					'Accept-Ranges': 'bytes',
					'Cache-Control': 'public, max-age=31536000, immutable'
				}
			});
		}

		// Return the full file
		return new Response(fileBuffer, {
			headers: {
				'Content-Type': contentType,
				'Content-Length': fileSize.toString(),
				'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
				'Accept-Ranges': 'bytes' // Support range requests for audio streaming
			}
		});
	} catch (error) {
		console.error('Error serving audio file:', error);
		return new Response('Error serving audio file', { status: 500 });
	}
};

