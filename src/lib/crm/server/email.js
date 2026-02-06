import { env } from '$env/dynamic/private';
import { readCollection, findById, update, findMany } from './fileStore.js';
import { ensureUnsubscribeToken, ensureEventToken } from './tokens.js';
import { rateLimitedSend } from './emailRateLimiter.js';
import { getSettings } from './settings.js';
import { getEmailProvider } from '$lib/server/emailProvider.js';

/**
 * Get base URL for absolute links in emails
 * @param {object} event - SvelteKit event object
 * @returns {string} Base URL
 */
function getBaseUrl(event) {
	return env.APP_BASE_URL || event?.url?.origin || 'http://localhost:5173';
}

/**
 * Resolve logo URL for emails: use Hub theme logo if set, otherwise OnNuma logo.
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<{ logoUrl: string, alt: string }>}
 */
async function getEmailLogo(event) {
	const baseUrl = getBaseUrl(event);
	const settings = await getSettings();
	const theme = settings?.theme || {};
	const logoPath = typeof theme.logoPath === 'string' ? theme.logoPath.trim() : '';
	if (logoPath && logoPath.startsWith('http')) {
		return { logoUrl: logoPath, alt: 'Logo' };
	}
	if (logoPath && logoPath.startsWith('/')) {
		return { logoUrl: `${baseUrl}${logoPath}`, alt: 'Logo' };
	}
	if (logoPath) {
		return { logoUrl: `${baseUrl}/${logoPath.replace(/^\//, '')}`, alt: 'Logo' };
	}
	return { logoUrl: `${baseUrl}/images/onnuma-logo.png`, alt: 'OnNuma' };
}

/**
 * Generate email branding HTML with logo and site link.
 * Uses Hub theme logo if set; otherwise OnNuma logo.
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<string>} Branding HTML
 */
async function getEmailBranding(event) {
	const baseUrl = getBaseUrl(event);
	const { logoUrl, alt } = await getEmailLogo(event);
	return `
		<div style="text-align: center; padding: 20px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
			<a href="${baseUrl}" style="display: inline-block; text-decoration: none;">
				<img src="${logoUrl}" alt="${alt}" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
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
 * Get upcoming public events (next 14 days)
 * @param {object} event - SvelteKit event object (for base URL)
 * @param {object} contact - Optional contact object to filter events by list membership
 * @returns {Promise<Array>} Array of event occurrences
 */
export async function getUpcomingEvents(event, contact = null) {
	const now = new Date();
	
	// Calculate 14 days from now (end of day at 23:59:59)
	const fourteenDaysFromNow = new Date(now);
	fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);
	fourteenDaysFromNow.setHours(23, 59, 59, 999); // End of day

	const events = await readCollection('events');
	const occurrences = await readCollection('occurrences');
	const lists = await readCollection('lists');
	const baseUrl = getBaseUrl(event);

	// Filter to public and internal events (internal events are for members/contacts only)
	// Exclude events that are hidden from email
	let memberEvents = events.filter(e => 
		(e.visibility === 'public' || e.visibility === 'internal') && 
		!e.hideFromEmail
	);

	// If a contact is provided, filter events by list membership
	if (contact && contact.id) {
		memberEvents = memberEvents.filter(e => {
			// If event has no listIds (empty array or undefined), include it for everyone
			if (!e.listIds || !Array.isArray(e.listIds) || e.listIds.length === 0) {
				return true;
			}

			// Check if contact is in any of the event's lists
			return e.listIds.some(listId => {
				const list = lists.find(l => l.id === listId);
				if (!list || !list.contactIds || !Array.isArray(list.contactIds)) {
					return false;
				}
				return list.contactIds.includes(contact.id);
			});
		});
	}

	const memberEventIds = new Set(memberEvents.map(e => e.id));

	// Get upcoming occurrences for public and internal events
	const upcoming = [];
	for (const occurrence of occurrences) {
		if (!memberEventIds.has(occurrence.eventId)) continue;

		const startDate = new Date(occurrence.startsAt);
		if (startDate >= now && startDate <= fourteenDaysFromNow) {
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
	const events = await readCollection('events');
	const occurrences = await readCollection('occurrences');
	const tokens = await readCollection('rota_tokens');
	const baseUrl = getBaseUrl(event);

	const upcoming = [];
	/** @type {Map<string, { token: string }>} */
	const eventTokenCache = new Map();

	// Check each rota to see if contact is assigned to specific occurrences
	for (const rota of rotas) {
		if (!rota.assignees || !Array.isArray(rota.assignees)) continue;

		const eventData = events.find(e => e.id === rota.eventId);
		if (!eventData) continue;

		// Find which occurrences this contact is assigned to for this rota
		const assignedOccurrenceIds = new Set();
		
		for (const assignee of rota.assignees) {
			let isContactAssigned = false;
			let assigneeOccurrenceId = null;

			// Check if this assignee is the contact we're looking for
			if (typeof assignee === 'string') {
				// Old format: assignee is just a string (contactId)
				if (assignee === contactId) {
					isContactAssigned = true;
					// For old format, if rota has a specific occurrenceId, use it; otherwise null means all occurrences
					assigneeOccurrenceId = rota.occurrenceId || null;
				}
			} else if (assignee && typeof assignee === 'object') {
				// New format: assignee is an object with contactId and occurrenceId
				let assigneeContactId = null;
				
				if (typeof assignee.contactId === 'string') {
					assigneeContactId = assignee.contactId;
				} else if (assignee.id) {
					assigneeContactId = assignee.id;
				}
				
				if (assigneeContactId === contactId) {
					isContactAssigned = true;
					// Get the occurrenceId from the assignee, or fall back to rota's occurrenceId
					assigneeOccurrenceId = assignee.occurrenceId !== undefined ? assignee.occurrenceId : rota.occurrenceId;
				}
			}

			// If this assignee is the contact, record which occurrence they're assigned to
			if (isContactAssigned) {
				if (assigneeOccurrenceId === null) {
					// Contact is assigned to all occurrences (old format or explicit null)
					// We'll handle this by checking all occurrences below
					assignedOccurrenceIds.add('all');
				} else {
					// Contact is assigned to a specific occurrence
					assignedOccurrenceIds.add(assigneeOccurrenceId);
				}
			}
		}

		// If contact is not assigned to any occurrences for this rota, skip
		if (assignedOccurrenceIds.size === 0) continue;

		// Get occurrences to check
		let rotaOccurrences = [];
		if (rota.occurrenceId) {
			// Rota is for a specific occurrence
			const occurrence = occurrences.find(o => o.id === rota.occurrenceId);
			if (occurrence && (assignedOccurrenceIds.has('all') || assignedOccurrenceIds.has(rota.occurrenceId))) {
				rotaOccurrences = [occurrence];
			}
		} else {
			// Rota is for all occurrences - only include ones where contact is assigned
			if (assignedOccurrenceIds.has('all')) {
				// Contact is assigned to all occurrences
				rotaOccurrences = occurrences.filter(o => o.eventId === rota.eventId);
			} else {
				// Contact is assigned to specific occurrences only
				rotaOccurrences = occurrences.filter(o => 
					o.eventId === rota.eventId && assignedOccurrenceIds.has(o.id)
				);
			}
		}

		// Filter to upcoming occurrences (within 14 days) where contact is assigned
		for (const occurrence of rotaOccurrences) {
			const startDate = new Date(occurrence.startsAt);
			if (startDate >= now && startDate <= fourteenDaysFromNow) {
				// Double-check: if not assigned to 'all', verify this specific occurrence
				if (!assignedOccurrenceIds.has('all') && !assignedOccurrenceIds.has(occurrence.id)) {
					continue;
				}

				// Find token for this rota/occurrence
				const tokenData = tokens.find(t => 
					t.rotaId === rota.id && 
					t.occurrenceId === (occurrence.id || null) &&
					!t.used
				);

				// Ensure event token for public "who's on the rotas" page link
				let eventToken = eventTokenCache.get(eventData.id);
				if (!eventToken) {
					eventToken = await ensureEventToken(eventData.id);
					eventTokenCache.set(eventData.id, eventToken);
				}
				const eventRotaViewUrl = `${baseUrl}/event/${eventToken.token}?occurrenceId=${occurrence.id}#rotas`;

				upcoming.push({
					rota,
					event: eventData,
					occurrence,
					signupUrl: tokenData ? `${baseUrl}/signup/rota/${tokenData.token}` : null,
					eventRotaViewUrl
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
			let text = 'Your Rotas:\n';
			if (upcomingRotas.length === 0) {
				text += 'You have no upcoming rotas in the next 14 days.';
			} else {
				text += '(Click the rota name to view event information and other volunteers)\n\n';
				for (const item of upcomingRotas) {
					const { rota, event: eventData, occurrence, signupUrl, eventRotaViewUrl } = item;
					const dateStr = new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
						weekday: 'long',
						year: 'numeric',
						month: 'long',
						day: 'numeric',
						hour: '2-digit',
						minute: '2-digit'
					});

					text += `\n- ${eventData.title} - ${rota.role}\n  ${dateStr}`;
					if (eventRotaViewUrl) {
						text += `\n  See who's on the rotas: ${eventRotaViewUrl}`;
					}
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
				let html = '<h2 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">Your Rotas:</h2>';
				if (upcomingRotas.length === 0) {
					html += '<p style="color: #333; font-size: 14px;">You have no upcoming rotas in the next 14 days.</p>';
				} else {
					html += '<p class="rota-description" style="color: #6b7280; font-size: 12px; font-style: italic; margin: 0 0 12px 0;">Click the rota name to view event information and other volunteers</p>';
					for (const item of upcomingRotas) {
						const { rota, event: eventData, occurrence, signupUrl, eventRotaViewUrl } = item;
						const dateStr = new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
							weekday: 'long',
							year: 'numeric',
							month: 'long',
							day: 'numeric',
							hour: '2-digit',
							minute: '2-digit'
						});

						// Event title and rota name link to public page showing who's on the rotas for this event (brand blue)
						const linkStyle = 'color: #4A97D2; font-weight: 600; text-decoration: underline;';
						const eventLink = eventRotaViewUrl
							? `<a href="${eventRotaViewUrl}" style="${linkStyle}">${eventData.title}</a>`
							: `<strong>${eventData.title}</strong>`;
						const roleLink = eventRotaViewUrl
							? `<a href="${eventRotaViewUrl}" style="${linkStyle}">${rota.role}</a>`
							: `<strong>${rota.role}</strong>`;

						// Format: Event Title (link) - Role (link) - Date/Time - Location
						const location = occurrence.location || eventData.location || '';
						let line = `${eventLink} - ${roleLink} - ${dateStr}`;
						if (location) {
							line += ` - ${location}`;
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

	// Get week note for next week (before replace to avoid async issues)
	let weekNote = null;
	try {
		const { getWeekKey } = await import('$lib/crm/utils/weekUtils.js');
		const weekNotes = await readCollection('week_notes');
		// Get next week's date (7 days from now)
		const nextWeekDate = new Date();
		nextWeekDate.setDate(nextWeekDate.getDate() + 7);
		const nextWeekKey = getWeekKey(nextWeekDate);
		weekNote = weekNotes.find(n => n.weekKey === nextWeekKey);
	} catch (error) {
		console.error('[email] Error loading week notes:', error);
		// Continue without week note if there's an error
	}

	// Replace upcoming events placeholders
	if (isText) {
		// Plain text version
		personalized = personalized.replace(/\{\{upcomingEvents\}\}/g, () => {
			let text = 'Coming Up:\n';
			
			// Add week note if it exists
			if (weekNote && weekNote.note) {
				// Strip HTML tags for text version
				const noteText = weekNote.note
					.replace(/<[^>]*>/g, '')
					.replace(/&nbsp;/g, ' ')
					.replace(/&amp;/g, '&')
					.replace(/&lt;/g, '<')
					.replace(/&gt;/g, '>')
					.replace(/&quot;/g, '"')
					.replace(/&#39;/g, "'")
					.trim();
				if (noteText) {
					text += `${noteText}\n\n`;
				}
			}
			
			if (upcomingEvents.length === 0) {
				text += 'There are no upcoming events in the next 14 days.';
				return text;
			}

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
				// Get location from occurrence first, fallback to event location
				const location = occurrence.location || eventData.location || '';
				let line = `${eventData.title} - ${dateStr}`;
				if (location) {
					line += ` - ${location}`;
				}
				text += `\n- ${line}`;
			}
			return text;
		});
	} else {
		// HTML version
		personalized = personalized.replace(/\{\{upcomingEvents\}\}/g, () => {
			let html = '<h2 style="color: #333; font-size: 18px; font-weight: 600; margin: 0 0 12px 0;">Coming Up:</h2>';
			
			// Add week note if it exists
			if (weekNote && weekNote.note) {
				html += '<div style="background: #f0f9ff; padding: 12px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #2d7a32;">';
				html += `<div style="color: #333; font-size: 14px; line-height: 1.5;">${weekNote.note}</div>`;
				html += '</div>';
			}
			
			if (upcomingEvents.length === 0) {
				html += '<p style="color: #333; font-size: 14px;">There are no upcoming events in the next 14 days.</p>';
				return html;
			}

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
				// Get location from occurrence first, fallback to event location
				const location = occurrence.location || eventData.location || '';
				let line = `<strong>${eventData.title}</strong>`;
				line += ` - ${dateStr}`;
				if (location) {
					line += ` - ${location}`;
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
 * Prepare newsletter email data (without sending)
 * Used for batch sending
 * @param {object} options - Email options
 * @param {string} options.newsletterId - Newsletter ID
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {object} contact - Contact object for personalisation
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Email data ready for sending
 */
export async function prepareNewsletterEmail({ newsletterId, to, name, contact }, event) {
	const email = await findById('emails', newsletterId);
	if (!email) {
		throw new Error('Email not found');
	}

	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

	// Get upcoming events for personalisation (filtered by contact's list membership)
	const upcomingEvents = await getUpcomingEvents(event, contact);
	
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
	const branding = await getEmailBranding(event);
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

	return {
		from: fromEmail,
		to: [to],
		subject: personalizedSubject,
		html: fullHtml,
		text: personalizedText,
		contactEmail: to,
		newsletterId: newsletterId
	};
}

/**
 * Send newsletter email via Resend (single email)
 * @param {object} options - Email options
 * @param {string} options.newsletterId - Newsletter ID
 * @param {string} options.to - Recipient email
 * @param {string} options.name - Recipient name
 * @param {object} contact - Contact object for personalisation
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend response
 */
export async function sendNewsletterEmail({ newsletterId, to, name, contact }, event) {
	const emailData = await prepareNewsletterEmail({ newsletterId, to, name, contact }, event);
	const email = await findById('emails', newsletterId);

	try {
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: emailData.from,
			to: emailData.to,
			subject: emailData.subject,
			html: emailData.html,
			text: emailData.text
		}));

		// Log the send
		const logs = email.logs || [];
		logs.push({
			timestamp: new Date().toISOString(),
			email: emailData.contactEmail,
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
			email: emailData.contactEmail,
			status: 'error',
			error: error.message
		});

		await update('emails', newsletterId, { logs });

		throw error;
	}
}

/**
 * Send batch of newsletter emails using Resend batch API
 * @param {Array} emailDataArray - Array of email data objects from prepareNewsletterEmail
 * @param {string} newsletterId - Newsletter ID for logging
 * @returns {Promise<Array>} Results array with status for each email
 */
export async function sendNewsletterBatch(emailDataArray, newsletterId) {
	if (!emailDataArray || emailDataArray.length === 0) {
		return [];
	}

	const email = await findById('emails', newsletterId);
	if (!email) {
		throw new Error('Email not found');
	}

	const results = [];
	const BATCH_SIZE = 100; // Resend batch API limit

	// Process in batches of 100
	for (let i = 0; i < emailDataArray.length; i += BATCH_SIZE) {
		const batch = emailDataArray.slice(i, i + BATCH_SIZE);
		
		// Prepare batch payload (remove newsletterId and contactEmail from payload)
		const batchPayload = batch.map(emailData => ({
			from: emailData.from,
			to: emailData.to,
			subject: emailData.subject,
			html: emailData.html,
			text: emailData.text
		}));

		try {
			// Send batch with rate limiting (pass batch size for tracking)
			const result = await rateLimitedSend(async () => (await getEmailProvider()).batch.send(batchPayload), batch.length);

			// Check for errors in response
			if (result.error) {
				throw new Error(result.error.message || 'Batch send failed');
			}

			// Log results for each email in the batch
			const logs = email.logs || [];
			if (result.data && Array.isArray(result.data)) {
				batch.forEach((emailData, index) => {
					const messageId = result.data[index]?.id || null;
					logs.push({
						timestamp: new Date().toISOString(),
						email: emailData.contactEmail,
						status: 'sent',
						messageId: messageId
					});
					results.push({ 
						email: emailData.contactEmail, 
						status: 'sent',
						messageId: messageId
					});
				});
			} else {
				// Fallback if response format is unexpected
				batch.forEach((emailData) => {
					logs.push({
						timestamp: new Date().toISOString(),
						email: emailData.contactEmail,
						status: 'sent',
						messageId: null
					});
					results.push({ 
						email: emailData.contactEmail, 
						status: 'sent'
					});
				});
			}

			await update('emails', newsletterId, { logs });
		} catch (error) {
			// Log errors for all emails in the failed batch
			const logs = email.logs || [];
			batch.forEach((emailData) => {
				logs.push({
					timestamp: new Date().toISOString(),
					email: emailData.contactEmail,
					status: 'error',
					error: error.message
				});
				results.push({ 
					email: emailData.contactEmail, 
					status: 'error', 
					error: error.message 
				});
			});

			await update('emails', newsletterId, { logs });
		}
	}

	return results;
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
	
	// Get location from occurrence first, fallback to event location
	const occurrenceLocation = occurrence ? (occurrence.location || eventData.location || '') : '';

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
			const location = item.occurrence.location || item.event.location || '';
			upcomingRotasHtml += `
				<div style="border-bottom: 1px solid #e5e7eb; padding: 6px 0; margin-bottom: 6px;">
					<p style="margin: 0 0 3px 0; color: #333; font-size: 14px; font-weight: 600;">${item.event.title} - ${item.rota.role}</p>
					<p style="margin: 0 0 3px 0; color: #666; font-size: 13px;">${dateStr}</p>
					${location ? `<p style="margin: 0 0 5px 0; color: #666; font-size: 13px;">📍 ${location}</p>` : ''}
					${item.signupUrl ? `<a href="${item.signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Rota</a>` : ''}
				</div>
			`;
		}
		upcomingRotasHtml += '</div>';
	}

	const branding = await getEmailBranding(event);
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
					${occurrenceLocation ? `
					<p style="margin: 10px 0 5px 0; color: #666; font-size: 13px;"><strong>Location:</strong></p>
					<p style="margin: 0; color: #333; font-size: 14px;">${occurrenceLocation}</p>
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
			const location = item.occurrence.location || item.event.location || '';
			upcomingRotasText += `- ${item.event.title} - ${item.rota.role}\n  ${dateStr}`;
			if (location) {
				upcomingRotasText += `\n  Location: ${location}`;
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

${occurrence ? `Date & Time: ${occurrenceDate}${occurrenceLocation ? `\nLocation: ${occurrenceLocation}` : ''}` : ''}

Accept your invitation by visiting:
${signupUrl}
${upcomingRotasText}
	`.trim();

	try {
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: [to],
			subject: `Can you help with volunteering? - sign up for these rotas`,
			html,
			text
		}));

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
 * @param {string} customMessage - Optional custom message to include in the email
 * @returns {Promise<Array>} Results array
 */
export async function sendCombinedRotaInvites(contactInvites, eventData, eventPageUrl, event, customMessage = '') {
	const emailDataArray = [];
	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	
	for (const contactInvite of contactInvites) {
		const { contact, invites } = contactInvite;
		const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email;
		const firstName = contact.firstName || '';
		const to = contact.email;
		
		if (!to) {
			emailDataArray.push({ email: to || 'unknown', status: 'error', error: 'No email address' });
			continue;
		}

		try {
			// Replace {{firstname}} placeholder in custom message with actual first name
			const personalizedMessage = customMessage ? customMessage.replace(/\{\{firstname\}\}/gi, firstName) : '';
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
						<p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">Capacity: ${capacity} ${capacity === 1 ? 'person is' : 'people are'} ideal for this rota</p>
						<div style="text-align: center; margin-top: 10px;">
							<a href="${signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 13px;">Select Date for ${role}</a>
						</div>
					</div>
				`;

				rotasText += `\n${role} (Capacity: ${capacity} ${capacity === 1 ? 'person is' : 'people are'} ideal for this rota)`;
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
					const location = item.occurrence.location || item.event.location || '';
					upcomingRotasHtml += `
						<div style="border-bottom: 1px solid #e5e7eb; padding: 6px 0; margin-bottom: 6px;">
							<p style="margin: 0 0 3px 0; color: #333; font-size: 14px; font-weight: 600;">${item.event.title} - ${item.rota.role}</p>
							<p style="margin: 0 0 3px 0; color: #666; font-size: 13px;">${dateStr}</p>
							${location ? `<p style="margin: 0 0 5px 0; color: #666; font-size: 13px;">📍 ${location}</p>` : ''}
							${item.signupUrl ? `<a href="${item.signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Rota</a>` : ''}
						</div>
					`;
				}
				upcomingRotasHtml += '</div>';
			}

			const branding = await getEmailBranding(event);
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
						<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hi ${firstName || 'there'},</p>
						
						${personalizedMessage ? `<p style="color: #333; font-size: 15px; margin: 0 0 15px 0; white-space: pre-wrap;">${personalizedMessage}</p>` : ''}

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
					const location = item.occurrence.location || item.event.location || '';
					upcomingRotasText += `- ${item.event.title} - ${item.rota.role}\n  ${dateStr}`;
					if (location) {
						upcomingRotasText += `\n  Location: ${location}`;
					}
					if (item.signupUrl) {
						upcomingRotasText += `\n  View: ${item.signupUrl}`;
					}
					upcomingRotasText += '\n';
				}
			}

			const text = `
Volunteer Rota Invitations

Hi ${firstName || 'there'},

${personalizedMessage ? personalizedMessage + '\n\n' : ''}${rotasText}
${eventPageUrl ? `\nView Event Page: ${eventPageUrl}` : ''}
${upcomingRotasText}

---
Eltham Green Community Church
542 Westhorne Avenue, Eltham, London, SE9 6RR
Phone: 020 8850 1331
Email: enquiries@egcc.co.uk
Website: ${baseUrl}
			`.trim();

			const subject = `Can you help with volunteering? - sign up for these rotas`;

			// Store email data for batch sending
			emailDataArray.push({ 
				email: to, 
				emailData: {
					from: fromEmail,
					to: [to],
					subject,
					html,
					text
				}
			});
		} catch (error) {
			console.error(`Error preparing combined rota invite to ${to}:`, error);
			emailDataArray.push({ email: to, status: 'error', error: error.message });
		}
	}

	// Send emails in batches
	const results = await sendRotaInviteBatch(emailDataArray);
	return results;
}

/**
 * Send batch of rota invite emails using Resend batch API
 * @param {Array} emailDataArray - Array of {email, emailData} or {email, status, error}
 * @returns {Promise<Array>} Results array with status for each email
 */
async function sendRotaInviteBatch(emailDataArray) {
	if (!emailDataArray || emailDataArray.length === 0) {
		return [];
	}

	const results = [];
	const BATCH_SIZE = 100; // Resend batch API limit
	const validEmails = emailDataArray.filter(item => item.emailData);
	const errors = emailDataArray.filter(item => item.error);

	// Add errors to results
	errors.forEach(item => {
		results.push({ email: item.email, status: 'error', error: item.error });
	});

	// Process valid emails in batches of 100
	for (let i = 0; i < validEmails.length; i += BATCH_SIZE) {
		const batch = validEmails.slice(i, i + BATCH_SIZE);
		
		// Prepare batch payload
		const batchPayload = batch.map(item => item.emailData);

		try {
			// Send batch with rate limiting (pass batch size for tracking)
			const result = await rateLimitedSend(async () => (await getEmailProvider()).batch.send(batchPayload), batch.length);

			// Check for errors in response
			if (result.error) {
				throw new Error(result.error.message || 'Batch send failed');
			}

			// Process results for each email in the batch
			if (result.data && Array.isArray(result.data)) {
				batch.forEach((item, index) => {
					const messageId = result.data[index]?.id || null;
					results.push({ 
						email: item.email, 
						status: 'sent',
						messageId: messageId
					});
				});
			} else {
				// Fallback if response format is unexpected
				batch.forEach((item) => {
					results.push({ 
						email: item.email, 
						status: 'sent'
					});
				});
			}
		} catch (error) {
			// Log errors for all emails in the failed batch
			batch.forEach((item) => {
				results.push({ 
					email: item.email, 
					status: 'error', 
					error: error.message 
				});
			});
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

	const branding = await getEmailBranding(event);
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
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: [to],
			subject: 'Welcome to TheHUB - Your Admin Account',
			html: html,
			text: text
		}));

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

	const branding = await getEmailBranding(event);
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
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: [to],
			subject: 'Reset Your Password - TheHUB',
			html: html,
			text: text
		}));

		return result;
	} catch (error) {
		console.error('Failed to send password reset email:', error);
		throw error;
	}
}

/**
 * Send MultiOrg password reset email.
 * @param {{ to: string, name: string, resetToken: string }} - Recipient and token
 * @param {{ url: URL, adminSubdomain?: boolean }} event - url.origin and adminSubdomain (for reset link path)
 */
export async function sendMultiOrgPasswordResetEmail({ to, name, resetToken }, event) {
	if (!env.RESEND_API_KEY || env.RESEND_API_KEY.trim() === '') {
		console.error('[MultiOrg password reset email] RESEND_API_KEY is not set. Set it in your environment (e.g. Railway variables).');
		throw new Error('Email is not configured: RESEND_API_KEY is missing.');
	}
	const adminSubdomain = !!event?.adminSubdomain;
	const baseUrl = adminSubdomain ? event.url?.origin : getBaseUrl(event);
	const path = adminSubdomain ? '/auth/reset-password' : '/multi-org/auth/reset-password';
	const encodedToken = encodeURIComponent(resetToken);
	const encodedEmail = encodeURIComponent(to);
	const resetLink = `${baseUrl}${path}?token=${encodedToken}&email=${encodedEmail}`;

	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
	const logoUrl = `${baseUrl}/images/onnuma-logo.png`;
	const html = `
		<!DOCTYPE html>
		<html>
		<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reset Your Password - OnNuma</title></head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #272838; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f8f8fa;">
			<div style="background: #fff; padding: 24px; border-radius: 12px; border: 1px solid #7E7F9A; box-shadow: 0 2px 8px rgba(39,40,56,0.08);">
				<div style="background: #FEFCF4; padding: 24px; border-radius: 10px; text-align: center; margin-bottom: 20px; border: 1px solid #F3DE8A;">
					<img src="${logoUrl}" alt="OnNuma" style="max-width: 180px; height: auto; max-height: 48px; margin-bottom: 12px; display: inline-block;" />
					<h1 style="color: #272838; margin: 0; font-size: 20px; font-weight: 600;">Reset Your Password</h1>
					<p style="color: #272838; margin: 8px 0 0 0; font-size: 14px; opacity: 0.85;">OnNuma</p>
				</div>
				<p style="color: #272838; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
				<p style="color: #272838; font-size: 15px; margin: 0 0 15px 0;">We received a request to reset your OnNuma admin password.</p>
				<div style="background: #F3DE8A; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #EB9486;">
					<p style="color: #272838; font-size: 14px; margin: 0 0 12px 0;">Click the button below to set a new password. This link expires in 24 hours.</p>
					<a href="${resetLink}" style="display: inline-block; background: #EB9486; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Reset Password</a>
					<p style="color: #7E7F9A; font-size: 12px; margin: 12px 0 0 0;">Or copy this link: ${resetLink}</p>
				</div>
				<p style="color: #7E7F9A; font-size: 12px; margin: 16px 0 0 0;">If you didn't request this, you can ignore this email. Your password will not change until you use the link above.</p>
			</div>
		</body>
		</html>
	`;
	const text = `Reset Your Password - OnNuma\n\nHello ${name},\n\nWe received a request to reset your OnNuma admin password.\n\nOpen this link to set a new password (expires in 24 hours):\n${resetLink}\n\nIf you didn't request this, ignore this email.\n`;

	try {
		return await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: [to],
			subject: 'Reset your OnNuma password',
			html,
			text
		}));
	} catch (error) {
		console.error('Failed to send MultiOrg password reset email:', error);
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
export async function sendEventSignupConfirmation({ to, name, event, occurrence, guestCount = 0, dietaryRequirements }, svelteEvent) {
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
	
	// Get location from occurrence first, fallback to event location
	const location = occurrence.location || event.location || '';

	const branding = await getEmailBranding(svelteEvent);
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
						${location ? `
						<tr>
							<td style="padding: 6px 0; font-weight: 600; color: #666; font-size: 13px;">Location:</td>
							<td style="padding: 6px 0; color: #333; font-size: 13px;">${location}</td>
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
						${dietaryRequirements ? `
						<tr>
							<td style="padding: 6px 0; font-weight: 600; color: #666; font-size: 13px;">Dietary:</td>
							<td style="padding: 6px 0; color: #333; font-size: 13px;">${dietaryRequirements.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
						</tr>
						` : ''}
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
${location ? `Location: ${location}` : ''}
Attendees: ${totalAttendees === 1 
		? 'Just you' 
		: `You + ${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} (${totalAttendees} total)`}
${dietaryRequirements ? `Dietary requirements: ${dietaryRequirements}\n` : ''}

We look forward to seeing you there!

Eltham Green Community Church
542 Westhorne Avenue, Eltham, London, SE9 6RR
	`.trim();

	try {
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: [to],
			subject: `Event Signup Confirmed: ${event.title}`,
			html: html,
			text: text
		}));

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
		// Always group by occurrence to avoid duplicates and show clear structure
		assigneesHtml = '<div style="margin-top: 15px;"><h3 style="color: #2d7a32; margin: 0 0 10px 0; font-size: 15px; font-weight: 600;">Assignees by Occurrence:</h3>';
		for (const [occKey, assignees] of Object.entries(assigneesByOcc)) {
			// Deduplicate assignees within the same occurrence (by email or name)
			const uniqueAssignees = [];
			const seenAssignees = new Set();
			for (const assignee of assignees) {
				const key = assignee.email || assignee.name;
				if (!seenAssignees.has(key)) {
					seenAssignees.add(key);
					uniqueAssignees.push(assignee);
				}
			}
			
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
			uniqueAssignees.forEach(assignee => {
				const displayName = assignee.email ? `${assignee.name} (${assignee.email})` : assignee.name;
				assigneesHtml += `<li style="margin: 5px 0;">${displayName}</li>`;
			});
			assigneesHtml += '</ul></div>';
		}
		assigneesHtml += '</div>';
	} else {
		assigneesHtml = '<div style="margin-top: 15px;"><p style="color: #666; font-size: 14px; font-style: italic;">No assignees yet.</p></div>';
	}

	// Build assignees text section
	let assigneesText = '';
	if (allAssigneesList.length > 0) {
		assigneesText = '\n\nAssignees by Occurrence:\n';
		for (const [occKey, assignees] of Object.entries(assigneesByOcc)) {
			// Deduplicate assignees within the same occurrence (by email or name)
			const uniqueAssignees = [];
			const seenAssignees = new Set();
			for (const assignee of assignees) {
				const key = assignee.email || assignee.name;
				if (!seenAssignees.has(key)) {
					seenAssignees.add(key);
					uniqueAssignees.push(assignee);
				}
			}
			
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
			uniqueAssignees.forEach(assignee => {
				const displayName = assignee.email ? `${assignee.name} (${assignee.email})` : assignee.name;
				assigneesText += `- ${displayName}\n`;
			});
		}
	} else {
		assigneesText = '\n\nNo assignees yet.';
	}

	const branding = await getEmailBranding(event);
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
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Capacity:</strong> ${rota.capacity} ${rota.capacity === 1 ? 'person is' : 'people are'} ideal for this rota</p>
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
Capacity: ${rota.capacity} ${rota.capacity === 1 ? 'person is' : 'people are'} ideal for this rota
Total Assignees: ${(rota.assignees || []).length}${assigneesText}

View the rota: ${hubUrl}
	`.trim();

	try {
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: [to],
			subject: `Rota Updated: ${role} - ${eventTitle}`,
			html,
			text
		}));

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

	const branding = await getEmailBranding(event);
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
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: [to],
			subject: `Reminder: ${role} - ${eventTitle} in 3 days`,
			html,
			text
		}));

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
	const branding = await getEmailBranding(event);
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
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: [to],
			subject: 'Welcome to Eltham Green Community Church',
			html,
			text
		}));

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
	const branding = await getEmailBranding(event);
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
		const result = await rateLimitedSend(async () => (await getEmailProvider()).emails.send({
			from: fromEmail,
			to: to,
			subject: `${isUpdate ? 'Member Information Updated' : 'New Member Signup'}: ${contactName}`,
			html,
			text
		}));

		return result;
	} catch (error) {
		console.error('Failed to send member signup admin notification:', error);
		throw error;
	}
}

