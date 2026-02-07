import { json } from '@sveltejs/kit';

/**
 * Cloudinary sync removed: images are stored in volume/static/images.
 * Stub returns empty list so any legacy UI doesn't break.
 */
export async function GET() {
	return json({ success: true, images: [] });
}

export async function POST() {
	return json({
		success: true,
		message: 'Images are now stored in /images (volume or static/images). Cloudinary sync is disabled.',
		added: 0,
		updated: 0,
		total: 0
	});
}
