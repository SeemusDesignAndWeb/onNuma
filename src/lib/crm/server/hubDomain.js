/**
 * Hub domain resolution: map request Host to organisation.
 * Used so each organisation can have its own login URL (e.g. hub.egcc.co.uk).
 *
 * Security:
 * - Organisation is derived ONLY from the request Host, matched against
 *   organisation.hubDomain (server-side allowlist). We never trust query params
 *   or cookies to choose organisation when on a custom domain.
 * - When Host matches a hubDomain, that org is fixed for the request; no override.
 */

import { readCollection } from './fileStore.js';

/** Normalise host for comparison: lowercase, strip port. */
export function normaliseHost(host) {
	if (!host || typeof host !== 'string') return '';
	return host.toLowerCase().trim().split(':')[0];
}

/** Valid hostname: letters, digits, hyphens, dots; not too long. */
const HOSTNAME_REGEX = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/i;

export function isValidHubDomain(value) {
	if (!value || typeof value !== 'string') return false;
	const n = value.toLowerCase().trim();
	if (n.length > 253) return false;
	return HOSTNAME_REGEX.test(n);
}

let orgsCache = null;
let orgsCacheTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

async function getOrganisationsWithHubDomain() {
	const now = Date.now();
	if (orgsCache && (now - orgsCacheTime) < CACHE_TTL_MS) {
		return orgsCache;
	}
	const raw = await readCollection('organisations');
	const orgs = (Array.isArray(raw) ? raw : []).filter((o) => o && !o.archivedAt);
	orgsCache = orgs;
	orgsCacheTime = now;
	return orgs;
}

/**
 * Resolve organisation id from request host.
 * @param {string} host - Request Host header (e.g. "hub.egcc.co.uk" or "localhost:5173")
 * @returns {Promise<{ id: string, name: string } | null>} Organisation or null if no match
 */
export async function resolveOrganisationFromHost(host) {
	const normalised = normaliseHost(host);
	if (!normalised) return null;

	const orgs = await getOrganisationsWithHubDomain();
	for (const org of orgs) {
		const domain = org.hubDomain && normaliseHost(String(org.hubDomain).trim());
		if (domain && domain === normalised) {
			return { id: org.id, name: org.name || 'Hub' };
		}
	}
	return null;
}

/**
 * Invalidate cache (e.g. after organisation hubDomain is updated).
 */
export function invalidateHubDomainCache() {
	orgsCache = null;
	orgsCacheTime = 0;
}

// --- Multi-org admin subdomain (e.g. admin.onnuma.com → /multi-org at root) ---

const MULTI_ORG_ADMIN_DOMAIN = process.env.MULTI_ORG_ADMIN_DOMAIN || '';

/**
 * Whether the request host is the dedicated Multi-org admin domain (e.g. admin.onnuma.com).
 * When true, multi-org is served at / so that admin.onnuma.com/ = dashboard, admin.onnuma.com/auth/login = login.
 */
export function isMultiOrgAdminDomain(host) {
	if (!MULTI_ORG_ADMIN_DOMAIN) return false;
	return normaliseHost(host) === normaliseHost(MULTI_ORG_ADMIN_DOMAIN);
}

/**
 * Path for redirects and links: when on the admin subdomain, use /auth/login not /multi-org/auth/login.
 * @param {string} internalPath - Internal path (e.g. '/multi-org/auth/login' or '/multi-org/organisations')
 * @param {boolean} isAdminDomain - From event.locals.multiOrgAdminDomain
 * @returns {string} Path to use in Location header or href
 */
export function getMultiOrgPublicPath(internalPath, isAdminDomain) {
	if (!internalPath) return isAdminDomain ? '/' : '/multi-org';
	if (isAdminDomain) {
		const p = (internalPath.replace(/^\/multi-org\/?/, '') || '').trim();
		return p.startsWith('/') ? p : '/' + p || '/';
	}
	return internalPath.startsWith('/multi-org') ? internalPath : '/multi-org' + (internalPath.startsWith('/') ? internalPath : '/' + internalPath);
}
