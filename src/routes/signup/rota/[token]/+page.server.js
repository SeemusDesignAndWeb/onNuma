import { redirect, error, fail } from '@sveltejs/kit';
import { getRotaTokenByToken } from '$lib/crm/server/tokens.js';
import { findById, update, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId } from '$lib/crm/server/orgContext.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';

export async function load({ params, cookies }) {
	const token = await getRotaTokenByToken(params.token);
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
	
	console.log('[Rota Signup] Event ID:', event.id);
	console.log('[Rota Signup] Total event occurrences:', eventOccurrences.length);
	console.log('[Rota Signup] Upcoming occurrences:', occurrences.length);
	
	// Get rotas - if token has a rotaId, only show that specific rota
	// Otherwise (for backward compatibility), show all rotas for the event
	// Only show public rotas on public signup pages
	const allRotas = token.rotaId 
		? await findMany('rotas', r => r.eventId === event.id && r.id === token.rotaId)
		: await findMany('rotas', r => r.eventId === event.id);
	
	console.log('[Rota Signup] All rotas found:', allRotas.length);
	console.log('[Rota Signup] Token rotaId:', token.rotaId);
	
	// Filter to only show public rotas (internal rotas are not accessible via public signup)
	const rotas = allRotas.filter(r => {
		const visibility = r.visibility || 'public';
		const isPublic = visibility === 'public';
		if (!isPublic) {
			console.log('[Rota Signup] Filtered out rota (not public):', r.id, 'visibility:', visibility);
		}
		return isPublic;
	});
	
	console.log('[Rota Signup] Public rotas:', rotas.length);
	
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
			});
		}
		
		return {
			...rota,
			assigneesByOcc
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
				const token = await getRotaTokenByToken(params.token);
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

				// Parse name into firstName and lastName
				const nameParts = name.trim().split(/\s+/);
				const firstName = nameParts[0] || '';
				const lastName = nameParts.slice(1).join(' ') || '';

				// Try to match with existing contact by email
				const normalizedEmail = email.trim().toLowerCase();
				const existingContacts = await findMany('contacts', c => 
					c.email && c.email.toLowerCase() === normalizedEmail
				);

				let matchedContact = null;
				if (existingContacts.length > 0) {
					matchedContact = existingContacts[0];
					
					// Check if contact is confirmed
					if (matchedContact.confirmed === false) {
						return fail(400, { 
							error: 'Your contact details need to be confirmed before you can sign up for rotas. Please contact an administrator.' 
						});
					}
					
					// Validate name matches the contact
					const contactFirstName = (matchedContact.firstName || '').trim().toLowerCase();
					const contactLastName = (matchedContact.lastName || '').trim().toLowerCase();
					const inputFirstName = firstName.trim().toLowerCase();
					const inputLastName = lastName.trim().toLowerCase();
					
					// Check if names match (allow partial matches - at least first name should match)
					const firstNameMatches = !inputFirstName || contactFirstName.includes(inputFirstName) || inputFirstName.includes(contactFirstName);
					const lastNameMatches = !inputLastName || !contactLastName || contactLastName.includes(inputLastName) || inputLastName.includes(contactLastName) || inputLastName === '';
					
					// If we have a last name in the contact, require it to match
					if (contactLastName && inputLastName && !lastNameMatches) {
						return fail(400, { 
							error: 'The name provided does not match the account for this email address. Please check your details and try again.' 
						});
					}
					
					// Require first name to match if provided
					if (inputFirstName && !firstNameMatches) {
						return fail(400, { 
							error: 'The name provided does not match the account for this email address. Please check your details and try again.' 
						});
					}
					
					// Optionally update contact name if it's missing or more complete
					const existingFullName = `${matchedContact.firstName || ''} ${matchedContact.lastName || ''}`.trim();
					const newFullName = name.trim();
					
					if (!existingFullName || (newFullName.length > existingFullName.length && newFullName !== existingFullName)) {
						const updatedContact = {
							...matchedContact,
							firstName: firstName || matchedContact.firstName || '',
							lastName: lastName || matchedContact.lastName || '',
							updatedAt: new Date().toISOString()
						};
						matchedContact = await update('contacts', matchedContact.id, updatedContact);
					}
				} else {
					// Contact must exist in database to sign up for rotas
					return fail(400, { 
						error: 'No account found with this email address. Please sign up as a member first or contact an administrator to add you to the system.' 
					});
				}

				// Check if signing up with spouse
				const signUpWithSpouse = data.get('signUpWithSpouse') === 'on' || data.get('signUpWithSpouse') === 'true';
				let spouseContact = null;
				
				if (signUpWithSpouse && matchedContact && matchedContact.spouseId) {
					spouseContact = await findById('contacts', matchedContact.spouseId);
					if (!spouseContact) {
						return fail(400, { error: 'Spouse contact not found' });
					}
				}

				// Get selected rotas and occurrences
				const selectedRotasStr = data.get('selectedRotas') || '[]';
				console.log('[Rota Signup] Received selectedRotas string:', selectedRotasStr);
				
				let selectedRotas;
				try {
					selectedRotas = JSON.parse(selectedRotasStr);
					console.log('[Rota Signup] Parsed selectedRotas:', JSON.stringify(selectedRotas, null, 2));
				} catch (parseError) {
					console.error('[Rota Signup] JSON parse error:', parseError);
					console.error('[Rota Signup] Failed to parse:', selectedRotasStr);
					return fail(400, { error: 'Invalid selection data format' });
				}
				
				if (!Array.isArray(selectedRotas)) {
					console.error('[Rota Signup] selectedRotas is not an array:', typeof selectedRotas, selectedRotas);
					return fail(400, { error: 'Invalid selection data format' });
				}
				
				if (selectedRotas.length === 0) {
					console.warn('[Rota Signup] No rotas selected. selectedRotasStr was:', selectedRotasStr);
					return fail(400, { error: 'Please select at least one rota and occurrence to sign up for' });
				}

				// Get upcoming occurrences to check for clashes
				const eventOccurrences = await findMany('occurrences', o => o.eventId === event.id);
				const occurrences = filterUpcomingOccurrences(eventOccurrences);
				const rotas = await findMany('rotas', r => r.eventId === event.id);
				const allContacts = await readCollection('contacts');
				const holidays = await readCollection('holidays');

				const errors = [];

				// Check for holidays
				const contactHolidays = holidays.filter(h => h.contactId === matchedContact.id);
				for (const { rotaId, occurrenceId } of selectedRotas) {
					const occ = occurrences.find(o => o.id === occurrenceId);
					if (occ) {
						const occStart = new Date(occ.startsAt);
						const occEnd = new Date(occ.endsAt || occ.startsAt);
						
						const isAway = contactHolidays.some(h => {
							const hStart = new Date(h.startDate);
							const hEnd = new Date(h.endDate);
							return (occStart < hEnd && occEnd > hStart);
						});
						
						if (isAway) {
							errors.push(`You have booked an away day for ${formatDateTimeUK(occ.startsAt)}`);
						}
					}
				}

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
					const rota = rotas.find(r => r.id === rotaId);
					if (!rota) {
						errors.push(`Rota not found: ${rotaId}`);
						continue;
					}

					const targetOccurrenceId = occurrenceId || rota.occurrenceId || null;

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
									const aOccId = a.occurrenceId || r.occurrenceId;
									return aOccId === targetOccurrenceId;
								}
								return false;
							});

							const alreadySignedUp = assigneesForOcc.some(a => {
								if (typeof a === 'string') {
									// Old format: string is contactId
									return a === matchedContact.id;
								}
								if (a && typeof a === 'object') {
									// Check contactId match
									if (a.contactId) {
										if (typeof a.contactId === 'string') {
											return a.contactId === matchedContact.id;
										}
										// Handle nested contactId object (shouldn't happen, but be safe)
										if (a.contactId && typeof a.contactId === 'object' && a.contactId.id) {
											return a.contactId.id === matchedContact.id;
										}
									}
									// Also check email match for legacy public signup format (shouldn't happen now, but be safe)
									if (a.email && a.email.toLowerCase() === normalizedEmail) {
										return true;
									}
								}
								return false;
							});

							if (alreadySignedUp) {
								const occ = occurrences.find(o => o.id === targetOccurrenceId);
								const occTime = occ ? formatDateTimeUK(occ.startsAt) : 'this occurrence';
								errors.push(`You are already signed up for a rota on ${occTime}`);
								break;
							}
						}
					}
				}

				// If there are errors, return them now
				if (errors.length > 0) {
					return fail(400, { error: errors.join('; ') });
				}

				// Process each selected rota/occurrence
				for (const { rotaId, occurrenceId } of selectedRotas) {
					console.log(`[Rota Signup] Processing rotaId: ${rotaId}, occurrenceId: ${occurrenceId}`);
					
					// Reload rota from database to get latest data (in case it was updated in previous iteration)
					const rota = await findById('rotas', rotaId);
					if (!rota) {
						errors.push(`Rota not found: ${rotaId}`);
						continue;
					}

					// Determine the actual occurrenceId to use
					const targetOccurrenceId = occurrenceId || rota.occurrenceId || null;
					console.log(`[Rota Signup] Target occurrenceId: ${targetOccurrenceId}, Current assignees count: ${rota.assignees?.length || 0}`);
					
					// If this rota is linked to a meeting planner for a specific occurrence,
					// default to that occurrence when none is supplied so both views stay in sync
					const meetingPlanners = await readCollection('meeting_planners');
					const linkedMeetingPlanner = meetingPlanners.find(mp => 
						mp.meetingLeaderRotaId === rotaId ||
						mp.worshipLeaderRotaId === rotaId ||
						mp.speakerRotaId === rotaId ||
						mp.callToWorshipRotaId === rotaId
					);
					
					if (linkedMeetingPlanner && linkedMeetingPlanner.occurrenceId && !targetOccurrenceId) {
						targetOccurrenceId = linkedMeetingPlanner.occurrenceId;
					}

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

					// Add assignee - link to matched contact (contact must exist, checked earlier)
					existingAssignees.push({ 
						contactId: matchedContact.id, 
						occurrenceId: targetOccurrenceId 
					});
					console.log(`[Rota Signup] Adding assignee. Total assignees after add: ${existingAssignees.length}`);

					// If signing up with spouse, also add spouse
					if (signUpWithSpouse && spouseContact) {
						// Check if spouse is already signed up for this occurrence
						const spouseAlreadySignedUp = assigneesForOccurrence.some(a => {
							if (typeof a === 'string') {
								return a === spouseContact.id;
							}
							if (a && typeof a === 'object' && a.contactId) {
								if (typeof a.contactId === 'string') {
									return a.contactId === spouseContact.id;
								}
							}
							return false;
						});

						if (!spouseAlreadySignedUp) {
							// Check capacity for spouse
							if (assigneesForOccurrence.length + 1 >= rota.capacity) {
								errors.push(`Rota "${rota.role}" does not have enough capacity for both you and your spouse for this occurrence`);
								continue;
							}
							
							existingAssignees.push({ 
								contactId: spouseContact.id, 
								occurrenceId: targetOccurrenceId 
							});
							console.log(`[Rota Signup] Adding spouse assignee. Total assignees after add: ${existingAssignees.length}`);
						}
					}

					// Update rota
					const updatedRota = {
						...rota,
						assignees: existingAssignees
					};
					const { validateRota } = await import('$lib/crm/server/validators.js');
					const validated = validateRota(updatedRota);
					await update('rotas', rota.id, validated);
					console.log(`[Rota Signup] Updated rota ${rotaId} with ${validated.assignees.length} assignees`);
				}

				if (errors.length > 0) {
					return fail(400, { error: errors.join('; ') });
				}

				return { success: true, message: 'Successfully signed up for selected rotas!' };
			} catch (error) {
				return fail(500, { error: error.message || 'Failed to sign up for rota' });
			}
		}
};

