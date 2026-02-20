import { env } from '$env/dynamic/private';
import { readCollection, findById, update, findMany } from './fileStore.js';
import { ensureUnsubscribeToken, ensureEventToken } from './tokens.js';
import { rateLimitedSend } from './emailRateLimiter.js';
import { getSettings, getCurrentOrganisationId } from './settings.js';
import { sendEmail } from '$lib/server/mailgun.js';

const fromEmailDefault = () => env.MAILGUN_FROM_EMAIL || (env.MAILGUN_DOMAIN ? `noreply@${env.MAILGUN_DOMAIN}` : '');

/**
 * Get base URL for absolute links in emails.
 * When the request is from a hub custom domain (e.g. hub.egcc.co.uk), uses that origin
 * so links and images point to the correct domain/subdomain.
 * Prefers APP_BASE_URL when the request origin is localhost so cron/internal calls still produce correct links.
 * @param {object} event - SvelteKit event object (may have locals.hubBaseUrl when on hub domain)
 * @returns {string} Base URL (origin, no trailing slash)
 */
function getBaseUrl(event) {
	if (event?.locals?.hubBaseUrl) return event.locals.hubBaseUrl;
	const requestOrigin = event?.url?.origin;
	const isLocalhost = !requestOrigin || /^https?:\/\/localhost(:\d+)?$/i.test(requestOrigin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(requestOrigin);
	const appBase = env.APP_BASE_URL ? String(env.APP_BASE_URL).trim().replace(/\/$/, '') : '';
	if (appBase && (isLocalhost || !requestOrigin)) return appBase;
	const base = appBase || requestOrigin || 'http://localhost:5173';
	return base.replace(/\/$/, '');
}

/** Default logo path when no theme logo is set (must exist in static/assets). */
const DEFAULT_ONNUMA_LOGO_PATH = '/assets/onnuma-logo.png';

/**
 * Get organisation contact details for email footers (name, address, phone, email).
 * Uses current Hub organisation so links and contact info match the correct domain/org.
 * @returns {Promise<{ orgName: string, address: string, phone: string, email: string }>}
 */
async function getOrgContactForEmail() {
	const orgId = await getCurrentOrganisationId();
	if (!orgId) return { orgName: '', address: '', phone: '', email: '' };
	const org = await findById('organisations', orgId);
	if (!org) return { orgName: '', address: '', phone: '', email: '' };
	return {
		orgName: String(org.name || '').trim(),
		address: String(org.address || '').trim(),
		phone: String(org.telephone || '').trim(),
		email: String(org.email || '').trim()
	};
}

/**
 * Resolve logo URL for emails: use Hub theme logo if set and valid, otherwise OnNuma logo.
 * When no theme exists or theme has no logo (empty, legacy Cloudinary, etc.), always use OnNuma logo.
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<{ logoUrl: string, alt: string }>}
 */
async function getEmailLogo(event) {
	const baseUrl = getBaseUrl(event);
	const settings = await getSettings();
	const theme = settings?.theme || {};
	let logoPath = typeof theme.logoPath === 'string' ? theme.logoPath.trim() : '';
	// Strip legacy Cloudinary URLs (broken in emails); treat as no theme logo
	if (logoPath && logoPath.includes('cloudinary.com')) {
		logoPath = '';
	}
	if (!logoPath) {
		return { logoUrl: `${baseUrl}${DEFAULT_ONNUMA_LOGO_PATH}`, alt: 'OnNuma' };
	}
	if (logoPath.startsWith('http')) {
		return { logoUrl: logoPath, alt: 'Logo' };
	}
	if (logoPath.startsWith('/')) {
		return { logoUrl: `${baseUrl}${logoPath}`, alt: 'Logo' };
	}
	return { logoUrl: `${baseUrl}/${logoPath.replace(/^\//, '')}`, alt: 'Logo' };
}

/**
 * Generate email branding HTML with logo and site link.
 * Uses Hub theme logo if set; otherwise OnNuma logo.
 * @param {object} event - SvelteKit event object (for base URL)
 * @param {{ baseUrlForLogo?: string }} [options] - When baseUrlForLogo is set, use that origin for logo image and link and always use default OnNuma logo (for org-specific emails so logo is correct before any theme change).
 * @returns {Promise<string>} Branding HTML
 */
async function getEmailBranding(event, options = {}) {
	const baseUrl = getBaseUrl(event);
	let logoUrl, alt, linkUrl;
	if (options?.baseUrlForLogo && String(options.baseUrlForLogo).trim()) {
		const logoBase = String(options.baseUrlForLogo).replace(/\/$/, '');
		logoUrl = `${logoBase}${DEFAULT_ONNUMA_LOGO_PATH}`;
		alt = 'OnNuma';
		linkUrl = logoBase;
	} else {
		const resolved = await getEmailLogo(event);
		logoUrl = resolved.logoUrl;
		alt = resolved.alt;
		linkUrl = baseUrl;
	}
	return `
		<div style="text-align: center; padding: 20px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
			<a href="${linkUrl}" style="display: inline-block; text-decoration: none;">
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
	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);
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

		// Filter to upcoming occurrences (from start of today, within 14 days) where contact is assigned
		for (const occurrence of rotaOccurrences) {
			const startDate = new Date(occurrence.startsAt);
			if (startDate >= startOfToday && startDate <= fourteenDaysFromNow) {
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
					signupUrl: tokenData ? `${baseUrl}/signup/schedule/${tokenData.token}` : null,
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
	const orgContact = await getOrgContactForEmail();

	// Check if contact has any rotas if not provided
	let hasRotas = contactHasRotas;
	if (hasRotas === null && contact?.id) {
		hasRotas = await hasAnyRotas(contact.id);
	}
	// Default to false if still null (no contact or no contact ID)
	if (hasRotas === null) {
		hasRotas = false;
	}

	// Replace contact and org placeholders with default values
	let personalized = content
		.replace(/\{\{firstName\}\}/g, contactData.firstName || 'all')
		.replace(/\{\{lastName\}\}/g, contactData.lastName || '')
		.replace(/\{\{name\}\}/g, `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim() || contactData.email || 'Church Member')
		.replace(/\{\{email\}\}/g, contactData.email || '')
		.replace(/\{\{phone\}\}/g, contactData.phone || '')
		.replace(/\{\{org_name\}\}/g, orgContact.orgName || '');

	const signupPageUrl = `${baseUrl}/signup/schedules`;

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
						text += `\n  See who's on the schedules: ${eventRotaViewUrl}`;
					}
					if (signupUrl) {
						text += `\n  Sign up: ${signupUrl}`;
					}
					text += '\n';
				}
			}
			
			// Add signup link
			text += '\n';
			text += `Sign Up for Schedules: ${signupPageUrl}`;
			
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
							html += `<a href="${signupUrl}" style="display: inline-block; background: #4A97D2; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; margin-top: 3px;">View Schedule Details</a>`;
						}
						html += '</div>';
					}
				}
			
				// Add signup link
				html += '<div style="margin-top: 12px;">';
				html += `<a href="${signupPageUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px;">Sign Up for Schedules</a>`;
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
	const fromEmail = fromEmailDefault();

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
		const result = await rateLimitedSend(() =>
			sendEmail({
				from: emailData.from,
				to: emailData.to,
				subject: emailData.subject,
				html: emailData.html,
				text: emailData.text
			})
		);

		// Log the send
		const logs = email.logs || [];
		logs.push({
			timestamp: new Date().toISOString(),
			email: emailData.contactEmail,
			status: 'sent',
			messageId: result?.data?.id ?? null
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
 * Send batch of newsletter emails. Mailgun has no batch API – send each email with rate limiting.
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
	const logs = email.logs || [];

	for (const emailData of emailDataArray) {
		try {
			const result = await rateLimitedSend(() =>
				sendEmail({
					from: emailData.from,
					to: emailData.to,
					subject: emailData.subject,
					html: emailData.html,
					text: emailData.text
				})
			);
			const messageId = result?.data?.id ?? null;
			logs.push({
				timestamp: new Date().toISOString(),
				email: emailData.contactEmail,
				status: 'sent',
				messageId
			});
			results.push({ email: emailData.contactEmail, status: 'sent', messageId });
		} catch (error) {
			logs.push({
				timestamp: new Date().toISOString(),
				email: emailData.contactEmail,
				status: 'error',
				error: error.message
			});
			results.push({ email: emailData.contactEmail, status: 'error', error: error.message });
		}
		await update('emails', newsletterId, { logs });
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
	const signupUrl = `${baseUrl}/signup/schedule/${token}`;
	const fromEmail = fromEmailDefault();

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
					${item.signupUrl ? `<a href="${item.signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Schedule</a>` : ''}
				</div>
			`;
		}
		upcomingRotasHtml += '</div>';
	}

	const onnumaLogoUrl = `${baseUrl}${DEFAULT_ONNUMA_LOGO_PATH}`;
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
		const result = await rateLimitedSend(() =>
			sendEmail({
				from: fromEmail,
				to: [to],
				subject: `Can you help with volunteering? - sign up for these rotas`,
				html,
				text
			})
		);
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
	const fromEmail = fromEmailDefault();
	const orgContact = await getOrgContactForEmail();

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
						signupUrl: `${baseUrl}/signup/schedule/${invite.token}#rota-${rotaId}`
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
							${item.signupUrl ? `<a href="${item.signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">View Schedule</a>` : ''}
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
								${orgContact.orgName ? `<p style="margin: 0 0 8px 0; color: #333; font-size: 14px; font-weight: 600;">${orgContact.orgName}</p>` : ''}
								${orgContact.address ? `<p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">${orgContact.address}</p>` : ''}
								${(orgContact.phone || orgContact.email) ? `<p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">
									${orgContact.phone ? `<a href="tel:${orgContact.phone.replace(/\s/g, '')}" style="color: #2d7a32; text-decoration: none;">${orgContact.phone}</a>` : ''}
									${orgContact.phone && orgContact.email ? ' | ' : ''}
									${orgContact.email ? `<a href="mailto:${orgContact.email}" style="color: #2d7a32; text-decoration: none;">${orgContact.email}</a>` : ''}
								</p>` : ''}
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

			const footerText = [
				orgContact.orgName,
				orgContact.address,
				orgContact.phone ? `Phone: ${orgContact.phone}` : '',
				orgContact.email ? `Email: ${orgContact.email}` : ''
			].filter(Boolean).join('\n');
			const text = `
Volunteer Rota Invitations

Hi ${firstName || 'there'},

${personalizedMessage ? personalizedMessage + '\n\n' : ''}${rotasText}
${eventPageUrl ? `\nView Event Page: ${eventPageUrl}` : ''}
${upcomingRotasText}
${footerText ? `\n---\n${footerText}\n` : ''}
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
 * Send suggested-to-invite email: one contact, selected rotas, custom message, ends with MyHUB link.
 * @param {object} contact - Contact { id, email, firstName, lastName }
 * @param {Array} rotaInvites - Array of { rota, event, signupUrl }
 * @param {string} customMessage - Optional message (supports {{firstname}})
 * @param {object} event - SvelteKit event object
 * @returns {Promise<{ email: string, status: string, error?: string }>}
 */
export async function sendSuggestedInviteEmail(contact, rotaInvites, customMessage, event) {
	const baseUrl = getBaseUrl(event);
	const fromEmail = fromEmailDefault();
	const to = contact?.email;
	if (!to) {
		return { email: to || 'unknown', status: 'error', error: 'No email address' };
	}

	const orgContact = await getOrgContactForEmail();
	const firstName = contact.firstName || '';
	const personalizedMessage = customMessage
		? String(customMessage).replace(/\{\{firstname\}\}/gi, firstName).trim()
		: '';

	let rotasHtml = '';
	let rotasText = '';
	for (const { rota, event: eventData, signupUrl } of rotaInvites) {
		if (!rota || !signupUrl) continue;
		const role = rota.role || 'Volunteer';
		const capacity = rota.capacity ?? 1;
		const eventTitle = eventData?.title || 'Event';

		rotasHtml += `
			<div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #2d7a32;">
				<p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">${eventTitle}</p>
				<p style="margin: 0 0 8px 0; color: #333; font-size: 16px; font-weight: 600;">${role}</p>
				<p style="margin: 0 0 10px 0; color: #666; font-size: 13px;">Capacity: ${capacity} ${capacity === 1 ? 'person is' : 'people are'} ideal for this rota</p>
				<div style="text-align: center; margin-top: 10px;">
					<a href="${signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 8px 16px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 13px;">Select date for ${role}</a>
				</div>
			</div>
		`;
		rotasText += `\n${eventTitle} – ${role} (Capacity: ${capacity})\nSelect date: ${signupUrl}\n`;
	}

	const myHubUrl = `${baseUrl}/myhub`;
	const myHubSectionHtml = `
		<div style="background: #f0f9ff; padding: 15px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #2563eb;">
			<p style="margin: 0 0 8px 0; color: #333; font-size: 15px; font-weight: 600;">See all rotas and sign up for more</p>
			<p style="margin: 0 0 12px 0; color: #666; font-size: 14px;">There are other rotas you can sign up for. Visit MyHUB to see everything in one place.</p>
			<a href="${myHubUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">Open MyHUB</a>
		</div>
	`;
	const myHubSectionText = `\n\nThere are other rotas you can sign up for. Visit MyHUB to see everything: ${myHubUrl}`;

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
					${myHubSectionHtml}
					<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
						<div style="text-align: center; margin-bottom: 15px;">
							${orgContact.orgName ? `<p style="margin: 0 0 8px 0; color: #333; font-size: 14px; font-weight: 600;">${orgContact.orgName}</p>` : ''}
							${orgContact.address ? `<p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">${orgContact.address}</p>` : ''}
							${(orgContact.phone || orgContact.email) ? `<p style="margin: 0 0 4px 0; color: #666; font-size: 12px;">
								${orgContact.phone ? `<a href="tel:${orgContact.phone.replace(/\s/g, '')}" style="color: #2d7a32; text-decoration: none;">${orgContact.phone}</a>` : ''}
								${orgContact.phone && orgContact.email ? ' | ' : ''}
								${orgContact.email ? `<a href="mailto:${orgContact.email}" style="color: #2d7a32; text-decoration: none;">${orgContact.email}</a>` : ''}
							</p>` : ''}
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

	const footerText = [
		orgContact.orgName,
		orgContact.address,
		orgContact.phone ? `Phone: ${orgContact.phone}` : '',
		orgContact.email ? `Email: ${orgContact.email}` : ''
	].filter(Boolean).join('\n');
	const text = `
Volunteer Rota Invitations

Hi ${firstName || 'there'},

${personalizedMessage ? personalizedMessage + '\n\n' : ''}${rotasText}${myHubSectionText}
${footerText ? `\n---\n${footerText}\n` : ''}
Website: ${baseUrl}
	`.trim();

	const subject = `Can you help? Sign up for these rotas`;

	try {
		await rateLimitedSend(() =>
			sendEmail({
				from: fromEmail,
				to: [to],
				subject,
				html,
				text
			})
		);
		return { email: to, status: 'sent' };
	} catch (err) {
		console.error('Error sending suggested invite email:', err);
		return { email: to, status: 'error', error: err?.message || 'Send failed' };
	}
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
			for (const item of batch) {
				try {
					const result = await rateLimitedSend(() =>
						sendEmail({
							from: item.emailData.from,
							to: item.emailData.to,
							subject: item.emailData.subject,
							html: item.emailData.html,
							text: item.emailData.text
						})
					);
					results.push({
						email: item.email,
						status: 'sent',
						messageId: result?.data?.id ?? null
					});
				} catch (err) {
					results.push({
						email: item.email,
						status: 'error',
						error: err?.message ?? 'Send failed'
					});
				}
			}
		} catch (error) {
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
 * @param {string} [options.hubBaseUrl] - Base URL for this org's hub (custom login URL). When set, verification and login links use this so the user logs in at their org's URL.
 * @param {string} [options.orgName] - Organisation name for the email body (e.g. "River Church"). When not set, uses "your organisation".
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend API response
 */
export async function sendAdminWelcomeEmail({ to, name, email, verificationToken, password, hubBaseUrl, orgName }, event) {
	const organisationName = (orgName && String(orgName).trim()) || 'your organisation';
	console.log('[email] sendAdminWelcomeEmail called:', { to, name, email, hasToken: !!verificationToken, hasPassword: !!password, hubBaseUrl: hubBaseUrl ?? 'none', orgName: organisationName });
	
	const baseUrl = getBaseUrl(event);
	const hubUrl = (hubBaseUrl && String(hubBaseUrl).trim()) ? String(hubBaseUrl).replace(/\/$/, '') : baseUrl;
	const fromEmail = fromEmailDefault();
	if (!fromEmail || !fromEmail.trim()) {
		console.warn('[email] sendAdminWelcomeEmail: fromEmail is empty — Mailgun may reject. Check MAILGUN_FROM_EMAIL or MAILGUN_DOMAIN.');
	}
	console.log('[email] Config:', { baseUrl, hubUrl, fromEmail: fromEmail || '(empty)', to, MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN ? 'set' : 'NOT SET', MAILGUN_API_KEY: process.env.MAILGUN_API_KEY ? 'set' : 'NOT SET' });
	
	// Verification and login links: use org's custom hub URL when provided so they log in at their custom URL
	const verificationLink = `${hubUrl}/hub/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
	const hubLoginLink = `${hubUrl}/hub/auth/login`;

	// Use org's hub URL for logo so default OnNuma logo shows (unless super user changes theme later)
	const branding = await getEmailBranding(event, { baseUrlForLogo: hubUrl });
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Welcome to TheHUB - ${organisationName}</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: #ffffff; padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px; border: 1px solid #e5e7eb;">
					<h1 style="color: #333; margin: 0; font-size: 20px; font-weight: 600;">Welcome to TheHUB</h1>
					<p style="color: #666; margin: 8px 0 0 0; font-size: 14px;">${organisationName}</p>
				</div>
				
				<div style="padding: 0;">
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Your admin account has been created for TheHUB, the church management system for ${organisationName}.</p>

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
						<a href="${hubUrl}" style="color: #4A97D2; text-decoration: none;">Visit ${organisationName} Hub</a>
					</p>
				</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Welcome to TheHUB - ${organisationName}

Hello ${name},

Your admin account has been created for TheHUB, the church management system for ${organisationName}.

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

Log in to your Hub: ${hubLoginLink}
	`.trim();

	console.log('[email] Calling rateLimitedSend with from:', fromEmail, 'to:', to);
	try {
		const result = await rateLimitedSend(() => {
			console.log('[email] rateLimitedSend callback: invoking sendEmail now');
			return sendEmail({
				from: fromEmail,
				to: [to],
				subject: `Welcome to TheHUB - ${organisationName}`,
				html: html,
				text: text
			});
		});

		console.log('[email] Welcome email sent successfully:', JSON.stringify(result));
		return result;
	} catch (error) {
		console.error('[email] Failed to send admin welcome email:', error?.message || error);
		console.error('[email] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
		throw error;
	}
}

/**
 * Send password reset email (Hub admin).
 * When hubBaseUrl is provided, the reset link and logo use the organisation's subdomain.
 * @param {object} options - Email options
 * @param {string} options.to - Admin email address
 * @param {string} options.name - Admin name
 * @param {string} options.resetToken - Password reset token
 * @param {string} [options.hubBaseUrl] - Base URL for this org's hub (e.g. https://orgslug.onnuma.com). When set, reset link and logo use this so the user resets on their org's URL.
 * @param {string} [options.orgName] - Organisation name for the email (e.g. "River Church"). When not set, uses "The HUB".
 * @param {object} event - SvelteKit event object (for base URL when hubBaseUrl not set)
 * @returns {Promise<object>} Resend API response
 */
export async function sendPasswordResetEmail({ to, name, resetToken, hubBaseUrl, orgName }, event) {
	const baseUrl = getBaseUrl(event);
	const hubUrl = (hubBaseUrl && String(hubBaseUrl).trim()) ? String(hubBaseUrl).replace(/\/$/, '') : baseUrl;
	const fromEmail = fromEmailDefault();
	
	// Create reset link - use org's hub URL when provided so link goes to organisation's subdomain
	const encodedToken = encodeURIComponent(resetToken);
	const encodedEmail = encodeURIComponent(to);
	const resetLink = `${hubUrl}/hub/auth/reset-password?token=${encodedToken}&email=${encodedEmail}`;
	
	console.log('[sendPasswordResetEmail] Generated reset link:', {
		baseUrl: baseUrl,
		hubUrl: hubUrl,
		tokenLength: resetToken.length,
		encodedTokenLength: encodedToken.length,
		email: to,
		encodedEmailLength: encodedEmail.length,
		linkPreview: resetLink.substring(0, 100) + '...',
		fullLink: resetLink
	});

	// Use request origin for logo when hubBaseUrl is set so the image loads (default OnNuma logo).
	// When hubBaseUrl is not set, getEmailBranding uses theme logo or default from event base URL.
	const branding = hubBaseUrl
		? await getEmailBranding(event, { baseUrlForLogo: hubUrl })
		: await getEmailBranding(event);
	const organisationName = (orgName && String(orgName).trim()) || 'The HUB';
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Reset Your Password - ${organisationName}</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #4A97D2 0%, #3a7ab8 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Reset Your Password</h1>
					<p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">${organisationName}</p>
				</div>
				
				<div style="padding: 0;">
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">We received a request to reset your password for your ${organisationName} admin account.</p>

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
						<a href="${hubUrl}" style="color: #4A97D2; text-decoration: none;">Visit ${organisationName}</a>
					</p>
				</div>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Reset Your Password - ${organisationName}

Hello ${name},

We received a request to reset your password for your ${organisationName} admin account.

Click the link below to reset your password. This link will expire in 24 hours.

${resetLink}

Security Notice:
- If you didn't request this password reset, please ignore this email
- Your password will not be changed until you click the link above
- This link expires in 24 hours for security
- For security, all active sessions will be logged out after password reset

If you have any questions or need assistance, please contact the system administrator.

Visit: ${hubUrl}
	`.trim();

	try {
		const result = await rateLimitedSend(() => sendEmail({
			from: fromEmail,
			to: [to],
			subject: `Reset Your Password - ${organisationName}`,
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
	if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) {
		console.error('[MultiOrg password reset email] Mailgun is not configured. Set MAILGUN_API_KEY and MAILGUN_DOMAIN in your environment.');
		throw new Error('Email is not configured: Mailgun (MAILGUN_API_KEY and MAILGUN_DOMAIN) is missing.');
	}
	const adminSubdomain = !!event?.adminSubdomain;
	const baseUrl = adminSubdomain ? event.url?.origin : getBaseUrl(event);
	const path = adminSubdomain ? '/auth/reset-password' : '/multi-org/auth/reset-password';
	const encodedToken = encodeURIComponent(resetToken);
	const encodedEmail = encodeURIComponent(to);
	const resetLink = `${baseUrl}${path}?token=${encodedToken}&email=${encodedEmail}`;

	const fromEmail = fromEmailDefault();
	const logoUrl = `${baseUrl}${DEFAULT_ONNUMA_LOGO_PATH}`;
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
		return await rateLimitedSend(() => sendEmail({
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
	const fromEmail = fromEmailDefault();

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
		const result = await rateLimitedSend(() => sendEmail({
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
	const fromEmail = fromEmailDefault();
	const hubUrl = `${baseUrl}/hub/schedules/${rota.id}`;

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

	// Only show occurrences from start of today (not past dates)
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);

	// Build assignees HTML section
	let assigneesHtml = '';
	if (allAssigneesList.length > 0) {
		// Always group by occurrence to avoid duplicates and show clear structure
		assigneesHtml = '<div style="margin-top: 15px;"><h3 style="color: #2d7a32; margin: 0 0 10px 0; font-size: 15px; font-weight: 600;">Assignees by Occurrence:</h3>';
		for (const [occKey, assignees] of Object.entries(assigneesByOcc)) {
			// Skip past occurrences: only show dates from today onwards
			if (occKey !== 'all' && occKey) {
				const occ = eventOccurrences.find(o => o.id === occKey);
				if (occ && new Date(occ.startsAt) < startOfToday) continue;
			}
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
			// Skip past occurrences: only show dates from today onwards
			if (occKey !== 'all' && occKey) {
				const occ = eventOccurrences.find(o => o.id === occKey);
				if (occ && new Date(occ.startsAt) < startOfToday) continue;
			}
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
					<a href="${hubUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 14px;">View Schedule</a>
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

View the schedule: ${hubUrl}
	`.trim();

	try {
		const result = await rateLimitedSend(() => sendEmail({
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
 * Send notification when a volunteer says they can no longer volunteer on a date.
 * Recipient is the rota owner or super admin.
 * @param {object} options - Recipient options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Recipient name
 * @param {object} payload - { volunteerName, volunteerEmail, role, eventTitle, dateDisplay }
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend API response
 */
export async function sendVolunteerCannotAttendNotification({ to, name }, payload, event) {
	const { volunteerName, volunteerEmail, role, eventTitle, dateDisplay, note } = payload;
	const baseUrl = getBaseUrl(event);
	const fromEmail = fromEmailDefault();

	const branding = await getEmailBranding(event);
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Volunteer can no longer attend</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Volunteer can no longer attend</h1>
				</div>
				<div style="padding: 0;">
					<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name || 'there'},</p>
					<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
						<strong>${volunteerName || volunteerEmail || 'A volunteer'}</strong>${volunteerEmail ? ` (${volunteerEmail})` : ''} has let you know they can no longer volunteer on this date.
					</p>
				<div style="background: #fef2f2; padding: 15px; border-radius: 6px; margin: 15px 0; border: 1px solid #fecaca;">
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Role:</strong> ${role || '—'}</p>
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Event:</strong> ${eventTitle || '—'}</p>
					<p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>Date:</strong> ${dateDisplay || '—'}</p>
				</div>
				${note ? `<div style="background: #f9fafb; padding: 12px 15px; border-radius: 6px; margin: 15px 0; border-left: 3px solid #9ca3af;"><p style="margin: 0 0 4px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Their message</p><p style="margin: 0; color: #374151; font-size: 15px;">${note}</p></div>` : ''}
				<p style="color: #666; font-size: 14px; margin: 15px 0 0 0;">
					Please update the rota in the Hub and find a replacement if needed.
				</p>
				</div>
			</div>
		</body>
		</html>
	`;

	const text = `
Volunteer can no longer attend

Hello ${name || 'there'},

${volunteerName || volunteerEmail || 'A volunteer'}${volunteerEmail ? ` (${volunteerEmail})` : ''} has let you know they can no longer volunteer on this date.

Details:
Role: ${role || '—'}
Event: ${eventTitle || '—'}
Date: ${dateDisplay || '—'}
${note ? '\nTheir message:\n' + note : ''}
Please update the rota in the Hub and find a replacement if needed.
	`.trim();

	try {
		const result = await rateLimitedSend(() => sendEmail({
			from: fromEmail,
			to: [to],
			subject: `Volunteer can no longer attend: ${role || 'Rota'} – ${dateDisplay || eventTitle || 'Date'}`,
			html,
			text
		}));
		return result;
	} catch (error) {
		console.error('Failed to send volunteer cannot attend notification:', error);
		throw error;
	}
}

/**
 * Send email change verification to a member's new address.
 * @param {object} options - { to: new email, name, verificationLink, currentEmail }
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<object>} Resend API response
 */
export async function sendMemberEmailChangeVerification({ to, name, verificationLink, currentEmail }, event) {
	const baseUrl = getBaseUrl(event);
	const fromEmail = fromEmailDefault();
	const branding = await getEmailBranding(event);
	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Confirm your new email address</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.5; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
			<div style="background: #ffffff; padding: 20px 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
				${branding}
				<div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 20px 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
					<h1 style="color: white; margin: 0; font-size: 20px; font-weight: 600;">Confirm your new email address</h1>
				</div>
				<div style="padding: 0;">
					<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">Hello ${name || 'there'},</p>
					<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
						You requested to change the email address for your volunteering account from <strong>${currentEmail || 'your current email'}</strong> to <strong>${to}</strong>.
					</p>
					<p style="color: #333; font-size: 15px; margin: 0 0 15px 0;">
						Click the button below to confirm that this email address is yours. The link will expire in 24 hours.
					</p>
					<div style="text-align: center; margin: 24px 0;">
						<a href="${verificationLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Confirm email address</a>
					</div>
					<p style="color: #666; font-size: 14px; margin: 15px 0 0 0;">
						If you didn't request this change, you can ignore this email. Your address will stay the same.
					</p>
				</div>
			</div>
		</body>
		</html>
	`;
	const text = `
Confirm your new email address

Hello ${name || 'there'},

You requested to change the email address for your volunteering account from ${currentEmail || 'your current email'} to ${to}.

Confirm that this email address is yours by visiting this link (expires in 24 hours):

${verificationLink}

If you didn't request this change, you can ignore this email. Your address will stay the same.
	`.trim();
	try {
		return await rateLimitedSend(() => sendEmail({
			from: fromEmail,
			to: [to],
			subject: 'Confirm your new email address',
			html,
			text
		}));
	} catch (error) {
		console.error('Failed to send member email change verification:', error);
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
 * @param {object} options - Optional { daysAhead, orgName, coordinatorName, hubBaseUrl }. hubBaseUrl overrides base URL so "View in My Hub" uses the org's subdomain (e.g. for cron).
 * @returns {Promise<object>} Resend API response
 */
export async function sendUpcomingRotaReminder({ to, name, firstName }, rotaData, event, { daysAhead = 7, orgName = '', coordinatorName = '', hubBaseUrl = '' } = {}) {
	const { rota, event: eventData, occurrence } = rotaData;
	const baseUrl = (hubBaseUrl && String(hubBaseUrl).trim()) ? String(hubBaseUrl).replace(/\/$/, '') : getBaseUrl(event);
	const fromEmail = fromEmailDefault();

	const eventTitle = eventData?.title || 'Event';
	const role = rota?.role || '';

	// Resolve occurrence if not passed directly
	let occ = occurrence;
	if (!occ && rota?.occurrenceId) {
		try {
			const { readCollection: rc } = await import('./fileStore.js');
			const occs = await rc('occurrences');
			occ = occs.find((o) => o.id === rota.occurrenceId) || null;
		} catch (_) {}
	}

	// Plain-English date and time formatting (matches MyHub display)
	function _ordinal(n) {
		const s = ['th', 'st', 'nd', 'rd'];
		const v = n % 100;
		return n + (s[(v - 20) % 10] || s[v] || s[0]);
	}
	function _fmtDate(d) {
		if (!d) return '';
		const dt = d instanceof Date ? d : new Date(d);
		if (isNaN(dt.getTime())) return '';
		const dayName = dt.toLocaleDateString('en-GB', { weekday: 'long' });
		const month = dt.toLocaleDateString('en-GB', { month: 'long' });
		return `${dayName}, ${_ordinal(dt.getDate())} ${month}`;
	}
	function _fmtTime(d) {
		if (!d) return '';
		const dt = d instanceof Date ? d : new Date(d);
		if (isNaN(dt.getTime())) return '';
		const h = dt.getHours();
		const m = dt.getMinutes();
		const ampm = h >= 12 ? 'pm' : 'am';
		const h12 = h % 12 || 12;
		return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`;
	}

	let dayName = '';
	let dateDisplay = '';
	let timeDisplay = '';
	let locationDisplay = '';

	if (occ?.startsAt) {
		const startDate = new Date(occ.startsAt);
		dayName = startDate.toLocaleDateString('en-GB', { weekday: 'long' });
		dateDisplay = _fmtDate(startDate);
		const startTime = _fmtTime(startDate);
		const endTime = occ.endsAt ? _fmtTime(new Date(occ.endsAt)) : '';
		timeDisplay = endTime ? `${startTime} – ${endTime}` : startTime;
		locationDisplay = occ.location || eventData?.location || '';
	}

	// Subject: "See you [Day]! — [Org Name]"
	const subjectDay = daysAhead === 0 ? 'today' : daysAhead === 1 ? 'tomorrow' : dayName || 'soon';
	const orgSuffix = orgName ? ` — ${orgName}` : '';
	const subject = `See you ${subjectDay}!${orgSuffix}`;

	const myhubUrl = `${baseUrl}/myhub`;
	const firstName_display = firstName || name?.split(' ')[0] || name || 'there';
	const signOff = coordinatorName || orgName || 'Your coordinator';
	const orgPhrase = orgName ? `with ${orgName}` : 'with us';

	const locationHtml = locationDisplay
		? `<p style="margin:6px 0 0 0;font-size:16px;color:#6b7280;">📍 <a href="https://maps.google.com/?q=${encodeURIComponent(locationDisplay)}" style="color:#2563a8;text-decoration:underline;">${locationDisplay}</a></p>`
		: '';

	const branding = await getEmailBranding(event);

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;padding:12px;background:#f9fafb;">
<div style="background:#fff;padding:32px 24px;border-radius:12px;border:1px solid #e5e7eb;">
${branding}

<p style="font-size:18px;margin:0 0 16px 0;color:#111827;">Hi ${firstName_display},</p>

<p style="font-size:18px;margin:0 0 24px 0;color:#111827;">
  Just a friendly reminder that you're volunteering ${orgPhrase} this ${dayName || 'week'}:
</p>

<div style="background:#eff6ff;border-radius:10px;padding:20px 24px;margin:0 0 24px 0;border-left:4px solid #2563a8;">
  <p style="font-size:20px;font-weight:700;color:#1e40af;margin:0 0 6px 0;">${eventTitle}</p>
  ${role ? `<p style="font-size:16px;color:#374151;margin:0 0 6px 0;">${role}</p>` : ''}
  ${dateDisplay ? `<p style="font-size:18px;font-weight:600;color:#111827;margin:0 0 4px 0;">${dateDisplay}${timeDisplay ? ` — ${timeDisplay}` : ''}</p>` : ''}
  ${locationHtml}
</div>

<div style="text-align:center;margin:0 0 28px 0;">
  <a href="${myhubUrl}" style="display:inline-block;background:#2563a8;color:#fff;padding:16px 36px;text-decoration:none;border-radius:10px;font-size:18px;font-weight:700;min-width:200px;">View in My Hub</a>
</div>

<p style="font-size:16px;color:#374151;margin:0 0 6px 0;">
  If something has come up and you can't make it, please let us know as soon as you can so we can find cover:
</p>
<p style="font-size:16px;margin:0 0 28px 0;">
  <a href="${myhubUrl}" style="color:#2563a8;font-weight:600;">I can't make this one</a>
</p>

<p style="font-size:17px;color:#111827;margin:0 0 4px 0;">Thank you — see you ${subjectDay}!</p>
<p style="font-size:16px;color:#374151;margin:0;">${signOff}</p>

</div>
</body>
</html>`;

	const text = `Hi ${firstName_display},

Just a friendly reminder that you're volunteering ${orgPhrase} this ${dayName || 'week'}:

${eventTitle}${role ? `\n${role}` : ''}${dateDisplay ? `\n${dateDisplay}${timeDisplay ? ` — ${timeDisplay}` : ''}` : ''}${locationDisplay ? `\n${locationDisplay}` : ''}

View in My Hub: ${myhubUrl}

If something has come up and you can't make it, please let us know as soon as you can so we can find cover:
I can't make this one: ${myhubUrl}

Thank you — see you ${subjectDay}!
${signOff}`.trim();

	try {
		const result = await rateLimitedSend(() =>
			sendEmail({
				from: fromEmail,
				to: [to],
				subject,
				html,
				text
			})
		);
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
	const fromEmail = fromEmailDefault();
	const baseUrl = getBaseUrl(event);
	const branding = await getEmailBranding(event);
	const contactName = name || to;
	const orgContact = await getOrgContactForEmail();
	const orgName = orgContact.orgName || 'your organisation';

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Welcome to ${orgName}</title>
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
							Thank you for signing up to become a member of ${orgName}!
						</p>
						<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">
							We've received your information and are excited to have you join our community. Our team will be in touch with you soon.
						</p>
						${(orgContact.phone || orgContact.email) ? `<p style="color: #666; font-size: 14px; margin: 0;">
							If you have any questions, please feel free to contact us at ${orgContact.email ? `<a href="mailto:${orgContact.email}" style="color: #2d7a32; text-decoration: none;">${orgContact.email}</a>` : ''}${orgContact.phone && orgContact.email ? ' or call us at ' : ''}${orgContact.phone ? `<a href="tel:${orgContact.phone.replace(/\s/g, '')}" style="color: #2d7a32; text-decoration: none;">${orgContact.phone}</a>` : ''}.
						</p>` : ''}
					</div>
					
					${(orgContact.orgName || orgContact.address) ? `<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
						${orgContact.orgName ? `<p style="margin: 0;">${orgContact.orgName}</p>` : ''}
						${orgContact.address ? `<p style="margin: 5px 0 0 0;">${orgContact.address}</p>` : ''}
					</div>` : ''}
				</div>
			</div>
		</body>
		</html>
	`;

	const contactLine = (orgContact.phone || orgContact.email)
		? `If you have any questions, please feel free to contact us at ${orgContact.email || ''}${orgContact.phone && orgContact.email ? ' or call us at ' : ''}${orgContact.phone || ''}.`
		: '';
	const footerLines = [orgContact.orgName, orgContact.address].filter(Boolean).join('\n');
	const text = `
Welcome, ${contactName}!

Thank you for signing up to become a member of ${orgName}!

We've received your information and are excited to have you join our community. Our team will be in touch with you soon.
${contactLine ? '\n' + contactLine + '\n' : ''}
${footerLines ? '\n' + footerLines + '\n' : ''}
	`.trim();

	try {
		const result = await rateLimitedSend(() => sendEmail({
			from: fromEmail,
			to: [to],
			subject: `Welcome to ${orgName}`,
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
	const fromEmail = fromEmailDefault();
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
		const result = await rateLimitedSend(() => sendEmail({
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

/**
 * Send a magic link email to a volunteer so they can access MyHUB without a password.
 * Spec: warm, personal tone; single large "Go to My Hub" button; no jargon.
 *
 * @param {{ to: string, name: string, magicLink: string, orgName?: string }} options
 * @param {object} event - SvelteKit event object (for base URL / branding)
 * @returns {Promise<object>}
 */
export async function sendMagicLinkEmail({ to, name, magicLink, orgName }, event) {
	const fromEmail = fromEmailDefault();
	const branding = await getEmailBranding(event);
	const firstName = (name || '').split(/\s+/)[0] || 'there';
	const displayOrg = orgName ? orgName : 'your volunteering team';

	const html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Your link to MyHUB</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f0f4f8;">
			<div style="background: #ffffff; padding: 28px 24px 32px; border-radius: 12px; border: 1px solid #e2e8f0;">
				${branding}
				<p style="font-size: 18px; margin: 0 0 16px 0; color: #1e293b;">Hi ${firstName},</p>
				<p style="font-size: 18px; margin: 0 0 24px 0; color: #1e293b;">
					Here is your personal link to <strong>${displayOrg}</strong>'s volunteer hub.
					Tap the button below to open it — no password needed.
				</p>
				<div style="text-align: center; margin: 32px 0;">
					<a href="${magicLink}"
					   style="display: inline-block; background: #2563a8; color: #ffffff; text-decoration: none;
					          font-size: 20px; font-weight: 700; padding: 18px 40px; border-radius: 10px;
					          letter-spacing: 0.01em;">
						Go to My Hub
					</a>
				</div>
				<p style="font-size: 15px; color: #64748b; margin: 24px 0 0 0;">
					This link will work for 7 days. If you didn't ask for it, you can safely ignore this email.
				</p>
				<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
				<p style="font-size: 13px; color: #94a3b8; margin: 0;">
					If the button doesn't work, copy and paste this address into your browser:<br>
					<span style="color: #2563a8; word-break: break-all;">${magicLink}</span>
				</p>
			</div>
		</body>
		</html>
	`;

	const text = `
Hi ${firstName},

Here is your personal link to ${displayOrg}'s volunteer hub:

${magicLink}

Tap or paste the link above into your browser — no password needed.

This link will work for 7 days. If you didn't ask for it, you can safely ignore this email.
	`.trim();

	try {
		const result = await rateLimitedSend(() =>
			sendEmail({
				from: fromEmail,
				to: [to],
				subject: `Your link to MyHUB — ${displayOrg}`,
				html,
				text
			})
		);
		return result;
	} catch (error) {
		console.error('[email] Failed to send magic link email:', error);
		throw error;
	}
}

/**
 * Send a personal MyHUB shift invitation to a volunteer.
 * The email includes shift details and a magic-link button leading directly to their MyHub dashboard.
 *
 * @param {{ to: string, name: string, magicLink: string, orgName?: string, eventTitle: string, role?: string, dateDisplay: string, timeDisplay?: string }} options
 * @param {object} event - SvelteKit event (for base URL / branding)
 */
export async function sendMyhubInvitationEmail({ to, name, magicLink, orgName, eventTitle, role, dateDisplay, timeDisplay }, event) {
	const fromEmail = fromEmailDefault();
	const branding = await getEmailBranding(event);
	const firstName = (name || '').split(/\s+/)[0] || 'there';
	const displayOrg = orgName ? orgName : 'your volunteering team';
	const roleLine = role
		? `<p style="font-size:16px;color:#4b5563;margin:0 0 4px 0;">Role: <strong>${role}</strong></p>`
		: '';
	const timeLine = timeDisplay
		? `<p style="font-size:16px;color:#374151;margin:0 0 4px 0;">${timeDisplay}</p>`
		: '';

	const html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>You've been invited to help</title>
		</head>
		<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:10px;background-color:#f0f4f8;">
			<div style="background:#ffffff;padding:28px 24px 32px;border-radius:12px;border:1px solid #e2e8f0;">
				${branding}
				<p style="font-size:18px;margin:0 0 16px 0;color:#1e293b;">Hi ${firstName},</p>
				<p style="font-size:18px;margin:0 0 20px 0;color:#1e293b;">
					<strong>${displayOrg}</strong> would love your help with an upcoming shift. Here are the details:
				</p>
				<div style="background:#f8fafc;border-left:4px solid #2563a8;border-radius:6px;padding:16px 20px;margin:0 0 24px 0;">
					<p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px 0;">${eventTitle}</p>
					${roleLine}
					<p style="font-size:16px;font-weight:600;color:#374151;margin:0 0 4px 0;">${dateDisplay}</p>
					${timeLine}
				</div>
				<p style="font-size:17px;margin:0 0 24px 0;color:#1e293b;">
					Tap the button below to see your invitation in My Hub — you can say yes or let us know if you can't make it.
				</p>
				<div style="text-align:center;margin:32px 0;">
					<a href="${magicLink}"
					   style="display:inline-block;background:#2563a8;color:#ffffff;text-decoration:none;font-size:20px;font-weight:700;padding:18px 40px;border-radius:10px;letter-spacing:0.01em;">
						See my invitation
					</a>
				</div>
				<p style="font-size:15px;color:#64748b;margin:24px 0 0 0;">
					This link will work for 7 days. If you didn't expect this email, you can safely ignore it.
				</p>
				<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
				<p style="font-size:13px;color:#94a3b8;margin:0;">
					If the button doesn't work, copy and paste this address into your browser:<br>
					<span style="color:#2563a8;word-break:break-all;">${magicLink}</span>
				</p>
			</div>
		</body>
		</html>
	`;

	const text = `
Hi ${firstName},

${displayOrg} would love your help with an upcoming shift:

${eventTitle}${role ? '\nRole: ' + role : ''}
${dateDisplay}${timeDisplay ? '\n' + timeDisplay : ''}

Tap or paste the link below to see your invitation in My Hub — you can say yes or let us know if you can't make it:

${magicLink}

This link will work for 7 days. If you didn't expect this email, you can safely ignore it.
	`.trim();

	try {
		const result = await rateLimitedSend(() =>
			sendEmail({
				from: fromEmail,
				to: [to],
				subject: `You've been invited to help — ${eventTitle}`,
				html,
				text
			})
		);
		return result;
	} catch (error) {
		console.error('[email] Failed to send MyHUB invitation email:', error);
		throw error;
	}
}

/**
 * Notify a rota coordinator when a volunteer accepts or declines a MyHUB shift invitation.
 *
 * @param {{ to: string, name: string, volunteerName: string, volunteerEmail?: string, eventTitle: string, role?: string, dateDisplay: string, accepted: boolean }} options
 * @param {object} event - SvelteKit event
 */
export async function sendInvitationResponseEmail({ to, name, volunteerName, volunteerEmail, eventTitle, role, dateDisplay, accepted }, event) {
	const fromEmail = fromEmailDefault();
	const branding = await getEmailBranding(event);
	const firstName = (name || '').split(/\s+/)[0] || 'there';
	const statusVerb = accepted ? 'said yes' : "let you know they can't make it";
	const statusLabel = accepted ? '✓ Attending' : '✗ Cannot attend';
	const statusColour = accepted ? '#15803d' : '#b45309';
	const statusBg = accepted ? '#f0fdf4' : '#fefce8';
	const statusBorder = accepted ? '#bbf7d0' : '#fde68a';

	const html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Invitation response</title>
		</head>
		<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:10px;background-color:#f0f4f8;">
			<div style="background:#ffffff;padding:28px 24px 32px;border-radius:12px;border:1px solid #e2e8f0;">
				${branding}
				<p style="font-size:18px;margin:0 0 16px 0;color:#1e293b;">Hi ${firstName},</p>
				<p style="font-size:18px;margin:0 0 20px 0;color:#1e293b;">
					<strong>${volunteerName}</strong> has ${statusVerb} for a shift:
				</p>
				<div style="background:#f8fafc;border-left:4px solid #2563a8;border-radius:6px;padding:16px 20px;margin:0 0 16px 0;">
					<p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 6px 0;">${eventTitle}</p>
					${role ? `<p style="font-size:16px;color:#4b5563;margin:0 0 4px 0;">Role: <strong>${role}</strong></p>` : ''}
					<p style="font-size:16px;font-weight:600;color:#374151;margin:0;">${dateDisplay}</p>
				</div>
				<div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:6px;padding:12px 16px;margin:0 0 24px 0;">
					<p style="font-size:16px;font-weight:700;color:${statusColour};margin:0;">${statusLabel}</p>
					${volunteerEmail ? `<p style="font-size:14px;color:#6b7280;margin:4px 0 0 0;">${volunteerName} &lt;${volunteerEmail}&gt;</p>` : ''}
				</div>
				<p style="font-size:15px;color:#64748b;margin:0;">
					You can manage this shift in your hub admin area.
				</p>
			</div>
		</body>
		</html>
	`;

	const text = `
Hi ${firstName},

${volunteerName} has ${statusVerb} for a shift:

${eventTitle}${role ? '\nRole: ' + role : ''}
${dateDisplay}

Status: ${statusLabel}
${volunteerEmail ? volunteerName + ' <' + volunteerEmail + '>' : ''}

You can manage this shift in your hub admin area.
	`.trim();

	try {
		const result = await rateLimitedSend(() =>
			sendEmail({
				from: fromEmail,
				to: [to],
				subject: `${volunteerName} has ${statusVerb} — ${eventTitle}`,
				html,
				text
			})
		);
		return result;
	} catch (error) {
		console.error('[email] Failed to send invitation response email:', error);
		throw error;
	}
}

/**
 * Send a warm welcome email to a new volunteer when a coordinator adds them.
 * Spec: personal tone, magic-link "Visit My Hub" button, no jargon.
 *
 * @param {{ to: string, name: string, magicLink: string, orgName?: string, coordinatorName?: string }} options
 * @param {object} event - SvelteKit event (for base URL / branding)
 */
export async function sendVolunteerWelcomeEmail({ to, name, magicLink, orgName, coordinatorName }, event) {
	const fromEmail = fromEmailDefault();
	const branding = await getEmailBranding(event);
	const firstName = (name || '').split(/\s+/)[0] || 'there';
	const displayOrg = orgName || 'your volunteering team';
	const coordinatorLine = coordinatorName
		? `${coordinatorName} from <strong>${displayOrg}</strong>`
		: `<strong>${displayOrg}</strong>`;

	const html = `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Welcome to ${displayOrg}'s volunteer team</title>
		</head>
		<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#1e293b;max-width:600px;margin:0 auto;padding:10px;background-color:#f0f4f8;">
			<div style="background:#ffffff;padding:28px 24px 32px;border-radius:12px;border:1px solid #e2e8f0;">
				${branding}
				<p style="font-size:18px;margin:0 0 16px 0;color:#1e293b;">Hi ${firstName},</p>
				<p style="font-size:18px;margin:0 0 20px 0;color:#1e293b;">
					${coordinatorLine} has added you to their volunteer team on OnNuma Hub.
				</p>
				<p style="font-size:18px;margin:0 0 24px 0;color:#1e293b;">
					Your personal hub is ready — it's where you'll see your upcoming shifts
					and can let us know if you're available.
				</p>
				<div style="text-align:center;margin:32px 0;">
					<a href="${magicLink}"
					   style="display:inline-block;background:#2563a8;color:#ffffff;text-decoration:none;font-size:20px;font-weight:700;padding:18px 40px;border-radius:10px;letter-spacing:0.01em;">
						Visit My Hub
					</a>
				</div>
				<p style="font-size:16px;color:#374151;margin:0 0 24px 0;">
					That's it! No passwords to remember. Just tap the button above
					any time you want to check in.
				</p>
				<p style="font-size:16px;color:#374151;margin:0;">
					See you soon,<br>
					<strong>${coordinatorName || displayOrg}</strong><br>
					<span style="color:#64748b;">${displayOrg}</span>
				</p>
				<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
				<p style="font-size:13px;color:#94a3b8;margin:0;">
					If the button doesn't work, copy and paste this address into your browser:<br>
					<span style="color:#2563a8;word-break:break-all;">${magicLink}</span>
				</p>
			</div>
		</body>
		</html>
	`;

	const text = `
Hi ${firstName},

${coordinatorName ? coordinatorName + ' from ' + displayOrg : displayOrg} has added you to their volunteer team on OnNuma Hub.

Your personal hub is ready — it's where you'll see your upcoming shifts and can let us know if you're available.

Visit My Hub:
${magicLink}

That's it! No passwords to remember. Just tap the link above any time you want to check in.

See you soon,
${coordinatorName || displayOrg}
${displayOrg}
	`.trim();

	try {
		const result = await rateLimitedSend(() =>
			sendEmail({
				from: fromEmail,
				to: [to],
				subject: `Welcome to ${displayOrg}'s volunteer team, ${firstName}!`,
				html,
				text
			})
		);
		return result;
	} catch (error) {
		console.error('[email] Failed to send volunteer welcome email:', error);
		throw error;
	}
}

/**
 * Send a personal thank-you message from a coordinator to a volunteer.
 * The message also appears on the volunteer's MyHub history page.
 * @param {string} [options.fromEmail] - Coordinator email; when set, signature shows first name as mailto link
 * @param {string} [options.fromFirstName] - Coordinator first name for link text (used when fromEmail is set)
 */
export async function sendThankyouEmail({ to, firstName, fromName, fromEmail, fromFirstName, message, orgName }, event) {
	const baseUrl = getBaseUrl(event);
	const fromEmailDefaultVal = fromEmailDefault();
	const branding = await getEmailBranding(event);

	const displayOrg = orgName || 'your coordinator';
	const myhubUrl = `${baseUrl}/myhub/history`;
	const subject = orgName ? `A personal note from ${orgName}` : 'A personal note for you';

	// Signature: show first name as clickable mailto when we have coordinator email; never show raw email as link text
	const linkText = fromFirstName
		? fromFirstName
		: (typeof fromName === 'string' && !fromName.includes('@') ? fromName.split(/\s+/)[0] : null) || 'Your coordinator';
	const signerDisplay = fromEmail
		? `<a href="mailto:${fromEmail.replace(/"/g, '&quot;')}" style="color:#92400e;text-decoration:underline;">${linkText}</a>`
		: (fromName || 'Your coordinator');

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto;padding:12px;background:#fafaf9;">
<div style="background:#fff;padding:32px 24px;border-radius:12px;border:1px solid #e5e7eb;">
${branding}

<p style="font-size:18px;margin:0 0 20px 0;color:#111827;">Hi ${firstName},</p>

<div style="background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%);border:1px solid #fde68a;border-radius:12px;padding:24px 28px;margin:0 0 24px 0;">
  <p style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#92400e;margin:0 0 12px 0;">A personal message for you</p>
  <p style="font-size:18px;color:#78350f;line-height:1.7;margin:0 0 16px 0;font-style:italic;">"${message}"</p>
  <p style="font-size:16px;font-weight:600;color:#92400e;margin:0;">— ${signerDisplay}</p>
</div>

<p style="font-size:16px;color:#374151;margin:0 0 24px 0;">
  This message has been saved on your volunteering history page, so you can look back at it any time.
</p>

<div style="text-align:center;margin:0 0 24px 0;">
  <a href="${myhubUrl}" style="display:inline-block;background:#2563a8;color:#fff;padding:14px 32px;text-decoration:none;border-radius:10px;font-size:17px;font-weight:700;">View my history</a>
</div>

<p style="font-size:16px;color:#374151;margin:0;">Thank you for everything you do,</p>
<p style="font-size:16px;color:#374151;margin:4px 0 0 0;">${displayOrg}</p>
</div>
</body>
</html>`;

	const textSigner = fromFirstName || (typeof fromName === 'string' && !fromName.includes('@') ? fromName.split(/\s+/)[0] : null) || fromName || 'Your coordinator';
	const text = `Hi ${firstName},

A personal message for you:

"${message}"

— ${textSigner}

This message has been saved on your volunteering history page.
View your history: ${myhubUrl}

Thank you for everything you do,
${displayOrg}`.trim();

	try {
		return await rateLimitedSend(() =>
			sendEmail({ from: fromEmailDefaultVal, to: [to], subject, html, text })
		);
	} catch (error) {
		console.error('[email] Failed to send thank-you email:', error);
		throw error;
	}
}

// ---------------------------------------------------------------------------
// Volunteer vetting emails
// ---------------------------------------------------------------------------

/**
 * Notify coordinator(s) that a new pending volunteer has expressed interest.
 * @param {{ email: string, firstName?: string }} coordinator
 * @param {{ firstName: string, lastName: string, email: string, phone?: string, rotaSlots: Array }} pendingVolunteer
 * @param {object} svelteKitEvent - SvelteKit event object (for base URL)
 */
export async function sendPendingVolunteerNotification(coordinator, pendingVolunteer, svelteKitEvent) {
	if (!coordinator?.email) return;
	const fromEmailDefaultVal = fromEmailDefault();
	if (!fromEmailDefaultVal) return;

	const baseUrl = getBaseUrl(svelteKitEvent);
	const branding = await getEmailBranding(svelteKitEvent);
	const { orgName } = await getOrgContactForEmail();
	const displayOrg = orgName || 'your organisation';

	const volunteersUrl = `${baseUrl}/hub/volunteers`;

	const name = [pendingVolunteer.firstName, pendingVolunteer.lastName].filter(Boolean).join(' ') || pendingVolunteer.email;
	const slotLines = (pendingVolunteer.rotaSlots || [])
		.map((s) => `<li style="padding: 4px 0;">${s.rotaRole} — ${s.eventTitle}${s.occurrenceDate ? ' (' + new Date(s.occurrenceDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ')' : ''}</li>`)
		.join('');

	const subject = `New volunteer interest: ${name}`;
	const html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
			${branding}
			<div style="padding: 0 24px 32px;">
				<h2 style="color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 16px;">New volunteer interest</h2>
				<p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
					<strong>${name}</strong> has expressed interest in volunteering for ${displayOrg}.
				</p>
				<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
					<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 100px;">Name</td><td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600;">${name}</td></tr>
					<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${pendingVolunteer.email}</td></tr>
					${pendingVolunteer.phone ? `<tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Phone</td><td style="padding: 8px 0; color: #111827; font-size: 14px;">${pendingVolunteer.phone}</td></tr>` : ''}
				</table>
				<p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 8px;">Requested slots:</p>
				<ul style="margin: 0 0 24px; padding-left: 20px; color: #374151; font-size: 14px; line-height: 1.6;">${slotLines}</ul>
				<a href="${volunteersUrl}" style="display: inline-block; background: #4A97D2; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 700;">Review in Hub →</a>
			</div>
		</div>`;

	try {
		await rateLimitedSend(() => sendEmail({ from: fromEmailDefaultVal, to: [coordinator.email], subject, html, text: `New volunteer interest: ${name}\n\nEmail: ${pendingVolunteer.email}\n${pendingVolunteer.phone ? 'Phone: ' + pendingVolunteer.phone + '\n' : ''}\nReview at: ${volunteersUrl}` }));
	} catch (err) {
		console.error('[email] Failed to send pending volunteer notification:', err?.message || err);
	}
}

/**
 * Send welcome email to an approved volunteer with their MyHUB magic link.
 * @param {{ firstName?: string, email: string }} contact
 * @param {string} magicLinkUrl
 * @param {object} svelteKitEvent
 */
export async function sendVolunteerApprovedEmail(contact, magicLinkUrl, svelteKitEvent) {
	if (!contact?.email) return;
	const fromEmailDefaultVal = fromEmailDefault();
	if (!fromEmailDefaultVal) return;

	const branding = await getEmailBranding(svelteKitEvent);
	const { orgName } = await getOrgContactForEmail();
	const displayOrg = orgName || 'the team';
	const firstName = contact.firstName || 'there';

	const subject = `Welcome to volunteering with ${displayOrg}`;
	const html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
			${branding}
			<div style="padding: 0 24px 32px;">
				<h2 style="color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 16px;">Welcome, ${firstName}!</h2>
				<p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
					We're delighted to confirm your place as a volunteer with ${displayOrg}. Your rotas have been updated and you can view everything through your personal MyHUB page.
				</p>
				<p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
					Click the button below to access your MyHUB — no password needed, just click the link.
				</p>
				<a href="${magicLinkUrl}" style="display: inline-block; background: #4BB170; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 700;">Go to my volunteering →</a>
				<p style="color: #9ca3af; font-size: 13px; margin: 24px 0 0;">This link is personal to you and expires in 7 days. Do not share it with others.</p>
			</div>
		</div>`;

	try {
		await rateLimitedSend(() => sendEmail({ from: fromEmailDefaultVal, to: [contact.email], subject, html, text: `Welcome to volunteering with ${displayOrg}!\n\nAccess your MyHUB here: ${magicLinkUrl}\n\nThis link is personal to you and expires in 7 days.` }));
	} catch (err) {
		console.error('[email] Failed to send volunteer approved email:', err?.message || err);
	}
}

/**
 * Send a kind decline email to a pending volunteer.
 * @param {{ firstName: string, email: string }} pendingVolunteer
 * @param {object} svelteKitEvent
 */
export async function sendVolunteerDeclinedEmail(pendingVolunteer, svelteKitEvent) {
	if (!pendingVolunteer?.email) return;
	const fromEmailDefaultVal = fromEmailDefault();
	if (!fromEmailDefaultVal) return;

	const branding = await getEmailBranding(svelteKitEvent);
	const { orgName, email: orgEmail } = await getOrgContactForEmail();
	const displayOrg = orgName || 'the team';
	const firstName = pendingVolunteer.firstName || 'there';

	const subject = `Your volunteering enquiry with ${displayOrg}`;
	const html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
			${branding}
			<div style="padding: 0 24px 32px;">
				<h2 style="color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 16px;">Thank you for your interest, ${firstName}</h2>
				<p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
					Thank you so much for expressing an interest in volunteering with ${displayOrg}. We really appreciate you getting in touch.
				</p>
				<p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
					Unfortunately, we're not able to offer you a place on this occasion. This may simply be because the slots you requested are now filled, or because we have all the volunteers we need for that time.
				</p>
				${orgEmail ? `<p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">If you'd like to discuss this further, please don't hesitate to get in touch at <a href="mailto:${orgEmail}" style="color: #4A97D2;">${orgEmail}</a>.</p>` : ''}
				<p style="color: #374151; font-size: 15px; line-height: 1.6; margin: 0;">Thank you again for wanting to help — we hope to see you involved in the future.</p>
			</div>
		</div>`;

	try {
		await rateLimitedSend(() => sendEmail({ from: fromEmailDefaultVal, to: [pendingVolunteer.email], subject, html, text: `Thank you for your interest, ${firstName}.\n\nUnfortunately we're not able to offer you a volunteering place on this occasion.\n\n${orgEmail ? 'Please get in touch at ' + orgEmail + ' if you have any questions.' : ''}\n\nThank you again for wanting to help.` }));
	} catch (err) {
		console.error('[email] Failed to send volunteer declined email:', err?.message || err);
	}
}
