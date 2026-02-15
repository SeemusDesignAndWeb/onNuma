import { redirect } from '@sveltejs/kit';
import { clearMemberCookie } from '$lib/crm/server/memberAuth.js';

export function GET({ cookies }) {
	clearMemberCookie(cookies);
	throw redirect(302, '/my');
}
