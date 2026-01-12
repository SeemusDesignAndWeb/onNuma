import { fail, redirect } from '@sveltejs/kit';
import { create } from '$lib/crm/server/fileStore.js';
import { validateList } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange } from '$lib/crm/server/audit.js';

export async function load({ cookies }) {
	const csrfToken = getCsrfToken(cookies) || '';
	return { csrfToken };
}

export const actions = {
	create: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const listData = {
			name: data.get('name'),
			description: data.get('description'),
			contactIds: []
		};

		try {
			const validated = validateList(listData);
			const list = await create('lists', validated);

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'create', 'list', list.id, {
				name: list.name
			}, event);

			// Redirect after successful creation - don't wrap in try-catch
			throw redirect(302, `/hub/lists/${list.id}?created=true`);
		} catch (error) {
			// Don't treat redirects as errors - check for redirect status code
			if (error?.status === 302 || error?.status === 301 || (error?.status >= 300 && error?.status < 400)) {
				throw error; // Re-throw redirects
			}
			// Also check if it's a redirect by looking for location header
			if (error?.location) {
				throw error;
			}
			console.error('Error creating list:', error);
			return fail(400, { error: error.message || 'Failed to create list' });
		}
	}
};

