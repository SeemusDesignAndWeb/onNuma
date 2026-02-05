import { error, fail } from '@sveltejs/kit';
import { getEventTokenByToken } from '$lib/crm/server/tokens.js';
import { findById, update, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { validateRota } from '$lib/crm/server/validators.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';

export async function load({ params, cookies }) {
	const token = await getEventTokenByToken(params.token);
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

	// Get upcoming occurrences for this event
	const eventOccurrences = await findMany('occurrences', o => o.eventId === event.id);
	const occurrences = filterUpcomingOccurrences(eventOccurrences);
	
	// Get all rotas for this event - only show public rotas on public signup pages
	const allRotas = await findMany('rotas', r => r.eventId === event.id);
	const rotas = allRotas.filter(r => (r.visibility || 'public') === 'public');
	
	// Load contacts to enrich assignees
	const contacts = await readCollection('contacts');
	
	// Process rotas with assignee counts per occurrence
	const rotasWithDetails = rotas.map(rota => {
		const assignees = rota.assignees || [];
		
		// Group assignees by occurrence
		const assigneesByOcc = {};
		if (occurrences.length > 0) {
			occurrences.forEach(occ => {
			assigneesByOcc[occ.id] = assignees.filter(a => {
				if (typeof a === 'string') {
					// Old format - if rota has occurrenceId, only count for that occurrence
					return rota.occurrenceId === occ.id;
				}
				if (a && typeof a === 'object') {
					const aOccId = a.occurrenceId || rota.occurrenceId;
					return aOccId === occ.id;
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
					const contact = contacts.find(c => c.id === a.contactId);
					return {
						id: contact?.id,
						name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email : (a.name || 'Unknown'),
						email: contact?.email || a.email || ''
					};
				}
				// Public signup
				return {
					id: null,
					name: a.name || 'Unknown',
					email: a.email || ''
				};
			});
			});
		}
		
		return {
			...rota,
			assigneesByOcc,
			// Get occurrence if rota is for a specific one
			occurrence: rota.occurrenceId ? occurrences.find(o => o.id === rota.occurrenceId) : null
		};
	});

	const csrfToken = getCsrfToken(cookies) || '';
	return { token, event, occurrences, rotas: rotasWithDetails, csrfToken };
}

export const actions = {
	signup: async ({ request, params, cookies }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const token = await getEventTokenByToken(params.token);
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

			const name = data.get('name') || '';
			const email = data.get('email') || '';

			if (!name || !email) {
				return fail(400, { error: 'Name and email are required' });
			}

			// Get selected rotas and occurrences
			const selectedRotas = JSON.parse(data.get('selectedRotas') || '[]');
			
			if (selectedRotas.length === 0) {
				return fail(400, { error: 'Please select at least one rota to sign up for' });
			}

			// Get upcoming occurrences to check for clashes
			const eventOccurrences = await findMany('occurrences', o => o.eventId === event.id);
			const occurrences = filterUpcomingOccurrences(eventOccurrences);
			const rotas = await findMany('rotas', r => r.eventId === event.id);

			const errors = [];

			// Check for clashes - same occurrence selected multiple times (check this FIRST)
			const occurrenceCounts = {};
			for (const { rotaId, occurrenceId } of selectedRotas) {
				if (occurrenceId) {
					occurrenceCounts[occurrenceId] = (occurrenceCounts[occurrenceId] || 0) + 1;
				}
			}

			for (const [occId, count] of Object.entries(occurrenceCounts)) {
				if (count > 1) {
					return fail(400, { error: 'Your rota selections are clashing, please change one of your rota signups' });
				}
			}

			// Check if already signed up to any rota for the selected occurrences
			for (const { rotaId, occurrenceId } of selectedRotas) {
				const targetOccurrenceId = occurrenceId || null;

				// Block signup to past occurrences
				if (targetOccurrenceId) {
					const occ = occurrences.find(o => o.id === targetOccurrenceId);
					if (!occ) {
						errors.push('The selected occurrence is no longer available for signup');
						continue;
					}
				}
				
				// Check ALL rotas for this occurrence to see if email is already signed up
				if (targetOccurrenceId) {
					const allRotasForOcc = rotas.filter(r => {
						return !r.occurrenceId || r.occurrenceId === targetOccurrenceId;
					});

					for (const r of allRotasForOcc) {
						const assignees = Array.isArray(r.assignees) ? r.assignees : [];
						const assigneesForOcc = assignees.filter(a => {
							if (typeof a === 'string') {
								return r.occurrenceId === targetOccurrenceId;
							}
							if (a && typeof a === 'object') {
								const aOccurrenceId = a.occurrenceId || r.occurrenceId;
								return aOccurrenceId === targetOccurrenceId;
							}
							return false;
						});

						const emailExists = assigneesForOcc.some(a => {
							if (typeof a === 'string') {
								return false; // Can't check email for old format
							}
							if (a && typeof a === 'object') {
								return a.email && a.email.toLowerCase() === email.toLowerCase();
							}
							return false;
						});

						if (emailExists) {
							errors.push(`You are already signed up for a rota on this occurrence`);
							break;
						}
					}
				}
			}

			// Process each selected rota
			for (const { rotaId, occurrenceId } of selectedRotas) {
				const rota = rotas.find(r => r.id === rotaId);
				if (!rota) {
					errors.push(`Rota not found: ${rotaId}`);
					continue;
				}

				// Determine the actual occurrenceId to use
				const targetOccurrenceId = occurrenceId || rota.occurrenceId || null;

				// Check capacity per occurrence
				const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
				const assigneesForOccurrence = existingAssignees.filter(a => {
					if (typeof a === 'string') {
						return rota.occurrenceId === targetOccurrenceId;
					}
					if (a && typeof a === 'object') {
						const aOccurrenceId = a.occurrenceId || rota.occurrenceId;
						return aOccurrenceId === targetOccurrenceId;
					}
					return false;
				});

				if (assigneesForOccurrence.length >= rota.capacity) {
					errors.push(`Rota "${rota.role}" is full for this occurrence`);
					continue;
				}

				// Add assignee as object (name, email, occurrenceId) for public signups
				existingAssignees.push({ name, email, occurrenceId: targetOccurrenceId });

				// Update rota
				const updatedRota = {
					...rota,
					assignees: existingAssignees
				};
				const validated = validateRota(updatedRota);
				await update('rotas', rota.id, validated);
			}

			if (errors.length > 0) {
				return fail(400, { error: errors.join('; ') });
			}

			return { success: true, message: 'Successfully signed up for selected rotas!' };
		} catch (error) {
			console.error('Error in event signup:', error);
			return fail(500, { error: error.message || 'Failed to sign up for rotas' });
		}
	}
};

