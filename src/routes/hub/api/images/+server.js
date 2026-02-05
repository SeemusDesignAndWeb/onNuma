import { json } from '@sveltejs/kit';
import { getHubImages, getHubImage, saveHubImage, deleteHubImage } from '$lib/server/hubImagesStore.js';
import { uploadImage, deleteImage as deleteCloudinaryImage } from '$lib/server/cloudinary';
import { randomUUID } from 'crypto';

/** Cloudinary folder for hub uploads (separate from admin images) */
const HUB_CLOUDINARY_FOLDER = 'egcc/hub';

/**
 * Get images from the hub image library (The HUB only – separate from admin images)
 * Stored in Postgres when DATABASE_URL is set, else JSON file. Auth is handled by The HUB hook.
 */
export async function GET({ url }) {
	try {
		const id = url.searchParams.get('id');
		if (id) {
			const image = await getHubImage(id);
			return image ? json(image) : json({ error: 'Image not found' }, { status: 404 });
		}
		const images = await getHubImages();
		return json(images);
	} catch (error) {
		console.error('Error fetching images:', error);
		return json({ error: 'Failed to fetch images' }, { status: 500 });
	}
}

/**
 * Upload image (accessible from The HUB)
 * Auth is handled by The HUB hook
 */
export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file type
		if (!file.type.startsWith('image/')) {
			return json({ error: 'File must be an image' }, { status: 400 });
		}

		// Validate file size (max 10MB)
		if (file.size > 10 * 1024 * 1024) {
			return json({ error: 'File size must be less than 10MB' }, { status: 400 });
		}

		// Convert file to buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Upload to Cloudinary in hub folder (separate from admin)
		const uploadResult = await uploadImage(buffer, file.name, {
			public_id: `${HUB_CLOUDINARY_FOLDER}/${randomUUID()}`
		});

		// Create image metadata
		const imageMetadata = {
			id: randomUUID(),
			filename: uploadResult.public_id.split('/').pop(),
			originalName: file.name,
			path: uploadResult.secure_url,
			cloudinaryPublicId: uploadResult.public_id,
			size: file.size,
			mimeType: file.type,
			width: uploadResult.width,
			height: uploadResult.height,
			uploadedAt: new Date().toISOString()
		};

		await saveHubImage(imageMetadata);

		return json({ success: true, image: imageMetadata });
	} catch (error) {
		console.error('Image upload error:', error);
		return json({ error: 'Failed to upload image: ' + error.message }, { status: 500 });
	}
}

/**
 * Delete image (accessible from The HUB)
 * Auth is handled by The HUB hook
 */
export async function DELETE({ url }) {
	const id = url.searchParams.get('id');

	if (!id) {
		return json({ error: 'ID required' }, { status: 400 });
	}

	try {
		const image = await getHubImage(id);
		if (!image) {
			return json({ error: 'Image not found' }, { status: 404 });
		}

		if (image.cloudinaryPublicId) {
			try {
				await deleteCloudinaryImage(image.cloudinaryPublicId);
			} catch (cloudinaryError) {
				console.error('Failed to delete from Cloudinary:', cloudinaryError);
			}
		}

		await deleteHubImage(id);

		return json({ success: true });
	} catch (error) {
		console.error('Image delete error:', error);
		return json({ error: 'Failed to delete image' }, { status: 500 });
	}
}

