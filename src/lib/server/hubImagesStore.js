/**
 * Hub images store: Postgres when DATABASE_URL is set, otherwise JSON file (database.js).
 * Uses the CRM crm_records table with collection 'hub_images' when using Postgres.
 */

import { env } from '$env/dynamic/private';
import * as dbStore from '$lib/crm/server/dbStore.js';
import {
	getHubImages as getHubImagesFile,
	getHubImage as getHubImageFile,
	saveHubImage as saveHubImageFile,
	deleteHubImage as deleteHubImageFile
} from '$lib/server/database.js';

const HUB_IMAGES_COLLECTION = 'hub_images';

function usePostgres() {
	const url = env.DATABASE_URL?.trim();
	return !!url && !url.includes('base');
}

/**
 * @returns {Promise<Array<{ id: string, filename: string, originalName: string, path: string, size: number, mimeType: string, width?: number, height?: number, uploadedAt: string }>>}
 */
export async function getHubImages() {
	if (usePostgres()) {
		return dbStore.readCollection(HUB_IMAGES_COLLECTION);
	}
	return Promise.resolve(getHubImagesFile());
}

/**
 * @param {string} id
 * @returns {Promise<{ id: string, filename: string, path: string, ... } | null>}
 */
export async function getHubImage(id) {
	if (usePostgres()) {
		return dbStore.findById(HUB_IMAGES_COLLECTION, id);
	}
	return Promise.resolve(getHubImageFile(id) ?? null);
}

/**
 * @param {{ id: string, filename: string, originalName: string, path: string, size: number, mimeType: string, width?: number, height?: number, uploadedAt: string }} image
 */
export async function saveHubImage(image) {
	if (usePostgres()) {
		const existing = await dbStore.findById(HUB_IMAGES_COLLECTION, image.id);
		if (existing) {
			await dbStore.update(HUB_IMAGES_COLLECTION, image.id, image);
		} else {
			await dbStore.create(HUB_IMAGES_COLLECTION, image);
		}
		return;
	}
	saveHubImageFile(image);
}

/**
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteHubImage(id) {
	if (usePostgres()) {
		return dbStore.remove(HUB_IMAGES_COLLECTION, id);
	}
	deleteHubImageFile(id);
	return Promise.resolve(true);
}
