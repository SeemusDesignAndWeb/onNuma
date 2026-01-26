import { redirect, fail } from '@sveltejs/kit';
import { readCollection, remove } from '$lib/crm/server/fileStore.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { isUpcomingOccurrence } from '$lib/crm/utils/occurrenceFilters.js';

const ITEMS_PER_PAGE = 20;

export async function load({ url, cookies }) {
	const page = parseInt(url.searchParams.get('page') || '1', 10);
	const search = url.searchParams.get('search') || '';

	const rotas = await readCollection('rotas');
	const events = await readCollection('events');
	const occurrences = await readCollection('occurrences');
	
	// Create a map of upcoming occurrence IDs for quick lookup
	const now = new Date();
	const upcomingOccurrenceIds = new Set(
		occurrences
			.filter(occ => isUpcomingOccurrence(occ, now))
			.map(occ => occ.id)
	);
	
	let filtered = rotas;
	if (search) {
		const searchLower = search.toLowerCase();
		filtered = rotas.filter(r => {
			const event = events.find(e => e.id === r.eventId);
			return r.role?.toLowerCase().includes(searchLower) ||
				event?.title?.toLowerCase().includes(searchLower);
		});
	}

	const total = filtered.length;
	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const paginated = filtered.slice(start, end);

	// Enrich with event data and filter assignees to only upcoming occurrences
	const enriched = paginated.map(rota => {
		const event = events.find(e => e.id === rota.eventId);
		
		// Get all upcoming occurrences for this event
		const eventOccurrences = occurrences.filter(occ => 
			occ.eventId === rota.eventId && isUpcomingOccurrence(occ, now)
		);
		
		// If rota is for a specific occurrence, only consider that occurrence
		const applicableOccurrences = rota.occurrenceId
			? eventOccurrences.filter(occ => occ.id === rota.occurrenceId)
			: eventOccurrences;
		
		// Filter assignees to only include those for occurrences on or after today
		const assignees = Array.isArray(rota.assignees) ? rota.assignees : [];
		const filteredAssignees = assignees.filter(assignee => {
			// Determine which occurrence this assignee is for
			let occurrenceId = null;
			
			if (typeof assignee === 'string') {
				// Old format: just contact ID, use rota's occurrenceId
				occurrenceId = rota.occurrenceId;
			} else if (typeof assignee === 'object' && assignee !== null) {
				// New format: object with occurrenceId
				occurrenceId = assignee.occurrenceId !== null && assignee.occurrenceId !== undefined
					? assignee.occurrenceId
					: rota.occurrenceId;
			}
			
			// If rota is for all occurrences (occurrenceId is null), check if there are any upcoming occurrences for this event
			if (occurrenceId === null) {
				// Check if there are any upcoming occurrences for this event
				return eventOccurrences.length > 0;
			}
			
			// Check if this specific occurrence is upcoming
			return upcomingOccurrenceIds.has(occurrenceId);
		});
		
		// Calculate number of covered occurrences (occurrences with at least one assignee)
		let coveredCount = 0;
		if (applicableOccurrences.length > 0) {
			const coveredOccurrenceIds = new Set();
			
			filteredAssignees.forEach(assignee => {
				let occurrenceId = null;
				
				if (typeof assignee === 'string') {
					// Old format: just contact ID, use rota's occurrenceId
					occurrenceId = rota.occurrenceId;
				} else if (typeof assignee === 'object' && assignee !== null) {
					// New format: object with occurrenceId
					occurrenceId = assignee.occurrenceId !== null && assignee.occurrenceId !== undefined
						? assignee.occurrenceId
						: rota.occurrenceId;
				}
				
				// If occurrenceId is null (rota for all occurrences, old format assignee),
				// we can't determine which specific occurrence it's for, so skip it
				if (occurrenceId !== null && applicableOccurrences.some(occ => occ.id === occurrenceId)) {
					coveredOccurrenceIds.add(occurrenceId);
				}
			});
			
			coveredCount = coveredOccurrenceIds.size;
		}
		
		return { 
			...rota, 
			eventTitle: event?.title || 'Unknown Event',
			assignees: filteredAssignees,
			coveredCount
		};
	});

	const csrfToken = getCsrfToken(cookies) || '';
	return {
		rotas: enriched,
		currentPage: page,
		totalPages: Math.ceil(total / ITEMS_PER_PAGE),
		total,
		search,
		csrfToken
	};
}

export const actions = {
	delete: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		const rotaId = data.get('rotaId');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		if (!rotaId) {
			return fail(400, { error: 'Rota ID is required' });
		}

		try {
			await remove('rotas', rotaId);
			
			// Preserve search and page params
			const page = url.searchParams.get('page') || '1';
			const search = url.searchParams.get('search') || '';
			const params = new URLSearchParams();
			if (search) params.set('search', search);
			params.set('page', page);
			
			throw redirect(302, `/hub/rotas?${params.toString()}`);
		} catch (error) {
			if (error.status === 302) throw error; // Re-throw redirects
			console.error('Error deleting rota:', error);
			return fail(400, { error: error.message || 'Failed to delete rota' });
		}
	}
};

