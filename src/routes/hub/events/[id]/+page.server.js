import { redirect } from '@sveltejs/kit';
import { findById, update, remove, readCollection, findMany } from '$lib/crm/server/fileStore.js';
import { validateEvent } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { ensureEventToken, ensureOccurrenceToken } from '$lib/crm/server/tokens.js';
import { env } from '$env/dynamic/private';

export async function load({ params, cookies, url }) {
	const event = await findById('events', params.id);
	if (!event) {
		throw redirect(302, '/hub/events');
	}

	const occurrences = await findMany('occurrences', o => o.eventId === params.id);
	const rotas = await findMany('rotas', r => r.eventId === params.id);
	const eventSignups = await findMany('event_signups', s => s.eventId === params.id);

	// Calculate rota statistics and signup statistics for each occurrence
	const occurrencesWithStats = occurrences.map(occ => {
		// Find rotas that apply to this occurrence
		// A rota applies if:
		// 1. It has no occurrenceId (applies to all occurrences)
		// 2. It has an occurrenceId matching this occurrence
		const applicableRotas = rotas.filter(rota => {
			return !rota.occurrenceId || rota.occurrenceId === occ.id;
		});

		// Calculate stats for this occurrence
		let totalCapacity = 0;
		let totalAssigned = 0;
		let rotaCount = applicableRotas.length;

		applicableRotas.forEach(rota => {
			totalCapacity += rota.capacity || 0;
			
			// Count assignees for this specific occurrence
			const assignees = rota.assignees || [];
			const assigneesForOcc = assignees.filter(a => {
				if (typeof a === 'string') {
					// Old format - if rota has occurrenceId, only count for that occurrence
					return rota.occurrenceId === occ.id;
				}
				if (a && typeof a === 'object') {
					const aOccId = a.occurrenceId || rota.occurrenceId;
					return aOccId === occ.id;
				}
				return false;
			});
			
			totalAssigned += assigneesForOcc.length;
		});

		const spotsRemaining = totalCapacity - totalAssigned;

		// Calculate event signup statistics for this occurrence
		const occSignups = eventSignups.filter(s => s.occurrenceId === occ.id);
		const totalAttendees = occSignups.reduce((sum, s) => sum + (s.guestCount || 0) + 1, 0); // +1 for the signup person
		// Use occurrence maxSpaces if set, otherwise use event maxSpaces
		const effectiveMaxSpaces = occ.maxSpaces !== null && occ.maxSpaces !== undefined ? occ.maxSpaces : event.maxSpaces;
		const availableSpots = effectiveMaxSpaces ? effectiveMaxSpaces - totalAttendees : null;
		const isFull = effectiveMaxSpaces ? totalAttendees >= effectiveMaxSpaces : false;

		return {
			...occ,
			rotaStats: {
				rotaCount,
				totalCapacity,
				totalAssigned,
				spotsRemaining
			},
			signupStats: {
				signupCount: occSignups.length,
				totalAttendees,
				availableSpots,
				isFull,
				signups: occSignups
			}
		};
	});

	// Ensure an event token exists and generate links
	let rotaSignupLink = '';
	let publicEventLink = '';
	const occurrenceLinks = [];
	
	try {
		const token = await ensureEventToken(params.id);
		const baseUrl = env.APP_BASE_URL || url.origin || 'http://localhost:5173';
		rotaSignupLink = `${baseUrl}/signup/event/${token.token}`;
		publicEventLink = `${baseUrl}/event/${token.token}`;
		
		// Generate occurrence-specific links
		for (const occ of occurrences) {
			try {
				const occToken = await ensureOccurrenceToken(params.id, occ.id);
				occurrenceLinks.push({
					occurrenceId: occ.id,
					link: `${baseUrl}/event/${occToken.token}`
				});
			} catch (error) {
				console.error(`Error generating token for occurrence ${occ.id}:`, error);
			}
		}
	} catch (error) {
		console.error('Error generating event token:', error);
		// Continue without links if token generation fails
	}

	const csrfToken = getCsrfToken(cookies) || '';
	return { event, occurrences: occurrencesWithStats, rotas, rotaSignupLink, publicEventLink, occurrenceLinks, csrfToken };
}

export const actions = {
	update: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const description = data.get('description') || '';
			const sanitized = await sanitizeHtml(description);

			const eventData = {
				title: data.get('title'),
				description: sanitized,
				location: data.get('location'),
				visibility: data.get('visibility') === 'public' ? 'public' : 'private',
				maxSpaces: data.get('maxSpaces') ? parseInt(data.get('maxSpaces')) : null
			};

			const validated = validateEvent(eventData);
			await update('events', params.id, validated);

			return { success: true };
		} catch (error) {
			return { error: error.message };
		}
	},

	delete: async ({ params, cookies, request }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		await remove('events', params.id);
		throw redirect(302, '/hub/events');
	}
};

