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

	// Filter to public events only
	const publicEvents = events.filter(e => e.visibility === 'public');
	const publicEventIds = new Set(publicEvents.map(e => e.id));

	// Get upcoming occurrences for public events
	const upcoming = [];
	for (const occurrence of occurrences) {
		if (!publicEventIds.has(occurrence.eventId)) continue;

		const startDate = new Date(occurrence.startsAt);
		if (startDate >= now && startDate <= sevenDaysFromNow) {
			const eventData = publicEvents.find(e => e.id === occurrence.eventId);
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
 * Get upcoming rotas for a contact (within 7 days)
 * @param {string} contactId - Contact ID
 * @param {object} event - SvelteKit event object (for base URL)
 * @returns {Promise<Array>} Array of rota objects with event and occurrence data
 */
async function getUpcomingRotas(contactId, event) {
	const now = new Date();
	const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

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

		// Filter to upcoming occurrences (within 7 days)
		for (const occurrence of rotaOccurrences) {
			const startDate = new Date(occurrence.startsAt);
			if (startDate >= now && startDate <= sevenDaysFromNow) {
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
 * @returns {string} Personalised content
 */
export function personalizeContent(content, contact, upcomingRotas = [], upcomingEvents = [], event, isText = false) {
	if (!content) return '';

	const baseUrl = getBaseUrl(event);
	const contactData = contact || { email: '', firstName: '', lastName: '', phone: '' };
	
	// Replace contact placeholders with default values
	let personalized = content
		.replace(/\{\{firstName\}\}/g, contactData.firstName || 'all')
		.replace(/\{\{lastName\}\}/g, contactData.lastName || '')
		.replace(/\{\{name\}\}/g, `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim() || contactData.email || 'Church Member')
		.replace(/\{\{email\}\}/g, contactData.email || 'subscriber@egcc.co.uk')
		.replace(/\{\{phone\}\}/g, contactData.phone || '');

	// Replace rota links placeholder with actual rota links
	if (isText) {
		// Plain text version
		personalized = personalized.replace(/\{\{rotaLinks\}\}/g, () => {
			if (upcomingRotas.length === 0) {
				return 'You have no upcoming rotas in the next 7 days.';
			}

			let text = '';
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
			return text;
		});
		} else {
			// HTML version
			personalized = personalized.replace(/\{\{rotaLinks\}\}/g, () => {
				if (upcomingRotas.length === 0) {
					return '<p style="color: #666; font-size: 14px;">You have no upcoming rotas in the next 7 days.</p>';
				}

				let html = '';
				
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

					html += '<div style="margin-bottom: 15px; border-bottom: 1px solid #e5e7eb;">';
					html += `<p style="margin: 0 0 5px 0; color: #333; font-size: 16px; font-weight: 600;">${eventData.title} - ${rota.role}</p>`;
					html += `<p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">${dateStr}</p>`;
					if (signupUrl) {
						html += `<a href="${signupUrl}" style="display: inline-block; background: #4A97D2; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px; margin-top: 5px;">View Rota Details</a>`;
					}
					html += '</div>';
				}
			
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

				text += `\n- ${eventData.title}\n  ${dateStr}`;
				if (occurrence.location) {
					text += `\n  Location: ${occurrence.location}`;
				}
				if (eventData.description) {
					const desc = eventData.description.replace(/<[^>]*>/g, '').substring(0, 100);
					if (desc) {
						text += `\n  ${desc}${desc.length >= 100 ? '...' : ''}`;
					}
				}
				text += '\n';
			}
			return text;
		});
	} else {
		// HTML version
		personalized = personalized.replace(/\{\{upcomingEvents\}\}/g, () => {
			if (upcomingEvents.length === 0) {
				return '<p style="color: #666; font-size: 14px;">There are no upcoming events in the next 7 days.</p>';
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

				html += '<div style="margin-bottom: 15px;">';
				html += `<p style="margin: 0 0 5px 0; color: #333; font-size: 16px; font-weight: 600;">${eventData.title}</p>`;
				html += `<p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">${dateStr}</p>`;
				if (occurrence.location) {
					html += `<p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">📍 ${occurrence.location}</p>`;
				}
				if (eventData.description) {
					const desc = eventData.description.replace(/<[^>]*>/g, '').substring(0, 150);
					if (desc) {
						html += `<p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">${desc}${desc.length >= 150 ? '...' : ''}</p>`;
					}
				}
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
	const newsletter = await findById('newsletters', newsletterId);
	if (!newsletter) {
		throw new Error('Newsletter not found');
	}

	const baseUrl = getBaseUrl(event);
	const fromEmail = env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

	// Get upcoming events for personalisation
	const upcomingEvents = await getUpcomingEvents(event);
	
	// Get upcoming rotas for this contact
	const upcomingRotas = contact?.id ? await getUpcomingRotas(contact.id, event) : [];

	// Personalize content
	const contactData = contact || { email: to, firstName: name, lastName: '', phone: '' };
	const personalizedSubject = personalizeContent(newsletter.subject, contactData, upcomingRotas, upcomingEvents, event, false);
	let personalizedHtml = personalizeContent(newsletter.htmlContent, contactData, upcomingRotas, upcomingEvents, event, false);
	let personalizedText = personalizeContent(
		newsletter.textContent || newsletter.htmlContent.replace(/<[^>]*>/g, ''), 
		contactData, 
		upcomingRotas,
		upcomingEvents,
		event,
		true
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

	personalizedHtml += unsubscribeHtml;
	personalizedText += unsubscribeText;

	try {
		const result = await resend.emails.send({
			from: fromEmail,
			to: [to],
			subject: personalizedSubject,
			html: personalizedHtml,
			text: personalizedText
		});

		// Log the send
		const logs = newsletter.logs || [];
		logs.push({
			timestamp: new Date().toISOString(),
			email: to,
			status: 'sent',
			messageId: result.data?.id || null
		});

		await update('newsletters', newsletterId, { logs });

		return result;
	} catch (error) {
		// Log the error
		const logs = newsletter.logs || [];
		logs.push({
			timestamp: new Date().toISOString(),
			email: to,
			status: 'error',
			error: error.message
		});

		await update('newsletters', newsletterId, { logs });

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
			<div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 30px 0; border-left: 4px solid #2d7a32;">
				<h3 style="margin: 0 0 15px 0; color: #333; font-size: 18px;">Your Other Upcoming Rotas (Next 7 Days)</h3>
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
				<div style="border-bottom: 1px solid #e5e7eb; padding: 10px 0; margin-bottom: 10px;">
					<p style="margin: 0 0 5px 0; color: #333; font-size: 15px; font-weight: 600;">${item.event.title} - ${item.rota.role}</p>
					<p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">${dateStr}</p>
					${item.occurrence.location ? `<p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">📍 ${item.occurrence.location}</p>` : ''}
					${item.signupUrl ? `<a href="${item.signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 6px 15px; text-decoration: none; border-radius: 5px; font-size: 13px;">View Rota</a>` : ''}
				</div>
			`;
		}
		upcomingRotasHtml += '</div>';
	}

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Volunteer Rota Invitation</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
				<h1 style="color: white; margin: 0; font-size: 24px;">Volunteer Rota Invitation</h1>
			</div>
			
			<div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
				<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">
					You've been invited to volunteer for <strong>${eventTitle}</strong> as a <strong>${role}</strong>.
				</p>

				${occurrence ? `
				<div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
					<p style="margin: 0; color: #666; font-size: 14px;"><strong>Date & Time:</strong></p>
					<p style="margin: 5px 0 0 0; color: #333; font-size: 16px;">${occurrenceDate}</p>
					${occurrence.location ? `
					<p style="margin: 15px 0 0 0; color: #666; font-size: 14px;"><strong>Location:</strong></p>
					<p style="margin: 5px 0 0 0; color: #333; font-size: 16px;">${occurrence.location}</p>
					` : ''}
				</div>
				` : ''}

				<div style="text-align: center; margin: 30px 0;">
					<a href="${signupUrl}" style="display: inline-block; background: #2d7a32; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
				</div>

				<p style="color: #666; font-size: 14px; margin: 20px 0 0 0;">
					Or copy and paste this link into your browser:<br>
					<a href="${signupUrl}" style="color: #2d7a32; word-break: break-all;">${signupUrl}</a>
				</p>

				${upcomingRotasHtml}
			</div>
		</body>
		</html>
	`;

	let upcomingRotasText = '';
	if (otherUpcomingRotas.length > 0) {
		upcomingRotasText = '\n\nYour Other Upcoming Rotas (Next 7 Days):\n';
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
 * Send bulk rota invitations
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

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Welcome to TheHUB - Eltham Green Community Church</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
			<div style="background: linear-gradient(135deg, #4A97D2 0%, #3a7ab8 100%); padding: 40px 30px; border-radius: 10px 10px 0 0; text-align: center;">
				<h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Welcome to TheHUB</h1>
				<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Eltham Green Community Church</p>
			</div>
			
			<div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
				<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">Your admin account has been created for TheHUB, the church management system for Eltham Green Community Church.</p>

				<div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4BB170;">
					<h2 style="color: #4BB170; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Your Login Credentials</h2>
					<table style="width: 100%; border-collapse: collapse;">
						<tr>
							<td style="padding: 8px 0; font-weight: 600; color: #666; width: 100px;">Email:</td>
							<td style="padding: 8px 0; color: #333;">${email}</td>
						</tr>
						${password ? `
						<tr>
							<td style="padding: 8px 0; font-weight: 600; color: #666;">Password:</td>
							<td style="padding: 8px 0; color: #333; font-family: monospace;">${password}</td>
						</tr>
						` : ''}
					</table>
					${password ? `
					<p style="color: #A62524; font-size: 14px; margin: 15px 0 0 0; font-weight: 600;">⚠️ Please change your password after your first login for security.</p>
					` : ''}
				</div>

				<div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4A97D2;">
					<h2 style="color: #4A97D2; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Verify Your Email Address</h2>
					<p style="color: #333; font-size: 14px; margin: 0 0 20px 0;">Please verify your email address to complete your account setup. This link will expire in 7 days.</p>
					<a href="${verificationLink}" style="display: inline-block; background: #4A97D2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: 600; margin: 10px 0;">Verify Email Address</a>
					<p style="color: #666; font-size: 12px; margin: 15px 0 0 0;">Or copy and paste this link into your browser:</p>
					<p style="color: #4A97D2; font-size: 12px; margin: 5px 0 0 0; word-break: break-all;">${verificationLink}</p>
				</div>

				<div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #e5e7eb;">
					<h2 style="color: #333; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Getting Started</h2>
					<p style="color: #333; font-size: 14px; margin: 0 0 15px 0;">Once your email is verified, you can access TheHUB at:</p>
					<a href="${hubLoginLink}" style="display: inline-block; background: #4BB170; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: 600; margin: 10px 0;">Login to TheHUB</a>
					<p style="color: #666; font-size: 12px; margin: 15px 0 0 0; word-break: break-all;">${hubLoginLink}</p>
				</div>

				<div style="background: #fffbf0; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #E6A324;">
					<h2 style="color: #E6A324; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Security Reminders</h2>
					<ul style="color: #333; font-size: 14px; margin: 0; padding-left: 20px;">
						<li style="margin: 8px 0;">Keep your login credentials secure and never share them</li>
						<li style="margin: 8px 0;">Use a strong, unique password</li>
						<li style="margin: 8px 0;">Log out when you're finished using TheHUB</li>
						<li style="margin: 8px 0;">Contact the system administrator if you notice any suspicious activity</li>
					</ul>
				</div>

				<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
					<p style="margin: 0;">If you have any questions or need assistance, please contact the system administrator.</p>
					<p style="margin: 10px 0 0 0;">
						<a href="${baseUrl}" style="color: #4A97D2; text-decoration: none;">Visit Eltham Green Community Church Website</a>
					</p>
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

Verify Your Email Address:
Please verify your email address to complete your account setup. This link will expire in 7 days.

${verificationLink}

Getting Started:
Once your email is verified, you can access TheHUB at:

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

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Reset Your Password - TheHUB</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
			<div style="background: linear-gradient(135deg, #4A97D2 0%, #3a7ab8 100%); padding: 40px 30px; border-radius: 10px 10px 0 0; text-align: center;">
				<h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Reset Your Password</h1>
				<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">TheHUB - Eltham Green Community Church</p>
			</div>
			
			<div style="background: #ffffff; padding: 40px 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
				<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">Hello ${name},</p>
				
				<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">We received a request to reset your password for your TheHUB admin account.</p>

				<div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #4A97D2;">
					<p style="color: #333; font-size: 14px; margin: 0 0 20px 0;">Click the button below to reset your password. This link will expire in 24 hours.</p>
					<a href="${resetLink}" style="display: inline-block; background: #4A97D2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: 600; margin: 10px 0;">Reset Password</a>
					<p style="color: #666; font-size: 12px; margin: 15px 0 0 0;">Or copy and paste this link into your browser:</p>
					<p style="color: #4A97D2; font-size: 12px; margin: 5px 0 0 0; word-break: break-all;">${resetLink}</p>
				</div>

				<div style="background: #fffbf0; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #E6A324;">
					<h2 style="color: #E6A324; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Security Notice</h2>
					<ul style="color: #333; font-size: 14px; margin: 0; padding-left: 20px;">
						<li style="margin: 8px 0;">If you didn't request this password reset, please ignore this email</li>
						<li style="margin: 8px 0;">Your password will not be changed until you click the link above</li>
						<li style="margin: 8px 0;">This link expires in 24 hours for security</li>
						<li style="margin: 8px 0;">For security, all active sessions will be logged out after password reset</li>
					</ul>
				</div>

				<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
					<p style="margin: 0;">If you have any questions or need assistance, please contact the system administrator.</p>
					<p style="margin: 10px 0 0 0;">
						<a href="${baseUrl}" style="color: #4A97D2; text-decoration: none;">Visit Eltham Green Community Church Website</a>
					</p>
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

	const html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Event Signup Confirmation</title>
		</head>
		<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
			<div style="background: linear-gradient(135deg, #2d7a32 0%, #1e5a22 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
				<h1 style="color: white; margin: 0; font-size: 24px;">Event Signup Confirmed!</h1>
			</div>
			
			<div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
				<div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
					<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">
						Hi ${name},
					</p>
					<p style="color: #333; font-size: 16px; margin: 0 0 20px 0;">
						Thank you for signing up for <strong>${event.title}</strong>!
					</p>
					
					<div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
						<h2 style="color: #2d7a32; margin-top: 0; font-size: 18px; border-bottom: 2px solid #2d7a32; padding-bottom: 10px;">Event Details</h2>
						<table style="width: 100%; border-collapse: collapse;">
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666; width: 120px;">Date:</td>
								<td style="padding: 8px 0; color: #333;">${eventDate}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666;">Time:</td>
								<td style="padding: 8px 0; color: #333;">${eventTime}</td>
							</tr>
							${occurrence.location ? `
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666;">Location:</td>
								<td style="padding: 8px 0; color: #333;">${occurrence.location}</td>
							</tr>
							` : ''}
							<tr>
								<td style="padding: 8px 0; font-weight: 600; color: #666;">Attendees:</td>
								<td style="padding: 8px 0; color: #333;">
									${totalAttendees === 1 
										? 'Just you' 
										: `You + ${guestCount} ${guestCount === 1 ? 'guest' : 'guests'} (${totalAttendees} total)`}
								</td>
							</tr>
						</table>
					</div>
					
					<p style="color: #666; font-size: 14px; margin: 20px 0 0 0;">
						We look forward to seeing you there!
					</p>
				</div>
				
				<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #666; font-size: 12px;">
					<p style="margin: 0;">Eltham Green Community Church</p>
					<p style="margin: 5px 0 0 0;">542 Westhorne Avenue, Eltham, London, SE9 6RR</p>
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

