import { redirect } from '@sveltejs/kit';
import { verifyAndConsumeMagicLinkToken, setMemberCookie } from '$lib/crm/server/memberAuth.js';
import { env } from '$env/dynamic/private';

/**
 * GET /myhub/auth/[token]
 *
 * Validates a magic link token. On success, sets the member session cookie and
 * redirects the volunteer to their dashboard. On failure (expired, already used,
 * or not found), redirects to the send-link screen with a friendly error message.
 */
export async function GET({ params, cookies, url }) {
	const { token } = params;

	let contactId = null;
	try {
		contactId = await verifyAndConsumeMagicLinkToken(token);
	} catch (err) {
		console.error('[myhub/auth] Error verifying magic link token:', err?.message || err);
	}

	if (!contactId) {
		// Token invalid, already used, or expired — send back to the "get a link" screen
		// with a friendly message so the volunteer knows to request a fresh one.
		throw redirect(302, '/myhub?error=link-expired');
	}

	const isProduction = env.NODE_ENV === 'production';
	setMemberCookie(cookies, contactId, isProduction);

	// Honour an optional ?redirectTo= so deep links from emails keep working.
	const redirectTo = url.searchParams.get('redirectTo') || '/myhub';
	throw redirect(302, redirectTo);
}
