import { redirect } from '@sveltejs/kit';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { getSettings } from '$lib/crm/server/settings.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';

export async function load({ parent }) {
	throw redirect(302, '/hub/planner');
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();
	const meetingPlanners = filterByOrganisation(await readCollection('meeting_planners'), organisationId);
	const events = filterByOrganisation(await readCollection('events'), organisationId);
	const occurrences = filterByOrganisation(await readCollection('occurrences'), organisationId);
	const rotas = filterByOrganisation(await readCollection('rotas'), organisationId);
	const orgContacts = filterByOrganisation(await readCollection('contacts'), organisationId);
	const contacts = contactsWithinPlanLimit(orgContacts, plan);
	const settings = await getSettings();
	const meetingPlannerSettingsRotas = settings.meetingPlannerRotas || [];
	const meetingPlannerRoles = meetingPlannerSettingsRotas.map(r => (r.role || '').trim());

	// Helper function to get assignee names for a rota, filtered by occurrence if needed
	function getAssigneeNames(rota, meetingPlannerOccurrenceId) {
		if (!rota || !rota.assignees || rota.assignees.length === 0) {
			return [];
		}

		return rota.assignees
			.filter(assignee => {
				// If meeting planner is for a specific occurrence, filter assignees by that occurrence
				if (meetingPlannerOccurrenceId !== null && meetingPlannerOccurrenceId !== undefined) {
					let assigneeOccurrenceId;
					if (typeof assignee === 'string') {
						assigneeOccurrenceId = rota.occurrenceId;
					} else if (assignee && typeof assignee === 'object') {
						assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId;
					} else {
						return false;
					}
					return assigneeOccurrenceId === meetingPlannerOccurrenceId;
				}
				// If meeting planner is for all occurrences, show all assignees
				return true;
			})
			.map(assignee => {
				let contactId;
				if (typeof assignee === 'string') {
					contactId = assignee;
				} else if (assignee && typeof assignee === 'object') {
					contactId = assignee.contactId || assignee.id;
				} else {
					return null;
				}

				// Handle contactId as object (legacy format with name/email)
				if (contactId && typeof contactId === 'object' && contactId.name) {
					return contactId.name || contactId.email || 'Unknown';
				}

				// Handle contactId as string (look up in contacts)
				if (typeof contactId === 'string') {
					const contact = contacts.find(c => c.id === contactId);
					if (contact) {
						const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
						return name || contact.email || 'Unknown';
					}
				}
				return null;
			})
			.filter(name => name !== null);
	}

	// Get today's date at midnight for comparison (exclude today's meetings)
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Process each meeting planner to get rota assignees
	const processed = meetingPlanners
		.map(mp => {
			const event = events.find(e => e.id === mp.eventId);
			const occurrence = mp.occurrenceId ? occurrences.find(o => o.id === mp.occurrenceId) : null;

			// Find all rotas for this event
			const eventRotas = rotas.filter(r => r.eventId === mp.eventId);

			// Match rotas based on settings roles
			const matchedRotas = {};
			meetingPlannerRoles.forEach(role => {
				let matchedRota = eventRotas.find(r => (r.role || '').trim() === role);
				
				// Fuzzy match for Worship Team legacy name
				if (!matchedRota && role === 'Worship Team') {
					matchedRota = eventRotas.find(r => (r.role || '').trim() === 'Worship Leader and Team');
				} else if (!matchedRota && role === 'Worship Leader and Team') {
					matchedRota = eventRotas.find(r => (r.role || '').trim() === 'Worship Team');
				}

				if (matchedRota) {
					matchedRotas[role] = getAssigneeNames(matchedRota, mp.occurrenceId);
				} else {
					matchedRotas[role] = [];
				}
			});

			// Get other rotas for this event (those NOT in the meeting planner settings)
			const otherRotas = eventRotas.filter(r => {
				const role = (r.role || '').trim();
				// Check if this role is in our settings (with fuzzy match for Worship)
				const isSettingsRole = meetingPlannerRoles.some(sr => {
					if (sr === role) return true;
					if (sr === 'Worship Team' && role === 'Worship Leader and Team') return true;
					if (sr === 'Worship Leader and Team' && role === 'Worship Team') return true;
					return false;
				});
				return !isSettingsRole;
			});

			// Group other rotas by role
			const otherRotasData = {};
			otherRotas.forEach(rota => {
				const assignees = getAssigneeNames(rota, mp.occurrenceId);
				if (!otherRotasData[rota.role]) {
					otherRotasData[rota.role] = [];
				}
				otherRotasData[rota.role].push(...assignees);
			});

			// Remove duplicates in other rotas
			Object.keys(otherRotasData).forEach(role => {
				otherRotasData[role] = [...new Set(otherRotasData[role])];
			});

			return {
				id: mp.id,
				eventName: event?.title || 'Unknown Event',
				eventId: mp.eventId,
				occurrenceDate: occurrence ? occurrence.startsAt : null,
				occurrenceId: mp.occurrenceId,
				communionHappening: mp.communionHappening || false,
				speakerTopic: mp.speakerTopic || '',
				speakerSeries: mp.speakerSeries || '',
				notes: mp.notes || '',
				// Map specific legacy names for convenience in the UI if needed
				meetingLeader: matchedRotas['Meeting Leader'] || [],
				worshipLeader: matchedRotas['Worship Team'] || matchedRotas['Worship Leader and Team'] || [],
				speaker: matchedRotas['Speaker'] || [],
				callToWorship: matchedRotas['Call to Worship'] || [],
				dynamicRotas: matchedRotas, // All rotas from settings
				otherRotas: otherRotasData
			};
		})
		// Filter out past dates (keep "All occurrences" and future dates)
		.filter(mp => {
			// If no occurrence date (All occurrences), keep it
			if (!mp.occurrenceDate) return true;
			
			// Parse the occurrence date
			const occurrenceDate = new Date(mp.occurrenceDate);
			if (isNaN(occurrenceDate.getTime())) return true; // Keep invalid dates
			
			// Set to midnight for comparison
			occurrenceDate.setHours(0, 0, 0, 0);
			
			// Keep if date is today or in the future
			return occurrenceDate >= today;
		})
		// Sort by event name, then by occurrence date
		.sort((a, b) => {
			if (a.eventName !== b.eventName) {
				return a.eventName.localeCompare(b.eventName);
			}
			if (a.occurrenceDate && b.occurrenceDate) {
				return new Date(a.occurrenceDate) - new Date(b.occurrenceDate);
			}
			if (a.occurrenceDate) return -1;
			if (b.occurrenceDate) return 1;
			return 0;
		});

	// Define the specific order for other rota roles
	const preferredRotaOrder = [
		'Welcome team',
		'Hospitality',
		'Adventurers',
		'Explorers',
		'Youth'
	];
	
	// Collect all unique other rota roles across all meeting planners
	const allOtherRotaRoles = new Set();
	processed.forEach(mp => {
		Object.keys(mp.otherRotas).forEach(role => {
			allOtherRotaRoles.add(role);
		});
	});
	
	// Sort: first preferred order, then alphabetically for any others
	const sortedOtherRotaRoles = [
		...preferredRotaOrder.filter(role => allOtherRotaRoles.has(role)),
		...Array.from(allOtherRotaRoles).filter(role => !preferredRotaOrder.includes(role)).sort()
	];

	return {
		meetingPlanners: processed,
		otherRotaRoles: sortedOtherRotaRoles
	};
}
