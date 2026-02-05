import { getPage, getContactInfo } from '$lib/server/database';
import { error } from '@sveltejs/kit';

// Reserved routes that should not be handled by dynamic pages
const reservedRoutes = [
	'admin',
	'api',
	'events',
	'audio',
	'media',
	'activities',
	'community-groups',
	'im-new',
	'church',
	'team',
	'new-at-egcc',
	'policy',
	'the-church',
	'the-team',
	'organisations' // multi-org admin subdomain uses /organisations; main site redirects to /multi-org
];

export const load = async ({ params }) => {
	const slug = params.slug;
	
	// Don't handle reserved routes
	if (reservedRoutes.includes(slug)) {
		throw error(404, 'Page not found');
	}
	
	const page = getPage(slug);
	
	if (!page) {
		throw error(404, 'Page not found');
	}
	
	const contactInfo = getContactInfo();
	
	return { page, contactInfo };
};









