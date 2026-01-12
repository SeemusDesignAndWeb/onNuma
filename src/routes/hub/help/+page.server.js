import { readCollection } from '$lib/crm/server/fileStore.js';

export async function load({ locals }) {
	try {
		const videos = await readCollection('loom_videos');
		return { 
			videos,
			admin: locals.admin || null
		};
	} catch (error) {
		console.error('Error loading loom videos:', error);
		return { 
			videos: [],
			admin: locals.admin || null
		};
	}
}
