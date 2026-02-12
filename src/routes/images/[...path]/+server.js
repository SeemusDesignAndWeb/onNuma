/**
 * Serve uploaded images from IMAGES_PATH (e.g., /data/images).
 */

import { readUpload, getImagesDir } from '$lib/server/volumeImageStore.js';

const MIME_TYPES = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml',
	pdf: 'application/pdf'
};

export async function GET({ params, url }) {
	const pathParam = params.path;
	const filename = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam ?? '');
	
	console.log(`[images route] GET ${url.pathname} -> filename=${filename}`);
	
	// Security: no path traversal, no subdirectories
	if (!filename || filename.includes('..') || filename.includes('/')) {
		console.log(`[images route] Rejected: invalid filename`);
		return new Response('Not Found', { status: 404 });
	}

	const buffer = await readUpload(filename);
	if (!buffer) {
		console.log(`[images route] Not found: ${filename}, dir=${getImagesDir()}`);
		return new Response('Not Found', { 
			status: 404,
			headers: { 'X-Images-Dir': getImagesDir() }
		});
	}

	const ext = filename.split('.').pop()?.toLowerCase() || '';
	const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

	console.log(`[images route] Serving: ${filename}, type=${mimeType}, size=${buffer.length}`);
	return new Response(buffer, {
		headers: {
			'Content-Type': mimeType,
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
}
