/**
 * Image storage: local dev = static/images/uploads, production = volume at /images (or IMAGES_PATH).
 * Replaces Cloudinary for faster loads and simpler setup.
 */

import { join } from 'path';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { env } from '$env/dynamic/private';

const UPLOADS_SUBDIR = 'uploads';

/** Path we return for img src (must match how the GET /images/[...path] route resolves). */
export function getUploadPath(filename) {
	return `/images/${UPLOADS_SUBDIR}/${filename}`;
}

/**
 * Base directory for uploaded images.
 * - Local (no IMAGES_PATH): static/images → uploads go to static/images/uploads, served at /images/uploads/...
 * - Production (volume at /data): set IMAGES_PATH=/data/images so uploads go to /data/images/uploads/.
 *   GET /images/* is served by src/routes/images/[...path]/+server.js from this base dir.
 */
export function getImagesBaseDir() {
	const path = env.IMAGES_PATH?.trim();
	if (path) {
		return path.startsWith('/') ? path : join(process.cwd(), path);
	}
	return join(process.cwd(), 'static', 'images');
}

/**
 * Whether we're using the volume (production). When true, /images/* must be served by a route.
 */
export function isVolumeMode() {
	return !!env.IMAGES_PATH?.trim();
}

/**
 * Subfolder for uploads (uploads). Full path = baseDir/uploads.
 */
function getUploadsDir() {
	return join(getImagesBaseDir(), UPLOADS_SUBDIR);
}

/**
 * Get safe filename: unique prefix + original name (sanitized).
 */
function safeFilename(originalName) {
	const ext = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : 'jpg';
	const base = (originalName.replace(/\.[^.]+$/, '') || 'image').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 80);
	return `${randomUUID().slice(0, 8)}_${base}.${ext}`;
}

/**
 * Save uploaded image to disk. Returns path for use in img src (e.g. /images/uploads/xyz.jpg).
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} [mimeType]
 * @returns {Promise<{ path: string, filename: string }>}
 */
export async function saveUploadedImage(buffer, originalName, mimeType = 'image/jpeg') {
	const dir = getUploadsDir();
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	const filename = safeFilename(originalName);
	const filePath = join(dir, filename);
	await writeFile(filePath, buffer);

	const path = getUploadPath(filename);
	// Verify the same path the GET handler will use actually exists (same base dir)
	const resolved = resolveImagePath(path);
	if (!resolved || !existsSync(resolved)) {
		throw new Error(
			`Upload wrote to ${filePath} but cannot be resolved for serving (base: ${getImagesBaseDir()}). Check IMAGES_PATH.`
		);
	}
	return { path, filename };
}

/**
 * Delete image file by path (e.g. /images/uploads/xyz.jpg).
 * @param {string} path - Stored path like /images/uploads/xyz.jpg
 * @returns {Promise<boolean>}
 */
export async function deleteUploadedImage(path) {
	if (!path || !path.startsWith(`/images/${UPLOADS_SUBDIR}/`)) return false;
	const filename = path.replace(`/images/${UPLOADS_SUBDIR}/`, '').replace(/^\/+/, '');
	if (!filename || filename.includes('..')) return false;
	const filePath = join(getUploadsDir(), filename);
	if (!existsSync(filePath)) return true;
	await unlink(filePath);
	return true;
}

/**
 * Resolve full filesystem path from stored path (for serving from volume).
 * @param {string} path - Stored path like /images/uploads/xyz.jpg
 * @returns {string|null}
 */
export function resolveImagePath(path) {
	if (!path || !path.startsWith('/images/')) return null;
	const relative = path.replace(/^\/images\/?/, '').replace(/^\/+/, '');
	if (!relative || relative.includes('..')) return null;
	return join(getImagesBaseDir(), relative);
}

/**
 * Read image file buffer (for serving from volume). Returns null if not found.
 * @param {string} path - Stored path like /images/uploads/xyz.jpg
 * @returns {Promise<Buffer|null>}
 */
export async function readImageFile(path) {
	const filePath = resolveImagePath(path);
	if (!filePath || !existsSync(filePath)) return null;
	try {
		return await readFile(filePath);
	} catch {
		return null;
	}
}
