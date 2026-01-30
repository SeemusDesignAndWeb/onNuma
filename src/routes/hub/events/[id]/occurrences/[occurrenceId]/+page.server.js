import { redirect, fail } from '@sveltejs/kit';
import { findById, update, remove, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import { validateOccurrence } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { isUpcomingOccurrence } from '$lib/crm/utils/occurrenceFilters.js';
import { ensureOccurrenceToken } from '$lib/crm/server/tokens.js';
import { env } from '$env/dynamic/private';

export async function load({ params, cookies, url }) {
	const event = await findById('events', params.id);
	if (!event) {
		throw redirect(302, '/hub/events');
	}

	const occurrence = await findById('occurrences', params.occurrenceId);
	if (!occurrence || occurrence.eventId !== params.id) {
		throw redirect(302, `/hub/events/${params.id}`);
	}

	// Hide past occurrences by redirecting to the event page
	if (!isUpcomingOccurrence(occurrence)) {
		throw redirect(302, `/hub/events/${params.id}`);
	}

	// Get all rotas for this event
	const allRotas = await findMany('rotas', r => r.eventId === params.id);
	
	// Filter rotas that apply to this occurrence
	// A rota applies if:
	// 1. It has no occurrenceId (applies to all occurrences)
	// 2. It has an occurrenceId matching this occurrence
	const applicableRotas = allRotas.filter(rota => {
		return !rota.occurrenceId || rota.occurrenceId === params.occurrenceId;
	});

	// Load contacts to enrich assignees
	const contacts = await readCollection('contacts');

	// Process rotas with assignees for this occurrence
	const rotasWithAssignees = applicableRotas.map(rota => {
		const assignees = rota.assignees || [];
		
		// Filter assignees for this specific occurrence
		const assigneesForOcc = assignees.filter(a => {
			if (typeof a === 'string') {
				// Old format - if rota has occurrenceId, only count for that occurrence
				return rota.occurrenceId === params.occurrenceId;
			}
			if (a && typeof a === 'object') {
				const aOccId = a.occurrenceId || rota.occurrenceId;
				return aOccId === params.occurrenceId;
			}
			return false;
		}).map(a => {
			// Enrich with contact details
			if (typeof a === 'string') {
				const contact = contacts.find(c => c.id === a);
				return {
					id: contact?.id,
					name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : 'Unknown',
					email: contact?.email || ''
				};
			}
			if (a && typeof a === 'object' && a.contactId) {
				if (typeof a.contactId === 'string') {
					const contact = contacts.find(c => c.id === a.contactId);
					return {
						id: contact?.id,
						name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : (a.name || 'Unknown'),
						email: contact?.email || a.email || ''
					};
				}
				// Public signup format
				return {
					id: null,
					name: a.contactId.name || a.name || 'Unknown',
					email: a.contactId.email || a.email || ''
				};
			}
			// Public signup
			return {
				id: null,
				name: a.name || 'Unknown',
				email: a.email || ''
			};
		});

		return {
			...rota,
			assigneesForOcc,
			assignedCount: assigneesForOcc.length,
			spotsRemaining: (rota.capacity || 0) - assigneesForOcc.length
		};
	});

	// Get event signups for this occurrence
	const signups = await findMany('event_signups', s => 
		s.eventId === params.id && s.occurrenceId === params.occurrenceId
	);

	// Enrich signups with contact information if available
	const signupsWithDetails = signups.map(signup => {
		const contact = contacts.find(c => c.email === signup.email);
		return {
			...signup,
			contactId: contact?.id || null,
			contactName: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : null
		};
	});

	// Generate public link for this occurrence
	let publicOccurrenceLink = '';
	try {
		const occToken = await ensureOccurrenceToken(params.id, params.occurrenceId);
		const baseUrl = url.origin || env.APP_BASE_URL || 'http://localhost:5173';
		publicOccurrenceLink = `${baseUrl}/event/${occToken.token}`;
	} catch (error) {
		console.error('Error generating occurrence token:', error);
	}

	const csrfToken = getCsrfToken(cookies) || '';
	return { event, occurrence, rotas: rotasWithAssignees, signups: signupsWithDetails, publicOccurrenceLink, csrfToken };
}

export const actions = {
	update: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			const startsAt = data.get('startsAt');
			const endsAt = data.get('endsAt');
			const applyScope = data.get('applyScope') || 'this'; // 'this' or 'future'
			const allDay = data.get('allDay') === 'true';
			
			// Convert datetime-local to ISO format
			const startISO = startsAt ? new Date(startsAt).toISOString() : null;
			const endISO = endsAt ? new Date(endsAt).toISOString() : null;
			
			// Handle maxSpaces: if empty string, set to null to use event default
			// If provided, parse as integer
			const maxSpacesValue = data.get('maxSpaces');
			const maxSpaces = maxSpacesValue && maxSpacesValue.trim() !== '' 
				? parseInt(maxSpacesValue) 
				: null;
			
			const occurrenceData = {
				eventId: params.id,
				startsAt: startISO,
				endsAt: endISO,
				location: data.get('location') || '',
				maxSpaces: maxSpaces,
				information: data.get('information') || '',
				allDay: allDay
			};

			const validated = validateOccurrence(occurrenceData);
			
			// Get the current occurrence to check its start time
			const currentOccurrence = await findById('occurrences', params.occurrenceId);
			if (!currentOccurrence) {
				return { error: 'Occurrence not found' };
			}
			
			// Get the original start time before updating (to determine which occurrences are "future")
			const originalStartTime = new Date(currentOccurrence.startsAt);
			
			// Update the current occurrence
			await update('occurrences', params.occurrenceId, validated);
			
			// If applyScope is 'future', update all future occurrences
			if (applyScope === 'future') {
				
				// Find all occurrences for this event that start after the current occurrence's original start time
				const allOccurrences = await findMany('occurrences', o => o.eventId === params.id);
				
				// Filter to future occurrences (starting after the current occurrence's original start time)
				const futureOccurrences = allOccurrences.filter(occ => {
					if (occ.id === params.occurrenceId) return false; // Skip the one we already updated
					const occStart = new Date(occ.startsAt);
					return occStart > originalStartTime;
				});
				
				// Update each future occurrence with the same changes
				// Note: We preserve the occurrence's own startsAt/endsAt times, but update other fields
				for (const futureOcc of futureOccurrences) {
					const futureOccurrenceData = {
						eventId: futureOcc.eventId,
						startsAt: futureOcc.startsAt, // Preserve original start time
						endsAt: futureOcc.endsAt, // Preserve original end time
						location: validated.location, // Apply new location
						maxSpaces: validated.maxSpaces, // Apply new maxSpaces
						information: validated.information, // Apply new information
						allDay: validated.allDay // Apply allDay setting
					};
					
					const validatedFuture = validateOccurrence(futureOccurrenceData);
					await update('occurrences', futureOcc.id, validatedFuture);
				}
			}

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

		await remove('occurrences', params.occurrenceId);
		throw redirect(302, `/hub/events/${params.id}`);
	},

	deleteSignup: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const signupId = data.get('signupId');
			if (!signupId) {
				return fail(400, { error: 'Signup ID is required' });
			}

			// Verify the signup belongs to this event and occurrence
			const signup = await findById('event_signups', signupId);
			if (!signup) {
				return fail(404, { error: 'Signup not found' });
			}

			if (signup.eventId !== params.id || signup.occurrenceId !== params.occurrenceId) {
				return fail(403, { error: 'Signup does not belong to this occurrence' });
			}

			await remove('event_signups', signupId);
			return { success: true, type: 'deleteSignup' };
		} catch (error) {
			console.error('Error deleting signup:', error);
			return fail(400, { error: error.message || 'Failed to delete signup' });
		}
	}
};

