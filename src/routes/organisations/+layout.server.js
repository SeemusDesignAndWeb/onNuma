import { redirect } from '@sveltejs/kit';

/**
 * When on the multi-org admin subdomain, /organisations/* is the multi-org area.
 * When not on admin subdomain, redirect to /multi-org.
 */
export async function load({ locals }) {
	if (!locals.multiOrgAdminDomain) {
		throw redirect(302, '/multi-org');
	}
	return {
		multiOrgAdmin: locals.multiOrgAdmin || null,
		multiOrgBasePath: ''
	};
}
