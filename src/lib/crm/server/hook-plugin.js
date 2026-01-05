import { redirect } from '@sveltejs/kit';
import { getAdminFromCookies, generateCsrfToken, setCsrfToken, getCsrfToken } from './auth.js';

/**
 * CRM hook plugin - handles authentication and CSRF for /hub routes
 * @param {object} event - SvelteKit event
 * @param {Function} resolve - Next handler
 * @returns {Promise<Response>}
 */
export async function crmHandle({ event, resolve }) {
	const { url, request, cookies } = event;
	const isProduction = process.env.NODE_ENV === 'production';
	const pathname = url.pathname;

	// Set security headers
	event.setHeaders({
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'X-XSS-Protection': '1; mode=block',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; frame-src 'self' https://www.google.com https://maps.google.com;"
	});

	// Only handle /hub and /signup/rota routes
	if (!pathname.startsWith('/hub') && !pathname.startsWith('/signup/rota')) {
		return resolve(event);
	}

	// Public rota signup routes - no auth required
	if (pathname.startsWith('/signup/rota/')) {
		// Set CSRF token on GET requests (only if not already set)
		if (request.method === 'GET') {
			if (!getCsrfToken(cookies)) {
				const csrfToken = generateCsrfToken();
				setCsrfToken(cookies, csrfToken, isProduction);
			}
		}
		return resolve(event);
	}

	// Auth routes - allow access
	if (pathname.startsWith('/hub/auth/')) {
		// Set CSRF token on GET requests (only if not already set)
		if (request.method === 'GET') {
			if (!getCsrfToken(cookies)) {
				const csrfToken = generateCsrfToken();
				setCsrfToken(cookies, csrfToken, isProduction);
			}
		}
		return resolve(event);
	}

	// All other /hub routes require authentication
	const admin = await getAdminFromCookies(cookies);
	
	if (!admin) {
		throw redirect(302, '/hub/auth/login');
	}

	// Attach admin to locals
	event.locals.admin = admin;

	// Note: CSRF validation is handled in individual actions, not in the hook
	// This allows SvelteKit's form handling to work properly with use:enhance

	// Set CSRF token on GET requests (only if not already set)
	// This ensures the token persists across page navigations
	if (request.method === 'GET') {
		if (!getCsrfToken(cookies)) {
			const csrfToken = generateCsrfToken();
			setCsrfToken(cookies, csrfToken, isProduction);
		}
	}

	return resolve(event);
}

