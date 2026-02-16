import { fail, redirect, isRedirect } from '@sveltejs/kit';
import {
	authenticateMultiOrgAdmin,
	createMultiOrgSession,
	setMultiOrgSessionCookie,
	getMultiOrgCsrfToken,
	verifyMultiOrgCsrfToken
} from '$lib/crm/server/multiOrgAuth.js';

export async function load({ cookies, url }) {
	const csrfToken = getMultiOrgCsrfToken(cookies) || '';
	const resetSuccess = url.searchParams.get('reset') === 'success';
	return { csrfToken, resetSuccess };
}

export const actions = {
	login: async ({ request, cookies, locals }) => {
		try {
			const data = await request.formData();
			const email = data.get('email');
			const password = data.get('password');
			const csrfToken = data.get('_csrf');

			if (!csrfToken || !verifyMultiOrgCsrfToken(cookies, csrfToken)) {
				return fail(200, { error: 'CSRF token validation failed' });
			}

			if (!email || !password) {
				return fail(200, { error: 'Email and password are required' });
			}

			let admin;
			try {
				admin = await authenticateMultiOrgAdmin(email.toString(), password.toString());
			} catch (err) {
				console.error('[multi-org login] authenticateMultiOrgAdmin failed:', err?.message || err);
				return fail(500, { error: 'Login temporarily unavailable. Please try again.' });
			}
			if (!admin) {
				return fail(200, { error: 'Invalid email or password' });
			}

			let session;
			try {
				session = await createMultiOrgSession(admin.id);
			} catch (err) {
				console.error('[multi-org login] createMultiOrgSession failed:', err?.message || err);
				return fail(500, { error: 'Could not create session. Please try again.' });
			}
			setMultiOrgSessionCookie(
				cookies,
				session.id,
				process.env.NODE_ENV === 'production',
				!!locals.multiOrgAdminDomain
			);

			// Use canonical path so we always get multi-org layout (avoid cached /organisations)
			throw redirect(302, '/multi-org/organisations');
		} catch (err) {
			if (isRedirect(err)) throw err;
			console.error('[multi-org login] unexpected error:', err?.message || err);
			return fail(500, { error: 'Something went wrong. Please try again.' });
		}
	}
};
