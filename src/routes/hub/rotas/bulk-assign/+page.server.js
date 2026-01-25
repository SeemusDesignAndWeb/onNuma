import { readCollection, findById, update } from '$lib/crm/server/fileStore.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { validateRota } from '$lib/crm/server/validators.js';
import { fail } from '@sveltejs/kit';
import { logDataChange } from '$lib/crm/server/audit.js';

export async function load({ cookies }) {
	const events = await readCollection('events');
	const rotas = await readCollection('rotas');
	const contacts = await readCollection('contacts');
	const lists = await readCollection('lists');

	// Sort contacts alphabetically
	const sortedContacts = contacts.sort((a, b) => {
		const aLastName = (a.lastName || '').toLowerCase();
		const bLastName = (b.lastName || '').toLowerCase();
		const aFirstName = (a.firstName || '').toLowerCase();
		const bFirstName = (b.firstName || '').toLowerCase();
		
		if (aLastName !== bLastName) {
			return aLastName.localeCompare(bLastName);
		}
		return aFirstName.localeCompare(bFirstName);
	});

	const csrfToken = getCsrfToken(cookies) || '';
	return { events, rotas, contacts: sortedContacts, lists, csrfToken };
}

/**
 * Get the last day of the month for a date
 */
function getLastDayOfMonth(date) {
	const d = new Date(date);
	return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * Check if a date is in the beginning of the month
 * Beginning = first 10 days of the month
 */
function isBeginningOfMonth(date) {
	const d = new Date(date);
	return d.getDate() <= 10;
}

/**
 * Check if a date is in the end of the month
 * End = last 10 days of the month
 */
function isEndOfMonth(date) {
	const d = new Date(date);
	const lastDay = getLastDayOfMonth(d);
	return d.getDate() > (lastDay - 10);
}

/**
 * Check if a date is in the middle of the month
 * Middle = days between beginning and end
 */
function isMiddleOfMonth(date) {
	const d = new Date(date);
	const lastDay = getLastDayOfMonth(d);
	const dayOfMonth = d.getDate();
	// Middle is days 11 through (lastDay - 10)
	return dayOfMonth > 10 && dayOfMonth <= (lastDay - 10);
}

/**
 * Get day of week name (0 = Sunday, 1 = Monday, etc.)
 */
function getDayOfWeekNumber(dayName) {
	const days = {
		'sunday': 0,
		'monday': 1,
		'tuesday': 2,
		'wednesday': 3,
		'thursday': 4,
		'friday': 5,
		'saturday': 6
	};
	return days[dayName.toLowerCase()] ?? null;
}

/**
 * Check if a date matches day of month criteria
 */
function matchesDayOfMonth(date, position) {
	switch (position) {
		case 'beginning':
			return isBeginningOfMonth(date);
		case 'end':
			return isEndOfMonth(date);
		case 'middle':
			return isMiddleOfMonth(date);
		default:
			return false;
	}
}

/**
 * Check if a date matches day of week criteria
 */
function matchesDayOfWeek(date, dayOfWeek, weekOfMonth) {
	const d = new Date(date);
	// Normalize to date only (ignore time)
	const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
	
	const targetDay = getDayOfWeekNumber(dayOfWeek);
	if (targetDay === null) return false;

	// Check if it's the right day of week
	if (dateOnly.getDay() !== targetDay) return false;

	// If weekOfMonth is 'any', match any occurrence
	if (weekOfMonth === 'any') return true;

	// Find which occurrence of this day of week it is in the month
	const firstOfMonth = new Date(dateOnly.getFullYear(), dateOnly.getMonth(), 1);
	const firstDayOfWeek = firstOfMonth.getDay();
	
	// Find the first occurrence of the target day in this month
	let firstOccurrenceDate = 1;
	if (firstDayOfWeek === targetDay) {
		// First day of month is already the target day
		firstOccurrenceDate = 1;
	} else {
		// Calculate days to add to get to the first occurrence
		const daysToAdd = (targetDay - firstDayOfWeek + 7) % 7;
		firstOccurrenceDate = 1 + daysToAdd;
	}

	// Count which occurrence this is (1st, 2nd, 3rd, 4th, or last)
	const dayOfMonth = dateOnly.getDate();
	const occurrenceNumber = Math.floor((dayOfMonth - firstOccurrenceDate) / 7) + 1;
	
	// Check if it's the last occurrence
	const lastOfMonth = new Date(dateOnly.getFullYear(), dateOnly.getMonth() + 1, 0);
	const lastDayOfWeek = lastOfMonth.getDay();
	let lastOccurrenceDate = lastOfMonth.getDate();
	if (lastDayOfWeek !== targetDay) {
		// Go back to find the last occurrence
		const daysToSubtract = (lastDayOfWeek - targetDay + 7) % 7;
		lastOccurrenceDate = lastOfMonth.getDate() - daysToSubtract;
	}
	const isLast = dayOfMonth === lastOccurrenceDate;

	switch (weekOfMonth) {
		case 'first':
			return occurrenceNumber === 1;
		case 'second':
			return occurrenceNumber === 2;
		case 'third':
			return occurrenceNumber === 3;
		case 'fourth':
			return occurrenceNumber === 4;
		case 'last':
			return isLast;
		default:
			return false;
	}
}

/**
 * Check if a date matches the timing criteria
 */
function matchesTiming(date, patternType, dayOfMonthPosition, dayOfWeek, weekOfMonth) {
	if (patternType === 'day-of-month') {
		return matchesDayOfMonth(date, dayOfMonthPosition);
	} else if (patternType === 'day-of-week') {
		return matchesDayOfWeek(date, dayOfWeek, weekOfMonth);
	}
	return false;
}

/**
 * Filter occurrences based on frequency and timing
 */
function filterOccurrences(occurrences, patternType, dayOfMonthPosition, dayOfWeek, weekOfMonth, frequency, endDate) {
	const end = endDate ? new Date(endDate) : null;
	const now = new Date();
	// Set time to start of today for comparison (ignore time component)
	now.setHours(0, 0, 0, 0);
	
	// First, get all occurrences that match the timing and date range
	const matchingOccs = occurrences.filter(occ => {
		const occDate = new Date(occ.startsAt);
		// Set time to start of day for comparison
		const occDateOnly = new Date(occDate.getFullYear(), occDate.getMonth(), occDate.getDate());
		
		// Skip past occurrences (before today)
		if (occDateOnly < now) {
			return false;
		}
		
		// Check end date
		if (end) {
			const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
			if (occDateOnly > endDateOnly) {
				return false;
			}
		}
		
		// Check timing
		return matchesTiming(occDate, patternType, dayOfMonthPosition, dayOfWeek, weekOfMonth);
	}).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
	
	// Parse frequency as number
	const frequencyNum = parseInt(frequency, 10);
	if (isNaN(frequencyNum) || frequencyNum < 1) {
		return matchingOccs;
	}
	
	// Group by month
	const byMonth = {};
	matchingOccs.forEach(occ => {
		const occDate = new Date(occ.startsAt);
		const monthKey = `${occDate.getFullYear()}-${occDate.getMonth()}`;
		if (!byMonth[monthKey]) {
			byMonth[monthKey] = [];
		}
		byMonth[monthKey].push(occ);
	});
	
	// Filter based on frequency and position
	const result = [];
	for (const monthKey in byMonth) {
		const monthOccs = byMonth[monthKey];
		
		if (patternType === 'day-of-month' && dayOfMonthPosition === 'end') {
			// For "end", take the last N occurrences
			result.push(...monthOccs.slice(-frequencyNum));
		} else {
			// For "beginning", "middle", or day-of-week, take the first N occurrences
			result.push(...monthOccs.slice(0, frequencyNum));
		}
	}
	
	return result.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

export const actions = {
	assign: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const rotaId = data.get('rotaId');
			const contactSelectionType = data.get('contactSelectionType'); // 'individual' or 'list'
			const contactIdsJson = data.get('contactIds'); // JSON array for individual contacts
			const listId = data.get('listId'); // For list selection
			
			// New flexible timing options
			const patternType = data.get('patternType'); // 'day-of-month' or 'day-of-week'
			const dayOfMonthPosition = data.get('dayOfMonthPosition'); // 'beginning', 'middle', 'end'
			const dayOfWeek = data.get('dayOfWeek'); // 'monday', 'tuesday', etc.
			const weekOfMonth = data.get('weekOfMonth'); // 'first', 'second', 'third', 'fourth', 'last', 'any'
			const frequency = data.get('frequency'); // Number as string
			const endDate = data.get('endDate'); // ISO date string

			if (!rotaId) {
				return fail(400, { error: 'Rota is required' });
			}

			if (!contactSelectionType || (contactSelectionType === 'individual' && !contactIdsJson) || (contactSelectionType === 'list' && !listId)) {
				return fail(400, { error: 'Contact selection is required' });
			}

			if (!patternType) {
				return fail(400, { error: 'Pattern type is required' });
			}

			if (patternType === 'day-of-month' && !dayOfMonthPosition) {
				return fail(400, { error: 'Day of month position is required' });
			}

			if (patternType === 'day-of-week' && (!dayOfWeek || !weekOfMonth)) {
				return fail(400, { error: 'Day of week and week of month are required' });
			}

			if (!frequency) {
				return fail(400, { error: 'Frequency is required' });
			}

			const frequencyNum = parseInt(frequency, 10);
			if (isNaN(frequencyNum) || frequencyNum < 1) {
				return fail(400, { error: 'Frequency must be a positive number' });
			}

			if (!endDate) {
				return fail(400, { error: 'End date is required' });
			}

			// Get the rota
			const rota = await findById('rotas', rotaId);
			if (!rota) {
				return fail(404, { error: 'Rota not found' });
			}

			// Get contacts to assign
			let contactIds = [];
			if (contactSelectionType === 'list') {
				const list = await findById('lists', listId);
				if (!list) {
					return fail(404, { error: 'List not found' });
				}
				contactIds = Array.isArray(list.contactIds) ? list.contactIds : [];
			} else {
				try {
					contactIds = JSON.parse(contactIdsJson);
				} catch (e) {
					return fail(400, { error: 'Invalid contact IDs format' });
				}
			}

			if (contactIds.length === 0) {
				return fail(400, { error: 'No contacts selected' });
			}

			console.log('[BULK ASSIGN] Contact IDs to assign:', contactIds.length, contactIds);

			// Get all occurrences for this event
			const allOccurrences = await readCollection('occurrences');
			const eventOccurrences = allOccurrences.filter(o => o.eventId === rota.eventId);

			console.log('[BULK ASSIGN] Total event occurrences:', eventOccurrences.length);
			console.log('[BULK ASSIGN] Pattern:', patternType, patternType === 'day-of-week' ? `${dayOfWeek} (${weekOfMonth})` : dayOfMonthPosition);
			console.log('[BULK ASSIGN] Frequency:', frequency, 'End date:', endDate);

			// Filter occurrences based on criteria
			const matchingOccurrences = filterOccurrences(
				eventOccurrences, 
				patternType, 
				dayOfMonthPosition, 
				dayOfWeek, 
				weekOfMonth, 
				frequency, 
				endDate
			);

			console.log('[BULK ASSIGN] Matching occurrences:', matchingOccurrences.length);
			if (matchingOccurrences.length > 0) {
				console.log('[BULK ASSIGN] First few matches:', matchingOccurrences.slice(0, 3).map(o => ({
					id: o.id,
					startsAt: o.startsAt,
					day: new Date(o.startsAt).getDay(),
					date: new Date(o.startsAt).getDate()
				})));
			}

			if (matchingOccurrences.length === 0) {
				return fail(400, { error: 'No matching occurrences found for the selected criteria' });
			}

			// Get existing assignees
			const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
			console.log('[BULK ASSIGN] Existing assignees count:', existingAssignees.length);
			console.log('[BULK ASSIGN] Rota capacity:', rota.capacity);

			// Track assignments made
			let assignmentsMade = 0;
			let skippedFull = 0;
			let skippedDuplicate = 0;

			// For each matching occurrence, assign contacts
			for (const occurrence of matchingOccurrences) {
				console.log(`[BULK ASSIGN] Processing occurrence ${occurrence.id}, startsAt: ${occurrence.startsAt}`);
				// Check current capacity for this occurrence
				const assigneesForOcc = existingAssignees.filter(a => {
					if (typeof a === 'string') {
						return rota.occurrenceId === occurrence.id;
					}
					if (a && typeof a === 'object') {
						const aOccId = a.occurrenceId !== null && a.occurrenceId !== undefined 
							? a.occurrenceId 
							: rota.occurrenceId;
						return aOccId === occurrence.id;
					}
					return false;
				});

				const currentCount = assigneesForOcc.length;
				const availableSpots = rota.capacity - currentCount;

				if (availableSpots <= 0) {
					skippedFull++;
					continue;
				}

				// Get existing contact IDs for this occurrence to avoid duplicates
				const existingContactIdsForOcc = assigneesForOcc
					.map(a => typeof a === 'string' ? a : (a.contactId && typeof a.contactId === 'string' ? a.contactId : null))
					.filter(id => id !== null);

				// Filter out contacts already assigned to this occurrence
				const newContactsForOcc = contactIds.filter(id => !existingContactIdsForOcc.includes(id));

				// Limit to available spots
				const contactsToAdd = newContactsForOcc.slice(0, availableSpots);

				console.log(`[BULK ASSIGN] Occurrence ${occurrence.id}: currentCount=${currentCount}, availableSpots=${availableSpots}, newContactsForOcc=${newContactsForOcc.length}, contactsToAdd=${contactsToAdd.length}`);

				// Add assignees for this occurrence
				for (const contactId of contactsToAdd) {
					existingAssignees.push({
						contactId: contactId,
						occurrenceId: occurrence.id
					});
					assignmentsMade++;
				}

				// Track duplicates
				const duplicates = newContactsForOcc.length - contactsToAdd.length;
				skippedDuplicate += duplicates;
			}

			console.log('[BULK ASSIGN] Final counts - assignmentsMade:', assignmentsMade, 'skippedFull:', skippedFull, 'skippedDuplicate:', skippedDuplicate);

			// Update the rota
			const updatedRota = {
				...rota,
				assignees: existingAssignees
			};
			const validated = validateRota(updatedRota);
			await update('rotas', rotaId, validated);

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			const eventRecord = await findById('events', rota.eventId);
			await logDataChange(adminId, 'update', 'rota', rotaId, {
				role: rota.role,
				eventId: rota.eventId,
				eventName: eventRecord?.title || 'unknown',
				bulkAssignment: true,
				assignmentsMade,
				occurrencesMatched: matchingOccurrences.length
			}, event);

			const result = {
				success: true,
				assignmentsMade,
				occurrencesMatched: matchingOccurrences.length,
				skippedFull,
				skippedDuplicate
			};
			console.log('[BULK ASSIGN] Returning result:', result);
			return result;
		} catch (error) {
			console.error('Error in bulk assign:', error);
			return fail(400, { error: error.message || 'Failed to assign contacts' });
		}
	}
};
