import { redirect } from '@sveltejs/kit';

export async function GET({ url }) {
	// Redirect /calendar to /events/calendar for prettier URL
	const searchParams = url.searchParams.toString();
	const redirectUrl = `/events/calendar${searchParams ? `?${searchParams}` : ''}`;
	throw redirect(301, redirectUrl);
}

