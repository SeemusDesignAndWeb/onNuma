import { fail, redirect } from '@sveltejs/kit';
import { authenticateAdmin, createSession, setSessionCookie } from '$lib/crm/server/auth.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logAuditEvent } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';

// Rate limiting for login attempts
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Clean up old entries periodically
function cleanupLoginAttempts() {
	const now = Date.now();
	for (const [ip, attempts] of loginAttempts.entries()) {
		if (attempts.lockedUntil && attempts.lockedUntil < now) {
			loginAttempts.delete(ip);
		} else if (!attempts.lockedUntil && attempts.count === 0) {
			// Remove entries with no attempts after 1 hour
			loginAttempts.delete(ip);
		}
	}
}

// Run cleanup every 5 minutes
setInterval(cleanupLoginAttempts, 5 * 60 * 1000);

export async function load({ cookies, url }) {
	const csrfToken = getCsrfToken(cookies) || '';
	
	// Check for verification status in URL
	const verified = url.searchParams.get('verified');
	const error = url.searchParams.get('error');
	const unverified = url.searchParams.get('unverified');
	
	let message = null;
	if (verified === 'true') {
		message = { type: 'success', text: 'Email verified successfully! You can now log in.' };
	} else if (url.searchParams.get('reset') === 'success') {
		message = { type: 'success', text: 'Password reset successfully! You can now log in with your new password.' };
	} else if (unverified === 'true') {
		message = { type: 'error', text: 'Please verify your email address before logging in. Check your inbox for the verification link.' };
	} else if (error === 'invalid_token') {
		message = { type: 'error', text: 'Invalid or expired verification link. You can request a new verification email below.' };
	} else if (error === 'missing_params') {
		message = { type: 'error', text: 'Invalid verification link. You can request a new verification email below.' };
	} else if (error === 'verification_failed') {
		message = { type: 'error', text: 'Email verification failed. You can request a new verification email below.' };
	}

	return { csrfToken, message };
}

export const actions = {
	login: async ({ request, cookies, getClientAddress }) => {
		const data = await request.formData();
		const email = data.get('email');
		const password = data.get('password');
		const csrfToken = data.get('_csrf');

		// Verify CSRF token
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(200, { error: 'CSRF token validation failed' });
		}

		if (!email || !password) {
			return fail(200, { error: 'Email and password are required' });
		}

		// Rate limiting check
		let clientIp;
		try {
			clientIp = getClientAddress();
		} catch (error) {
			// Fallback if getClientAddress is not available
			const forwarded = request.headers.get('x-forwarded-for');
			clientIp = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
		}

		const attempts = loginAttempts.get(clientIp) || { count: 0, lockedUntil: null };

		// Check if locked out
		if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
			const remainingMinutes = Math.ceil((attempts.lockedUntil - Date.now()) / (60 * 1000));
			return fail(200, { error: `Too many login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.` });
		}

		// Attempt authentication
		let admin;
		let unverifiedEmail = null;
		try {
			const organisationId = await getCurrentOrganisationId();
			admin = await authenticateAdmin(email.toString(), password.toString(), organisationId);
		} catch (error) {
			// Handle email not verified error
			if (error.message === 'EMAIL_NOT_VERIFIED') {
				unverifiedEmail = email.toString();
				admin = null;
			}
			// Handle account lockout or password expiration errors
			else if (error.message.includes('locked') || error.message.includes('expired')) {
				return fail(200, { error: error.message });
			}
			// For other errors, treat as failed login
			else {
				admin = null;
			}
		}
		
		if (!admin) {
			// Handle unverified email case
			if (unverifiedEmail) {
				return fail(200, { 
					error: 'EMAIL_NOT_VERIFIED',
					email: unverifiedEmail
				});
			}
			
			// Increment failed attempt count (IP-based)
			attempts.count++;
			if (attempts.count >= MAX_ATTEMPTS) {
				attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
			}
			loginAttempts.set(clientIp, attempts);
			
			// Log failed login attempt
			await logAuditEvent(null, 'login_failed', { email: email.toString(), attemptCount: attempts.count, locked: attempts.count >= MAX_ATTEMPTS }, { getClientAddress: () => clientIp, request });
			
			return fail(200, { error: 'Invalid email or password' });
		}

		// Successful login - reset attempts
		loginAttempts.delete(clientIp);

		let session;
		try {
			session = await createSession(admin.id);
		} catch (err) {
			console.error('[login] createSession failed:', err?.message || err);
			return fail(500, { error: 'Could not create session. Please try again.' });
		}
		setSessionCookie(cookies, session.id, process.env.NODE_ENV === 'production');

		// Log successful login (best-effort; never block redirect)
		logAuditEvent(admin.id, 'login', { success: true }, { getClientAddress: () => clientIp, request }).catch((err) => {
			console.error('[login] audit log failed:', err?.message || err);
		});

		throw redirect(302, '/hub');
	}
};

