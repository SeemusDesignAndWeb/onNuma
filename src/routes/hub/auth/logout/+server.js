import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, getAdminFromCookies, removeSession } from '$lib/crm/server/auth.js';

export async function GET({ cookies }) {
	try {
		const admin = await getAdminFromCookies(cookies);
		if (admin) {
			const sessionId = cookies.get('crm_session');
			if (sessionId) {
				await removeSession(sessionId);
			}
		}
	} catch (err) {
		// Log but don't fail: ensure user is logged out (clear cookie + redirect) even if
		// session store (file/DB) is unavailable or throws
		if (process.env.NODE_ENV !== 'production') {
			console.error('[hub logout]', err);
		}
	}

	clearSessionCookie(cookies);
	throw redirect(302, '/hub/auth/login');
}

