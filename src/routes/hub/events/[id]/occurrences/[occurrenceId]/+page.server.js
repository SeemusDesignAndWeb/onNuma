import { redirect } from '@sveltejs/kit';
import { findById, update, remove, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import { validateOccurrence } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';

export async function load({ params, cookies }) {
	const event = await findById('events', params.id);
	if (!event) {
		throw redirect(302, '/hub/events');
	}

	const occurrence = await findById('occurrences', params.occurrenceId);
	if (!occurrence || occurrence.eventId !== params.id) {
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

	const csrfToken = getCsrfToken(cookies) || '';
	return { event, occurrence, rotas: rotasWithAssignees, signups: signupsWithDetails, csrfToken };
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
				information: data.get('information') || ''
			};

			const validated = validateOccurrence(occurrenceData);
			await update('occurrences', params.occurrenceId, validated);

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
	}
};

