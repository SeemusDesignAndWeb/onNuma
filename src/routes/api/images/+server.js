import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { getImages, saveImage, deleteImage } from '$lib/server/database';
import { saveUpload, deleteUpload } from '$lib/server/volumeImageStore.js';
import { randomUUID } from 'crypto';

/**
 * Admin image library.
 */
export const GET = async ({ url, cookies }) => {
	requireAuth({ cookies });

	const id = url.searchParams.get('id');

	try {
		if (id) {
			const image = getImages().find((img) => img.id === id);
			return image ? json(image) : json({ error: 'Image not found' }, { status: 404 });
		}
		return json(getImages());
	} catch (error) {
		return json({ error: 'Failed to fetch images' }, { status: 500 });
	}
};

export const POST = async ({ request, cookies }) => {
	requireAuth({ cookies });

	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		if (!file.type.startsWith('image/')) {
			return json({ error: 'File must be an image' }, { status: 400 });
		}

		if (file.size > 10 * 1024 * 1024) {
			return json({ error: 'File size must be less than 10MB' }, { status: 400 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		const { path, filename } = await saveUpload(buffer, file.name);

		const imageMetadata = {
			id: randomUUID(),
			filename,
			originalName: file.name,
			path,
			size: file.size,
			mimeType: file.type,
			width: undefined,
			height: undefined,
			uploadedAt: new Date().toISOString()
		};

		saveImage(imageMetadata);

		return json({ success: true, image: imageMetadata });
	} catch (error) {
		console.error('Image upload error:', error);
		return json({ error: 'Failed to upload image: ' + error.message }, { status: 500 });
	}
};

export const DELETE = async ({ url, cookies }) => {
	requireAuth({ cookies });

	const id = url.searchParams.get('id');

	if (!id) {
		return json({ error: 'ID required' }, { status: 400 });
	}

	try {
		const image = getImages().find((img) => img.id === id);
		if (!image) {
			return json({ error: 'Image not found' }, { status: 404 });
		}

		if (image.path) {
			await deleteUpload(image.path);
		}

		deleteImage(id);

		return json({ success: true });
	} catch (error) {
		console.error('Image delete error:', error);
		return json({ error: 'Failed to delete image' }, { status: 500 });
	}
};
