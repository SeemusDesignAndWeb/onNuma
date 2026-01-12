import { redirect } from '@sveltejs/kit';
import { findById, update, remove } from '$lib/crm/server/fileStore.js';
import { getCsrfToken, verifyCsrfToken, getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';

export async function load({ params, cookies }) {
	const currentAdmin = await getAdminFromCookies(cookies);
	if (!currentAdmin) {
		throw redirect(302, '/hub/auth/login');
	}

	// Only super admins can access video management
	if (!isSuperAdmin(currentAdmin)) {
		throw redirect(302, '/hub?error=access_denied');
	}

	const video = await findById('loom_videos', params.id);
	if (!video) {
		throw redirect(302, '/hub/videos');
	}

	const csrfToken = getCsrfToken(cookies) || '';
	return { video, csrfToken };
}

export const actions = {
	update: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		// Check super admin permission
		const currentAdmin = await getAdminFromCookies(cookies);
		if (!currentAdmin || !isSuperAdmin(currentAdmin)) {
			return { error: 'Unauthorized: Super admin access required' };
		}

		try {
			const title = (data.get('title') || '').toString();
			
			const videoData = {
				title: title,
				description: data.get('description') || '',
				embedCode: data.get('embedCode') || ''
			};

			// Basic validation
			if (!videoData.title.trim()) {
				return { error: 'Title is required' };
			}
			if (!videoData.embedCode.trim()) {
				return { error: 'Embed code is required' };
			}

			await update('loom_videos', params.id, videoData);

			return { success: true };
		} catch (error) {
			return { error: error.message };
		}
	},

	delete: async ({ params, cookies, request }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		// Check super admin permission
		const currentAdmin = await getAdminFromCookies(cookies);
		if (!currentAdmin || !isSuperAdmin(currentAdmin)) {
			return { error: 'Unauthorized: Super admin access required' };
		}

		await remove('loom_videos', params.id);
		throw redirect(302, '/hub/videos');
	}
};
