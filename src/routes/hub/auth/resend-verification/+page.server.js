import { fail } from '@sveltejs/kit';
import { getAdminByEmail, regenerateVerificationToken } from '$lib/crm/server/auth.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sendAdminWelcomeEmail } from '$lib/crm/server/email.js';
import { findById } from '$lib/crm/server/fileStore.js';

// Rate limiting for resend requests (per email)
const resendAttempts = new Map();
const MAX_RESEND_ATTEMPTS = 3;
const RESEND_COOLDOWN = 5 * 60 * 1000; // 5 minutes

export async function load({ cookies, url }) {
	const csrfToken = getCsrfToken(cookies) || '';
	const email = url.searchParams.get('email') || '';
	
	return { csrfToken, email };
}

export const actions = {
	resend: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		const email = data.get('email');

		// Verify CSRF token
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(200, { error: 'CSRF token validation failed' });
		}

		if (!email) {
			return fail(200, { error: 'Email address is required' });
		}

		const emailStr = email.toString().toLowerCase().trim();

		// Rate limiting check
		const attempts = resendAttempts.get(emailStr) || { count: 0, lastSent: null };
		const now = Date.now();
		
		// Check cooldown period
		if (attempts.lastSent && (now - attempts.lastSent) < RESEND_COOLDOWN) {
			const remainingSeconds = Math.ceil((RESEND_COOLDOWN - (now - attempts.lastSent)) / 1000);
			return fail(200, { 
				error: `Please wait ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''} before requesting another verification email.` 
			});
		}

		// Check max attempts
		if (attempts.count >= MAX_RESEND_ATTEMPTS) {
			return fail(200, { 
				error: 'Too many verification email requests. Please contact an administrator for assistance.' 
			});
		}

		try {
			// Get admin by email (don't reveal if email exists to prevent enumeration)
			const admin = await getAdminByEmail(emailStr);
			
			// If admin doesn't exist or is already verified, don't reveal this
			// Return success message either way to prevent email enumeration
			if (!admin || admin.emailVerified) {
				// Still increment attempts to prevent abuse
				attempts.count++;
				attempts.lastSent = now;
				resendAttempts.set(emailStr, attempts);
				
				// Return generic success message
				return { 
					success: true, 
					message: 'If an unverified account exists with this email, a verification email has been sent.' 
				};
			}

			// Regenerate verification token
			const verificationToken = await regenerateVerificationToken(admin.id);

			// Send verification email (without password since this is a resend)
			const org = admin.organisationId ? await findById('organisations', admin.organisationId) : null;
			const hubBaseUrl = org?.hubDomain ? `https://${String(org.hubDomain).replace(/\/$/, '')}` : undefined;
			try {
				await sendAdminWelcomeEmail({
					to: emailStr,
					name: admin.name,
					email: emailStr,
					verificationToken: verificationToken,
					password: null,
					hubBaseUrl,
					orgName: org?.name
				}, { url });
			} catch (emailError) {
				console.error('Failed to send verification email:', emailError);
				return fail(200, { error: 'Failed to send verification email. Please try again later.' });
			}

			// Update rate limiting
			attempts.count++;
			attempts.lastSent = now;
			resendAttempts.set(emailStr, attempts);

			return { 
				success: true, 
				message: 'Verification email has been sent. Please check your inbox and click the verification link.' 
			};
		} catch (error) {
			console.error('Error resending verification email:', error);
			return fail(200, { error: error.message || 'Failed to resend verification email' });
		}
	}
};
