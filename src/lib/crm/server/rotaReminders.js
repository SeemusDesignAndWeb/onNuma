import { readCollection, create, findById } from './fileStore.js';
import { sendUpcomingRotaReminder } from './email.js';
import { getSettings } from './settings.js';
import { getCurrentOrganisationId } from './orgContext.js';
import { generateId } from './ids.js';

/** Base URL for an org's hub (for "View in My Hub" links). Uses org.hubDomain when set. */
async function getHubBaseUrlForOrg(organisationId, fallbackOrigin) {
	if (!organisationId) return fallbackOrigin;
	const org = await findById('organisations', organisationId);
	const domain = org?.hubDomain && String(org.hubDomain).trim();
	if (!domain) return fallbackOrigin;
	return `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}

// Maps a contact's reminderTiming preference to the daysAhead value(s) it covers
const TIMING_TO_DAYS = {
	'1day': [1],
	'2days': [2],
	'1week': [7],
	'1week-and-1day': [1, 7]
};

function timingMatchesDaysAhead(timing, daysAhead) {
	const days = TIMING_TO_DAYS[timing] || [7];
	return days.includes(daysAhead);
}

async function hasReminderBeenSent(contactId, occurrenceId, daysAhead) {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1);

	let logs = [];
	try {
		logs = await readCollection('rota_reminder_log');
	} catch (_) {
		return false;
	}
	return logs.some(
		(log) =>
			log.contactId === contactId &&
			log.occurrenceId === occurrenceId &&
			log.daysAhead === daysAhead &&
			log.status === 'sent' &&
			new Date(log.sentAt) >= today &&
			new Date(log.sentAt) < tomorrow
	);
}

async function logReminder({ contactId, occurrenceId, daysAhead, status, contactEmail, eventTitle, role, organisationId, error }) {
	try {
		await create('rota_reminder_log', {
			id: generateId(),
			contactId,
			occurrenceId,
			daysAhead,
			status,
			contactEmail: contactEmail || '',
			eventTitle: eventTitle || '',
			role: role || '',
			organisationId: organisationId || '',
			error: error || null,
			sentAt: new Date().toISOString()
		});
	} catch (err) {
		console.error('[Rota Reminders] Failed to write reminder log:', err?.message || err);
	}
}

/**
 * Find all rota assignments for occurrences starting in N days
 * @param {number} daysAhead - Number of days ahead to check (default: 3)
 * @returns {Promise<Array>} Array of { contact, rota, event, occurrence } objects
 */
export async function findUpcomingRotaAssignments(daysAhead = 3) {
	const now = new Date();
	const targetDate = new Date(now);
	targetDate.setDate(now.getDate() + daysAhead);
	
	// Set time to start of day for comparison (00:00:00)
	const targetStart = new Date(targetDate);
	targetStart.setHours(0, 0, 0, 0);
	
	// Set time to end of day for comparison (23:59:59.999)
	const targetEnd = new Date(targetDate);
	targetEnd.setHours(23, 59, 59, 999);

	// Load all data
	const rotas = await readCollection('rotas');
	const occurrences = await readCollection('occurrences');
	const events = await readCollection('events');
	const contacts = await readCollection('contacts');

	// Create lookup maps for efficiency
	const eventsMap = new Map(events.map(e => [e.id, e]));
	const occurrencesMap = new Map(occurrences.map(o => [o.id, o]));
	const contactsMap = new Map(contacts.map(c => [c.id, c]));

	// Find occurrences starting on the target date (within the day window)
	const targetOccurrences = occurrences.filter(occ => {
		const startsAt = new Date(occ.startsAt);
		return startsAt >= targetStart && startsAt <= targetEnd;
	});

	const assignments = [];

	// Process each rota
	for (const rota of rotas) {
		const event = eventsMap.get(rota.eventId);
		if (!event) continue;

		// Get occurrences for this rota's event
		const eventOccurrences = occurrences.filter(o => o.eventId === rota.eventId);

		// Determine which occurrences this rota applies to
		let relevantOccurrences = [];
		
		if (rota.occurrenceId) {
			// Rota is for a specific occurrence
			const specificOcc = occurrencesMap.get(rota.occurrenceId);
			if (specificOcc && targetOccurrences.some(to => to.id === specificOcc.id)) {
				relevantOccurrences = [specificOcc];
			}
		} else {
			// Rota is for all occurrences - check all event occurrences that match target date
			relevantOccurrences = eventOccurrences.filter(occ => 
				targetOccurrences.some(to => to.id === occ.id)
			);
		}

		// Process assignees for each relevant occurrence
		for (const occurrence of relevantOccurrences) {
			const assignees = rota.assignees || [];
			
			for (const assignee of assignees) {
				let contactId = null;
				let assigneeOccurrenceId = null;

				// Handle old format (backward compatibility)
				if (typeof assignee === 'string') {
					contactId = assignee;
					assigneeOccurrenceId = rota.occurrenceId || occurrence.id;
				} else if (assignee && typeof assignee === 'object') {
					// New format: { contactId, occurrenceId }
					if (assignee.contactId) {
						contactId = assignee.contactId;
						assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || occurrence.id;
					} else if (assignee.id) {
						contactId = assignee.id;
						assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || occurrence.id;
					} else if (assignee.name && assignee.email) {
						// Public signup format - skip these as they don't have contact IDs
						continue;
					}
				}

				// Skip if no valid contact ID
				if (!contactId || typeof contactId !== 'string') {
					continue;
				}

				// Check if this assignee is for this specific occurrence
				// If assignee has a specific occurrenceId, it must match
				// If assignee has no occurrenceId but rota has one, it must match
				// If both are null, assignee is for all occurrences
				if (assigneeOccurrenceId !== null && assigneeOccurrenceId !== occurrence.id) {
					continue; // This assignee is for a different occurrence
				}

				// Get contact details
				const contact = contactsMap.get(contactId);
				if (!contact || !contact.email) {
					continue; // Skip contacts without email
				}

				// Add assignment
				assignments.push({
					contact,
					rota,
					event,
					occurrence
				});
			}
		}
	}

	return assignments;
}

/**
 * Send rota reminder emails respecting each volunteer's timing and notification preferences.
 * Runs for all relevant daysAhead values (1, 2, 7) in a single call.
 * Deduplicates via rota_reminder_log so re-running the cron the same day is safe.
 * @param {object} sveltekitEvent - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Summary of sent notifications
 */
export async function sendMyhubRotaReminders(sveltekitEvent) {
	let orgName = '';
	let organisationId = null;
	try {
		const settings = await getSettings();
		orgName = settings?.organisationName || settings?.name || '';
	} catch (_) {}
	try {
		organisationId = await getCurrentOrganisationId();
	} catch (_) {}

	const allDays = [1, 2, 7];
	const results = {
		sent: 0,
		failed: 0,
		skipped: 0,
		totalAssignments: 0,
		errors: []
	};

	for (const daysAhead of allDays) {
		const assignments = await findUpcomingRotaAssignments(daysAhead);
		results.totalAssignments += assignments.length;

		for (const assignment of assignments) {
			const { contact, rota, event: eventData, occurrence } = assignment;

			// Respect the volunteer's email reminder opt-out
			if (contact.reminderEmail === false) {
				results.skipped++;
				continue;
			}

			// Match against the volunteer's chosen timing (default: 1 week)
			const timing = contact.reminderTiming || '1week';
			if (!timingMatchesDaysAhead(timing, daysAhead)) {
				continue;
			}

			// Skip if already sent today for this contact + occurrence + timing
			const alreadySent = await hasReminderBeenSent(contact.id, occurrence.id, daysAhead);
			if (alreadySent) {
				results.skipped++;
				continue;
			}

			const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
			const contactOrgId = contact.organisationId || organisationId;
			const hubBaseUrl = await getHubBaseUrlForOrg(contactOrgId, sveltekitEvent?.url?.origin);

			try {
				await sendUpcomingRotaReminder(
					{ to: contact.email, name: contactName, firstName: contact.firstName || '' },
					{ rota, event: eventData, occurrence },
					sveltekitEvent,
					{ daysAhead, orgName, hubBaseUrl }
				);
				await logReminder({
					contactId: contact.id,
					occurrenceId: occurrence.id,
					daysAhead,
					status: 'sent',
					contactEmail: contact.email,
					eventTitle: eventData?.title || '',
					role: rota?.role || '',
					organisationId: organisationId || ''
				});
				results.sent++;
				console.log(`[Rota Reminders] Sent ${daysAhead}-day reminder to ${contact.email} for "${eventData?.title}"`);
			} catch (err) {
				await logReminder({
					contactId: contact.id,
					occurrenceId: occurrence.id,
					daysAhead,
					status: 'failed',
					contactEmail: contact.email,
					eventTitle: eventData?.title || '',
					role: rota?.role || '',
					organisationId: organisationId || '',
					error: err?.message || 'Unknown error'
				});
				results.failed++;
				results.errors.push({
					contact: contact.email,
					event: eventData?.title,
					daysAhead,
					error: err?.message || 'Unknown error'
				});
				console.error(`[Rota Reminders] Failed to send ${daysAhead}-day reminder to ${contact.email}:`, err);
			}
		}
	}

	return results;
}

/**
 * Send rota reminder emails for upcoming assignments
 * @param {number} daysAhead - Number of days ahead to check (default: 3)
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Summary of sent notifications
 */
export async function sendRotaReminders(daysAhead = 3, event) {
	const assignments = await findUpcomingRotaAssignments(daysAhead);

	// Group assignments by contact to avoid duplicate emails
	// If a contact has multiple rotas on the same day, send one email with all of them
	const assignmentsByContact = new Map();

	for (const assignment of assignments) {
		const contactId = assignment.contact.id;
		if (!assignmentsByContact.has(contactId)) {
			assignmentsByContact.set(contactId, []);
		}
		assignmentsByContact.get(contactId).push(assignment);
	}

	const results = {
		totalContacts: assignmentsByContact.size,
		totalAssignments: assignments.length,
		sent: 0,
		failed: 0,
		errors: []
	};

	// Send reminders to each contact
	for (const [contactId, contactAssignments] of assignmentsByContact) {
		const contact = contactAssignments[0].contact;
		const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;

		// For now, send one email per assignment
		// In the future, we could group multiple assignments into one email
		const contactOrgId = contact.organisationId || null;
		const hubBaseUrl = await getHubBaseUrlForOrg(contactOrgId, event?.url?.origin);
		for (const assignment of contactAssignments) {
			try {
				await sendUpcomingRotaReminder(
					{
						to: contact.email,
						name: contactName
					},
					{
						rota: assignment.rota,
						event: assignment.event,
						occurrence: assignment.occurrence
					},
					event,
					{ hubBaseUrl }
				);
				results.sent++;
				console.log(`[Rota Reminders] Sent reminder to ${contact.email} for ${assignment.event.title} - ${assignment.rota.role}`);
			} catch (error) {
				results.failed++;
				results.errors.push({
					contact: contact.email,
					event: assignment.event.title,
					rota: assignment.rota.role,
					error: error.message || 'Unknown error'
				});
				console.error(`[Rota Reminders] Failed to send reminder to ${contact.email}:`, error);
			}
		}
	}

	return results;
}
