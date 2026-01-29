import { readCollection } from '$lib/crm/server/fileStore.js';

export async function load() {
	const meetingPlanners = await readCollection('meeting_planners');
	const events = await readCollection('events');
	const occurrences = await readCollection('occurrences');
	const rotas = await readCollection('rotas');
	const contacts = await readCollection('contacts');

	// Get all standard meeting planner rota IDs to exclude them from "other rotas"
	const standardRotaIds = new Set();
	meetingPlanners.forEach(mp => {
		if (mp.meetingLeaderRotaId) standardRotaIds.add(mp.meetingLeaderRotaId);
		if (mp.worshipLeaderRotaId) standardRotaIds.add(mp.worshipLeaderRotaId);
		if (mp.speakerRotaId) standardRotaIds.add(mp.speakerRotaId);
		if (mp.callToWorshipRotaId) standardRotaIds.add(mp.callToWorshipRotaId);
		
		// Also include dynamic rotas
		if (mp.rotas && Array.isArray(mp.rotas)) {
			mp.rotas.forEach(r => {
				if (r.rotaId) standardRotaIds.add(r.rotaId);
			});
		}
	});

	// Helper function to get assignee names for a rota, filtered by occurrence if needed
	function getAssigneeNames(rota, meetingPlannerOccurrenceId) {
		if (!rota || !rota.assignees || rota.assignees.length === 0) {
			return [];
		}

		return rota.assignees
			.filter(assignee => {
				// If meeting planner is for a specific occurrence, filter assignees by that occurrence
				if (meetingPlannerOccurrenceId !== null) {
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

			// Get rotas for this meeting planner
			const meetingLeaderRota = mp.meetingLeaderRotaId ? rotas.find(r => r.id === mp.meetingLeaderRotaId) : null;
			const worshipLeaderRota = mp.worshipLeaderRotaId ? rotas.find(r => r.id === mp.worshipLeaderRotaId) : null;
			const speakerRota = mp.speakerRotaId ? rotas.find(r => r.id === mp.speakerRotaId) : null;
			const callToWorshipRota = mp.callToWorshipRotaId ? rotas.find(r => r.id === mp.callToWorshipRotaId) : null;

			// Handle dynamic rotas
			const dynamicRotas = {};
			if (mp.rotas && Array.isArray(mp.rotas)) {
				mp.rotas.forEach(r => {
					const rota = rotas.find(rotaRecord => rotaRecord.id === r.rotaId);
					if (rota) {
						dynamicRotas[r.role] = getAssigneeNames(rota, mp.occurrenceId);
					}
				});
			}

			// Get other rotas for this event (not the 4 standard ones and not dynamic ones)
			const otherRotas = rotas.filter(r => 
				r.eventId === mp.eventId && 
				!standardRotaIds.has(r.id)
			);

			// Group other rotas by role
			const otherRotasByRole = {};
			otherRotas.forEach(rota => {
				if (!otherRotasByRole[rota.role]) {
					otherRotasByRole[rota.role] = [];
				}
				otherRotasByRole[rota.role].push(rota);
			});

			// Get assignees for each other rota role
			const otherRotasData = {};
			Object.keys(otherRotasByRole).forEach(role => {
				// Combine assignees from all rotas with this role
				const allAssignees = [];
				otherRotasByRole[role].forEach(rota => {
					const assignees = getAssigneeNames(rota, mp.occurrenceId);
					allAssignees.push(...assignees);
				});
				// Remove duplicates (same name appearing in multiple rotas)
				otherRotasData[role] = [...new Set(allAssignees)];
			});

			// Add dynamic rotas that are not the standard 4 to otherRotasData
			const standardRoles = ['Meeting Leader', 'Worship Leader and Team', 'Speaker', 'Call to Worship'];
			Object.keys(dynamicRotas).forEach(role => {
				if (!standardRoles.includes(role)) {
					otherRotasData[role] = dynamicRotas[role];
				}
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
				meetingLeader: dynamicRotas['Meeting Leader'] || getAssigneeNames(meetingLeaderRota, mp.occurrenceId),
				worshipLeader: dynamicRotas['Worship Leader and Team'] || getAssigneeNames(worshipLeaderRota, mp.occurrenceId),
				speaker: dynamicRotas['Speaker'] || getAssigneeNames(speakerRota, mp.occurrenceId),
				callToWorship: dynamicRotas['Call to Worship'] || getAssigneeNames(callToWorshipRota, mp.occurrenceId),
				dynamicRotas: dynamicRotas, // For any extra rotas not in the 4 standard ones
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
