import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { readCollection, findById, update, findMany } from './fileStore.js';
import { ensureUnsubscribeToken } from './tokens.js';

const resend = new Resend(env.RESEND_API_KEY);

/**
 * Get base URL for absolute links in emails
 * @param {object} event - SvelteKit event object
 * @returns {string} Base URL
 */
function getBaseUrl(event) {
	return env.APP_BASE_URL || event?.url?.origin || 'http://localhost:5173';
}

/**
 * Generate email branding HTML with logo and site link
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {string} Branding HTML
 */
function getEmailBranding(event) {
	const baseUrl = getBaseUrl(event);
	const logoUrl = `${baseUrl}/images/egcc-color.png`;
	
	return `
		<div style="text-align: center; padding: 20px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
			<a href="${baseUrl}" style="display: inline-block; text-decoration: none;">
				<img src="${logoUrl}" alt="Eltham Green Community Church" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
			</a>
		</div>
	`;
}

/**
 * Clean up empty paragraphs and other Quill artifacts from HTML
 * @param {string} html - HTML content
 * @returns {string} Cleaned HTML
 */
function cleanNewsletterHtml(html) {
	if (!html) return '';
	
	// Remove empty paragraphs: <p><br></p>, <p></p>, <p> </p>, <p>&nbsp;</p>
	let cleaned = html
		.replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, '') // <p><br></p> or <p><br/></p>
		.replace(/<p[^>]*>\s*<\/p>/gi, '') // <p></p>
		.replace(/<p[^>]*>\s*&nbsp;\s*<\/p>/gi, '') // <p>&nbsp;</p>
		.replace(/<p[^>]*>\s+<\/p>/gi, ''); // <p> </p> (whitespace only)
	
	// Remove multiple consecutive empty paragraphs (in case some weren't caught)
	cleaned = cleaned.replace(/(<p[^>]*>\s*<br\s*\/?>\s*<\/p>\s*){2,}/gi, '');
	
	// Clean up any remaining empty divs that might have been created
	cleaned = cleaned.replace(/<div[^>]*>\s*<\/div>/gi, '');
	
	return cleaned;
}

/**
 * Get unsubscribe link for a contact
 * @param {string} contactIdOrEmail - Contact ID or email
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<string>} Unsubscribe URL
 */
async function getUnsubscribeLink(contactIdOrEmail, event) {
	if (!contactIdOrEmail) {
		return '';
	}
	
	const baseUrl = getBaseUrl(event);
	
	// Try to find contact by ID or email
	const contacts = await readCollection('contacts');
	const contact = contacts.find(c => c.id === contactIdOrEmail || c.email === contactIdOrEmail);
	
	if (!contact) {
		return '';
	}
	
	// Ensure unsubscribe token exists
	const token = await ensureUnsubscribeToken(contact.id, contact.email);
	return `${baseUrl}/unsubscribe/${token.token}`;
}

/**
 * Get upcoming public events (within 7 days)
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<Array>} Array of event occurrences
 */
export async function getUpcomingEvents(event) {
	const now = new Date();
	const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

	const events = await readCollection('events');
	const occurrences = await readCollection('occurrences');
	const baseUrl = getBaseUrl(event);

	// Filter to public and internal events (internal events are for members/contacts only)
	const memberEvents = events.filter(e => e.visibility === 'public' || e.visibility === 'internal');
	const memberEventIds = new Set(memberEvents.map(e => e.id));

	// Get upcoming occurrences for public and internal events
	const upcoming = [];
	for (const occurrence of occurrences) {
		if (!memberEventIds.has(occurrence.eventId)) continue;

		const startDate = new Date(occurrence.startsAt);
		if (startDate >= now && startDate <= sevenDaysFromNow) {
			const eventData = memberEvents.find(e => e.id === occurrence.eventId);
			if (eventData) {
				upcoming.push({
					event: eventData,
					occurrence
				});
			}
		}
	}

	// Sort by start date
	upcoming.sort((a, b) => new Date(a.occurrence.startsAt) - new Date(b.occurrence.startsAt));

	return upcoming;
}

/**
 * Check if a contact has any rotas assigned (regardless of date)
 * @param {string} contactId - Contact ID
 * @returns {Promise<boolean>} True if contact has any rotas assigned
 */
export async function hasAnyRotas(contactId) {
	if (!contactId) return false;
	
	try {
		const rotas = await readCollection('rotas');
		// Filter rotas where this contact is assigned (handle both old string format and new object format)
		const contactRotas = rotas.filter(r => {
			if (!r.assignees || !Array.isArray(r.assignees)) return false;
			return r.assignees.some(assignee => {
				// Old format: assignee is just a string (contactId)
				if (typeof assignee === 'string') {
					return assignee === contactId;
				}
				// New format: assignee is an object with contactId
				if (assignee && typeof assignee === 'object') {
					// contactId can be a string or an object (for public signups)
					if (typeof assignee.contactId === 'string') {
						return assignee.contactId === contactId;
					}
					// Also check assignee.id for backward compatibility
					if (assignee.id === contactId) {
						return true;
					}
				}
				return false;
			});
		});
		
		return contactRotas.length > 0;
	} catch (error) {
		console.error('Error checking if contact has rotas:', error);
		// Return false on error to avoid breaking email sending
		return false;
	}
}

/**
 * Get upcoming rotas for a contact (within 14 days)
 * @param {string} contactId - Contact ID
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<Array>} Array of rota objects with event and occurrence data
 */
export async function getUpcomingRotas(contactId, event) {
	const now = new Date();
	const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

	const rotas = await readCollection('rotas');
	// Filter rotas where this contact is assigned (handle both old string format and new object format)
	const contactRotas = rotas.filter(r => {
		if (!r.assignees || !Array.isArray(r.assignees)) return false;
		return r.assignees.some(assignee => {
			// Old format: assignee is just a string (contactId)
			if (typeof assignee === 'string') {
				return assignee === contactId;
			}
			// New format: assignee is an object with contactId
			if (assignee && typeof assignee === 'object') {
				// contactId can be a string or an object (for public signups)
				if (typeof assignee.contactId === 'string') {
					return assignee.contactId === contactId;
				}
				// Also check assignee.id for backward compatibility
				if (assignee.id === contactId) {
					return true;
				}
			}
			return false;
		});
	});

	if (contactRotas.length === 0) {
		return [];
	}

	const events = await readCollection('events');
	const occurrences = await readCollection('occurrences');
	const tokens = await readCollection('rota_tokens');
	const baseUrl = getBaseUrl(event);

	const upcoming = [];

	for (const rota of contactRotas) {
		const eventData = events.find(e => e.id === rota.eventId);
		if (!eventData) continue;

		// Get occurrences for this rota
		let rotaOccurrences = [];
		if (rota.occurrenceId) {
			// Specific occurrence
			const occurrence = occurrences.find(o => o.id === rota.occurrenceId);
			if (occurrence) {
				rotaOccurrences = [occurrence];
			}
		} else {
			// All occurrences for this event
			rotaOccurrences = occurrences.filter(o => o.eventId === rota.eventId);
		}

		// Filter to upcoming occurrences (within 14 days)
		for (const occurrence of rotaOccurrences) {
			const startDate = new Date(occurrence.startsAt);
			if (startDate >= now && startDate <= fourteenDaysFromNow) {
				// Find token for this rota/occurrence
				const tokenData = tokens.find(t => 
					t.rotaId === rota.id && 
					t.occurrenceId === (occurrence.id || null) &&
					!t.used
				);

				upcoming.push({
					rota,
					event: eventData,
					occurrence,
					signupUrl: tokenData ? `${baseUrl}/signup/rota/${tokenData.token}` : null
				});
			}
		}
	}

	// Sort by start date
	upcoming.sort((a, b) => new Date(a.occurrence.startsAt) - new Date(b.occurrence.startsAt));

	return upcoming;
}

/**
 * Personalise content with contact data, rota links, and upcoming events
 * @param {string} content - Content template
 * @param {object} contact - Contact object
 * @param {Array} upcomingRotas - Upcoming rotas array
 * @param {Array} upcomingEvents - Upcoming events array
 * @param {object} event - SvelteKit event object (for base URL)
 * @param {boolean} isText - Whether this is plain text (not HTML)
 * @param {boolean} contactHasRotas - Whether the contact has any rotas assigned (optional, will be checked if not provided)
 * @returns {Promise<string>} Personalised content
 */
export async function personalizeContent(content, contact, upcomingRotas = [], upcomingEvents = [], event, isText = false, contactHasRotas = null) {
	if (!content) return '';

	const baseUrl = getBaseUrl(event);
	const contactData = contact || { email: '', firstName: '', lastName: '', phone: '' };
	
	// Check if contact has any rotas if not provided
	let hasRotas = contactHasRotas;
	if (hasRotas === null && contact?.id) {
		hasRotas = await hasAnyRotas(contact.id);
	}
	// Default to false if still null (no contact or no contact ID)
	if (hasRotas === null) {
		hasRotas = false;
	}
	
	// Replace contact placeholders with default values
	let personalized = content
		.replace(/\{\{firstName\}\}/g, contactData.firstName || 'all')
		.replace(/\{\{lastName\}\}/g, contactData.lastName || '')
		.replace(/\{\{name\}\}/g, `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim() || contactData.email || 'Church Member')
		.replace(/\{\{email\}\}/g, contactData.email || 'subscriber@egcc.co.uk')
		.replace(/\{\{phone\}\}/g, contactData.phone || '');

	const signupPageUrl = `${baseUrl}/signup/rotas`;

	// Replace rota links placeholder with actual rota links
	if (isText) {
		// Plain text version
		personalized = personalized.replace(/\{\{rotaLinks\}\}/g, () => {
			let text = '';
			if (upcomingRotas.length === 0) {
				text = 'You have no upcoming rotas in the next 14 days.';
			} else {
				for (const item of upcomingRotas) {
					const { rota, event: eventData, occurrence, signupUrl } = item;
					const dateStr = new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					});

					text += `\n- ${eventData.title} - ${rota.role}\n  ${dateStr}`;
					if (signupUrl) {
						text += `\n  Sign up: ${signupUrl}`;
					}
					text += '\n';
				}
			}
			
			// Add signup link
			text += '\n';
			text += `Sign Up for Rotas: ${signupPageUrl}`;
			
			return text;
		});
		} else {
			// HTML version
			personalized = personalized.replace(/\{\{rotaLinks\}\}/g, () => {
				let html = '';
				if (upcomingRotas.length === 0) {
					html = '<p style="color: #333; font-size: 14px;">You have no upcoming rotas in the next 14 days.</p>';
				} else {
					for (const item of upcomingRotas) {
						const { rota, event: eventData, occurrence, signupUrl } = item;
						const dateStr = new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
							weekday: 'long',
							year: 'numeric',
							month: 'long',
							day: 'numeric',
							hour: '2-digit',
							minute: '2-digit'
						});

						// Format: Event Title (bold) - Role (bold) - Date/Time - Location (all on same line, same size)
						let line = `<strong>${eventData.title}</strong> - <strong>${rota.role}</strong> - ${dateStr}`;
						if (occurrence.location) {
							line += ` - ${occurrence.location}`;
						}
						
						html += '<div style="margin-bottom: 8px;">';
						html += `<p style="margin: 0 0 5px 0; color: #333; font-size: 14px;">${line}</p>`;
						if (signupUrl) {
							html += `<a href="${signupUrl}" style="display: inline-block; background: #4A97D2; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; margin-top: 3px;">View Rota Details</a>`;
						}
						html += '</div>';
					}
				}
			
				// Add signup link
				html += '<div style="margin-top: 12px;">';
				html += `<a href="${signupPageUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px;">Sign Up for Rotas</a>`;
				html += '</div>';
			
				return html;
			});
	}

	// Replace upcoming events placeholders
	if (isText) {
		// Plain text version
		personalized = personalized.replace(/\{\{upcomingEvents\}\}/g, () => {
			if (upcomingEvents.length === 0) {
				return 'There are no upcoming events in the next 7 days.';
			}

			let text = '';
			for (const item of upcomingEvents) {
				const { event: eventData, occurrence } = item;
				const dateStr = new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});

				// Format: Title - Date/Time - Location (all on same line)
				let line = `${eventData.title} - ${dateStr}`;
				if (occurrence.location) {
					line += ` - ${occurrence.location}`;
				}
				text += `\n- ${line}`;
			}
			return text;
		});
	} else {
		// HTML version
		personalized = personalized.replace(/\{\{upcomingEvents\}\}/g, () => {
			if (upcomingEvents.length === 0) {
				return '<p style="color: #333; font-size: 14px;">There are no upcoming events in the next 7 days.</p>';
			}

			let html = '';
			
			for (const item of upcomingEvents) {
				const { event: eventData, occurrence } = item;
				const dateStr = new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				});

				// Format: Title (bold) - Date/Time - Location (all on same line, same size)
				let line = `<strong>${eventData.title}</strong>`;
				line += ` - ${dateStr}`;
				if (occurrence.location) {
					line += ` - ${occurrence.location}`;
				}
				
				html += '<div style="margin-bottom: 8px;">';
				html += `<p style="margin: 0; color: #333; font-size: 14px;">${line}</p>`;
				html += '</div>';
			}
			
			return html;
		});
	}

	return personalized;
}

/**
 * Send newsletter email via Resend
 * @param {object} options - Email options
 * @param {string} options.newsletterId - Newsletter ID
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {object} contact - Contact object for personalisation
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend response
 */
export async function sendNewsletterEmail({ newsletterId, to, name, contact }, event) {
	const email = await findById('emails', newsletterId);
	if (!email) {
		throw new Error('Email not found');
	}

	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

	// Get upcoming events for personalisation
	const upcomingEvents = await getUpcomingEvents(event);
	
	// Get upcoming rotas for this contact
	const upcomingRotas = contact?.id ? await getUpcomingRotas(contact.id, event) : [];
	
	// Check if contact has any rotas assigned
	const contactHasRotas = contact?.id ? await hasAnyRotas(contact.id) : false;

	// Personalize content
	const contactData = contact || { email: to, firstName: name, lastName: '', phone: '' };
	const personalizedSubject = await personalizeContent(email.subject, contactData, upcomingRotas, upcomingEvents, event, false, contactHasRotas);
	let personalizedHtml = await personalizeContent(email.htmlContent, contactData, upcomingRotas, upcomingEvents, event, false, contactHasRotas);
	
	// Clean up empty paragraphs and Quill artifacts before sending
	personalizedHtml = cleanNewsletterHtml(personalizedHtml);
	
	let personalizedText = await personalizeContent(
		email.textContent || email.htmlContent.replace(/<[^>]*>/g, ''), 
		contactData, 
		upcomingRotas,
		upcomingEvents,
		event,
		true,
		contactHasRotas
	);

	// Add unsubscribe link to HTML and text versions
	const unsubscribeLink = await getUnsubscribeLink(contact?.id || contact?.email, event);
	const unsubscribeHtml = `
		<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #666;">
			<p style="margin: 0 0 10px 0;">You are receiving this email because you are subscribed to our newsletter.</p>
			<p style="margin: 0;">
				<a href="${unsubscribeLink}" style="color: #4A97D2; text-decoration: underline;">Unsubscribe from this list</a>
			</p>
		</div>
	`;
	const unsubscribeText = `\n\n---\nYou are receiving this email because you are subscribed to our newsletter.\nUnsubscribe: ${unsubscribeLink}`;

	// Wrap content in proper email template with branding
	const branding = getEmailBranding(event);
	const fullHtml = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${personalizedSubject}</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="color: #333;">
					${personalizedHtml}
				</div>
				${unsubscribeHtml}
			</div>
		</body>
		</html>
	`;

	personalizedText += unsubscribeText;

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: personalizedSubject,
			html: fullHtml,
			text: personalizedText
		});

		// Log the send
		const logs = email.logs || [];
		logs.push({
			timestamp: new Date().toISOString(),
			email: to,
			status: 'sent',
			messageId: result.data?.id || null
		});

		await update('emails', newsletterId, { logs });

		return result;
	} catch (error) {
		// Log the error
		const logs = email.logs || [];
		logs.push({
			timestamp: new Date().toISOString(),
			email: to,
			status: 'error',
			error: error.message
		});

		await update('emails', newsletterId, { logs });

		throw error;
	}
}

/**
 * Send rota invitation email
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {string} options.token - Rota token
 * @param {object} rotaData - Rota, event, occurrence data
 * @param {object} contact - Contact object for personalisation and upcoming rotas
 * @param {object} event - SvelteKit event object
 * @returns {Promise<object>} Resend response
 */
export async function sendRotaInvite({ to, name, token }, rotaData, contact, event) {
	const { rota, event: eventData, occurrence } = rotaData;
	const baseUrl = getBaseUrl(event);
	const signupUrl = `${baseUrl}/signup/rota/${token}`;
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

	const eventTitle = eventData?.title || 'Event';
	const role = rota?.role || 'Volunteer';
	const occurrenceDate = occurrence 
		? new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		})
		: 'TBD';

	// Get upcoming rotas for this contact (excluding the current one)
	const upcomingRotas = contact ? await getUpcomingRotas(contact.id, event) : [];
	const otherUpcomingRotas = upcomingRotas.filter(item => 
		item.rota.id !== rota.id || 
		(item.occurrence && occurrence && item.occurrence.id !== occurrence.id)
	);

	// Build upcoming rotas section
	let upcomingRotasHtml = '';
		if (otherUpcomingRotas.length > 0) {
		upcomingRotasHtml = `
			<div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 12px 0; border-left: 4px solid #2d7a32;">
				<h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px; font-weight: 600;">Your Other Upcoming Rotas (Next 14 Days)</h3>
		`;
		for (const item of otherUpcomingRotas) {
			const dateStr = new Date(item.occurrence.startsAt).toLocaleDateString('en-GB', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
			upcomingRotasHtml += `
				<div style="border-bottom: 1px solid #e5e7eb; padding: 6px 0; margin-bottom: 6px;">
					<p style="margin: 0 0 3px 0; color: #333; font-size: 14px; font-weight: 600;">${item.event.title} - ${item.rota.role}</p>
					<p style="margin: 0 0 3px 0; color: #666; font-size: 13px;">${dateStr}</p>
					${item.occurrence.location ? `<p style="margin: 0 0 5px 0; color: #666; font-size: 13px;">📍 ${item.occurrence.location}</p>` : ''}
					${item.signupUrl ? `<a href="${item.signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Rota</a>` : ''}
				</div>
			`;
		}
		upcomingRotasHtml += '</div>';
	}

	const branding = getEmailBranding(event);
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Volunteer Rota Invitation</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Volunteer Rota Invitation</h1>
				</div>
				
				<div style="padding: 0;">
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
					You've been invited to volunteer for <strong>${eventTitle}</strong> as a <strong>${role}</strong>.
				</p>

				${occurrence ? `
				<div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
					<p style="margin: 0 0 5px 0; color: #666; font-size: 13px;"><strong>Date & Time:</strong></p>
					<p style="margin: 0; color: #333; font-size: 14px;">${occurrenceDate}</p>
					${occurrence.location ? `
					<p style="margin: 10px 0 5px 0; color: #666; font-size: 13px;"><strong>Location:</strong></p>
					<p style="margin: 0; color: #333; font-size: 14px;">${occurrence.location}</p>
					` : ''}
				</div>
				` : ''}

				<div style="text-align: center; margin: 20px 0;">
					<a href="${signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">Accept Invitation</a>
				</div>

				<p style="color: #666; font-size: 13px; margin: 15px 0 0 0;">
					Or copy and paste this link into your browser:<br>
					<a href="${signupUrl}" style="color: #2d7a32; word-break: break-all; font-size: 12px;">${signupUrl}</a>
				</p>

				${upcomingRotasHtml}
				</div>
			</div>
		</body>
		</html>
	`;

	let upcomingRotasText = '';
	if (otherUpcomingRotas.length > 0) {
		upcomingRotasText = '\n\nYour Other Upcoming Rotas (Next 14 Days):\n';
		for (const item of otherUpcomingRotas) {
			const dateStr = new Date(item.occurrence.startsAt).toLocaleDateString('en-GB', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
			upcomingRotasText += `- ${item.event.title} - ${item.rota.role}\n  ${dateStr}`;
			if (item.occurrence.location) {
				upcomingRotasText += `\n  Location: ${item.occurrence.location}`;
			}
			if (item.signupUrl) {
				upcomingRotasText += `\n  View: ${item.signupUrl}`;
			}
			upcomingRotasText += '\n';
		}
	}

	const text = `
Volunteer Rota Invitation

Hello ${name},

You've been invited to volunteer for ${eventTitle} as a ${role}.

${occurrence ? `Date & Time: ${occurrenceDate}${occurrence.location ? `\nLocation: ${occurrence.location}` : ''}` : ''}

Accept your invitation by visiting:
${signupUrl}
${upcomingRotasText}
	`.trim();

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: `Volunteer Invitation: ${eventTitle} - ${role}`,
			html,
			text
		});

		return result;
	} catch (error) {
		console.error('Error sending rota invite:', error);
		throw error;
	}
}

/**
 * Send bulk rota invitations (one email per contact with all rotas)
 * @param {Array} contactInvites - Array of {contact, invites: [{token, rotaData}]}
 * @param {object} eventData - Event data
 * @param {string} eventPageUrl - URL to the public event page
 * @param {object} event - SvelteKit event object
 * @returns {Promise<Array>} Results array
 */
export async function sendCombinedRotaInvites(contactInvites, eventData, eventPageUrl, event) {
	const results = [];
	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	
	for (const contactInvite of contactInvites) {
		const { contact, invites } = contactInvite;
		const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
		const to = contact.email;
		
		if (!to) {
			results.push({ email: to || 'unknown', status: 'error', error: 'No email address' });
			continue;
		}

		try {
			// Group invites by rota (one section per rota, not per occurrence)
			const rotasMap = new Map();
			
			for (const invite of invites) {
				const { rota } = invite.rotaData;
				const rotaId = rota?.id;
				if (!rotaId) continue;
				
				if (!rotasMap.has(rotaId)) {
					// Use the first token for this rota (all tokens for same rota go to same page)
					rotasMap.set(rotaId, {
						rota,
						token: invite.token,
						signupUrl: `${baseUrl}/signup/rota/${invite.token}#rota-${rotaId}`
					});
				}
			}

			// Build rota sections for HTML (one per rota)
			let rotasHtml = '';
			let rotasText = '';
			const eventTitle = eventData?.title || 'Event';
			
			for (const [rotaId, rotaInfo] of rotasMap) {
				const { rota, signupUrl } = rotaInfo;
				const role = rota?.role || 'Volunteer';
				const capacity = rota?.capacity || 1;

				rotasHtml += `
					<div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #2d7a32;">
						<p style="margin: 0 0 8px 0; color: #333; font-size: 16px; font-weight: 600;">${role}</p>
						<p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">Capacity: ${capacity} ${capacity === 1 ? 'person' : 'people'} per occurrence</p>
						<div style="text-align: center; margin-top: 10px;">
							<a href="${signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 13px;">Select Date for ${role}</a>
						</div>
					</div>
				`;

				rotasText += `\n${role} (Capacity: ${capacity} ${capacity === 1 ? 'person' : 'people'} per occurrence)`;
				rotasText += `\nSelect date: ${signupUrl}\n`;
			}

			// Get upcoming rotas for this contact (excluding the ones in this invitation)
			const upcomingRotas = await getUpcomingRotas(contact.id, event);
			const invitedRotaIds = new Set(invites.map(i => i.rotaData.rota.id));
			const otherUpcomingRotas = upcomingRotas.filter(item => 
				!invitedRotaIds.has(item.rota.id)
			);

			// Build upcoming rotas section
			let upcomingRotasHtml = '';
			if (otherUpcomingRotas.length > 0) {
				upcomingRotasHtml = `
					<div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 12px 0; border-left: 4px solid #2d7a32;">
						<h3 style="margin: 0 0 8px 0; color: #333; font-size: 16px; font-weight: 600;">Your Other Upcoming Rotas (Next 14 Days)</h3>
				`;
				for (const item of otherUpcomingRotas) {
					const dateStr = new Date(item.occurrence.startsAt).toLocaleDateString('en-GB', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					});
					upcomingRotasHtml += `
						<div style="border-bottom: 1px solid #e5e7eb; padding: 6px 0; margin-bottom: 6px;">
							<p style="margin: 0 0 3px 0; color: #333; font-size: 14px; font-weight: 600;">${item.event.title} - ${item.rota.role}</p>
							<p style="margin: 0 0 3px 0; color: #666; font-size: 13px;">${dateStr}</p>
							${item.occurrence.location ? `<p style="margin: 0 0 5px 0; color: #666; font-size: 13px;">📍 ${item.occurrence.location}</p>` : ''}
							${item.signupUrl ? `<a href="${item.signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Rota</a>` : ''}
						</div>
					`;
				}
				upcomingRotasHtml += '</div>';
			}

			const branding = getEmailBranding(event);
			const html = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Volunteer Rota Invitations</title>
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
					<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
						${branding}
						<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
							<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Volunteer Rota Invitations</h1>
						</div>
						
						<div style="padding: 0;">
						<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
						
						<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
							Thank you for considering volunteering for <strong>${eventTitle}</strong>. We cannot run these events without your support, and we truly appreciate your willingness to help.
						</p>
						
						<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
							You've been invited to volunteer in the following role${rotasMap.size > 1 ? 's' : ''}:
						</p>

						${rotasHtml}

						${eventPageUrl ? `
						<div style="text-align: center; margin: 20px 0;">
							<a href="${eventPageUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">View Event Page</a>
						</div>
						` : ''}

						${upcomingRotasHtml}
						
						<!-- Footer -->
						<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
							<div style="text-align: center; margin-bottom: 15px;">
								<p style="margin: 0 0 8px 0; color: #333; font-size: 14px; font-weight: 600;">Eltham Green Community Church</p>
								<p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">542 Westhorne Avenue, Eltham, London, SE9 6RR</p>
								<p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">
									<a href="tel:02088501331" style="color: #2d7a32; text-decoration: none;">020 8850 1331</a> | 
									<a href="mailto:enquiries@egcc.co.uk" style="color: #2d7a32; text-decoration: none;">enquiries@egcc.co.uk</a>
								</p>
								<p style="margin: 10px 0 0 0;">
									<a href="${baseUrl}" style="color: #2d7a32; text-decoration: none; font-size: 12px; font-weight: 500;">Visit our website</a>
								</p>
							</div>
						</div>
						</div>
					</div>
				</body>
				</html>
			`;

			let upcomingRotasText = '';
			if (otherUpcomingRotas.length > 0) {
				upcomingRotasText = '\n\nYour Other Upcoming Rotas (Next 14 Days):\n';
				for (const item of otherUpcomingRotas) {
					const dateStr = new Date(item.occurrence.startsAt).toLocaleDateString('en-GB', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					});
					upcomingRotasText += `- ${item.event.title} - ${item.rota.role}\n  ${dateStr}`;
					if (item.occurrence.location) {
						upcomingRotasText += `\n  Location: ${item.occurrence.location}`;
					}
					if (item.signupUrl) {
						upcomingRotasText += `\n  View: ${item.signupUrl}`;
					}
					upcomingRotasText += '\n';
				}
			}

			const text = `
Volunteer Rota Invitations

Hello ${name},

Thank you for considering volunteering for ${eventTitle}. We cannot run these events without your support, and we truly appreciate your willingness to help.

You've been invited to volunteer in the following role${rotasMap.size > 1 ? 's' : ''}:
${rotasText}
${eventPageUrl ? `\nView Event Page: ${eventPageUrl}` : ''}
${upcomingRotasText}

---
Eltham Green Community Church
542 Westhorne Avenue, Eltham, London, SE9 6RR
Phone: 020 8850 1331
Email: enquiries@egcc.co.uk
Website: ${baseUrl}
			`.trim();

			const subject = `Volunteer for ${eventTitle}`;

			const result = await resend.emails.send({
				from: fromEmail,
				to: [to],
				subject,
				html,
				text
			});

			results.push({ email: to, status: 'sent', result });
		} catch (error) {
			console.error(`Error sending combined rota invite to ${to}:`, error);
			results.push({ email: to, status: 'error', error: error.message });
		}
	}

	return results;
}

/**
 * Send bulk rota invitations (legacy - sends one email per rota)
 * @param {Array} invites - Array of {to, name, token, rotaData, contact}
 * @param {object} event - SvelteKit event object
 * @returns {Promise<Array>} Results array
 */
export async function sendBulkRotaInvites(invites, event) {
	const results = [];
	
	for (const invite of invites) {
		try {
			const result = await sendRotaInvite(
				{ to: invite.to, name: invite.name, token: invite.token },
				invite.rotaData,
				invite.contact || null,
				event
			);
			results.push({ email: invite.to, status: 'sent', result });
		} catch (error) {
			results.push({ email: invite.to, status: 'error', error: error.message });
		}
	}

	return results;
}

/**
 * Send admin welcome email with verification link
 * @param {object} options - Email options
 * @param {string} options.to - Admin email address
 * @param {string} options.name - Admin name
 * @param {string} options.email - Admin email
 * @param {string} options.verificationToken - Email verification token
 * @param {string} options.password - Temporary password (optional, if provided)
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend API response
 */
export async function sendAdminWelcomeEmail({ to, name, email, verificationToken, password }, event) {
	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	
	// Create verification link
	const verificationLink = `${baseUrl}/hub/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
	const hubLoginLink = `${baseUrl}/hub/auth/login`;

	const branding = getEmailBranding(event);
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Welcome to TheHUB - Eltham Green Community Church</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #4A97D2 0%, #3a7ab8 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Welcome to TheHUB</h1>
					<p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">Eltham Green Community Church</p>
				</div>
				
				<div style="padding: 0;">
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Your admin account has been created for TheHUB, the church management system for Eltham Green Community Church.</p>

				<div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #4BB170;">
					<h2 style="color: #4BB170; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Your Login Credentials</h2>
					<table style="width: 100%; border-collapse: collapse;">
						<tr>
							<td style="padding: 6px 0; font-weight: 600; color: #666; width: 80px; font-size: 13px;">Email:</td>
							<td style="padding: 6px 0; color: #333; font-size: 13px;">${email}</td>
						</tr>
						${password ? `
						<tr>
							<td style="padding: 6px 0; font-weight: 600; color: #666; font-size: 13px;">Password:</td>
							<td style="padding: 6px 0; color: #333; font-family: monospace; font-size: 13px;">${password}</td>
						</tr>
						` : ''}
					</table>
					${password ? `
					<p style="color: #A62524; font-size: 13px; margin: 12px 0 0 0; font-weight: 600;">⚠️ Please change your password after your first login for security.</p>
					` : ''}
				</div>

				<div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #4A97D2;">
					<h2 style="color: #4A97D2; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Step 1: Verify Your Email Address</h2>
					<p style="color: #333; font-size: 13px; margin: 0 0 10px 0; font-weight: 600;">⚠️ Important: You must verify your email before you can log in.</p>
					<p style="color: #333; font-size: 13px; margin: 0 0 15px 0;">Please verify your email address to complete your account setup. This link will expire in 7 days.</p>
					<a href="${verificationLink}" style="display: inline-block; background: #4A97D2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: 600; margin: 8px 0;">Verify Email Address</a>
					<p style="color: #666; font-size: 12px; margin: 12px 0 0 0;">Or copy and paste this link into your browser:</p>
					<p style="color: #4A97D2; font-size: 11px; margin: 4px 0 0 0; word-break: break-all;">${verificationLink}</p>
				</div>

				<div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #e5e7eb;">
					<h2 style="color: #333; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Step 2: Log In to TheHUB</h2>
					<p style="color: #333; font-size: 13px; margin: 0 0 10px 0;">After verifying your email, you can log in using the credentials above.</p>
					<p style="color: #666; font-size: 12px; margin: 8px 0 0 0; font-style: italic;">Note: You will not be able to log in until your email is verified.</p>
					<a href="${hubLoginLink}" style="display: inline-block; background: #4BB170; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: 600; margin: 12px 0 0 0;">Login to TheHUB</a>
					<p style="color: #666; font-size: 12px; margin: 12px 0 0 0; word-break: break-all;">${hubLoginLink}</p>
				</div>

				<div style="background: #fffbf0; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #E6A324;">
					<h2 style="color: #E6A324; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Security Reminders</h2>
					<ul style="color: #333; font-size: 13px; margin: 0; padding-left: 18px;">
						<li style="margin: 6px 0;">Keep your login credentials secure and never share them</li>
						<li style="margin: 6px 0;">Use a strong, unique password</li>
						<li style="margin: 6px 0;">Log out when you're finished using TheHUB</li>
						<li style="margin: 6px 0;">Contact the system administrator if you notice any suspicious activity</li>
					</ul>
				</div>

				<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
					<p style="margin: 0;">If you have any questions or need assistance, please contact the system administrator.</p>
					<p style="margin: 8px 0 0 0;">
						<a href="${baseUrl}" style="color: #4A97D2; text-decoration: none;">Visit Eltham Green Community Church Website</a>
					</p>
				</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Welcome to TheHUB - Eltham Green Community Church

Hello ${name},

Your admin account has been created for TheHUB, the church management system for Eltham Green Community Church.

Your Login Credentials:
Email: ${email}
${password ? `Password: ${password}` : ''}
${password ? '\n⚠️ Please change your password after your first login for security.\n' : ''}

STEP 1: Verify Your Email Address
⚠️ IMPORTANT: You must verify your email before you can log in.

Please verify your email address to complete your account setup. This link will expire in 7 days.

${verificationLink}

STEP 2: Log In to TheHUB
After verifying your email, you can log in using the credentials above.

Note: You will not be able to log in until your email is verified.

${hubLoginLink}

Security Reminders:
- Keep your login credentials secure and never share them
- Use a strong, unique password
- Log out when you're finished using TheHUB
- Contact the system administrator if you notice any suspicious activity

If you have any questions or need assistance, please contact the system administrator.

Visit our website: ${baseUrl}
	`.trim();

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: 'Welcome to TheHUB - Your Admin Account',
			html: html,
			text: text
		});

		return result;
	} catch (error) {
		console.error('Failed to send admin welcome email:', error);
		throw error;
	}
}

/**
 * Send password reset email
 * @param {object} options - Email options
 * @param {string} options.to - Admin email address
 * @param {string} options.name - Admin name
 * @param {string} options.resetToken - Password reset token
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend API response
 */
export async function sendPasswordResetEmail({ to, name, resetToken }, event) {
	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	
	// Create reset link - token is base64url encoded so should be URL-safe, but encode it anyway to be safe
	const encodedToken = encodeURIComponent(resetToken);
	const encodedEmail = encodeURIComponent(to);
	const resetLink = `${baseUrl}/hub/auth/reset-password?token=${encodedToken}&email=${encodedEmail}`;
	
	console.log('[sendPasswordResetEmail] Generated reset link:', {
		baseUrl: baseUrl,
		tokenLength: resetToken.length,
		encodedTokenLength: encodedToken.length,
		email: to,
		encodedEmailLength: encodedEmail.length,
		linkPreview: resetLink.substring(0, 100) + '...',
		fullLink: resetLink
	});

	const branding = getEmailBranding(event);
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Reset Your Password - TheHUB</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #4A97D2 0%, #3a7ab8 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Reset Your Password</h1>
					<p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">TheHUB - Eltham Green Community Church</p>
				</div>
				
				<div style="padding: 0;">
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">We received a request to reset your password for your TheHUB admin account.</p>

				<div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #4A97D2;">
					<p style="color: #333; font-size: 13px; margin: 0 0 15px 0;">Click the button below to reset your password. This link will expire in 24 hours.</p>
					<a href="${resetLink}" style="display: inline-block; background: #4A97D2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: 600; margin: 8px 0;">Reset Password</a>
					<p style="color: #666; font-size: 12px; margin: 12px 0 0 0;">Or copy and paste this link into your browser:</p>
					<p style="color: #4A97D2; font-size: 11px; margin: 4px 0 0 0; word-break: break-all;">${resetLink}</p>
				</div>

				<div style="background: #fffbf0; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #E6A324;">
					<h2 style="color: #E6A324; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Security Notice</h2>
					<ul style="color: #333; font-size: 13px; margin: 0; padding-left: 18px;">
						<li style="margin: 6px 0;">If you didn't request this password reset, please ignore this email</li>
						<li style="margin: 6px 0;">Your password will not be changed until you click the link above</li>
						<li style="margin: 6px 0;">This link expires in 24 hours for security</li>
						<li style="margin: 6px 0;">For security, all active sessions will be logged out after password reset</li>
					</ul>
				</div>

				<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
					<p style="margin: 0;">If you have any questions or need assistance, please contact the system administrator.</p>
					<p style="margin: 8px 0 0 0;">
						<a href="${baseUrl}" style="color: #4A97D2; text-decoration: none;">Visit Eltham Green Community Church Website</a>
					</p>
				</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Reset Your Password - TheHUB

Hello ${name},

We received a request to reset your password for your TheHUB admin account.

Click the link below to reset your password. This link will expire in 24 hours.

${resetLink}

Security Notice:
- If you didn't request this password reset, please ignore this email
- Your password will not be changed until you click the link above
- This link expires in 24 hours for security
- For security, all active sessions will be logged out after password reset

If you have any questions or need assistance, please contact the system administrator.

Visit our website: ${baseUrl}
	`.trim();

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: 'Reset Your Password - TheHUB',
			html: html,
			text: text
		});

		return result;
	} catch (error) {
		console.error('Failed to send password reset email:', error);
		throw error;
	}
}

/**
 * Send event signup confirmation email
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {object} options.event - Event object
 * @param {object} options.occurrence - Occurrence object
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend response
 */
export async function sendEventSignupConfirmation({ to, name, event, occurrence, guestCount = 0 }, svelteEvent) {
	const baseUrl = getBaseUrl(svelteEvent);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

	// Format date and time
	const formatDate = (dateString) => {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleDateString('en-GB', { 
			weekday: 'long',
			day: 'numeric', 
			month: 'long', 
			year: 'numeric' 
		});
	};

	const formatTime = (dateString) => {
		if (!dateString) return '';
		const date = new Date(dateString);
		return date.toLocaleTimeString('en-GB', { 
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const eventDate = formatDate(occurrence.startsAt);
	const eventTime = `${formatTime(occurrence.startsAt)} - ${formatTime(occurrence.endsAt)}`;
	const totalAttendees = guestCount + 1; // +1 for the signer-upper

	const branding = getEmailBranding(svelteEvent);
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Event Signup Confirmation</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Event Signup Confirmed!</h1>
				</div>
				
				<div style="padding: 0;">
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
					Hi ${name},
				</p>
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
					Thank you for signing up for <strong>${event.title}</strong>!
				</p>
				
				<div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
					<h2 style="color: #2d7a32; margin: 0 0 12px 0; font-size: 16px; font-weight: 600; border-bottom: 2px solid #2d7a32; padding-bottom: 8px;">Event Details</h2>
					<table style="width: 100%; border-collapse: collapse;">
						<tr>
							<td style="padding: 6px 0; font-weight: 600; color: #666; width: 100px; font-size: 13px;">Date:</td>
							<td style="padding: 6px 0; color: #333; font-size: 13px;">${eventDate}</td>
						</tr>
						<tr>
							<td style="padding: 6px 0; font-weight: 600; color: #666; font-size: 13px;">Time:</td>
							<td style="padding: 6px 0; color: #333; font-size: 13px;">${eventTime}</td>
						</tr>
						${occurrence.location ? `
						<tr>
							<td style="padding: 6px 0; font-weight: 600; color: #666; font-size: 13px;">Location:</td>
							<td style="padding: 6px 0; color: #333; font-size: 13px;">${occurrence.location}</td>
						</tr>
						` : ''}
						<tr>
							<td style="padding: 6px 0; font-weight: 600; color: #666; font-size: 13px;">Attendees:</td>
							<td style="padding: 6px 0; color: #333; font-size: 13px;">
								${totalAttendees === 1 
									? 'Just you' 
									: `You + ${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} (${totalAttendees} total)`}
							</td>
						</tr>
					</table>
				</div>
				
				<p style="color: #666; font-size: 13px; margin: 15px 0 0 0;">
					We look forward to seeing you there!
				</p>
				
				<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
					<p style="margin: 0;">Eltham Green Community Church</p>
					<p style="margin: 4px 0 0 0;">542 Westhorne Avenue, Eltham, London, SE9 6RR</p>
				</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Event Signup Confirmed!

Hi ${name},

Thank you for signing up for ${event.title}!

Event Details:
Date: ${eventDate}
Time: ${eventTime}
${occurrence.location ? `Location: ${occurrence.location}` : ''}
Attendees: ${totalAttendees === 1 
		? 'Just you' 
		: `You + ${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} (${totalAttendees} total)`}

We look forward to seeing you there!

Eltham Green Community Church
542 Westhorne Avenue, Eltham, London, SE9 6RR
	`.trim();

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: `Event Signup Confirmed: ${event.title}`,
			html: html,
			text: text
		});

		return result;
	} catch (error) {
		console.error('Failed to send event signup confirmation email:', error);
		throw error;
	}
}

/**
 * Send rota update notification to owner
 * @param {object} options - Email options
 * @param {string} options.to - Owner email address
 * @param {string} options.name - Owner name
 * @param {object} rotaData - Rota, event, occurrence data
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend response
 */
export async function sendRotaUpdateNotification({ to, name }, rotaData, event) {
	const { rota, event: eventData, occurrence } = rotaData;
	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	const hubUrl = `${baseUrl}/hub/rotas/${rota.id}`;

	const eventTitle = eventData?.title || 'Event';
	const role = rota?.role || 'Volunteer';

	// Load contacts to enrich assignees
	const contacts = await readCollection('contacts');
	const allOccurrences = await readCollection('occurrences');
	const eventOccurrences = allOccurrences.filter(o => o.eventId === rota.eventId);
	
	// Format occurrence date if available
	let occurrenceDateDisplay = '';
	if (occurrence) {
		occurrenceDateDisplay = new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	} else if (rota.occurrenceId) {
		const rotaOccurrence = eventOccurrences.find(o => o.id === rota.occurrenceId);
		if (rotaOccurrence) {
			occurrenceDateDisplay = new Date(rotaOccurrence.startsAt).toLocaleDateString('en-GB', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		}
	}

	// Process assignees and get their contact information
	const assigneesByOcc = {};
	const allAssigneesList = [];
	
	(rota.assignees || []).forEach(assignee => {
		let contactId, occId;
		
		// Extract contact ID and occurrence ID
		if (typeof assignee === 'string') {
			contactId = assignee;
			occId = rota.occurrenceId;
		} else if (assignee && typeof assignee === 'object') {
			contactId = assignee.contactId || assignee.id;
			occId = assignee.occurrenceId || rota.occurrenceId;
		}
		
		// Get contact details
		let assigneeName = 'Unknown';
		let assigneeEmail = '';
		
		if (typeof contactId === 'string') {
			const contact = contacts.find(c => c.id === contactId);
			if (contact) {
				assigneeName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
				assigneeEmail = contact.email || '';
			}
		} else if (contactId && typeof contactId === 'object' && contactId.name) {
			// Public signup format
			assigneeName = contactId.name || 'Unknown';
			assigneeEmail = contactId.email || '';
		} else if (assignee && typeof assignee === 'object' && assignee.name) {
			// Direct name/email in assignee
			assigneeName = assignee.name || 'Unknown';
			assigneeEmail = assignee.email || '';
		}
		
		const assigneeInfo = {
			name: assigneeName,
			email: assigneeEmail
		};
		
		// Group by occurrence
		const occKey = occId || 'all';
		if (!assigneesByOcc[occKey]) {
			assigneesByOcc[occKey] = [];
		}
		assigneesByOcc[occKey].push(assigneeInfo);
		allAssigneesList.push(assigneeInfo);
	});

	// Build assignees HTML section
	let assigneesHtml = '';
	if (allAssigneesList.length > 0) {
		// If rota is for all occurrences, show all assignees together
		if (!rota.occurrenceId && Object.keys(assigneesByOcc).length > 0) {
			assigneesHtml = '<div style="margin-top: 15px;"><h3 style="color: #2d7a32; margin: 0 0 10px 0; font-size: 15px; font-weight: 600;">Assignees:</h3><ul style="margin: 0; padding-left: 20px; color: #333; font-size: 14px;">';
			allAssigneesList.forEach(assignee => {
				const displayName = assignee.email ? `${assignee.name} (${assignee.email})` : assignee.name;
				assigneesHtml += `<li style="margin: 5px 0;">${displayName}</li>`;
			});
			assigneesHtml += '</ul></div>';
		} else {
			// Group by occurrence
			assigneesHtml = '<div style="margin-top: 15px;"><h3 style="color: #2d7a32; margin: 0 0 10px 0; font-size: 15px; font-weight: 600;">Assignees by Occurrence:</h3>';
			for (const [occKey, assignees] of Object.entries(assigneesByOcc)) {
				if (occKey === 'all' || !occKey) {
					assigneesHtml += '<div style="margin-bottom: 15px;"><strong style="color: #333; font-size: 14px;">All Occurrences:</strong><ul style="margin: 5px 0; padding-left: 20px; color: #333; font-size: 14px;">';
				} else {
					const occ = eventOccurrences.find(o => o.id === occKey);
					const occDate = occ ? new Date(occ.startsAt).toLocaleDateString('en-GB', {
						weekday: 'short',
						year: 'numeric',
						month: 'short',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					}) : 'Unknown Date';
					assigneesHtml += `<div style="margin-bottom: 15px;"><strong style="color: #333; font-size: 14px;">${occDate}:</strong><ul style="margin: 5px 0; padding-left: 20px; color: #333; font-size: 14px;">`;
				}
				assignees.forEach(assignee => {
					const displayName = assignee.email ? `${assignee.name} (${assignee.email})` : assignee.name;
					assigneesHtml += `<li style="margin: 5px 0;">${displayName}</li>`;
				});
				assigneesHtml += '</ul></div>';
			}
			assigneesHtml += '</div>';
		}
	} else {
		assigneesHtml = '<div style="margin-top: 15px;"><p style="color: #666; font-size: 14px; font-style: italic;">No assignees yet.</p></div>';
	}

	// Build assignees text section
	let assigneesText = '';
	if (allAssigneesList.length > 0) {
		assigneesText = '\n\nAssignees:\n';
		if (!rota.occurrenceId && Object.keys(assigneesByOcc).length > 0) {
			allAssigneesList.forEach(assignee => {
				const displayName = assignee.email ? `${assignee.name} (${assignee.email})` : assignee.name;
				assigneesText += `- ${displayName}\n`;
			});
		} else {
			for (const [occKey, assignees] of Object.entries(assigneesByOcc)) {
				if (occKey === 'all' || !occKey) {
					assigneesText += '\nAll Occurrences:\n';
				} else {
					const occ = eventOccurrences.find(o => o.id === occKey);
					const occDate = occ ? new Date(occ.startsAt).toLocaleDateString('en-GB', {
						weekday: 'short',
						year: 'numeric',
						month: 'short',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					}) : 'Unknown Date';
					assigneesText += `\n${occDate}:\n`;
				}
				assignees.forEach(assignee => {
					const displayName = assignee.email ? `${assignee.name} (${assignee.email})` : assignee.name;
					assigneesText += `- ${displayName}\n`;
				});
			}
		}
	} else {
		assigneesText = '\n\nNo assignees yet.';
	}

	const branding = getEmailBranding(event);
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Rota Updated</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Rota Updated</h1>
				</div>
				
				<div style="padding: 0;">
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
					The rota <strong>${role}</strong> for <strong>${eventTitle}</strong> has been updated.
				</p>

				<div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 15px 0;">
					<h2 style="color: #2d7a32; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Rota Details</h2>
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Role:</strong> ${role}</p>
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Event:</strong> ${eventTitle}${occurrenceDateDisplay ? ` - ${occurrenceDateDisplay}` : ''}</p>
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Capacity:</strong> ${rota.capacity} per occurrence</p>
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Total Assignees:</strong> ${(rota.assignees || []).length}</p>
					${assigneesHtml}
				</div>

				<div style="text-align: center; margin: 20px 0;">
					<a href="${hubUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">View Rota</a>
				</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Rota Updated

Hello ${name},

The rota ${role} for ${eventTitle}${occurrenceDateDisplay ? ` - ${occurrenceDateDisplay}` : ''} has been updated.

Rota Details:
Role: ${role}
Event: ${eventTitle}${occurrenceDateDisplay ? ` - ${occurrenceDateDisplay}` : ''}
Capacity: ${rota.capacity} per occurrence
Total Assignees: ${(rota.assignees || []).length}${assigneesText}

View the rota: ${hubUrl}
	`.trim();

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: `Rota Updated: ${role} - ${eventTitle}`,
			html,
			text
		});

		return result;
	} catch (error) {
		console.error('Failed to send rota update notification:', error);
		throw error;
	}
}

/**
 * Send upcoming rota reminder email to a contact
 * @param {object} options - Email options
 * @param {string} options.to - Contact email address
 * @param {string} options.name - Contact name
 * @param {object} rotaData - Rota data { rota, event, occurrence }
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend API response
 */
export async function sendUpcomingRotaReminder({ to, name }, rotaData, event) {
	const { rota, event: eventData, occurrence } = rotaData;
	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	
	// Get signup link if token exists
	let signupLink = '';
	try {
		const { ensureRotaToken } = await import('./tokens.js');
		const token = await ensureRotaToken(rota.eventId, rota.id, occurrence?.id || rota.occurrenceId);
		signupLink = `${baseUrl}/signup/rota/${token.token}`;
	} catch (error) {
		console.error('Error generating rota token for reminder:', error);
		// Continue without signup link if token generation fails
	}

	const eventTitle = eventData?.title || 'Event';
	const role = rota?.role || 'Volunteer';

	// Format occurrence date
	let occurrenceDateDisplay = '';
	let occurrenceTimeDisplay = '';
	let occurrenceLocation = '';
	if (occurrence) {
		const startDate = new Date(occurrence.startsAt);
		occurrenceDateDisplay = startDate.toLocaleDateString('en-GB', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
		occurrenceTimeDisplay = startDate.toLocaleTimeString('en-GB', {
			hour: '2-digit',
			minute: '2-digit'
		});
		occurrenceLocation = occurrence.location || eventData?.location || '';
	} else if (rota.occurrenceId) {
		const { readCollection } = await import('./fileStore.js');
		const occurrences = await readCollection('occurrences');
		const rotaOccurrence = occurrences.find(o => o.id === rota.occurrenceId);
		if (rotaOccurrence) {
			const startDate = new Date(rotaOccurrence.startsAt);
			occurrenceDateDisplay = startDate.toLocaleDateString('en-GB', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
			occurrenceTimeDisplay = startDate.toLocaleTimeString('en-GB', {
				hour: '2-digit',
				minute: '2-digit'
			});
			occurrenceLocation = rotaOccurrence.location || eventData?.location || '';
		}
	}

	const branding = getEmailBranding(event);
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Upcoming Rota Reminder</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Upcoming Rota Reminder</h1>
					<p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">You have a rota assignment coming up in 3 days</p>
				</div>
				
				<div style="padding: 0;">
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
					This is a friendly reminder that you are assigned to the rota <strong>${role}</strong> for <strong>${eventTitle}</strong>.
				</p>

				<div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #2d7a32;">
					<h2 style="color: #2d7a32; margin: 0 0 12px 0; font-size: 16px; font-weight: 600;">Rota Details</h2>
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Role:</strong> ${role}</p>
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Event:</strong> ${eventTitle}</p>
					${occurrenceDateDisplay ? `<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Date:</strong> ${occurrenceDateDisplay}</p>` : ''}
					${occurrenceTimeDisplay ? `<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Time:</strong> ${occurrenceTimeDisplay}</p>` : ''}
					${occurrenceLocation ? `<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Location:</strong> ${occurrenceLocation}</p>` : ''}
				</div>

				${signupLink ? `
				<div style="text-align: center; margin: 20px 0;">
					<a href="${signupLink}" style="display: inline-block; background: #2d7a32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">View Rota Details</a>
				</div>
				` : ''}

				<div style="background: #fffbf0; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #E6A324;">
					<p style="color: #333; font-size: 13px; margin: 0;">
						<strong>Note:</strong> If you are unable to fulfill this assignment, please contact the rota coordinator as soon as possible.
					</p>
				</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Upcoming Rota Reminder

Hello ${name},

This is a friendly reminder that you are assigned to the rota ${role} for ${eventTitle}.

Rota Details:
Role: ${role}
Event: ${eventTitle}
${occurrenceDateDisplay ? `Date: ${occurrenceDateDisplay}` : ''}
${occurrenceTimeDisplay ? `Time: ${occurrenceTimeDisplay}` : ''}
${occurrenceLocation ? `Location: ${occurrenceLocation}` : ''}

${signupLink ? `View rota details: ${signupLink}` : ''}

Note: If you are unable to fulfill this assignment, please contact the rota coordinator as soon as possible.
	`.trim();

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: `Reminder: ${role} - ${eventTitle} in 3 days`,
			html,
			text
		});

		return result;
	} catch (error) {
		console.error('Failed to send upcoming rota reminder:', error);
		throw error;
	}
}

/**
 * Send member signup confirmation email to the new member
 * @param {object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Member's name
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend API response
 */
export async function sendMemberSignupConfirmationEmail({ to, name }, event) {
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	const baseUrl = getBaseUrl(event);
	const branding = getEmailBranding();
	const contactName = name || to;

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Welcome to Eltham Green Community Church</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="background: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 30px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 24px;">Welcome, ${contactName}!</h1>
				</div>
				
				<div style="background: #f9fafb; padding: 30px; border-radius: 6px; border: 1px solid #e5e7eb;">
					<div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
						<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">
							Thank you for signing up to become a member of Eltham Green Community Church!
						</p>
						<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">
							We've received your information and are excited to have you join our community. Our team will be in touch with you soon.
						</p>
						<p style="color: #666; font-size: 14px; margin: 0;">
							If you have any questions, please feel free to contact us at <a href="mailto:info@egcc.co.uk" style="color: #2d7a32; text-decoration: none;">info@egcc.co.uk</a> or call us at <a href="tel:02088501331" style="color: #2d7a32; text-decoration: none;">020 8850 1331</a>.
						</p>
					</div>
					
					<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
						<p style="margin: 0;">Eltham Green Community Church</p>
						<p style="margin: 5px 0 0 0;">542 Westhorne Avenue, Eltham, London, SE9 6RR</p>
					</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Welcome, ${contactName}!

Thank you for signing up to become a member of Eltham Green Community Church!

We've received your information and are excited to have you join our community. Our team will be in touch with you soon.

If you have any questions, please feel free to contact us at info@egcc.co.uk or call us at 020 8850 1331.

Eltham Green Community Church
542 Westhorne Avenue, Eltham, London, SE9 6RR
	`.trim();

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: 'Welcome to Eltham Green Community Church',
			html,
			text
		});

		return result;
	} catch (error) {
		console.error('Failed to send member signup confirmation email:', error);
		throw error;
	}
}

/**
 * Send member signup notification email to administrators
 * @param {object} options - Email options
 * @param {Array<string>} options.to - Admin email addresses
 * @param {object} options.contact - Contact data
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend API response
 */
export async function sendMemberSignupAdminNotification({ to, contact }, event) {
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	const baseUrl = getBaseUrl(event);
	const branding = getEmailBranding();
	const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
	const isUpdate = contact.updatedAt && contact.createdAt !== contact.updatedAt;

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>New Member Signup - ${contactName}</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="background: #ffffff; padding: 30px; border-radius: 10px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 30px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 24px;">${isUpdate ? 'Member Information Updated' : 'New Member Signup'}</h1>
				</div>
				
				<div style="background: #f9fafb; padding: 30px; border-radius: 6px; border: 1px solid #e5e7eb;">
					<div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
						<h2 style="color: #2d7a32; margin-top: 0; font-size: 18px; border-bottom: 2px solid #2d7a32; padding-bottom: 10px;">Contact Information</h2>
						<table style="width: 100%; border-collapse: collapse;">
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666; width: 140px;">Name:</td>
								<td style="padding: 8px 0; color: #333;">${contactName}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666;">Email:</td>
								<td style="padding: 8px 0; color: #333;">
									<a href="mailto:${contact.email}" style="color: #2d7a32; text-decoration: none;">${contact.email}</a>
								</td>
							</tr>
							${contact.phone ? `
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666;">Phone:</td>
								<td style="padding: 8px 0; color: #333;">
									<a href="tel:${contact.phone}" style="color: #2d7a32; text-decoration: none;">${contact.phone}</a>
								</td>
							</tr>
							` : ''}
							${contact.addressLine1 || contact.city || contact.postcode ? `
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666; vertical-align: top;">Address:</td>
								<td style="padding: 8px 0; color: #333;">
									${contact.addressLine1 || ''}<br>
									${contact.addressLine2 || ''}${contact.addressLine2 ? '<br>' : ''}
									${contact.city || ''}${contact.city && contact.county ? ', ' : ''}${contact.county || ''}<br>
									${contact.postcode || ''}<br>
									${contact.country || ''}
								</td>
							</tr>
							` : ''}
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666;">Newsletter:</td>
								<td style="padding: 8px 0; color: #333;">${contact.subscribed !== false ? 'Subscribed' : 'Not subscribed'}</td>
							</tr>
						</table>
					</div>
					
					<div style="margin-top: 20px; padding: 15px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
						<p style="margin: 0; color: #92400e; font-size: 14px;">
							<strong>Action Required:</strong> ${isUpdate ? 'Review the updated information' : 'Review this new member signup'} in the Hub at <a href="${baseUrl}/hub/contacts/${contact.id}" style="color: #2d7a32; text-decoration: none; font-weight: 600;">${baseUrl}/hub/contacts/${contact.id}</a>
						</p>
					</div>
					
					<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
						<p style="margin: 0;">This email was sent from the member signup form on Eltham Green Community Church website.</p>
					</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
${isUpdate ? 'Member Information Updated' : 'New Member Signup'}

Contact Information:
Name: ${contactName}
Email: ${contact.email}
${contact.phone ? `Phone: ${contact.phone}` : ''}
${contact.addressLine1 || contact.city || contact.postcode ? `
Address:
${contact.addressLine1 || ''}
${contact.addressLine2 || ''}
${contact.city || ''}${contact.city && contact.county ? ', ' : ''}${contact.county || ''}
${contact.postcode || ''}
${contact.country || ''}
` : ''}
Newsletter: ${contact.subscribed !== false ? 'Subscribed' : 'Not subscribed'}

Action Required: ${isUpdate ? 'Review the updated information' : 'Review this new member signup'} in the Hub at ${baseUrl}/hub/contacts/${contact.id}

This email was sent from the member signup form on Eltham Green Community Church website.
	`.trim();

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: to,
			subject: `${isUpdate ? 'Member Information Updated' : 'New Member Signup'}: ${contactName}`,
			html,
			text
		});

		return result;
	} catch (error) {
		console.error('Failed to send member signup admin notification:', error);
		throw error;
	}
}

