import { readCollection } from '$lib/crm/server/fileStore.js';
import { getCsrfToken } from '$lib/crm/server/auth.js';

const ITEMS_PER_PAGE = 20;

export async function load({ url, cookies }) {
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';

	const contacts = await readCollection('contacts');
	
	// Filter to only members (handle null, undefined, and empty strings)
	const members = contacts.filter(c => c && c.membershipStatus && c.membershipStatus.toLowerCase().trim() === 'member');
	
	// Sort members alphabetically by first name, then last name
	const sorted = members.sort((a, b) => {
		const aFirstName = (a.firstName || '').toLowerCase();
		const bFirstName = (b.firstName || '').toLowerCase();
		const aLastName = (a.lastName || '').toLowerCase();
		const bLastName = (b.lastName || '').toLowerCase();
		
		// First sort by first name
		if (aFirstName !== bFirstName) {
			return aFirstName.localeCompare(bFirstName);
		}
		// If first names are the same, sort by last name
		return aLastName.localeCompare(bLastName);
	});
	
	let filtered = sorted;
	if (search) {
		const searchLower = search.toLowerCase();
		filtered = sorted.filter(m => 
			m.email?.toLowerCase().includes(searchLower) ||
			m.firstName?.toLowerCase().includes(searchLower) ||
			m.lastName?.toLowerCase().includes(searchLower)
		);
	}

	const total = filtered.length;
	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const paginated = filtered.slice(start, end);

	const csrfToken = getCsrfToken(cookies) || '';

	return {
		members: paginated,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		search,
		csrfToken
	};
}
