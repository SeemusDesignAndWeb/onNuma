import { error } from '@sveltejs/kit';
import { findById, readCollection } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { formatDateTimeUK, formatTimeUK } from '$lib/crm/utils/dateFormat.js';

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
	const year = date.getFullYear();
	
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
 * Export rota to PDF
 * Note: Requires puppeteer to be installed: npm install puppeteer
 */
export async function GET({ params, locals }) {
	// Check authentication (set by hooks)
	if (!locals.admin) {
		throw error(401, 'Unauthorized');
	}

	try {
		const organisationId = await getCurrentOrganisationId();
		const rota = await findById('rotas', params.id);
		if (!rota) {
			throw error(404, 'Rota not found');
		}
		if (rota.organisationId != null && rota.organisationId !== organisationId) {
			throw error(404, 'Rota not found');
		}

		const event = await findById('events', rota.eventId);
		if (!event) {
			throw error(404, 'Event not found');
		}
		if (event.organisationId != null && event.organisationId !== organisationId) {
			throw error(404, 'Event not found');
		}

		// Load all occurrences for this event (for PDF, show all occurrences, not just upcoming)
		const allOccurrences = filterByOrganisation(await readCollection('occurrences'), organisationId);
		const eventOccurrences = allOccurrences
			.filter(o => o.eventId === rota.eventId)
			.sort((a, b) => {
				// Sort by date, earliest first
				const dateA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
				const dateB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
				return dateA - dateB;
			});
		
		// Load contacts for assignees (scoped to current org)
		const contacts = filterByOrganisation(await readCollection('contacts'), organisationId);
		
		// Process assignees and group by occurrence
		const processedAssignees = (rota.assignees || []).map(assignee => {
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
					return null;
				}
			} else {
				return null;
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
			
			return {
				...contactDetails,
				occurrenceId: occurrenceId
			};
		}).filter(a => a !== null);
		
		// Group assignees by occurrence
		const assigneesByOccurrence = {};
		processedAssignees.forEach(assignee => {
			const occId = assignee.occurrenceId;
			if (occId === null || occId === undefined) {
				if (!assigneesByOccurrence['unassigned']) {
					assigneesByOccurrence['unassigned'] = [];
				}
				assigneesByOccurrence['unassigned'].push(assignee);
			} else {
				if (!assigneesByOccurrence[occId]) {
					assigneesByOccurrence[occId] = [];
				}
				assigneesByOccurrence[occId].push(assignee);
			}
		});

		// Try to import puppeteer
		let puppeteer;
		try {
			puppeteer = await import('puppeteer');
		} catch (importError) {
			throw error(500, 'PDF export requires puppeteer. Please run: npm install puppeteer');
		}

		// Generate HTML for PDF
		const htmlContent = generateRotaPDFHTML({
			rota,
			event,
			eventOccurrences,
			assigneesByOccurrence
		});

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
			const rotaSlug = (rota.role || rota.id)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.substring(0, 50);
			const eventSlug = (event.title || event.id)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.substring(0, 30);
			const dateStr = new Date().toISOString().split('T')[0];
			const filename = `rota-${rotaSlug}-${eventSlug}-${dateStr}.pdf`;
			
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
 * Generate HTML content for rota PDF export
 */
function generateRotaPDFHTML({ rota, event, eventOccurrences, assigneesByOccurrence }) {
	const eventTitle = event.title || 'Unknown Event';
	const rotaRole = rota.role || 'Unknown Role';
	
	// Get occurrences to display (prioritize the rota's specific occurrence if it has one)
	// Filter out past occurrences - only show today and future dates
	const now = new Date();
	now.setHours(0, 0, 0, 0); // Set to start of today for date comparison
	
	let occurrencesToDisplay = [];
	if (rota.occurrenceId) {
		const specificOcc = eventOccurrences.find(o => o.id === rota.occurrenceId);
		if (specificOcc) {
			// Only include if the occurrence date is today or in the future
			const occDate = specificOcc.startsAt ? new Date(specificOcc.startsAt) : null;
			if (occDate && occDate >= now) {
				occurrencesToDisplay = [specificOcc];
			}
		}
	} else {
		// Show all occurrences for this event that are today or in the future
		occurrencesToDisplay = eventOccurrences.filter(occ => {
			if (!occ.startsAt) return false;
			const occDate = new Date(occ.startsAt);
			occDate.setHours(0, 0, 0, 0);
			return occDate >= now;
		});
	}
	
	// If no occurrences, show unassigned assignees if any
	if (occurrencesToDisplay.length === 0 && assigneesByOccurrence['unassigned']) {
		occurrencesToDisplay = [{ id: 'unassigned', startsAt: null, endsAt: null }];
	}

	// Generate cards HTML - one card per occurrence
	let cardsHTML = '';
	if (occurrencesToDisplay.length > 0) {
		occurrencesToDisplay.forEach(occ => {
			const occAssignees = assigneesByOccurrence[occ.id] || [];
			
			// Only include this occurrence if there are contacts assigned
			if (occAssignees.length > 0) {
				let dateTime = '';
				if (occ.id === 'unassigned') {
					dateTime = 'Unassigned';
				} else {
					dateTime = formatReadableDate(occ.startsAt);
					if (occ.endsAt) {
						const endTime = formatReadableDate(occ.endsAt);
						// Extract just the time part from endTime
						const endTimeOnly = endTime.split(' at ')[1] || '';
						if (endTimeOnly) {
							dateTime += ` - ${endTimeOnly}`;
						}
					}
				}
				
				const namesHTML = occAssignees.map(assignee => 
					`<div class="contact-name">${escapeHtml(assignee.name || 'Unknown')}</div>`
				).join('');
				
				cardsHTML += `
					<div class="date-card">
						<div class="date-header">${escapeHtml(dateTime)}</div>
						<div class="contacts-list">
							${namesHTML}
						</div>
					</div>
				`;
			}
		});
	}
	
	// If no cards were generated, show a message
	if (!cardsHTML) {
		cardsHTML = '<div class="no-contacts">No contacts assigned to any occurrences</div>';
	}

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Rota: ${escapeHtml(rotaRole)}</title>
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
		
		.header .event-title {
			font-size: 18px;
			color: #6b7280;
			margin-bottom: 12px;
		}
		
		.header .notes {
			margin-top: 16px;
			padding: 12px;
			background-color: #f9fafb;
			border-left: 3px solid #059669;
			font-size: 13px;
			line-height: 1.6;
			color: #374151;
		}
		
		.header .notes p {
			margin: 0 0 8px 0;
		}
		
		.header .notes p:last-child {
			margin-bottom: 0;
		}
		
		.cards-container {
			display: flex;
			flex-wrap: wrap;
			gap: 15px;
			margin-bottom: 30px;
		}
		
		.date-card {
			flex: 0 0 calc(33.333% - 10px);
			min-width: 250px;
			border: 1px solid #d1d5db;
			border-radius: 8px;
			background-color: #fff;
			overflow: hidden;
			page-break-inside: avoid;
		}
		
		.date-header {
			background-color: #f3f4f6;
			padding: 14px 16px;
			font-weight: 600;
			font-size: 15px;
			color: #111827;
			border-bottom: 1px solid #d1d5db;
		}
		
		.contacts-list {
			padding: 12px 16px;
		}
		
		.contact-name {
			padding: 8px 0;
			font-size: 14px;
			color: #374151;
			border-bottom: 1px solid #f3f4f6;
		}
		
		.contact-name:last-child {
			border-bottom: none;
		}
		
		.no-contacts {
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
		<h1>${escapeHtml(rotaRole)}</h1>
		<div class="event-title">${escapeHtml(eventTitle)}</div>
		${rota.notes ? `<div class="notes">${rota.notes}</div>` : ''}
	</div>
	
	<div class="cards-container">
		${cardsHTML}
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
