import { error } from '@sveltejs/kit';
import { findById, readCollection, findMany } from '$lib/crm/server/fileStore.js';
import { formatDateTimeUK } from '$lib/crm/utils/dateFormat.js';

/**
 * Export all rotas for an event to PDF
 * Note: Requires puppeteer to be installed: npm install puppeteer
 */
export async function GET({ params, locals }) {
	// Check authentication (set by hooks)
	if (!locals.admin) {
		throw error(401, 'Unauthorized');
	}

	try {
		const event = await findById('events', params.id);
		if (!event) {
			throw error(404, 'Event not found');
		}

		// Load all rotas for this event
		const rotas = await findMany('rotas', r => r.eventId === params.id);
		
		if (rotas.length === 0) {
			throw error(404, 'No rotas found for this event');
		}

		// Load all occurrences for this event (for PDF, show all occurrences, sorted by date)
		const allOccurrences = await readCollection('occurrences');
		const eventOccurrences = allOccurrences
			.filter(o => o.eventId === params.id)
			.sort((a, b) => {
				// Sort by date, earliest first
				const dateA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
				const dateB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
				return dateA - dateB;
			});
		
		// Load contacts for assignees
		const contacts = await readCollection('contacts');
		
		// Process all rotas and their assignees
		const rotasWithAssignees = rotas.map(rota => {
			// Process assignees
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
			
			return {
				...rota,
				assigneesByOccurrence
			};
		});

		// Try to import puppeteer
		let puppeteer;
		try {
			puppeteer = await import('puppeteer');
		} catch (importError) {
			throw error(500, 'PDF export requires puppeteer. Please run: npm install puppeteer');
		}

		// Generate HTML for PDF
		const htmlContent = generateEventRotasPDFHTML({
			event,
			rotas: rotasWithAssignees,
			eventOccurrences
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
			const eventSlug = (event.title || event.id)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.substring(0, 50);
			const dateStr = new Date().toISOString().split('T')[0];
			const filename = `event-rotas-${eventSlug}-${dateStr}.pdf`;
			
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
 * Generate HTML content for event rotas PDF export
 */
function generateEventRotasPDFHTML({ event, rotas, eventOccurrences }) {
	const eventTitle = event.title || 'Unknown Event';
	
	// Generate rota sections HTML - one section per rota
	let rotaSectionsHTML = '';
	
	rotas.forEach(rota => {
		const rotaRole = rota.role || 'Unknown Role';
		
		// Get occurrences to display for this rota
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
		
		// If no occurrences, check unassigned assignees
		if (occurrencesToDisplay.length === 0 && rota.assigneesByOccurrence['unassigned'] && rota.assigneesByOccurrence['unassigned'].length > 0) {
			occurrencesToDisplay = [{ id: 'unassigned', startsAt: null, endsAt: null }];
		}
		
		// Generate table rows for this rota
		let tableRowsHTML = '';
		if (occurrencesToDisplay.length > 0) {
			occurrencesToDisplay.forEach(occ => {
				const occAssignees = rota.assigneesByOccurrence[occ.id] || [];
				
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
		
		// Only add section if there are contacts assigned
		if (tableRowsHTML) {
			rotaSectionsHTML += `
				<div class="rota-section">
					<h2 class="rota-name">${escapeHtml(rotaRole)}</h2>
					${rota.notes ? `<div class="rota-notes">${rota.notes}</div>` : ''}
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
				</div>
			`;
		}
	});
	
	// If no rotas with contacts, show a message
	if (!rotaSectionsHTML) {
		rotaSectionsHTML = '<div class="no-rotas">No contacts assigned to any rotas</div>';
	}

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Rotas: ${escapeHtml(eventTitle)}</title>
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
		
		.rota-section {
			margin-bottom: 40px;
			page-break-inside: avoid;
		}
		
		.rota-section:last-child {
			margin-bottom: 0;
		}
		
		.rota-name {
			font-size: 22px;
			font-weight: 600;
			color: #059669;
			margin-bottom: 12px;
		}
		
		.rota-notes {
			margin-bottom: 16px;
			padding: 12px;
			background-color: #f9fafb;
			border-left: 3px solid #059669;
			font-size: 13px;
			line-height: 1.6;
			color: #374151;
		}
		
		.rota-notes p {
			margin: 0 0 8px 0;
		}
		
		.rota-notes p:last-child {
			margin-bottom: 0;
		}
		
		.no-rotas {
			color: #9ca3af;
			font-style: italic;
			text-align: center;
			padding: 20px;
		}
		
		.rota-section table {
			width: 100%;
			border-collapse: collapse;
			margin-bottom: 0;
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
		<h1>${escapeHtml(eventTitle)}</h1>
	</div>
	
	${rotaSectionsHTML}
	
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
