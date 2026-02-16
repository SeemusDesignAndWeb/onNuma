import { redirect } from '@sveltejs/kit';

export async function load() {
	// Canonical path so we always get multi-org layout (avoid cached /organisations on admin domain)
	throw redirect(302, '/multi-org/organisations');
}
