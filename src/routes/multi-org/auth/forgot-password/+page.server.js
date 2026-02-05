import { fail } from '@sveltejs/kit';
import { requestMultiOrgPasswordReset } from '$lib/crm/server/multiOrgAuth.js';
import { sendMultiOrgPasswordResetEmail } from '$lib/crm/server/email.js';

export async function load() {
	return {};
}

export const actions = {
	requestReset: async ({ request, url, locals }) => {
		const message =
			'If an account exists for that email, we\'ve sent a password reset link. Check your inbox and spam folder.';

		try {
			const formData = await request.formData();
			const email = (formData.get('email') || '').toString().trim().toLowerCase();
			if (!email) {
				return fail(400, { error: 'Please enter your email address.' });
			}

			const result = await requestMultiOrgPasswordReset(email);

			if (result) {
				const adminSubdomain = !!locals.multiOrgAdminDomain;
				const eventLike = { url, adminSubdomain };
				try {
					await sendMultiOrgPasswordResetEmail(
						{ to: result.email, name: result.name || result.email, resetToken: result.passwordResetToken },
						eventLike
					);
				} catch (err) {
					console.error('MultiOrg password reset email error:', err);
					return fail(500, { error: 'We couldn\'t send the reset email. Please try again later.', message });
				}
			}

			return { success: true, message };
		} catch (err) {
			console.error('MultiOrg forgot-password error:', err);
			return fail(500, {
				error: 'Something went wrong. Please try again later.',
				message
			});
		}
	}
};
