// Loom Video Tutorials
// Videos are now stored in the database (loom_videos collection)
// Manage videos via /hub/videos in the admin area
// 
// Note: This file contains only client-side helper functions.
// Videos are loaded server-side and passed via page data.

// Helper function to get videos by category
export function getVideosByCategory(videos, category) {
	return videos.filter(video => video.category === category);
}

// Helper function to get all unique categories
export function getCategories(videos) {
	const categories = [...new Set(videos.map(video => video.category).filter(Boolean))];
	return categories;
}
