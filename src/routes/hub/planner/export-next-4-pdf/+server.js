import { error } from '@sveltejs/kit';
import { readCollection, findById } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';

/**
 * Format date in a readable format: "Sunday 22nd February at 10am"
 */
function formatReadableDate(dateString) {
	if (!dateString) return '';
	const date = new Date(dateString);
	if (isNaN(date.getTime())) return '';
	
	const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
	
	const dayName = days[date.getDay()];
	const day = date.getDate();
	const month = months[date.getMonth()];
	
	// Get ordinal suffix
	const getOrdinal = (n) => {
		const s = ['th', 'st', 'nd', 'rd'];
		const v = n % 100;
		return n + (s[(v - 20) % 10] || s[v] || s[0]);
	};
	
	// Format time
	const hours = date.getHours();
	const minutes = date.getMinutes();
	const ampm = hours >= 12 ? 'pm' : 'am';
	const hour12 = hours % 12 || 12;
	const timeStr = minutes > 0 ? `${hour12}:${String(minutes).padStart(2, '0')}${ampm}` : `${hour12}${ampm}`;
	
	return `${dayName} ${getOrdinal(day)} ${month} at ${timeStr}`;
}

/**
 * Export next 4 meeting planners to PDF
 * Note: Requires puppeteer to be installed: npm install puppeteer
 */
export async function GET({ locals, url }) {
	// Check authentication (set by hooks)
	if (!locals.admin) {
		throw error(401, 'Unauthorized');
	}

	try {
		const organisationId = await getCurrentOrganisationId();
		// Load all meeting planners, events, and occurrences (scoped to current org)
		const allMeetingPlanners = filterByOrganisation(await readCollection('meeting_planners'), organisationId);
		const events = filterByOrganisation(await readCollection('events'), organisationId);
		const occurrences = filterByOrganisation(await readCollection('occurrences'), organisationId);
		const rotas = filterByOrganisation(await readCollection('rotas'), organisationId);
		const contacts = filterByOrganisation(await readCollection('contacts'), organisationId);
		
		// Filter to only future occurrences and sort by date
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		
		// Enrich meeting planners with occurrence dates and sort by occurrence date
		const enriched = allMeetingPlanners.map(mp => {
			const event = events.find(e => e.id === mp.eventId);
			const occurrence = mp.occurrenceId ? occurrences.find(o => o.id === mp.occurrenceId) : null;
			return {
				...mp,
				event,
				occurrence,
				sortDate: occurrence?.startsAt ? new Date(occurrence.startsAt) : new Date('9999-12-31') // Put "all occurrences" at the end
			};
		});
		
		// Filter to only future meeting planners (those with future occurrences or "all occurrences")
		const futureMeetingPlanners = enriched.filter(mp => {
			if (!mp.occurrence) {
				// "All occurrences" - check if event has any future occurrences
				const eventOccurrences = occurrences.filter(o => o.eventId === mp.eventId);
				return eventOccurrences.some(occ => {
					if (!occ.startsAt) return false;
					const occDate = new Date(occ.startsAt);
					occDate.setHours(0, 0, 0, 0);
					return occDate >= now;
				});
			}
			if (!mp.occurrence.startsAt) return false;
			const occDate = new Date(mp.occurrence.startsAt);
			occDate.setHours(0, 0, 0, 0);
			return occDate >= now;
		});
		
		// Sort by occurrence date (earliest first)
		futureMeetingPlanners.sort((a, b) => {
			return a.sortDate.getTime() - b.sortDate.getTime();
		});
		
		// Get next 4
		const next4MeetingPlanners = futureMeetingPlanners.slice(0, 4);
		
		if (next4MeetingPlanners.length === 0) {
			throw error(404, 'No upcoming meeting planners found');
		}

		// Process each meeting planner
		const meetingPlannersData = [];
		
		for (const mp of next4MeetingPlanners) {
			const event = mp.event;
			const occurrence = mp.occurrence;
			
			// Load all occurrences for this event (for PDF, show all occurrences, sorted by date)
			const eventOccurrences = occurrences
				.filter(o => o.eventId === mp.eventId)
				.sort((a, b) => {
					const dateA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
					const dateB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
					return dateA - dateB;
				});

			// Load all rotas
			const meetingLeaderRota = mp.meetingLeaderRotaId ? rotas.find(r => r.id === mp.meetingLeaderRotaId) : null;
			const worshipLeaderRota = mp.worshipLeaderRotaId ? rotas.find(r => r.id === mp.worshipLeaderRotaId) : null;
			const speakerRota = mp.speakerRotaId ? rotas.find(r => r.id === mp.speakerRotaId) : null;
			const callToWorshipRota = mp.callToWorshipRotaId ? rotas.find(r => r.id === mp.callToWorshipRotaId) : null;

			// Process assignees for each rota
			function processAssignees(rota) {
				if (!rota || !rota.assignees) {
					return {};
				}
				
				const assigneesByOccurrence = {};
				
				(rota.assignees || []).forEach((assignee) => {
					let contactId, occurrenceId;
					
					if (typeof assignee === 'string') {
						contactId = assignee;
						occurrenceId = rota.occurrenceId;
					} else if (assignee && typeof assignee === 'object') {
						if (assignee.contactId) {
							contactId = assignee.contactId;
							occurrenceId = assignee.occurrenceId || rota.occurrenceId;
						} else if (assignee.id) {
							contactId = assignee.id;
							occurrenceId = assignee.occurrenceId || rota.occurrenceId;
						} else if (assignee.name && assignee.email) {
							contactId = { name: assignee.name, email: assignee.email };
							occurrenceId = assignee.occurrenceId || rota.occurrenceId;
						} else {
							return;
						}
					} else {
						return;
					}
					
					// Filter: If meeting planner is for a specific occurrence, only show assignees for that occurrence
					if (mp.occurrenceId !== null && occurrenceId !== mp.occurrenceId) {
						return;
					}
					
					// Filter out past occurrences
					if (occurrenceId) {
						const occ = eventOccurrences.find(o => o.id === occurrenceId);
						if (occ && occ.startsAt) {
							const occDate = new Date(occ.startsAt);
							occDate.setHours(0, 0, 0, 0);
							if (occDate < now) {
								return; // Skip past occurrences
							}
						}
					}
					
					let contactDetails = null;
					if (typeof contactId === 'string') {
						const contact = contacts.find(c => c.id === contactId);
						if (contact) {
							contactDetails = {
								id: contact.id,
								name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
								email: contact.email
							};
						} else {
							contactDetails = {
								id: contactId,
								name: 'Unknown Contact',
								email: ''
							};
						}
					} else {
						contactDetails = {
							id: null,
							name: contactId.name || 'Unknown',
							email: contactId.email || ''
						};
					}
					
					if (!assigneesByOccurrence[occurrenceId || 'unassigned']) {
						assigneesByOccurrence[occurrenceId || 'unassigned'] = [];
					}
					assigneesByOccurrence[occurrenceId || 'unassigned'].push({
						...contactDetails,
						occurrenceId: occurrenceId
					});
				});
				
				return assigneesByOccurrence;
			}

			const rotasData = {
				meetingLeader: meetingLeaderRota ? {
					rota: meetingLeaderRota,
					assigneesByOccurrence: processAssignees(meetingLeaderRota)
				} : null,
				worshipLeader: worshipLeaderRota ? {
					rota: worshipLeaderRota,
					assigneesByOccurrence: processAssignees(worshipLeaderRota)
				} : null,
				speaker: speakerRota ? {
					rota: speakerRota,
					assigneesByOccurrence: processAssignees(speakerRota)
				} : null,
				callToWorship: callToWorshipRota ? {
					rota: callToWorshipRota,
					assigneesByOccurrence: processAssignees(callToWorshipRota)
				} : null
			};
			
			meetingPlannersData.push({
				meetingPlanner: mp,
				event,
				occurrence,
				eventOccurrences,
				rotasData
			});
		}

		// Try to import puppeteer
		let puppeteer;
		try {
			puppeteer = await import('puppeteer');
		} catch (importError) {
			throw error(500, 'PDF export requires puppeteer. Please run: npm install puppeteer');
		}

		// Generate HTML for PDF
		const htmlContent = generateMultipleMeetingPlannersPDFHTML(meetingPlannersData, now);

		// Launch browser
		const browser = await puppeteer.default.launch({
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		});

		try {
			const page = await browser.newPage();
			
			// Set content
			await page.setContent(htmlContent, {
				waitUntil: 'networkidle0'
			});

			// Generate PDF in landscape A4 format
			const pdf = await page.pdf({
				format: 'A4',
				landscape: true,
				printBackground: true,
				margin: {
					top: '15mm',
					right: '15mm',
					bottom: '15mm',
					left: '15mm'
				}
			});

			await browser.close();

			// Return PDF as response
			const dateStr = new Date().toISOString().split('T')[0];
			const filename = `meeting-planners-next-4-${dateStr}.pdf`;
			
			return new Response(pdf, {
				headers: {
					'Content-Type': 'application/pdf',
					'Content-Disposition': `attachment; filename="${filename}"`,
					'Content-Length': pdf.length.toString()
				}
			});
		} catch (pdfError) {
			await browser.close();
			throw pdfError;
		}
	} catch (err) {
		console.error('PDF export error:', err);
		if (err.status) {
			throw err;
		}
		throw error(500, err.message || 'Failed to generate PDF');
	}
}

/**
 * Generate HTML content for multiple meeting planners PDF export
 */
function generateMultipleMeetingPlannersPDFHTML(meetingPlannersData, now) {
	const rotaNames = {
		meetingLeader: 'Meeting Leader',
		worshipLeader: 'Worship Leader and Team',
		speaker: 'Speaker',
		callToWorship: 'Call to Worship'
	};
	
	// Filter occurrences to only show today and future
	function getFutureOccurrences(eventOccurrences) {
		return eventOccurrences.filter(occ => {
			if (!occ.startsAt) return false;
			const occDate = new Date(occ.startsAt);
			occDate.setHours(0, 0, 0, 0);
			return occDate >= now;
		});
	}
	
	// Generate cards HTML for each meeting planner
	let allCardsHTML = '';
	
	meetingPlannersData.forEach(({ meetingPlanner, event, occurrence, eventOccurrences, rotasData }) => {
		const eventTitle = event.title || 'Unknown Event';
		const futureOccurrences = getFutureOccurrences(eventOccurrences);
		
		// Get occurrences to display - one card per occurrence
		let occurrencesToDisplay = [];
		if (meetingPlanner.occurrenceId) {
			const specificOcc = futureOccurrences.find(o => o.id === meetingPlanner.occurrenceId);
			if (specificOcc) {
				occurrencesToDisplay = [specificOcc];
			}
		} else {
			// Show all future occurrences for this event
			occurrencesToDisplay = futureOccurrences;
		}
		
		// Generate cards HTML - one card per occurrence with all rotas
		if (occurrencesToDisplay.length > 0) {
			occurrencesToDisplay.forEach(occ => {
				// Check if this occurrence has any assignees across all rotas
				let hasAnyAssignees = false;
				Object.keys(rotasData).forEach(rotaKey => {
					const rotaInfo = rotasData[rotaKey];
					if (rotaInfo && rotaInfo.assigneesByOccurrence) {
						const occAssignees = rotaInfo.assigneesByOccurrence[occ.id] || [];
						if (occAssignees.length > 0) {
							hasAnyAssignees = true;
						}
					}
				});
				
				// Only create card if there are assignees or if it's the specific occurrence
				if (hasAnyAssignees || (meetingPlanner.occurrenceId && occ.id === meetingPlanner.occurrenceId)) {
					let dateTime = '';
					if (occ.id === 'unassigned') {
						dateTime = 'Unassigned';
					} else {
						dateTime = formatReadableDate(occ.startsAt);
						if (occ.endsAt) {
							const endTime = formatReadableDate(occ.endsAt);
							const endTimeOnly = endTime.split(' at ')[1] || '';
							if (endTimeOnly) {
								dateTime += ` - ${endTimeOnly}`;
							}
						}
					}
					
					// Build rotas HTML for this occurrence
					let rotasHTML = '';
					Object.keys(rotasData).forEach(rotaKey => {
						const rotaInfo = rotasData[rotaKey];
						if (!rotaInfo || !rotaInfo.rota) return;
						
						const rota = rotaInfo.rota;
						const rotaRole = rota.role || rotaNames[rotaKey] || 'Unknown Role';
						const assigneesByOccurrence = rotaInfo.assigneesByOccurrence || {};
						const occAssignees = assigneesByOccurrence[occ.id] || [];
						
						// Check if this rota applies to this occurrence
						let appliesToOccurrence = false;
						if (rota.occurrenceId) {
							appliesToOccurrence = rota.occurrenceId === occ.id;
						} else {
							// Rota is for all occurrences
							appliesToOccurrence = true;
						}
						
						if (appliesToOccurrence && occAssignees.length > 0) {
							const namesHTML = occAssignees.map(assignee => 
								`<div class="contact-name">${escapeHtml(assignee.name || 'Unknown')}</div>`
							).join('');
							
							rotasHTML += `
								<div class="rota-in-card">
									<div class="rota-name-in-card">${escapeHtml(rotaRole)}</div>
									${rota.notes ? `<div class="rota-notes-in-card">${rota.notes}</div>` : ''}
									<div class="contacts-list">
										${namesHTML}
									</div>
								</div>
							`;
						}
					});
					
					// Build meeting details for this occurrence
					let meetingDetailsHTML = '';
					if (meetingPlanner.communionHappening) {
						meetingDetailsHTML += '<div class="meeting-detail-item"><strong>Communion:</strong> On</div>';
					} else {
						meetingDetailsHTML += '<div class="meeting-detail-item"><strong>Communion:</strong> Off</div>';
					}
					if (meetingPlanner.speakerTopic) {
						meetingDetailsHTML += `<div class="meeting-detail-item"><strong>Speaker Topic:</strong> ${escapeHtml(meetingPlanner.speakerTopic)}</div>`;
					}
					if (meetingPlanner.speakerSeries) {
						meetingDetailsHTML += `<div class="meeting-detail-item"><strong>Speaker Series:</strong> ${escapeHtml(meetingPlanner.speakerSeries)}</div>`;
					}
					
					// Add event title to card header
					allCardsHTML += `
						<div class="date-card">
							<div class="event-title-in-card">${escapeHtml(eventTitle)}</div>
							<div class="date-header">${escapeHtml(dateTime)}</div>
							${meetingDetailsHTML ? `<div class="meeting-details-in-card">${meetingDetailsHTML}</div>` : ''}
							${meetingPlanner.notes ? `<div class="meeting-notes-in-card">${meetingPlanner.notes}</div>` : ''}
							${rotasHTML}
						</div>
					`;
				}
			});
		}
	});
	
	// If no cards were generated, show a message
	if (!allCardsHTML) {
		allCardsHTML = '<div class="no-rotas">No contacts assigned to any occurrences</div>';
	}

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Next 4 Meeting Planners</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			line-height: 1.5;
			color: #1f2937;
			background: #fff;
		}
		
		.header {
			margin-bottom: 30px;
		}
		
		.header h1 {
			font-size: 28px;
			font-weight: 700;
			margin-bottom: 8px;
			color: #111827;
		}
		
		.cards-container {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
		}
		
		.date-card {
			flex: 0 0 calc(25% - 9px);
			min-width: 200px;
			border: 1px solid #d1d5db;
			border-radius: 8px;
			background-color: #fff;
			overflow: hidden;
			page-break-inside: avoid;
		}
		
		.event-title-in-card {
			background-color: #059669;
			color: white;
			padding: 10px 14px;
			font-weight: 600;
			font-size: 14px;
			border-bottom: 1px solid #047857;
		}
		
		.date-header {
			background-color: #f3f4f6;
			padding: 12px 14px;
			font-weight: 600;
			font-size: 14px;
			color: #111827;
			border-bottom: 1px solid #d1d5db;
		}
		
		.meeting-details-in-card {
			padding: 10px 14px;
			background-color: #f9fafb;
			border-bottom: 1px solid #e5e7eb;
		}
		
		.meeting-detail-item {
			margin-bottom: 6px;
			font-size: 12px;
			color: #374151;
		}
		
		.meeting-detail-item:last-child {
			margin-bottom: 0;
		}
		
		.meeting-notes-in-card {
			padding: 10px 14px;
			background-color: #f0f9ff;
			border-bottom: 1px solid #e5e7eb;
			font-size: 12px;
			line-height: 1.5;
			color: #374151;
		}
		
		.meeting-notes-in-card p {
			margin: 0 0 6px 0;
		}
		
		.meeting-notes-in-card p:last-child {
			margin-bottom: 0;
		}
		
		.rota-in-card {
			padding: 10px 14px;
			border-bottom: 1px solid #e5e7eb;
		}
		
		.rota-in-card:last-child {
			border-bottom: none;
		}
		
		.rota-name-in-card {
			font-weight: 600;
			font-size: 13px;
			color: #059669;
			margin-bottom: 6px;
		}
		
		.rota-notes-in-card {
			padding: 6px 0;
			font-size: 11px;
			line-height: 1.4;
			color: #6b7280;
			font-style: italic;
			margin-bottom: 6px;
		}
		
		.rota-notes-in-card p {
			margin: 0 0 4px 0;
		}
		
		.rota-notes-in-card p:last-child {
			margin-bottom: 0;
		}
		
		.contacts-list {
			padding: 0;
		}
		
		.contact-name {
			padding: 5px 0;
			font-size: 12px;
			color: #374151;
			border-bottom: 1px solid #f3f4f6;
		}
		
		.contact-name:last-child {
			border-bottom: none;
		}
		
		.no-rotas {
			color: #9ca3af;
			font-style: italic;
			text-align: center;
			padding: 40px 20px;
		}
		
		.footer {
			margin-top: 40px;
			padding-top: 20px;
			border-top: 1px solid #e5e7eb;
			text-align: center;
			color: #6b7280;
			font-size: 11px;
		}
	</style>
</head>
<body>
	<div class="header">
		<h1>Next 4 Meeting Planners</h1>
	</div>
	
	<div class="cards-container">
		${allCardsHTML}
	</div>
	
	<div class="footer">
		<p>Eltham Green Community Church - TheHUB</p>
		<p>Generated on ${new Date().toLocaleDateString('en-GB', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})}</p>
	</div>
</body>
</html>
	`.trim();
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
	if (!text) return '';
	const map = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;'
	};
	return String(text).replace(/[&<>"']/g, m => map[m]);
}
