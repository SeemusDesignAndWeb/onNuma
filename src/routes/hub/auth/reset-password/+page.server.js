import { redirect } from '@sveltejs/kit';
import { verifyPasswordResetToken, resetPasswordWithToken, getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';

export async function load({ url, cookies }) {
	const tokenParam = url.searchParams.get('token');
	const emailParam = url.searchParams.get('email');

	console.log('[Reset Password Load] Raw URL params:', {
		hasToken: !!tokenParam,
		hasEmail: !!emailParam,
		tokenLength: tokenParam?.length,
		emailLength: emailParam?.length,
		tokenPreview: tokenParam?.substring(0, 30) + '...',
		emailPreview: emailParam?.substring(0, 20) + '...',
		fullUrl: url.toString()
	});

	if (!tokenParam || !emailParam) {
		console.log('[Reset Password Load] Missing params:', { hasToken: !!tokenParam, hasEmail: !!emailParam });
		throw redirect(302, '/hub/auth/login?error=missing_params');
	}

	// Decode token and email if they were URL-encoded
	let token, email;
	try {
		token = decodeURIComponent(tokenParam);
		email = decodeURIComponent(emailParam);
		console.log('[Reset Password Load] After decoding:', {
			tokenLength: token.length,
			emailLength: email.length,
			tokenPreview: token.substring(0, 30) + '...',
			email: email
		});
	} catch (decodeError) {
		console.error('[Reset Password Load] Error decoding params:', decodeError);
		throw redirect(302, '/hub/auth/login?error=invalid_token');
	}

	// Verify token is valid
	console.log('[Reset Password Load] Verifying token for email:', email);
	const admin = await verifyPasswordResetToken(email, token);
	if (!admin) {
		console.log('[Reset Password Load] Token verification failed for email:', email);
		// Return error state instead of redirecting immediately
		// This allows the page to show a more helpful error message
		const csrfToken = getCsrfToken(cookies) || '';
		return { 
			token: null, 
			email: null, 
			csrfToken,
			error: 'invalid_token'
		};
	}

	console.log('[Reset Password Load] Token verified successfully for admin:', admin.id);
	const csrfToken = getCsrfToken(cookies) || '';
	return { token, email, csrfToken, error: null };
}

export const actions = {
	reset: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		// Get token and email from form data (hidden fields) first, fallback to URL params
		let tokenParam = data.get('token');
		let emailParam = data.get('email');
		
		// Fallback to URL params if not in form data
		if (!tokenParam) {
			tokenParam = url.searchParams.get('token');
		}
		if (!emailParam) {
			emailParam = url.searchParams.get('email');
		}

		const newPassword = data.get('newPassword');
		const confirmPassword = data.get('confirmPassword');

		console.log('[Reset Password Action] Form submitted:', {
			hasToken: !!tokenParam,
			hasEmail: !!emailParam,
			tokenFromForm: !!data.get('token'),
			emailFromForm: !!data.get('email'),
			hasNewPassword: !!newPassword,
			hasConfirmPassword: !!confirmPassword
		});

		if (!tokenParam || !emailParam) {
			console.log('[Reset Password Action] Missing params in form submission');
			return { error: 'Invalid reset link' };
		}

		// Decode token and email if they were URL-encoded
		let token, email;
		try {
			token = typeof tokenParam === 'string' ? decodeURIComponent(tokenParam) : tokenParam.toString();
			email = typeof emailParam === 'string' ? decodeURIComponent(emailParam) : emailParam.toString();
			console.log('[Reset Password Action] Using params:', {
				tokenLength: token.length,
				email: email,
				tokenPreview: token.substring(0, 20) + '...'
			});
		} catch (decodeError) {
			console.error('[Reset Password Action] Error decoding params:', decodeError);
			return { error: 'Invalid reset link' };
		}

		if (!newPassword || !confirmPassword) {
			return { error: 'Both password fields are required' };
		}

		if (newPassword.toString() !== confirmPassword.toString()) {
			return { error: 'Passwords do not match' };
		}

		try {
			await resetPasswordWithToken(email, token, newPassword.toString());
			throw redirect(302, '/hub/auth/login?reset=success');
		} catch (error) {
			if (error.status === 302) {
				throw error; // Re-throw redirects
			}
			return { error: error.message || 'Failed to reset password' };
		}
	}
};

