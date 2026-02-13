import { error } from '@sveltejs/kit';
import { getEventTokenByToken, getOccurrenceTokenByToken } from '$lib/crm/server/tokens.js';
import { findById, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';
import { getCsrfToken } from '$lib/crm/server/auth.js';
import { filterUpcomingOccurrences, isUpcomingOccurrence } from '$lib/crm/utils/occurrenceFilters.js';

// Simple in-memory rate limiting (in production, use Redis or similar)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_SIGNUPS_PER_WINDOW = 5;

// Get client IP address
function getClientIp(request) {
	try {
		// Try to get from headers (for reverse proxy setups)
		const forwarded = request.headers.get('x-forwarded-for');
		if (forwarded) {
			return forwarded.split(',')[0].trim();
		}
		const realIp = request.headers.get('x-real-ip');
		if (realIp) {
			return realIp;
		}
	} catch (e) {
		// Fallback
	}
	return 'unknown';
}

// Rate limiting check
function checkRateLimit(ip) {
	const now = Date.now();
	const userSignups = rateLimitMap.get(ip) || [];
	
	// Remove old signups outside the window
	const recentSignups = userSignups.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
	
	if (recentSignups.length >= MAX_SIGNUPS_PER_WINDOW) {
		return false; // Rate limit exceeded
	}
	
	// Add current signup
	recentSignups.push(now);
	rateLimitMap.set(ip, recentSignups);
	
	// Clean up old entries periodically
	if (rateLimitMap.size > 1000) {
		for (const [key, signups] of rateLimitMap.entries()) {
			const filtered = signups.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
			if (filtered.length === 0) {
				rateLimitMap.delete(key);
			} else {
				rateLimitMap.set(key, filtered);
			}
		}
	}
	
	return true; // Within rate limit
}

// Sanitize name field (remove HTML tags and dangerous characters)
function sanitizeName(name) {
	if (!name || typeof name !== 'string') return '';
	// Remove HTML tags
	let sanitized = name.replace(/<[^>]*>/g, '');
	// Remove control characters except newlines and tabs
	sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
	// Trim and limit length
	return sanitized.trim().substring(0, 200);
}

// Sanitize free-text field (dietary requirements, etc.)
function sanitizeFreeText(text) {
	if (!text || typeof text !== 'string') return '';
	let sanitized = text.replace(/<[^>]*>/g, '');
	sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
	return sanitized.trim().substring(0, 500);
}

export async function load({ params, cookies, url }) {
	// Try to get occurrence token first, then event token
	let token = await getOccurrenceTokenByToken(params.token);
	let occurrenceId = null;
	
	if (token) {
		occurrenceId = token.occurrenceId;
	} else {
		token = await getEventTokenByToken(params.token);
	}
	
	if (!token) {
		throw error(404, 'Invalid token');
	}

	const event = await findById('events', token.eventId);
	if (!event) {
		throw error(404, 'Event not found');
	}
	const organisationId = await getCurrentOrganisationId();
	if (organisationId != null && event.organisationId != null && event.organisationId !== organisationId) {
		throw error(404, 'Event not found');
	}

	// Get all occurrences for this event
	const allOccurrences = await findMany('occurrences', o => o.eventId === event.id);
	
	// Get all event signups for this event
	const signups = await findMany('event_signups', s => s.eventId === event.id);
	
	// Calculate signup counts for all occurrences (for dropdown)
	const allOccurrencesWithSignups = allOccurrences.map(occ => {
		const occSignups = signups.filter(s => s.occurrenceId === occ.id);
		const totalAttendees = occSignups.reduce((sum, s) => sum + (s.guestCount || 0) + 1, 0);
		// Use occurrence maxSpaces if set, otherwise use event maxSpaces
		const effectiveMaxSpaces = occ.maxSpaces !== null && occ.maxSpaces !== undefined ? occ.maxSpaces : event.maxSpaces;
		const availableSpots = effectiveMaxSpaces ? effectiveMaxSpaces - totalAttendees : null;
		
		return {
			...occ,
			signups: occSignups,
			totalAttendees,
			availableSpots,
			isFull: effectiveMaxSpaces ? totalAttendees >= effectiveMaxSpaces : false
		};
	});
	
	// If this is an occurrence-specific token, filter to that occurrence only for display
	const occurrencesWithSignups = occurrenceId 
		? allOccurrencesWithSignups.filter(o => o.id === occurrenceId)
		: allOccurrencesWithSignups;

	// For signup form: only occurrences from today onwards (date-only, local)
	const upcomingOccurrencesForSignup = occurrenceId
		? allOccurrencesWithSignups.filter(o => o.id === occurrenceId && isUpcomingOccurrence(o))
		: filterUpcomingOccurrences(allOccurrencesWithSignups);

	// Load all rotas for this event (public, internal, church — for "Who's on the rotas" section)
	const allRotas = await findMany('rotas', r => r.eventId === event.id);
	const upcomingOccurrences = filterUpcomingOccurrences(allOccurrences);
	const contacts = await readCollection('contacts');

	const rotasWithAssignees = allRotas.map(rota => {
		const assignees = rota.assignees || [];
		const assigneesByOcc = {};
		upcomingOccurrences.forEach(occ => {
			assigneesByOcc[occ.id] = assignees.filter(a => {
				if (typeof a === 'string') return rota.occurrenceId === occ.id;
				if (a && typeof a === 'object') {
					const aOccId = a.occurrenceId ?? rota.occurrenceId;
					return aOccId === occ.id;
				}
				return false;
			}).map(a => {
				if (typeof a === 'string') {
					const contact = contacts.find(c => c.id === a);
					return {
						id: contact?.id,
						name: contact ? `${(contact.firstName || '').trim()} ${(contact.lastName || '').trim()}`.trim() || contact.email : 'Unknown',
						email: contact?.email || ''
					};
				}
				if (a && typeof a === 'object' && a.contactId) {
					if (typeof a.contactId === 'string') {
						const contact = contacts.find(c => c.id === a.contactId);
						return {
							id: contact?.id,
							name: contact ? `${(contact.firstName || '').trim()} ${(contact.lastName || '').trim()}`.trim() || contact.email : (a.name || 'Unknown'),
							email: contact?.email || a.email || ''
						};
					}
					return {
						id: null,
						name: a.contactId?.name || a.name || 'Unknown',
						email: a.contactId?.email || a.email || ''
					};
				}
				return { id: null, name: a?.name || 'Unknown', email: a?.email || '' };
			});
		});
		return { ...rota, assigneesByOcc };
	});

	// When coming from rota email link: ?occurrenceId=xxx#rotas — show only that date's assignees
	const rotaViewOccurrenceId = url.searchParams.get('occurrenceId') || null;

	const csrfToken = getCsrfToken(cookies) || '';
	return {
		token,
		event,
		occurrences: occurrencesWithSignups,
		allOccurrences: allOccurrencesWithSignups,
		upcomingOccurrencesForSignup,
		occurrenceId,
		rotas: rotasWithAssignees,
		upcomingOccurrencesForRotas: upcomingOccurrences,
		rotaViewOccurrenceId,
		csrfToken
	};
}

export const actions = {
	signup: async ({ request, params, cookies, url }) => {
		const { fail } = await import('@sveltejs/kit');
		const { verifyCsrfToken } = await import('$lib/crm/server/auth.js');
		const { create } = await import('$lib/crm/server/fileStore.js');
		const { isValidEmail } = await import('$lib/crm/server/validators.js');
		const { sendEventSignupConfirmation } = await import('$lib/crm/server/email.js');
		
		// Rate limiting check
		const clientIp = getClientIp(request);
		if (!checkRateLimit(clientIp)) {
			console.warn('Rate limit exceeded for IP:', clientIp);
			return fail(429, { error: 'Too many signup attempts. Please try again later.' });
		}
		
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			// Try occurrence token first, then event token
			let token = await getOccurrenceTokenByToken(params.token);
			if (!token) {
				token = await getEventTokenByToken(params.token);
			}
			
			if (!token) {
				return fail(404, { error: 'Invalid token' });
			}

			const event = await findById('events', token.eventId);
			if (!event) {
				return fail(404, { error: 'Event not found' });
			}
			const currentOrgId = await getCurrentOrganisationId();
			if (currentOrgId != null && event.organisationId != null && event.organisationId !== currentOrgId) {
				return fail(404, { error: 'Event not found' });
			}

			const occurrenceId = data.get('occurrenceId');
			let name = data.get('name') || '';
			const email = data.get('email') || '';
			let guestCount = parseInt(data.get('guestCount') || '0', 10);
			const dietaryRequirementsRaw = data.get('dietaryRequirements') || '';
			const dietaryRequirements = event.showDietaryRequirements ? sanitizeFreeText(dietaryRequirementsRaw) : '';

			if (!occurrenceId) {
				return fail(400, { error: 'Please select a date' });
			}

			if (!name || !email) {
				return fail(400, { error: 'Name and email are required' });
			}

			// Sanitize and validate name
			name = sanitizeName(name);
			if (!name || name.length === 0) {
				return fail(400, { error: 'Name is required and cannot be empty' });
			}
			if (name.length > 200) {
				return fail(400, { error: 'Name must be less than 200 characters' });
			}

			if (!isValidEmail(email)) {
				return fail(400, { error: 'Invalid email address' });
			}

			// Validate guest count bounds
			if (isNaN(guestCount) || guestCount < 0 || guestCount > 50) {
				return fail(400, { error: 'Number of guests must be between 0 and 50' });
			}

			// Check if occurrence exists and is not full
			const occurrence = await findById('occurrences', occurrenceId);
			if (!occurrence || occurrence.eventId !== event.id) {
				return fail(400, { error: 'Invalid occurrence selected' });
			}

			if (!isUpcomingOccurrence(occurrence)) {
				return fail(400, { error: 'This date has passed. Please select a date from today onwards.' });
			}

			// Check if already signed up
			const existingSignups = await findMany('event_signups', s => 
				s.eventId === event.id && 
				s.occurrenceId === occurrenceId && 
				s.email.toLowerCase() === email.toLowerCase()
			);

			if (existingSignups.length > 0) {
				return fail(400, { error: 'You have already signed up for this event date' });
			}

			// Check available spaces (use occurrence maxSpaces if set, otherwise event maxSpaces)
			const effectiveMaxSpaces = occurrence.maxSpaces !== null && occurrence.maxSpaces !== undefined 
				? occurrence.maxSpaces 
				: event.maxSpaces;
			
			if (effectiveMaxSpaces) {
				const allSignups = await findMany('event_signups', s => 
					s.eventId === event.id && s.occurrenceId === occurrenceId
				);
				const totalAttendees = allSignups.reduce((sum, s) => sum + (s.guestCount || 0) + 1, 0);
				const newTotal = totalAttendees + guestCount + 1;
				
				if (newTotal > effectiveMaxSpaces) {
					return fail(400, { error: `Not enough spaces available. Only ${effectiveMaxSpaces - totalAttendees} spots remaining.` });
				}
			}

			// Create signup (name already sanitized)
			const signup = await create('event_signups', {
				eventId: event.id,
				occurrenceId: occurrenceId,
				name: name, // Already sanitized
				email: email.trim().toLowerCase(),
				guestCount: guestCount,
				dietaryRequirements: dietaryRequirements || undefined
			});

			// Send confirmation email
			try {
				await sendEventSignupConfirmation({
					to: email,
					name: name,
					event: event,
					occurrence: occurrence,
					guestCount: guestCount || 0,
					dietaryRequirements: dietaryRequirements || undefined
				}, { url: url });
			} catch (emailError) {
				console.error('Failed to send confirmation email:', emailError);
				// Don't fail the signup if email fails
			}

			return {
				success: true,
				message: 'Successfully signed up for the event! A confirmation email has been sent.'
			};
		} catch (error) {
			console.error('Event signup error:', error);
			return fail(500, { error: error.message || 'Failed to sign up for event' });
		}
	}
};

