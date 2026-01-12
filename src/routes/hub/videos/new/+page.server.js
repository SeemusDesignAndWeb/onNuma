import { fail, redirect } from '@sveltejs/kit';
import { create } from '$lib/crm/server/fileStore.js';
import { getCsrfToken, verifyCsrfToken, getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';

export async function load({ cookies }) {
	const currentAdmin = await getAdminFromCookies(cookies);
	if (!currentAdmin) {
		throw redirect(302, '/hub/auth/login');
	}

	// Only super admins can access video management
	if (!isSuperAdmin(currentAdmin)) {
		throw redirect(302, '/hub?error=access_denied');
	}

	const csrfToken = getCsrfToken(cookies) || '';
	return { csrfToken };
}

export const actions = {
	create: async ({ request, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		// Check super admin permission
		const currentAdmin = await getAdminFromCookies(cookies);
		if (!currentAdmin || !isSuperAdmin(currentAdmin)) {
			return fail(403, { error: 'Unauthorized: Super admin access required' });
		}

		const title = (data.get('title') || '').toString();
		
		const videoData = {
			title: title,
			description: data.get('description') || '',
			embedCode: data.get('embedCode') || ''
		};

		// Basic validation
		if (!videoData.title.trim()) {
			return fail(400, { error: 'Title is required' });
		}
		if (!videoData.embedCode.trim()) {
			return fail(400, { error: 'Embed code is required' });
		}

		try {
			const video = await create('loom_videos', videoData);
			throw redirect(302, `/hub/videos/${video.id}?created=true`);
		} catch (error) {
			if (error?.status === 302 || error?.status === 301 || (error?.status >= 300 && error?.status < 400)) {
				throw error;
			}
			if (error?.location) {
				throw error;
			}
			console.error('Error creating video:', error);
			return fail(400, { error: error.message || 'Failed to create video' });
		}
	}
};
