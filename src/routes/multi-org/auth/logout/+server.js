import { redirect } from '@sveltejs/kit';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { getMultiOrgAdminFromCookies, clearMultiOrgSessionCookie, removeMultiOrgSession } from '$lib/crm/server/multiOrgAuth.js';

export async function GET({ cookies, locals }) {
	const admin = await getMultiOrgAdminFromCookies(cookies);
	const sessionId = cookies.get('multi_org_session');
	if (sessionId) {
		await removeMultiOrgSession(sessionId);
	}
	clearMultiOrgSessionCookie(cookies, !!locals.multiOrgAdminDomain);
	throw redirect(302, getMultiOrgPublicPath('/multi-org/auth/login', !!locals.multiOrgAdminDomain));
}
