import { json } from '@sveltejs/kit';
import { getLanding } from '$lib/server/database';

/** Public API: returns landing page content (CTAs, tagline) for the marketing site. No auth required. */
export const GET = async () => {
	try {
		const landing = getLanding();
		return json(landing);
	} catch (error) {
		console.error('Failed to fetch landing:', error);
		return json({ error: 'Failed to fetch landing' }, { status: 500 });
	}
};
