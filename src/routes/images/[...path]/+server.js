/**
 * Serve uploaded images from volume (production) or static/images (local).
 * Local: baseDir = static/images. Production: baseDir = IMAGES_PATH (e.g. /data/images).
 * Base dir must match where replace-cloudinary-with-volume.js writes (same IMAGES_PATH / process.cwd()).
 */

import { readImageFile, resolveImagePath, getImagesBaseDir } from '$lib/server/volumeImageStore.js';
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
	// [...path] can be string "uploads/file.png" or in some setups an array
	const pathParam = params.path;
	const path = Array.isArray(pathParam) ? pathParam.join('/') : (pathParam ?? '');
	if (!path || path.includes('..')) {
		return new Response('Not Found', { status: 404 });
	}

	const storedPath = `/images/${path}`;
	const filePath = resolveImagePath(storedPath);
	if (!filePath || !existsSync(filePath)) {
		const headers = new Headers();
		// Dev only: show where we looked when image is missing
		if (import.meta.env.DEV && filePath) {
			headers.set('X-Image-Resolved-Path', filePath);
			headers.set('X-Images-Base-Dir', getImagesBaseDir());
		}
		return new Response('Not Found', { status: 404, headers });
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
