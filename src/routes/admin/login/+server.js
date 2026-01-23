import { json } from '@sveltejs/kit';
import { createSession } from '$lib/server/auth';

// GET handler - allow page to load
export const GET = async () => {
	return new Response(null, { status: 200 });
};

export const POST = async ({ request, cookies }) => {
	const { password } = await request.json();

	if (createSession(cookies, password)) {
		return json({ success: true });
	} else {
		return json({ error: 'Invalid password' }, { status: 401 });
	}
};
