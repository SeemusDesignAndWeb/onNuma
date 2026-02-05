/**
 * Universal hooks. reroute runs before route matching and can return a different path.
 * When host is MULTI_ORG_ADMIN_DOMAIN (e.g. admin.onnuma.com), we return the /multi-org/* path
 * so SvelteKit finds the route (handle-only rewrite does not change the path used for matching).
 */

function normaliseHost(host) {
	if (!host || typeof host !== 'string') return '';
	return host.toLowerCase().trim().split(':')[0];
}

/** Admin domain from env (server). Set MULTI_ORG_ADMIN_DOMAIN in production. */
function getAdminDomain() {
	if (typeof process === 'undefined' || !process.env) return '';
	return (process.env.MULTI_ORG_ADMIN_DOMAIN || '').trim();
}

/**
 * Reroute: when request is for admin subdomain and path is / or /auth/* or /organisations/*,
 * return the /multi-org/* path so SvelteKit matches the multi-org route (fixes 404).
 */
export function reroute({ url }) {
	const domain = getAdminDomain();
	if (!domain) return undefined;

	const host = url.host || '';
	if (normaliseHost(host) !== normaliseHost(domain)) return undefined;

	const pathname = url.pathname || '/';
	const rewrite =
		pathname === '/' ||
		pathname.startsWith('/auth') ||
		pathname.startsWith('/organisations');
	if (!rewrite) return undefined;

	return pathname === '/' ? '/multi-org' : '/multi-org' + pathname;
}
