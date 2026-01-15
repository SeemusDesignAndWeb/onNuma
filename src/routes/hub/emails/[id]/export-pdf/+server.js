import { json, error } from '@sveltejs/kit';
import { findById } from '$lib/crm/server/fileStore.js';
import { personalizeContent, getUpcomingEvents } from '$lib/crm/server/email.js';

/**
 * Export newsletter to PDF
 * Note: Requires puppeteer to be installed: npm install puppeteer
 */
export async function GET({ params, locals, url }) {
	// Check authentication (set by hooks)
	if (!locals.admin) {
		throw error(401, 'Unauthorized');
	}

	try {
		const newsletter = await findById('emails', params.id);
		if (!newsletter) {
			throw error(404, 'Newsletter not found');
		}

		// Try to import puppeteer (will fail if not installed)
		let puppeteer;
		try {
			puppeteer = await import('puppeteer');
		} catch (importError) {
			throw error(500, 'PDF export requires puppeteer. Please run: npm install puppeteer');
		}

		// Get upcoming events for personalization (with error handling)
		const eventObj = { url }; // Create event-like object for getBaseUrl
		let upcomingEvents = [];
		try {
			upcomingEvents = await getUpcomingEvents(eventObj);
		} catch (eventsError) {
			console.error('Error fetching upcoming events for PDF export:', eventsError);
			// Continue with empty events array if fetch fails
		}
		
		// Personalize newsletter content with default values
		// For PDF export, remove rota links placeholder and preceding rota-related line to exclude rotas (aimed at ALL people)
		let subjectContent = newsletter.subject || '';
		let htmlContentForPersonalization = newsletter.htmlContent || newsletter.textContent || '<p>No content available</p>';
		
		// Remove rota links placeholder and any preceding line/paragraph that contains "rota"
		subjectContent = removeRotaLinksAndPrecedingLine(subjectContent);
		htmlContentForPersonalization = removeRotaLinksAndPrecedingLine(htmlContentForPersonalization);
		
		let personalizedSubject = subjectContent;
		let personalizedHtmlContent = htmlContentForPersonalization;
		try {
			personalizedSubject = await personalizeContent(subjectContent, null, [], upcomingEvents, eventObj, false, false);
			personalizedHtmlContent = await personalizeContent(htmlContentForPersonalization, null, [], upcomingEvents, eventObj, false, false);
		} catch (personalizeError) {
			console.error('Error personalizing content for PDF export:', personalizeError);
			// Use original content if personalization fails
		}
		
		// Generate HTML for PDF with personalized content
		const htmlContent = generateNewsletterHTML({
			...newsletter,
			subject: personalizedSubject,
			htmlContent: personalizedHtmlContent
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

			// Generate PDF
			const pdf = await page.pdf({
				format: 'A4',
				printBackground: true,
				margin: {
					top: '20mm',
					right: '15mm',
					bottom: '20mm',
					left: '15mm'
				}
			});

			await browser.close();

			// Return PDF as response
			// Sanitize filename to remove special characters
			const subjectSlug = (newsletter.subject || newsletter.id)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.substring(0, 50); // Limit length
			const dateStr = new Date().toISOString().split('T')[0];
			const filename = `newsletter-${subjectSlug}-${dateStr}.pdf`;
			
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
 * Generate HTML content for PDF export
 */
function generateNewsletterHTML(newsletter) {
	const subject = newsletter.subject || 'Untitled Newsletter';
	const htmlContent = newsletter.htmlContent || newsletter.textContent || '<p>No content available</p>';
	const createdAt = newsletter.createdAt ? new Date(newsletter.createdAt).toLocaleDateString('en-GB', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	}) : '';

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${subject}</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
			line-height: 1.6;
			color: #333;
			background: #fff;
		}
		
		.content {
			padding: 20px 0;
		}
		
		.content img {
			max-width: 100%;
			height: auto;
			display: block;
			margin: 20px 0;
		}
		
		.content p {
			margin-bottom: 15px;
		}
		
		/* Quill alignment classes */
		.content .ql-align-center {
			text-align: center;
		}
		
		.content .ql-align-right {
			text-align: right;
		}
		
		.content .ql-align-justify {
			text-align: justify;
		}
		
		.content .ql-align-left {
			text-align: left;
		}
		
		/* Also handle inline styles for alignment */
		.content [style*="text-align: center"],
		.content [style*="text-align:center"] {
			text-align: center !important;
		}
		
		.content [style*="text-align: right"],
		.content [style*="text-align:right"] {
			text-align: right !important;
		}
		
		.content [style*="text-align: justify"],
		.content [style*="text-align:justify"] {
			text-align: justify !important;
		}
		
		.content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
			margin-top: 0.67em;
			margin-bottom: 0.67em;
			font-weight: 600;
			line-height: 1.2;
		}
		
		.content h1 { 
			font-size: 2em;
			line-height: 1.2;
		}
		.content h2 { 
			font-size: 1.5em;
			line-height: 1.3;
		}
		.content h3 { 
			font-size: 1.17em;
			line-height: 1.4;
		}
		.content h4 { 
			font-size: 1em;
			line-height: 1.5;
		}
		
		.content ul, .content ol {
			margin-left: 30px;
			margin-bottom: 15px;
		}
		
		.content li {
			margin-bottom: 8px;
		}
		
		.content blockquote {
			border-left: 4px solid #4A97D2;
			padding-left: 20px;
			margin: 20px 0;
			font-style: italic;
			color: #666;
		}
		
		.content table {
			width: 100%;
			border-collapse: collapse;
			margin: 20px 0;
		}
		
		.content table th,
		.content table td {
			border: 1px solid #ddd;
			padding: 12px;
			text-align: left;
		}
		
		.content table th {
			background-color: #f5f5f5;
			font-weight: 600;
		}
		
		.footer {
			margin-top: 40px;
			padding-top: 20px;
			border-top: 2px solid #e5e7eb;
			text-align: center;
			color: #666;
			font-size: 12px;
		}
		
		@media print {
			.content {
				page-break-inside: avoid;
			}
		}
	</style>
</head>
<body>
	<div class="content">
		${htmlContent}
	</div>
	
	<div class="footer">
		<p>Eltham Green Community Church - TheHUB Newsletter</p>
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
 * Remove rotaLinks placeholder and the preceding line/paragraph if it contains "rota"
 * @param {string} content - Content to process
 * @returns {string} Content with rotaLinks and preceding rota-related line removed
 */
function removeRotaLinksAndPrecedingLine(content) {
	if (!content) return content;
	
	let result = content;
	
	// Pattern 1: HTML block element containing "rota" immediately before {{rotaLinks}}
	// Matches: <p>Your Rotas</p>{{rotaLinks}}, <h2>Your Rotas</h2>{{rotaLinks}}, <div>Your Rotas</div>{{rotaLinks}}
	// This uses a non-greedy match to get the element immediately before the placeholder
	result = result.replace(/(<(?:p|h[1-6]|div|li)[^>]*>[\s\S]*?<\/(?:p|h[1-6]|div|li)>)\s*\{\{rotaLinks\}\}/gi, (match, element) => {
		// Check if the element's text content contains "rota"
		const textContent = element.replace(/<[^>]+>/g, '').trim();
		if (/rota/i.test(textContent)) {
			// Remove the entire match (element + placeholder)
			return '';
		}
		// If no "rota" found, just remove the placeholder
		return element;
	});
	
	// Pattern 2: Text line containing "rota" immediately before {{rotaLinks}} (plain text or within HTML)
	// Matches: Your Rotas\n{{rotaLinks}} or Your Rotas {{rotaLinks}} or <p>Your Rotas{{rotaLinks}}</p>
	result = result.replace(/([^\n<]*rota[^\n<]*[\n\s]*)\{\{rotaLinks\}\}/gi, '');
	
	// Pattern 3: Remove any remaining {{rotaLinks}} placeholders
	result = result.replace(/\{\{rotaLinks\}\}/g, '');
	
	return result;
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
	return text.replace(/[&<>"']/g, m => map[m]);
}

