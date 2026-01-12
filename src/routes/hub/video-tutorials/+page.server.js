import { readCollection } from '$lib/crm/server/fileStore.js';

export async function load({ locals }) {
	try {
		const videos = await readCollection('loom_videos');
		// Sort videos alphabetically by title
		const sortedVideos = videos.sort((a, b) => {
			const titleA = (a.title || '').toLowerCase();
			const titleB = (b.title || '').toLowerCase();
			return titleA.localeCompare(titleB);
		});
		return { 
			videos: sortedVideos,
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
