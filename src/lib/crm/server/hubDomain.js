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

/** Base domain for hub subdomains (e.g. onnuma.com). Used to resolve org from host like acme.onnuma.com. */
const HUB_BASE_DOMAIN = (process.env.HUB_BASE_DOMAIN || 'onnuma.com').toLowerCase().trim().replace(/^\.+|\.+$/g, '');

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
 * Resolve organisation from request host.
 * Organisation ID is always derived from the domain: when e.g. acme.onnuma.com is called,
 * the site looks up the organisation whose hubDomain matches that host (full host or subdomain).
 * @param {string} host - Request Host header (e.g. "acme.onnuma.com" or "hub.egcc.co.uk")
 * @returns {Promise<{ id: string, name: string } | null>} Organisation or null if no match
 */
export async function resolveOrganisationFromHost(host) {
	const normalised = normaliseHost(host);
	if (!normalised) return null;

	const orgs = await getOrganisationsWithHubDomain();
	// 1) Exact match: org.hubDomain === host (e.g. "acme.onnuma.com" === "acme.onnuma.com")
	for (const org of orgs) {
		const domain = org.hubDomain && normaliseHost(String(org.hubDomain).trim());
		if (domain && domain === normalised) {
			return { id: org.id, name: org.name || 'Hub' };
		}
	}
	// 2) Subdomain match: host is subdomain.onnuma.com and org.hubDomain is "subdomain" or "subdomain.onnuma.com"
	if (HUB_BASE_DOMAIN && (normalised === HUB_BASE_DOMAIN || normalised.endsWith('.' + HUB_BASE_DOMAIN))) {
		const subdomain = normalised === HUB_BASE_DOMAIN ? '' : normalised.slice(0, -HUB_BASE_DOMAIN.length - 1);
		if (subdomain) {
			for (const org of orgs) {
				const domain = org.hubDomain && normaliseHost(String(org.hubDomain).trim());
				if (!domain) continue;
				// Match full host (acme.onnuma.com) or subdomain-only (acme)
				if (domain === normalised || domain === subdomain) {
					return { id: org.id, name: org.name || 'Hub' };
				}
			}
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

/**
 * Build hub base URL (e.g. https://acme.onnuma.com) from an organisation.
 * If org.hubDomain is subdomain-only (no dot), appends HUB_BASE_DOMAIN (e.g. "acme" → acme.onnuma.com).
 * @param {object} org - Organisation { hubDomain? }
 * @param {string} fallback - URL to return when org has no hubDomain
 * @returns {string}
 */
export function getHubBaseUrlFromOrg(org, fallback) {
	const domain = org?.hubDomain && String(org.hubDomain).trim();
	if (!domain) return fallback;
	let host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
	if (!host.includes('.')) host = `${host}.${HUB_BASE_DOMAIN}`;
	return `https://${host}`;
}

// --- Main app domain (www.onnuma.com) — Hub must not be served here ---

/**
 * Whether the request host is the main public site (www.onnuma.com or onnuma.com).
 * Only these hosts serve the front-end (marketing/signup). Hub routes redirect to signup here.
 */
export function isMainAppDomain(host) {
	if (!host || typeof host !== 'string') return false;
	const h = normaliseHost(host);
	if (!h) return false;
	return (h === 'www.' + HUB_BASE_DOMAIN) || (h === HUB_BASE_DOMAIN);
}

/**
 * Whether the request host is a subdomain of the base domain (e.g. *.onnuma.com or onnuma.com).
 */
export function isSubdomainOfBaseDomain(host) {
	if (!host || typeof host !== 'string') return false;
	const h = normaliseHost(host);
	if (!h || !HUB_BASE_DOMAIN) return false;
	return h === HUB_BASE_DOMAIN || h.endsWith('.' + HUB_BASE_DOMAIN);
}

/**
 * Whether the request host is "another" subdomain (subdomain of base but not www and not admin).
 * These hosts either serve the Hub (if org exists for that hub domain) or should redirect to front-end.
 */
export function isOtherSubdomain(host) {
	if (!host || typeof host !== 'string') return false;
	return isSubdomainOfBaseDomain(host) && !isMainAppDomain(host) && !isMultiOrgAdminDomain(host);
}

/**
 * Origin URL for the front-end site (www). Used when redirecting non-org subdomains to the main site.
 */
export function getFrontendOrigin() {
	const appBase = (process.env.APP_BASE_URL || '').trim();
	if (appBase && (appBase.startsWith('http://') || appBase.startsWith('https://'))) {
		try {
			return new URL(appBase).origin;
		} catch {
			// fallback
		}
	}
	return 'https://www.' + HUB_BASE_DOMAIN;
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
