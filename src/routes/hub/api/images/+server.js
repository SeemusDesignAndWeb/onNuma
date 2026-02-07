import { json } from '@sveltejs/kit';
import { getHubImages, getHubImage, saveHubImage, deleteHubImage } from '$lib/server/hubImagesStore.js';
import { saveUploadedImage, deleteUploadedImage } from '$lib/server/volumeImageStore.js';
import { randomUUID } from 'crypto';

/**
 * Hub image library: uploads go to volume (production) or static/images/uploads (local).
 * Auth is handled by The HUB hook.
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

export async function POST({ request }) {
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

		const { path, filename } = await saveUploadedImage(buffer, file.name, file.type);

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

		await saveHubImage(imageMetadata);

		return json({ success: true, image: imageMetadata });
	} catch (error) {
		console.error('Image upload error:', error);
		return json({ error: 'Failed to upload image: ' + error.message }, { status: 500 });
	}
}

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

		if (image.path) {
			await deleteUploadedImage(image.path);
		}

		await deleteHubImage(id);

		return json({ success: true });
	} catch (error) {
		console.error('Image delete error:', error);
		return json({ error: 'Failed to delete image' }, { status: 500 });
	}
}
