import { readCollection } from '$lib/crm/server/fileStore.js';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { canAccessSafeguarding, canAccessForms } from '$lib/crm/server/permissions.js';

const ITEMS_PER_PAGE = 20;

export async function load({ url, cookies }) {
	const admin = await getAdminFromCookies(cookies);
	if (!admin) {
		return { forms: [], currentPage: 1, totalPages: 1, total: 0, search: '', latestSubmissions: [] };
	}
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';

	const [forms, registers] = await Promise.all([
		readCollection('forms'),
		readCollection('registers')
	]);
	
	// Filter forms based on admin permissions
	const canAccessSafeguardingForms = canAccessSafeguarding(admin);
	const canAccessNonSafeguardingForms = canAccessForms(admin);
	
	let filtered = forms.filter(f => {
		// If it's a safeguarding form, check safeguarding permission
		if (f.isSafeguarding || f.requiresEncryption) {
			return canAccessSafeguardingForms;
		}
		// Otherwise, check forms permission
		return canAccessNonSafeguardingForms;
	});
	
	if (search) {
		const searchLower = search.toLowerCase();
		filtered = filtered.filter(f => 
			f.name?.toLowerCase().includes(searchLower) ||
			f.description?.toLowerCase().includes(searchLower)
		);
	}

	const total = filtered.length;
	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const paginated = filtered.slice(start, end);

	// Get latest 10 form submissions, sorted by submittedAt (most recent first)
	const latestSubmissions = [...registers]
		.sort((a, b) => {
			const dateA = new Date(a.submittedAt || a.createdAt || 0);
			const dateB = new Date(b.submittedAt || b.createdAt || 0);
			return dateB - dateA;
		})
		.slice(0, 10);

	// Enrich submissions with form names
	const formsMap = new Map(forms.map(f => [f.id, f]));
	const enrichedSubmissions = latestSubmissions.map(submission => {
		const form = formsMap.get(submission.formId);
		return {
			...submission,
			formName: form?.name || 'Unknown Form'
		};
	});

	return {
		forms: paginated,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		search,
		latestSubmissions: enrichedSubmissions
	};
}

