import { error } from '@sveltejs/kit';
import { getEventTokenByToken, getOccurrenceTokenByToken } from '$lib/crm/server/tokens.js';
import { findById, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import { getCsrfToken } from '$lib/crm/server/auth.js';

export async function load({ params, cookies }) {
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

	const csrfToken = getCsrfToken(cookies) || '';
	return { token, event, occurrences: occurrencesWithSignups, allOccurrences: allOccurrencesWithSignups, occurrenceId, csrfToken };
}

export const actions = {
	signup: async ({ request, params, cookies, url }) => {
		const { fail } = await import('@sveltejs/kit');
		const { verifyCsrfToken } = await import('$lib/crm/server/auth.js');
		const { create } = await import('$lib/crm/server/fileStore.js');
		const { isValidEmail } = await import('$lib/crm/server/validators.js');
		const { sendEventSignupConfirmation } = await import('$lib/crm/server/email.js');
		
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

			const occurrenceId = data.get('occurrenceId');
			const name = data.get('name') || '';
			const email = data.get('email') || '';
			const guestCount = parseInt(data.get('guestCount') || '0', 10);

			if (!occurrenceId) {
				return fail(400, { error: 'Please select a date' });
			}

			if (!name || !email) {
				return fail(400, { error: 'Name and email are required' });
			}

			if (!isValidEmail(email)) {
				return fail(400, { error: 'Invalid email address' });
			}

			// Check if occurrence exists and is not full
			const occurrence = await findById('occurrences', occurrenceId);
			if (!occurrence || occurrence.eventId !== event.id) {
				return fail(400, { error: 'Invalid occurrence selected' });
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

			// Create signup
			const signup = await create('event_signups', {
				eventId: event.id,
				occurrenceId: occurrenceId,
				name: name.trim(),
				email: email.trim().toLowerCase(),
				guestCount: guestCount || 0
			});

			// Send confirmation email
			try {
				await sendEventSignupConfirmation({
					to: email,
					name: name,
					event: event,
					occurrence: occurrence,
					guestCount: guestCount || 0
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

