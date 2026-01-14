import { error } from '@sveltejs/kit';
import { findById, readCollection } from '$lib/crm/server/fileStore.js';
import { formatDateTimeUK, formatTimeUK } from '$lib/crm/utils/dateFormat.js';

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
		const rota = await findById('rotas', params.id);
		if (!rota) {
			throw error(404, 'Rota not found');
		}

		const event = await findById('events', rota.eventId);
		if (!event) {
			throw error(404, 'Event not found');
		}

		// Load all occurrences for this event (for PDF, show all occurrences, not just upcoming)
		const allOccurrences = await readCollection('occurrences');
		const eventOccurrences = allOccurrences
			.filter(o => o.eventId === rota.eventId)
			.sort((a, b) => {
				// Sort by date, earliest first
				const dateA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
				const dateB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
				return dateA - dateB;
			});
		
		// Load contacts for assignees
		const contacts = await readCollection('contacts');
		
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
	let occurrencesToDisplay = [];
	if (rota.occurrenceId) {
		const specificOcc = eventOccurrences.find(o => o.id === rota.occurrenceId);
		if (specificOcc) {
			occurrencesToDisplay = [specificOcc];
		}
	} else {
		// Show all occurrences for this event
		occurrencesToDisplay = eventOccurrences;
	}
	
	// If no occurrences, show unassigned assignees if any
	if (occurrencesToDisplay.length === 0 && assigneesByOccurrence['unassigned']) {
		occurrencesToDisplay = [{ id: 'unassigned', startsAt: null, endsAt: null }];
	}

	// Generate table rows HTML - only include occurrences with contacts
	let tableRowsHTML = '';
	if (occurrencesToDisplay.length > 0) {
		occurrencesToDisplay.forEach(occ => {
			const occAssignees = assigneesByOccurrence[occ.id] || [];
			
			// Only include this occurrence if there are contacts assigned
			if (occAssignees.length > 0) {
				let dateTime = '';
				if (occ.id === 'unassigned') {
					dateTime = 'Unassigned';
				} else {
					dateTime = formatDateTimeUK(occ.startsAt);
					if (occ.endsAt) {
						dateTime += ' - ' + formatDateTimeUK(occ.endsAt);
					}
				}
				
				occAssignees.forEach((assignee, index) => {
					tableRowsHTML += `
						<tr>
							<td>${index === 0 ? escapeHtml(dateTime) : ''}</td>
							<td>${escapeHtml(assignee.name || 'Unknown')}</td>
						</tr>
					`;
				});
			}
		});
	}
	
	// If no rows were generated, show a message
	if (!tableRowsHTML) {
		tableRowsHTML = `
			<tr>
				<td colspan="2" class="no-contacts">No contacts assigned to any occurrences</td>
			</tr>
		`;
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
		
		table {
			width: 100%;
			border-collapse: collapse;
			margin-bottom: 30px;
		}
		
		th {
			background-color: #f3f4f6;
			padding: 12px;
			text-align: left;
			font-weight: 600;
			border: 1px solid #d1d5db;
			font-size: 14px;
		}
		
		td {
			padding: 10px 12px;
			border: 1px solid #d1d5db;
			font-size: 13px;
		}
		
		tr:nth-child(even) {
			background-color: #f9fafb;
		}
		
		.no-contacts {
			color: #9ca3af;
			font-style: italic;
			text-align: center;
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
	
	<table>
		<thead>
			<tr>
				<th>Date & Time</th>
				<th>Name</th>
			</tr>
		</thead>
		<tbody>
			${tableRowsHTML}
		</tbody>
	</table>
	
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
