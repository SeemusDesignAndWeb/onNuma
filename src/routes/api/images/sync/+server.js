import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';

/**
 * Cloudinary sync removed: images are stored in volume/static/images.
 * Stub returns empty list so any legacy UI doesn't break.
 */
export async function GET({ cookies }) {
	requireAuth({ cookies });
	return json({ success: true, images: [] });
}

export async function POST({ cookies }) {
	requireAuth({ cookies });
	return json({
		success: true,
		message: 'Images are now stored in /images (volume or static/images). Cloudinary sync is disabled.',
		added: 0,
		updated: 0,
		total: 0
	});
}
