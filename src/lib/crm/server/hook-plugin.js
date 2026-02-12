import { redirect, isRedirect } from '@sveltejs/kit';
import { getAdminFromCookies, generateCsrfToken, setCsrfToken, getCsrfToken, SESSION_COOKIE } from './auth.js';
import { hasRouteAccess } from './permissions.js';
import {
	getMultiOrgAdminFromCookies,
	generateMultiOrgCsrfToken,
	setMultiOrgCsrfToken,
	getMultiOrgCsrfToken
} from './multiOrgAuth.js';
import { resolveOrganisationFromHost, getMultiOrgPublicPath } from './hubDomain.js';
import { runWithOrganisation } from './requestOrg.js';

/**
 * CRM hook plugin - handles authentication and CSRF for /hub and /multi-org routes.
 * When request host matches an organisation's hubDomain, that org is bound for the request.
 * @param {object} event - SvelteKit event
 * @param {Function} resolve - Next handler
 * @returns {Promise<Response>}
 */
export async function crmHandle({ event, resolve }) {
	const { url, request, cookies } = event;
	const pathname = url.pathname;
	const isProduction = process.env.NODE_ENV === 'production';

	try {
		return await crmHandleInner({ event, resolve, url, request, cookies, pathname, isProduction });
	} catch (err) {
		if (isRedirect(err)) throw err;
		console.error('[crmHandle] Error (can cause 502 if uncaught):', err?.message || err);
		return new Response('Service temporarily unavailable. Please try again.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}
}

async function crmHandleInner({ event, resolve, url, request, cookies, pathname, isProduction }) {
	// Set security headers
	event.setHeaders({
		'X-Content-Type-Options': 'nosniff',
		'X-Frame-Options': 'DENY',
		'X-XSS-Protection': '1; mode=block',
		'Referrer-Policy': 'strict-origin-when-cross-origin',
		'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; frame-src 'self' https://www.google.com https://maps.google.com https://www.loom.com;"
	});

	// MultiOrg area: separate login and session.
	// On admin subdomain the path is /auth/* or /organisations (reroute only changes matched route, not event.url).
	const isMultiOrgPath =
		pathname.startsWith('/multi-org') ||
		(!!event.locals.multiOrgAdminDomain &&
			(pathname === '/' || pathname.startsWith('/auth') || pathname.startsWith('/organisations')));
	const isMultiOrgPublicAuth =
		pathname.startsWith('/multi-org/auth/login') ||
		pathname.startsWith('/multi-org/auth/logout') ||
		pathname.startsWith('/multi-org/auth/forgot-password') ||
		pathname.startsWith('/multi-org/auth/reset-password') ||
		(!!event.locals.multiOrgAdminDomain &&
			(pathname.startsWith('/auth/login') ||
				pathname === '/auth/logout' ||
				pathname.startsWith('/auth/forgot-password') ||
				pathname.startsWith('/auth/reset-password')));
	if (isMultiOrgPath) {
		const adminSubdomain = !!event.locals.multiOrgAdminDomain;
		if (isMultiOrgPublicAuth) {
			if (request.method === 'GET' && (pathname.startsWith('/multi-org/auth/login') || pathname.startsWith('/auth/login'))) {
				if (!getMultiOrgCsrfToken(cookies)) {
					const token = generateMultiOrgCsrfToken();
					setMultiOrgCsrfToken(cookies, token, isProduction, adminSubdomain);
				}
			}
			return resolve(event);
		}
		const multiOrgAdmin = await getMultiOrgAdminFromCookies(cookies);
		if (!multiOrgAdmin) {
			const loginPath = getMultiOrgPublicPath('/multi-org/auth/login', adminSubdomain);
			throw redirect(302, loginPath);
		}
		event.locals.multiOrgAdmin = multiOrgAdmin;
		if (request.method === 'GET') {
			if (!getMultiOrgCsrfToken(cookies)) {
				const token = generateMultiOrgCsrfToken();
				setMultiOrgCsrfToken(cookies, token, isProduction, adminSubdomain);
			}
		}
		return resolve(event);
	}

	// Public hub pages: signup, event links, forms, unsubscribe, view-rotas (all use org from host when on hub domain).
	const isPublicHubPath =
		pathname.startsWith('/signup/') ||
		pathname.startsWith('/event/') ||
		pathname.startsWith('/forms') ||
		pathname.startsWith('/unsubscribe/') ||
		pathname.startsWith('/view-rotas');

	// Protected hub paths require auth; avoid slow resolveOrganisationFromHost when there is no session cookie.
	const isProtectedHubPath =
		pathname.startsWith('/hub') &&
		!pathname.startsWith('/hub/auth/') &&
		pathname !== '/hub/privacy' &&
		!pathname.startsWith('/hub/privacy/');
	if (isProtectedHubPath && !cookies.get(SESSION_COOKIE)) {
		console.log(`[crmHandle] No session cookie for ${pathname}, redirecting to login`);
		throw redirect(302, '/hub/auth/login');
	}

	// When host is an organisation's hub domain, send non-Hub paths (other than public hub pages and static assets) to hub login.
	const host = url.host || request.headers.get('host') || '';
	const orgFromHost = await resolveOrganisationFromHost(host);
	const isPublicAsset = pathname.startsWith('/images/') || pathname.startsWith('/assets/');
	if (orgFromHost && !pathname.startsWith('/hub') && !isPublicHubPath && !isPublicAsset) {
		throw redirect(302, '/hub/auth/login');
	}

	// Run with org context for /hub and all public hub pages so getCurrentOrganisationId() returns the right org.
	if (!pathname.startsWith('/hub') && !isPublicHubPath) {
		return resolve(event);
	}

	// Resolve organisation from request host when using custom hub domain (e.g. hub.egcc.co.uk).
	// When set, org is fixed for this request; getCurrentOrganisationId() will use it.
	if (orgFromHost) {
		event.locals.hubOrganisationFromHost = orgFromHost.id;
		event.locals.hubOrganisationFromDomain = { id: orgFromHost.id, name: orgFromHost.name };
		return runWithOrganisation(orgFromHost.id, () => crmHandleHubAndSignup(event, resolve));
	}

	return crmHandleHubAndSignup(event, resolve);
}

async function crmHandleHubAndSignup(event, resolve) {
	const { url, request, cookies } = event;
	const isProduction = process.env.NODE_ENV === 'production';
	const pathname = url.pathname;

	// Public signup routes - no auth required (rota, event, member, membership-form, rotas)
	if (pathname.startsWith('/signup/rota/') || pathname.startsWith('/signup/event/') || pathname.startsWith('/signup/member') || pathname.startsWith('/signup/membership-form') || pathname.startsWith('/signup/rotas')) {
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

	// Privacy policy - public access (no auth required)
	if (pathname === '/hub/privacy' || pathname === '/hub/privacy/api') {
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

	// Effective super admin email (from hub_settings when set by MultiOrg, else env)
	const { getEffectiveSuperAdminEmail, getCurrentOrganisationId } = await import('./settings.js');
	const effectiveSuperAdminEmail = await getEffectiveSuperAdminEmail();
	event.locals.superAdminEmail = effectiveSuperAdminEmail;

	// Organisation area permissions (MultiOrg): restrict access to areas allowed for this org
	const organisationId = await getCurrentOrganisationId();
	const { findById } = await import('./fileStore.js');
	const org = organisationId ? await findById('organisations', organisationId) : null;
	const organisationAreaPermissions =
		org && Array.isArray(org.areaPermissions) ? org.areaPermissions : null;

	// Check if admin has permission to access this route (user permissions × org areas)
	if (!hasRouteAccess(admin, pathname, effectiveSuperAdminEmail, organisationAreaPermissions)) {
		// Prevent redirect loop - if we're already on /hub with access_denied, don't redirect again
		if (pathname === '/hub' && url.searchParams.get('error') === 'access_denied') {
			// Allow access to show the error message
			event.locals.admin = admin;
			return resolve(event);
		}
		// Redirect to hub home with error message
		throw redirect(302, '/hub?error=access_denied');
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

