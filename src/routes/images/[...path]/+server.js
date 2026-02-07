/**
 * Serve uploaded images from volume (production) or static/images (local).
 * Local: baseDir = static/images. Production: baseDir = IMAGES_PATH or /images.
 */

import { readImageFile, resolveImagePath } from '$lib/server/volumeImageStore.js';
import { existsSync } from 'fs';

const MIME_TYPES = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	png: 'image/png',
	gif: 'image/gif',
	webp: 'image/webp',
	svg: 'image/svg+xml'
};

export async function GET({ params }) {
	const path = params.path;
	if (!path || path.includes('..')) {
		return new Response('Not Found', { status: 404 });
	}

	const storedPath = `/images/${path}`;
	const filePath = resolveImagePath(storedPath);
	if (!filePath || !existsSync(filePath)) {
		return new Response('Not Found', { status: 404 });
	}

	const buffer = await readImageFile(storedPath);
	if (!buffer) {
		return new Response('Not Found', { status: 404 });
	}

	const ext = path.split('.').pop()?.toLowerCase() || '';
	const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

	return new Response(buffer, {
		headers: {
			'Content-Type': mimeType,
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
}
