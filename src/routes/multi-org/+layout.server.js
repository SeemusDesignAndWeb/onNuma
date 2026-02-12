import { getMultiOrgCsrfToken } from '$lib/crm/server/multiOrgAuth.js';

export async function load({ cookies, locals }) {
	const csrfToken = getMultiOrgCsrfToken(cookies) || '';
	return {
		csrfToken,
		multiOrgAdmin: locals.multiOrgAdmin || null,
		// Always use /multi-org for client-side links - reroute() only works server-side
		multiOrgBasePath: '/multi-org'
	};
}
