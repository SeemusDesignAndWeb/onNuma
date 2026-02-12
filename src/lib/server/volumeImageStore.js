/**
 * Image uploads: files stored on disk, served via /images/[...path] route.
 * 
 * Local dev: IMAGES_PATH not set, uses process.cwd()/data/images
 * Production: IMAGES_PATH=/data/images
 */

import { join } from 'path';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { env } from '$env/dynamic/private';

/**
 * Base directory for images.
 * Production: IMAGES_PATH (e.g., /data/images)
 * Local: ./data/images
 */
export function getImagesDir() {
	const path = env.IMAGES_PATH?.trim();
	if (path) {
		return path.startsWith('/') ? path : join(process.cwd(), path);
	}
	return join(process.cwd(), 'data', 'images');
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
	const dir = getImagesDir();
	
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true });
	}
	
	const filename = safeFilename(originalName);
	const filePath = join(dir, filename);
	
	await writeFile(filePath, buffer);
	
	if (!existsSync(filePath)) {
		throw new Error(`Failed to write file: ${filePath}`);
	}
	
	return { 
		path: `/images/${filename}`,
		filename 
	};
}

/**
 * Delete uploaded file.
 * @param {string} urlPath - URL path like /images/xyz.jpg
 */
export async function deleteUpload(urlPath) {
	if (!urlPath?.startsWith('/images/')) return false;
	
	const filename = urlPath.replace('/images/', '').replace(/^\/+/, '');
	if (!filename || filename.includes('..') || filename.includes('/')) return false;
	
	const filePath = join(getImagesDir(), filename);
	if (!existsSync(filePath)) return true;
	
	await unlink(filePath);
	return true;
}

/**
 * Read uploaded file (for serving via route).
 * @param {string} filename - Just the filename, not the full path
 */
export async function readUpload(filename) {
	if (!filename || filename.includes('..') || filename.includes('/')) return null;
	
	const filePath = join(getImagesDir(), filename);
	if (!existsSync(filePath)) return null;
	
	try {
		return await readFile(filePath);
	} catch {
		return null;
	}
}
