import { sequence } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { crmHandle } from '$lib/crm/server/hook-plugin.js';
import { cleanupExpiredSessions } from '$lib/crm/server/auth.js';
import { isMultiOrgAdminDomain } from '$lib/crm/server/hubDomain.js';

/** When host is MULTI_ORG_ADMIN_DOMAIN (e.g. admin.onnuma.com), set locals so multi-org links use /auth/* not /multi-org/auth/*. Path rewrite for route matching is done in hooks.js reroute. */
async function multiOrgAdminDomainHandle({ event, resolve }) {
	// Prefer X-Forwarded-Host when behind a proxy (Railway, Vercel, etc.)
	const host =
		event.request.headers.get('x-forwarded-host') ||
		event.request.headers.get('host') ||
		event.url?.host ||
		'';
	if (!isMultiOrgAdminDomain(host)) return resolve(event);

	event.locals.multiOrgAdminDomain = true;
	return resolve(event);
}

/** Redirect /organisations to multi-org when not on admin domain (admin domain uses hooks.js reroute). Keeps one source of truth. */
async function organisationsRedirectHandle({ event, resolve }) {
	if (event.locals.multiOrgAdminDomain) return resolve(event);
	const pathname = event.url?.pathname || '';
	if (pathname !== '/organisations' && !pathname.startsWith('/organisations/')) return resolve(event);
	const search = event.url?.search || '';
	throw redirect(302, '/multi-org' + pathname + search);
}

// Base handle (if you have existing hooks, add them here)
async function baseHandle({ event, resolve }) {
	// Enforce HTTPS in production (check x-forwarded-proto for proxied requests)
	if (process.env.NODE_ENV === 'production') {
		const proto = event.request.headers.get('x-forwarded-proto') || event.url.protocol.replace(':', '');
		if (proto !== 'https') {
			const host = event.request.headers.get('x-forwarded-host') || event.request.headers.get('host') || event.url.host;
			return new Response('HTTPS required', {
				status: 301,
				headers: {
					'Location': `https://${host}${event.url.pathname}${event.url.search}`
				}
			});
		}
	}
	return resolve(event);
}

// Run session cleanup every hour
let lastCleanup = 0;
const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

async function sessionCleanupHandle({ event, resolve }) {
	const now = Date.now();
	if (now - lastCleanup > CLEANUP_INTERVAL) {
		lastCleanup = now;
		// Run cleanup asynchronously (don't block request)
		cleanupExpiredSessions().catch(err => {
			console.error('Session cleanup error:', err?.message || 'Unknown error');
		});
	}
	return resolve(event);
}

export const handle = sequence(multiOrgAdminDomainHandle, organisationsRedirectHandle, baseHandle, sessionCleanupHandle, crmHandle);

