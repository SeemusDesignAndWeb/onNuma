import { redirect } from '@sveltejs/kit';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';

const ITEMS_PER_PAGE = 20;

export async function load({ url, cookies }) {
	const currentAdmin = await getAdminFromCookies(cookies);
	if (!currentAdmin) {
		throw redirect(302, '/hub/auth/login');
	}

	// Only super admins can access video management
	if (!isSuperAdmin(currentAdmin)) {
		throw redirect(302, '/hub?error=access_denied');
	}

	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';

	const videos = await readCollection('loom_videos');
	
	// Sort videos alphabetically by title
	const sortedVideos = videos.sort((a, b) => {
		const titleA = (a.title || '').toLowerCase();
		const titleB = (b.title || '').toLowerCase();
		return titleA.localeCompare(titleB);
	});
	
	let filtered = sortedVideos;
	if (search) {
		const searchLower = search.toLowerCase();
		filtered = sortedVideos.filter(v => 
			v.title?.toLowerCase().includes(searchLower) ||
			v.description?.toLowerCase().includes(searchLower)
		);
	}

	const total = filtered.length;
	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const paginated = filtered.slice(start, end);

	return {
		videos: paginated,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		search
	};
}
