import { fail, redirect } from '@sveltejs/kit';
import { resetMultiOrgPasswordWithToken } from '$lib/crm/server/multiOrgAuth.js';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';

export async function load({ url }) {
	const token = url.searchParams.get('token') || '';
	const email = url.searchParams.get('email') || '';
	return {
		token,
		email,
		multiOrgBasePath: '/multi-org'
	};
}

export const actions = {
	reset: async ({ request, locals }) => {
		const formData = await request.formData();
		const token = (formData.get('token') || '').toString().trim();
		const email = (formData.get('email') || '').toString().trim().toLowerCase();
		const password = (formData.get('password') || '').toString();
		const confirmPassword = (formData.get('confirmPassword') || '').toString();

		if (!token || !email) {
			return fail(400, { error: 'Invalid reset link. Please request a new password reset.' });
		}
		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match.' });
		}

		try {
			await resetMultiOrgPasswordWithToken(email, token, password);
		} catch (err) {
			const msg = err?.message || 'Invalid or expired reset link.';
			return fail(400, { error: msg, token, email });
		}

		const loginPath = getMultiOrgPublicPath('/multi-org/auth/login', !!locals.multiOrgAdminDomain);
		throw redirect(302, `${loginPath}?reset=success`);
	}
};
