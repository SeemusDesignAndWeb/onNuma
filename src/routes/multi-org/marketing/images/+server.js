import { json } from '@sveltejs/kit';
import { getHubImages, saveHubImage } from '$lib/server/hubImagesStore.js';
import { saveUpload } from '$lib/server/volumeImageStore.js';
import { randomUUID } from 'crypto';

export async function GET({ locals }) {
	if (!locals.multiOrgAdmin) {
		return json({ error: 'Unauthorised' }, { status: 401 });
	}

	try {
		const images = await getHubImages();
		return json(images || []);
	} catch (error) {
		console.error('Marketing images GET error:', error);
		return json({ error: 'Failed to fetch images' }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	if (!locals.multiOrgAdmin) {
		return json({ error: 'Unauthorised' }, { status: 401 });
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file) return json({ error: 'No file provided' }, { status: 400 });
		if (!file.type.startsWith('image/')) {
			return json({ error: 'File must be an image' }, { status: 400 });
		}
		if (file.size > 10 * 1024 * 1024) {
			return json({ error: 'File size must be less than 10MB' }, { status: 400 });
		}

		const buffer = Buffer.from(await file.arrayBuffer());
		const { path, filename } = await saveUpload(buffer, file.name);

		const image = {
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

		await saveHubImage(image);
		return json({ success: true, image });
	} catch (error) {
		console.error('Marketing images POST error:', error);
		return json({ error: `Failed to upload image: ${error.message}` }, { status: 500 });
	}
}
