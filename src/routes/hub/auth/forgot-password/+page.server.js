import { getCsrfToken, verifyCsrfToken, requestPasswordReset } from '$lib/crm/server/auth.js';
import { sendPasswordResetEmail } from '$lib/crm/server/email.js';

export async function load({ cookies }) {
	const csrfToken = getCsrfToken(cookies) || '';
	return { csrfToken };
}

export const actions = {
	requestReset: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		const email = data.get('email');

		if (!email) {
			return { error: 'Email is required' };
		}

		try {
			const emailStr = email.toString();
			console.log('[Forgot Password] Request received for email:', emailStr);

			// Request password reset (returns null if email doesn't exist to prevent enumeration)
			const admin = await requestPasswordReset(emailStr);

			// Always return success message to prevent email enumeration
			// If admin exists, send email; if not, still return success
			if (admin) {
				console.log('[Forgot Password] Admin found, token generated:', {
					adminId: admin.id,
					email: admin.email,
					tokenLength: admin.passwordResetToken?.length,
					tokenPreview: admin.passwordResetToken?.substring(0, 20) + '...',
					expiresAt: admin.passwordResetTokenExpires
				});

				// Always use the current request origin for the reset link so
				// the user is sent back to the same domain they submitted from.
				// This avoids cross-org domain confusion when multiple orgs share the platform.
				try {
					await sendPasswordResetEmail({
						to: admin.email,
						name: admin.name || admin.email,
						resetToken: admin.passwordResetToken
					}, { url });
					console.log('[Forgot Password] Reset email sent successfully to:', admin.email);
				} catch (emailError) {
					// Log error but don't reveal it to user
					console.error('[Forgot Password] Failed to send password reset email:', emailError);
				}
			} else {
				console.log('[Forgot Password] No admin found for email (or enumeration protection):', emailStr);
			}

			// Always return success to prevent email enumeration
			return { 
				success: true, 
				message: 'If an account with that email exists, a password reset link has been sent.' 
			};
		} catch (error) {
			// Still return generic success to prevent enumeration
			return { 
				success: true, 
				message: 'If an account with that email exists, a password reset link has been sent.' 
			};
		}
	}
};

