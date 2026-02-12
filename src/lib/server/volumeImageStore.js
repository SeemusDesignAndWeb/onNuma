/**
 * Image uploads: files stored on disk, served via /uploads/[...path] route.
 * 
 * Local dev: static/uploads (Vite serves automatically)
 * Production: UPLOADS_PATH env var (e.g., /data/uploads)
 */

import { join } from 'path';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { env } from '$env/dynamic/private';

/**
 * Base directory for uploads.
 * - Local: static/uploads (served by Vite dev server)
 * - Production: UPLOADS_PATH (e.g., /data/uploads), served by /uploads/[...path] route
 */
export function getUploadsDir() {
	const path = env.UPLOADS_PATH?.trim();
	if (path) {
		return path.startsWith('/') ? path : join(process.cwd(), path);
	}
	return join(process.cwd(), 'static', 'uploads');
}

/**
 * Whether we need the dynamic route to serve uploads (production with volume).
 */
export function isVolumeMode() {
	return !!env.UPLOADS_PATH?.trim();
}

/**
 * Generate safe filename with unique prefix.
 */
function safeFilename(originalName) {
	const ext = originalName.includes('.') ? originalName.split('.').pop().toLowerCase() : 'jpg';
	const base = (originalName.replace(/\.[^.]+$/, '') || 'image')
		.replace(/[^a-zA-Z0-9-_]/g, '_')
		.slice(0, 80);
	return `${randomUUID().slice(0, 8)}_${base}.${ext}`;
}

/**
 * Save uploaded file to disk.
 * @returns {{ path: string, filename: string }} - path is the URL path for img src
 */
export async function saveUpload(buffer, originalName) {
	const dir = getUploadsDir();
	
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	
	const filename = safeFilename(originalName);
	const filePath = join(dir, filename);
	
	await writeFile(filePath, buffer);
	
	// Verify file was written
	if (!existsSync(filePath)) {
		throw new Error(`Failed to write file: ${filePath}`);
	}
	
	return { 
		path: `/uploads/${filename}`,
		filename 
	};
}

/**
 * Delete uploaded file.
 * @param {string} urlPath - URL path like /uploads/xyz.jpg
 */
export async function deleteUpload(urlPath) {
	if (!urlPath?.startsWith('/uploads/')) return false;
	
	const filename = urlPath.replace('/uploads/', '').replace(/^\/+/, '');
	if (!filename || filename.includes('..') || filename.includes('/')) return false;
	
	const filePath = join(getUploadsDir(), filename);
	if (!existsSync(filePath)) return true;
	
	await unlink(filePath);
	return true;
}

/**
 * Read uploaded file (for serving via route in production).
 * @param {string} urlPath - URL path like /uploads/xyz.jpg
 */
export async function readUpload(urlPath) {
	if (!urlPath?.startsWith('/uploads/')) return null;
	
	const filename = urlPath.replace('/uploads/', '').replace(/^\/+/, '');
	if (!filename || filename.includes('..') || filename.includes('/')) return null;
	
	const filePath = join(getUploadsDir(), filename);
	if (!existsSync(filePath)) return null;
	
	try {
		return await readFile(filePath);
	} catch {
		return null;
	}
}

/**
 * Resolve URL path to filesystem path (for checking existence).
 * @param {string} urlPath - URL path like /uploads/xyz.jpg
 */
export function resolveUploadPath(urlPath) {
	if (!urlPath?.startsWith('/uploads/')) return null;
	
	const filename = urlPath.replace('/uploads/', '').replace(/^\/+/, '');
	if (!filename || filename.includes('..') || filename.includes('/')) return null;
	
	return join(getUploadsDir(), filename);
}
