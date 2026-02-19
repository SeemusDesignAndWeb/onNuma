/**
 * Marketing module – server-side utilities for onboarding email templates,
 * sequences, placeholder rendering, and the send engine.
 */

import { randomUUID } from 'crypto';
import { readCollection, findById, create, update, findMany, remove } from './fileStore.js';
import { rateLimitedSend } from './emailRateLimiter.js';
import { sendEmail } from '$lib/server/mailgun.js';
import { env } from '$env/dynamic/private';
import { ensureUnsubscribeToken } from './tokens.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** First-class supported placeholders */
export const SUPPORTED_PLACEHOLDERS = [
	{ key: 'first_name', description: 'Contact first name' },
	{ key: 'last_name', description: 'Contact last name' },
	{ key: 'full_name', description: 'Contact full name' },
	{ key: 'firstName', description: 'Contact first name (legacy alias)' },
	{ key: 'lastName', description: 'Contact last name (legacy alias)' },
	{ key: 'name', description: 'Contact full name (legacy alias)' },
	{ key: 'email', description: 'Contact email (legacy alias)' },
	{ key: 'phone', description: 'Contact phone (legacy alias)' },
	{ key: 'org_name', description: 'Organisation name' },
	{ key: 'org_logo_url', description: 'Organisation logo URL' },
	{ key: 'login_url', description: 'Hub login URL' },
	{ key: 'rota_url', description: 'Rotas page URL' },
	{ key: 'events_url', description: 'Events page URL' },
	{ key: 'profile_url', description: 'User profile URL' },
	{ key: 'support_email', description: 'Support email address' },
	{ key: 'support_url', description: 'Support / help URL' },
	{ key: 'unsubscribe_url', description: 'Unsubscribe link (non-essential)' }
];

export const SUPPORTED_PLACEHOLDER_KEYS = SUPPORTED_PLACEHOLDERS.map((p) => p.key);

/** Delay unit multipliers in milliseconds */
const DELAY_UNITS = {
	minutes: 60 * 1000,
	hours: 60 * 60 * 1000,
	days: 24 * 60 * 60 * 1000,
	weeks: 7 * 24 * 60 * 60 * 1000
};

/**
 * Base URL for an organisation: use org's hub domain when set so links and images point to the correct domain.
 * @param {object} org - Organisation { hubDomain? }
 * @param {string} fallbackBaseUrl - URL to use when org has no hubDomain
 * @returns {string}
 */
function getOrgBaseUrl(org, fallbackBaseUrl) {
	const domain = org?.hubDomain && String(org.hubDomain).trim();
	if (!domain) return fallbackBaseUrl;
	const host = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
	return `https://${host}`;
}

// ---------------------------------------------------------------------------
// Placeholder helpers
// ---------------------------------------------------------------------------

/**
 * Detect all {{placeholder}} tokens in a string.
 * Also detects {{link:key}} references.
 * @param {string} text
 * @returns {string[]} list of placeholder keys found
 */
export function detectPlaceholders(text) {
	if (!text) return [];
	const re = /\{\{([a-zA-Z0-9_:]+)\}\}/g;
	const found = new Set();
	let m;
	while ((m = re.exec(text)) !== null) {
		found.add(m[1]);
	}
	return [...found];
}

/**
 * Validate placeholders – returns warnings for unknown ones.
 * @param {string[]} placeholders
 * @returns {{ unknown: string[], linkKeys: string[] }}
 */
export function validatePlaceholders(placeholders) {
	const unknown = [];
	const linkKeys = [];
	const blockKeys = [];
	for (const p of placeholders) {
		if (p.startsWith('link:')) {
			linkKeys.push(p.replace('link:', ''));
		} else if (p.startsWith('block:')) {
			blockKeys.push(p.replace('block:', ''));
		} else if (!SUPPORTED_PLACEHOLDER_KEYS.includes(p)) {
			unknown.push(p);
		}
	}
	return { unknown, linkKeys, blockKeys };
}

/**
 * Build placeholder data map for a given contact + org.
 * @param {object} contact
 * @param {object} org
 * @param {string} baseUrl
 * @param {object} [links] – resolved link values { key: url }
 * @returns {Record<string, string>}
 */
export function buildPlaceholderData(contact, org, baseUrl, links = {}) {
	const c = contact || {};
	const o = org || {};
	const firstName = c.firstName || '';
	const lastName = c.lastName || '';
	const fullName = `${firstName} ${lastName}`.trim() || c.email || '';

	const data = {
		first_name: firstName,
		last_name: lastName,
		full_name: fullName,
		// Legacy aliases used in Hub newsletter templates.
		firstName,
		lastName,
		name: fullName,
		email: c.email || '',
		phone: c.phone || '',
		org_name: o.name || '',
		org_logo_url: o.logoUrl || `${baseUrl}/assets/onnuma-logo.png`,
		login_url: `${baseUrl}/hub/auth/login`,
		rota_url: `${baseUrl}/hub/schedules`,
		events_url: `${baseUrl}/hub/events`,
		profile_url: `${baseUrl}/hub/profile`,
		support_email: o.supportEmail || env.MAILGUN_FROM_EMAIL || '',
		support_url: o.supportUrl || baseUrl,
		unsubscribe_url: '' // filled per-send if token available
	};

	// Add link: references
	for (const [key, url] of Object.entries(links)) {
		data[`link:${key}`] = url;
	}

	return data;
}

/**
 * Replace all {{placeholder}} tokens in text with values from a data map.
 * @param {string} text
 * @param {Record<string, string>} data
 * @returns {string}
 */
export function renderTemplate(text, data) {
	if (!text) return '';
	return text.replace(/\{\{([a-zA-Z0-9_:]+)\}\}/g, (match, key) => {
		return data[key] !== undefined ? data[key] : match;
	});
}

// ---------------------------------------------------------------------------
// Links library helpers
// ---------------------------------------------------------------------------

/**
 * Resolve all link values for a given org (merges global + org-specific).
 * @param {string|null} organisationId
 * @returns {Promise<Record<string, string>>}
 */
export async function resolveLinks(organisationId) {
	const allLinks = await readCollection('marketing_links');
	const result = {};
	// Global links first
	for (const link of allLinks.filter((l) => l.scope === 'global' && l.status === 'active')) {
		result[link.key] = link.url;
	}
	// Org-specific overrides
	if (organisationId) {
		for (const link of allLinks.filter(
			(l) => l.scope === 'org' && l.organisationId === organisationId && l.status === 'active'
		)) {
			result[link.key] = link.url;
		}
	}
	return result;
}

// ---------------------------------------------------------------------------
// Content blocks helpers
// ---------------------------------------------------------------------------

/**
 * Insert content blocks referenced by {{block:key}} into template HTML/text.
 * @param {string} text
 * @param {boolean} isHtml – if true use body_html, otherwise body_text
 * @returns {Promise<string>}
 */
export async function insertContentBlocks(text, isHtml = true) {
	if (!text) return '';
	const blockRe = /\{\{block:([a-zA-Z0-9_-]+)\}\}/g;
	const matches = [...text.matchAll(blockRe)];
	if (matches.length === 0) return text;

	const blocks = await readCollection('marketing_content_blocks');
	let result = text;
	for (const m of matches) {
		const blockKey = m[1];
		const block = blocks.find((b) => (b.key === blockKey || b.id === blockKey) && b.status === 'active');
		const replacement = block ? (isHtml ? block.body_html || '' : block.body_text || '') : '';
		result = result.replace(m[0], replacement);
	}
	return result;
}

// ---------------------------------------------------------------------------
// Template CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Create a new marketing email template.
 */
export async function createEmailTemplate(data) {
	const now = new Date().toISOString();
	const id = randomUUID();
	const template = {
		id,
		name: data.name || 'Untitled template',
		internal_notes: data.internal_notes || '',
		subject: data.subject || '',
		preview_text: data.preview_text || '',
		body_html: data.body_html || '',
		body_text: data.body_text || '',
		placeholders: detectPlaceholders(`${data.subject || ''} ${data.body_html || ''} ${data.body_text || ''}`),
		status: 'draft',
		tags: Array.isArray(data.tags) ? data.tags : [],
		created_at: now,
		updated_at: now,
		created_by: data.created_by || null
	};
	await create('marketing_email_templates', template);

	// Store initial version
	await createTemplateVersion(template, data.created_by, 'Created');

	return template;
}

/**
 * Duplicate an existing template.
 */
export async function duplicateEmailTemplate(templateId, adminId) {
	const original = await findById('marketing_email_templates', templateId);
	if (!original) throw new Error('Template not found');

	const now = new Date().toISOString();
	const id = randomUUID();
	const copy = {
		...original,
		id,
		name: `${original.name} (copy)`,
		status: 'draft',
		created_at: now,
		updated_at: now,
		created_by: adminId || original.created_by
	};
	await create('marketing_email_templates', copy);
	await createTemplateVersion(copy, adminId, 'Duplicated from ' + original.name);
	return copy;
}

/**
 * Create a new reusable mailshot.
 */
export async function createMailshot(data) {
	const now = new Date().toISOString();
	const id = randomUUID();
	const mailshot = {
		id,
		name: data.name || 'Untitled mailshot',
		internal_notes: data.internal_notes || '',
		subject: data.subject || '',
		preview_text: data.preview_text || '',
		body_html: data.body_html || '',
		body_text: data.body_text || '',
		placeholders: detectPlaceholders(`${data.subject || ''} ${data.body_html || ''} ${data.body_text || ''}`),
		status: 'draft',
		tags: Array.isArray(data.tags) ? data.tags : [],
		created_at: now,
		updated_at: now,
		created_by: data.created_by || null,
		last_sent_at: null,
		send_count: 0
	};
	await create('marketing_mailshots', mailshot);
	return mailshot;
}

/**
 * Duplicate an existing reusable mailshot.
 */
export async function duplicateMailshot(mailshotId, adminId) {
	const original = await findById('marketing_mailshots', mailshotId);
	if (!original) throw new Error('Mailshot not found');

	const now = new Date().toISOString();
	const id = randomUUID();
	const copy = {
		...original,
		id,
		name: `${original.name} (copy)`,
		status: 'draft',
		created_at: now,
		updated_at: now,
		created_by: adminId || original.created_by,
		last_sent_at: null,
		send_count: 0
	};
	await create('marketing_mailshots', copy);
	return copy;
}

/**
 * Store a version snapshot for a template.
 */
async function createTemplateVersion(template, updatedBy, changeSummary) {
	const version = {
		id: randomUUID(),
		template_id: template.id,
		snapshot: {
			name: template.name,
			subject: template.subject,
			preview_text: template.preview_text,
			body_html: template.body_html,
			body_text: template.body_text,
			tags: template.tags
		},
		updated_at: new Date().toISOString(),
		updated_by: updatedBy || null,
		change_summary: changeSummary || ''
	};
	await create('marketing_template_versions', version);
	return version;
}

export { createTemplateVersion };

// ---------------------------------------------------------------------------
// Sequence CRUD helpers
// ---------------------------------------------------------------------------

/**
 * Create a new sequence.
 */
export async function createSequence(data) {
	const now = new Date().toISOString();
	const id = randomUUID();
	const seq = {
		id,
		name: data.name || 'Untitled sequence',
		description: data.description || '',
		status: 'draft',
		applies_to: data.applies_to || 'default',
		organisation_id: data.organisation_id || null,
		org_group: data.org_group || null,
		created_at: now,
		updated_at: now,
		created_by: data.created_by || null
	};
	await create('marketing_sequences', seq);
	return seq;
}

/**
 * Add a step to a sequence.
 */
export async function addSequenceStep(data) {
	const now = new Date().toISOString();
	const id = randomUUID();

	// Get current max order
	const existing = await findMany('marketing_sequence_steps', (s) => s.sequence_id === data.sequence_id);
	const maxOrder = existing.reduce((max, s) => Math.max(max, s.order || 0), 0);

	const step = {
		id,
		sequence_id: data.sequence_id,
		email_template_id: data.email_template_id || null,
		order: data.order ?? maxOrder + 1,
		delay_value: data.delay_value ?? 0,
		delay_unit: data.delay_unit || 'days',
		conditions: data.conditions || [],
		created_at: now,
		updated_at: now
	};
	await create('marketing_sequence_steps', step);
	return step;
}

/**
 * Duplicate a full sequence (with all steps).
 */
export async function duplicateSequence(sequenceId, adminId) {
	const original = await findById('marketing_sequences', sequenceId);
	if (!original) throw new Error('Sequence not found');

	const now = new Date().toISOString();
	const newId = randomUUID();
	const copy = {
		...original,
		id: newId,
		name: `${original.name} (copy)`,
		status: 'draft',
		created_at: now,
		updated_at: now,
		created_by: adminId || original.created_by
	};
	await create('marketing_sequences', copy);

	// Duplicate steps
	const steps = await findMany('marketing_sequence_steps', (s) => s.sequence_id === sequenceId);
	for (const step of steps) {
		await create('marketing_sequence_steps', {
			...step,
			id: randomUUID(),
			sequence_id: newId,
			created_at: now,
			updated_at: now
		});
	}

	return copy;
}

// ---------------------------------------------------------------------------
// Send engine
// ---------------------------------------------------------------------------

/**
 * Compute the absolute send time for a step given the user's join timestamp.
 * @param {{ delay_value: number, delay_unit: string }} step
 * @param {Date|string} joinedAt
 * @param {string} [timezone] – IANA timezone for org (default UTC)
 * @param {number} [preferredHour] – preferred send hour in org tz (default 9)
 * @returns {Date}
 */
export function computeSendTime(step, joinedAt, timezone = 'UTC', preferredHour = 9) {
	const joinDate = new Date(joinedAt);
	const delayMs = (step.delay_value || 0) * (DELAY_UNITS[step.delay_unit] || DELAY_UNITS.days);
	const raw = new Date(joinDate.getTime() + delayMs);

	// For delays of days or weeks, pin to preferred hour in org timezone
	if (step.delay_unit === 'days' || step.delay_unit === 'weeks') {
		try {
			const formatter = new Intl.DateTimeFormat('en-US', {
				timeZone: timezone,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false
			});
			const parts = formatter.formatToParts(raw);
			const get = (type) => parts.find((p) => p.type === type)?.value || '00';
			const localDateStr = `${get('year')}-${get('month')}-${get('day')}T${String(preferredHour).padStart(2, '0')}:00:00`;
			// Re-interpret in that timezone
			const targetDate = new Date(localDateStr + 'Z');
			// Adjust for timezone offset
			const offset = raw.getTime() - new Date(
				`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}Z`
			).getTime();
			return new Date(targetDate.getTime() + offset);
		} catch {
			return raw;
		}
	}

	return raw;
}

/**
 * Evaluate whether a step's conditions are met for a user.
 * @param {object} step
 * @param {object} contact
 * @returns {Promise<boolean>}
 */
export async function evaluateStepConditions(step, contact) {
	if (!step.conditions || step.conditions.length === 0) return true;

	for (const cond of step.conditions) {
		switch (cond.type) {
			case 'not_completed_onboarding_step': {
				// Placeholder: check contact.onboardingSteps for completion
				const completed = contact.onboardingSteps || [];
				if (completed.includes(cond.value)) return false;
				break;
			}
			case 'not_joined_rota': {
				const rotas = await readCollection('rotas');
				const hasRota = rotas.some(
					(r) =>
						r.assignees &&
						r.assignees.some((a) => {
							const cid = typeof a === 'string' ? a : a.contactId || a.id;
							return cid === contact.id;
						})
				);
				if (hasRota) return false;
				break;
			}
			case 'not_logged_in_since_joining': {
				// Check lastLoginAt vs joinedAt
				if (contact.lastLoginAt && contact.joinedAt) {
					if (new Date(contact.lastLoginAt) > new Date(contact.joinedAt)) return false;
				}
				break;
			}
		}
	}
	return true;
}

/**
 * Build the idempotency key for a send.
 */
export function buildIdempotencyKey(userId, sequenceStepId) {
	return `mkt_${userId}_${sequenceStepId}`;
}

/**
 * Enqueue a marketing email for sending (idempotent).
 * @returns {Promise<object|null>} the queue entry or null if already queued
 */
export async function enqueueEmail({ userId, sequenceId, sequenceStepId, templateId, organisationId, sendAt }) {
	const idempotencyKey = buildIdempotencyKey(userId, sequenceStepId);

	// Check if already queued or sent
	const existing = await findMany('marketing_send_queue', (q) => q.idempotency_key === idempotencyKey);
	if (existing.length > 0) return null;

	const entry = {
		id: randomUUID(),
		idempotency_key: idempotencyKey,
		user_id: userId,
		sequence_id: sequenceId,
		sequence_step_id: sequenceStepId,
		template_id: templateId,
		organisation_id: organisationId,
		send_at: sendAt instanceof Date ? sendAt.toISOString() : sendAt,
		status: 'pending', // pending | sending | sent | failed | cancelled
		attempts: 0,
		max_attempts: 5,
		last_attempt_at: null,
		error: null,
		message_id: null,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString()
	};
	await create('marketing_send_queue', entry);
	return entry;
}

/**
 * Process the send queue – find due entries and send them.
 * Called by the cron endpoint.
 * @param {string} baseUrl
 * @returns {Promise<{ processed: number, sent: number, failed: number, skipped: number, errors: string[] }>}
 */
export async function processSendQueue(baseUrl) {
	const now = new Date();
	const results = { processed: 0, sent: 0, failed: 0, skipped: 0, errors: [] };

	const queue = await readCollection('marketing_send_queue');
	const pending = queue.filter(
		(q) =>
			q.status === 'pending' &&
			new Date(q.send_at) <= now &&
			q.attempts < (q.max_attempts || 5)
	);

	// Rate limit: process max 50 per run per org
	const orgCounts = {};

	for (const entry of pending) {
		const orgId = entry.organisation_id || '_global';
		orgCounts[orgId] = (orgCounts[orgId] || 0) + 1;
		if (orgCounts[orgId] > 50) {
			results.skipped++;
			continue;
		}

		results.processed++;

		try {
			// Mark as sending
			await update('marketing_send_queue', entry.id, {
				status: 'sending',
				attempts: (entry.attempts || 0) + 1,
				last_attempt_at: now.toISOString(),
				updated_at: now.toISOString()
			});

			// Load template
			const template = await findById('marketing_email_templates', entry.template_id);
			if (!template || template.status !== 'active') {
				await update('marketing_send_queue', entry.id, {
					status: 'failed',
					error: 'Template not found or not active',
					updated_at: now.toISOString()
				});
				results.failed++;
				results.errors.push(`Entry ${entry.id}: template missing/inactive`);
				continue;
			}

			// Load contact
			const contact = await findById('contacts', entry.user_id);
			if (!contact || !contact.email) {
				await update('marketing_send_queue', entry.id, {
					status: 'failed',
					error: 'Contact not found or no email',
					updated_at: now.toISOString()
				});
				results.failed++;
				results.errors.push(`Entry ${entry.id}: contact missing`);
				continue;
			}

			// Check opt-out preferences
			const prefs = await findMany(
				'marketing_user_preferences',
				(p) => p.user_id === contact.id
			);
			const userPref = prefs[0];
			if (userPref && userPref.opted_out_non_essential && template.tags?.includes('non-essential')) {
				await update('marketing_send_queue', entry.id, {
					status: 'cancelled',
					error: 'User opted out of non-essential emails',
					updated_at: now.toISOString()
				});
				results.skipped++;
				continue;
			}

			// Check step conditions
			const step = await findById('marketing_sequence_steps', entry.sequence_step_id);
			if (step) {
				const conditionsMet = await evaluateStepConditions(step, contact);
				if (!conditionsMet) {
					await update('marketing_send_queue', entry.id, {
						status: 'cancelled',
						error: 'Step conditions not met',
						updated_at: now.toISOString()
					});
					results.skipped++;
					continue;
				}
			}

			// Load org + links
			const org = entry.organisation_id
				? await findById('organisations', entry.organisation_id)
				: {};
			const links = await resolveLinks(entry.organisation_id);

			// Use org's hub domain when set so links and logo point to the correct domain/subdomain
			const entryBaseUrl = getOrgBaseUrl(org, baseUrl);

			// Resolve branding
			const branding = await getOrgBranding(entry.organisation_id);

			// Build data and render (login_url, org_logo_url, etc. use entryBaseUrl)
			const data = buildPlaceholderData(contact, org, entryBaseUrl, links);
			// Unsubscribe link (token-based).
			const unsubscribeToken = await ensureUnsubscribeToken(contact.id, contact.email);
			data.unsubscribe_url = unsubscribeToken?.token
				? `${entryBaseUrl}/marketing/unsubscribe?token=${encodeURIComponent(unsubscribeToken.token)}`
				: `${entryBaseUrl}/marketing/unsubscribe`;

			let bodyHtml = await insertContentBlocks(template.body_html, true);
			let bodyText = await insertContentBlocks(template.body_text || template.body_html?.replace(/<[^>]*>/g, ''), false);
			bodyHtml = renderTemplate(bodyHtml, data);
			bodyText = renderTemplate(bodyText, data);
			const subject = renderTemplate(template.subject, data);
			const previewText = renderTemplate(template.preview_text || '', data);

			const fromEmail = branding.sender_email || env.MAILGUN_FROM_EMAIL || (env.MAILGUN_DOMAIN ? `noreply@${env.MAILGUN_DOMAIN}` : 'noreply@onnuma.com');
			const fromName = branding.sender_name || org.name || 'OnNuma';

			// Send (layout logo and footer link use entryBaseUrl)
			const result = await rateLimitedSend(() =>
				sendEmail({
					from: `${fromName} <${fromEmail}>`,
					to: [contact.email],
					subject,
					html: wrapInEmailLayout(bodyHtml, previewText, branding, entryBaseUrl, data.unsubscribe_url),
					text: appendUnsubscribeToText(bodyText, data.unsubscribe_url)
				})
			);

			const messageId = result?.data?.id ?? null;

			// Mark sent
			await update('marketing_send_queue', entry.id, {
				status: 'sent',
				message_id: messageId,
				error: null,
				updated_at: new Date().toISOString()
			});

			// Log
			await create('marketing_send_logs', {
				id: randomUUID(),
				queue_entry_id: entry.id,
				user_id: entry.user_id,
				template_id: entry.template_id,
				sequence_id: entry.sequence_id,
				sequence_step_id: entry.sequence_step_id,
				organisation_id: entry.organisation_id,
				status: 'sent',
				message_id: messageId,
				email: contact.email,
				sent_at: new Date().toISOString(),
				error: null
			});

			results.sent++;
		} catch (error) {
			// Exponential backoff: reschedule
			const attempt = (entry.attempts || 0) + 1;
			const backoffMs = Math.min(attempt * attempt * 60000, 3600000); // max 1hr
			const retryAt = new Date(Date.now() + backoffMs);

			await update('marketing_send_queue', entry.id, {
				status: attempt >= (entry.max_attempts || 5) ? 'failed' : 'pending',
				error: error.message || 'Unknown error',
				send_at: retryAt.toISOString(),
				updated_at: new Date().toISOString()
			});

			// Log failure
			await create('marketing_send_logs', {
				id: randomUUID(),
				queue_entry_id: entry.id,
				user_id: entry.user_id,
				template_id: entry.template_id,
				sequence_id: entry.sequence_id,
				sequence_step_id: entry.sequence_step_id,
				organisation_id: entry.organisation_id,
				status: 'failed',
				message_id: null,
				email: '',
				sent_at: new Date().toISOString(),
				error: error.message || 'Unknown error'
			});

			results.failed++;
			results.errors.push(`Entry ${entry.id}: ${error.message}`);
		}
	}

	return results;
}

/**
 * Evaluate sequences for all orgs – find users who should receive emails
 * and enqueue them. Called by the cron endpoint before processSendQueue.
 * @param {string} baseUrl
 * @returns {Promise<{ enqueued: number, orgsProcessed: number }>}
 */
export async function evaluateSequences(baseUrl) {
	let enqueued = 0;
	let orgsProcessed = 0;

	const orgs = await readCollection('organisations');
	const sequences = await readCollection('marketing_sequences');
	const allSteps = await readCollection('marketing_sequence_steps');

	for (const org of orgs) {
		if (!org || org.archivedAt) continue;

		// Check if org has onboarding enabled and a sequence assigned
		const onboarding = org.onboardingEmails || {};
		if (!onboarding.enabled || !onboarding.sequence_id) continue;

		orgsProcessed++;

		const seq = sequences.find((s) => s.id === onboarding.sequence_id && s.status === 'active');
		if (!seq) continue;

		const steps = allSteps
			.filter((s) => s.sequence_id === seq.id)
			.sort((a, b) => (a.order || 0) - (b.order || 0));

		if (steps.length === 0) continue;

		// Find contacts who joined this org
		const contacts = await readCollection('contacts', { organisationId: org.id });
		const timezone = onboarding.timezone || org.timezone || 'UTC';
		const preferredHour = onboarding.send_hour ?? 9;

		for (const contact of contacts) {
			if (!contact || !contact.email || !contact.joinedAt) continue;

			// Enqueue each step
			for (const step of steps) {
				const sendAt = computeSendTime(step, contact.joinedAt, timezone, preferredHour);
				const result = await enqueueEmail({
					userId: contact.id,
					sequenceId: seq.id,
					sequenceStepId: step.id,
					templateId: step.email_template_id,
					organisationId: org.id,
					sendAt
				});
				if (result) enqueued++;
			}
		}
	}

	return { enqueued, orgsProcessed };
}

// ---------------------------------------------------------------------------
// Org branding
// ---------------------------------------------------------------------------

/**
 * Get branding defaults for an org.
 */
export async function getOrgBranding(organisationId) {
	if (!organisationId) return {};
	const all = await readCollection('marketing_org_branding');
	const branding = all.find((b) => b.organisation_id === organisationId);
	return branding || {};
}

// ---------------------------------------------------------------------------
// Email layout wrapper
// ---------------------------------------------------------------------------

function wrapInEmailLayout(bodyHtml, previewText, branding, baseUrl, unsubscribeUrl) {
	const logoUrl = branding.logo_url || `${baseUrl}/assets/onnuma-logo.png`;
	const footerContent = branding.footer_content || '';

	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	${previewText ? `<meta name="description" content="${previewText.replace(/"/g, '&quot;')}">` : ''}
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 10px; background-color: #f9fafb;">
	${previewText ? `<div style="display:none;max-height:0;overflow:hidden;">${previewText}</div>` : ''}
	<div style="background: #ffffff; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb;">
		<div style="text-align: center; padding: 16px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px;">
			<a href="${baseUrl}" style="display: inline-block; text-decoration: none;">
				<img src="${logoUrl}" alt="Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
			</a>
		</div>
		<div style="color: #333;">
			${bodyHtml}
		</div>
		${footerContent ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #666;">${footerContent}</div>` : ''}
		${unsubscribeUrl ? `<div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #999;">
			<a href="${unsubscribeUrl}" style="color: #999; text-decoration: underline;">Unsubscribe</a>
		</div>` : ''}
	</div>
</body>
</html>`;
}

function appendUnsubscribeToText(bodyText, unsubscribeUrl) {
	const text = String(bodyText || '').trim();
	if (!unsubscribeUrl) return text;
	return `${text}\n\n---\nUnsubscribe: ${unsubscribeUrl}`;
}

// ---------------------------------------------------------------------------
// Test send
// ---------------------------------------------------------------------------

/**
 * Send a test/preview email for a template to an admin address.
 */
export async function sendTestEmail(templateId, toEmail, organisationId, baseUrl) {
	const template = await findById('marketing_email_templates', templateId);
	if (!template) throw new Error('Template not found');

	const org = organisationId ? await findById('organisations', organisationId) : {};
	const links = await resolveLinks(organisationId);
	const branding = await getOrgBranding(organisationId);

	// Use sample data
	const sampleContact = {
		firstName: 'Test',
		lastName: 'User',
		email: toEmail
	};
	const data = buildPlaceholderData(sampleContact, org, baseUrl, links);
	data.unsubscribe_url = `${baseUrl}/marketing/unsubscribe`;

	let bodyHtml = await insertContentBlocks(template.body_html, true);
	let bodyText = await insertContentBlocks(template.body_text || template.body_html?.replace(/<[^>]*>/g, ''), false);
	bodyHtml = renderTemplate(bodyHtml, data);
	bodyText = renderTemplate(bodyText, data);
	const subject = `[TEST] ${renderTemplate(template.subject, data)}`;
	const previewText = renderTemplate(template.preview_text || '', data);

	const fromEmail = branding.sender_email || env.MAILGUN_FROM_EMAIL || (env.MAILGUN_DOMAIN ? `noreply@${env.MAILGUN_DOMAIN}` : 'noreply@onnuma.com');
	const fromName = branding.sender_name || (org && org.name) || 'OnNuma';

	const result = await rateLimitedSend(() =>
		sendEmail({
			from: `${fromName} <${fromEmail}>`,
			to: [toEmail],
			subject,
			html: wrapInEmailLayout(bodyHtml, previewText, branding, baseUrl, data.unsubscribe_url),
			text: appendUnsubscribeToText(bodyText, data.unsubscribe_url)
		})
	);

	return result;
}

/**
 * Send a test version of a mailshot to one or more addresses.
 */
export async function sendTestMailshot({ mailshot, toEmails, organisationId, baseUrl }) {
	if (!mailshot) throw new Error('Mailshot not provided');
	if (!Array.isArray(toEmails) || toEmails.length === 0) {
		throw new Error('At least one test email is required');
	}

	const org = organisationId ? await findById('organisations', organisationId) : {};
	const links = await resolveLinks(organisationId);
	const branding = await getOrgBranding(organisationId);

	const sampleContact = {
		firstName: 'Test',
		lastName: 'User',
		email: toEmails[0]
	};
	const data = buildPlaceholderData(sampleContact, org, baseUrl, links);
	data.unsubscribe_url = `${baseUrl}/marketing/unsubscribe`;

	let bodyHtml = await insertContentBlocks(mailshot.body_html || '', true);
	let bodyText = await insertContentBlocks(
		mailshot.body_text || mailshot.body_html?.replace(/<[^>]*>/g, '') || '',
		false
	);
	bodyHtml = renderTemplate(bodyHtml, data);
	bodyText = renderTemplate(bodyText, data);
	const subject = `[TEST] ${renderTemplate(mailshot.subject || '', data)}`;
	const previewText = renderTemplate(mailshot.preview_text || '', data);

	const fromEmail =
		branding.sender_email ||
		env.MAILGUN_FROM_EMAIL ||
		(env.MAILGUN_DOMAIN ? `noreply@${env.MAILGUN_DOMAIN}` : 'noreply@onnuma.com');
	const fromName = branding.sender_name || (org && org.name) || 'OnNuma';

	const results = [];
	for (const toEmail of toEmails) {
		try {
			const result = await rateLimitedSend(() =>
				sendEmail({
					from: `${fromName} <${fromEmail}>`,
					to: [toEmail],
					subject,
					html: wrapInEmailLayout(bodyHtml, previewText, branding, baseUrl, data.unsubscribe_url),
					text: appendUnsubscribeToText(bodyText, data.unsubscribe_url)
				})
			);
			results.push({
				email: toEmail,
				status: 'sent',
				messageId: result?.data?.id ?? null
			});
		} catch (error) {
			results.push({
				email: toEmail,
				status: 'error',
				error: error.message || 'Send failed'
			});
		}
	}

	return {
		total: toEmails.length,
		sent: results.filter((r) => r.status === 'sent').length,
		failed: results.filter((r) => r.status === 'error').length,
		results
	};
}

/**
 * Send a one-off marketing broadcast to all subscribed contacts.
 * Respects legacy contact subscription flag and marketing preference opt-outs.
 */
export async function sendMarketingBroadcast({ subject, previewText, bodyHtml, bodyText, baseUrl }) {
	const contacts = await readCollection('contacts');
	const prefs = await readCollection('marketing_user_preferences');
	const orgs = await readCollection('organisations');

	const prefMap = new Map(
		prefs
			.filter((p) => p?.user_id)
			.map((p) => [p.user_id, p])
	);
	const orgMap = new Map(
		orgs
			.filter((o) => o?.id)
			.map((o) => [o.id, o])
	);

	const eligible = contacts.filter((contact) => {
		if (!contact?.email || contact.subscribed === false) return false;
		const pref = prefMap.get(contact.id);
		return !pref?.opted_out_non_essential;
	});

	const results = [];
	let sent = 0;
	let failed = 0;
	let skipped = contacts.length - eligible.length;

	for (const contact of eligible) {
		try {
			const organisationId = contact.organisationId || null;
			const org = organisationId ? (orgMap.get(organisationId) || {}) : {};
			const links = await resolveLinks(organisationId);
			const branding = await getOrgBranding(organisationId);

			// Use org's hub domain when set so links and logo point to the correct domain/subdomain
			const contactBaseUrl = getOrgBaseUrl(org, baseUrl);

			const data = buildPlaceholderData(contact, org, contactBaseUrl, links);
			const unsubscribeToken = await ensureUnsubscribeToken(contact.id, contact.email);
			data.unsubscribe_url = unsubscribeToken?.token
				? `${contactBaseUrl}/marketing/unsubscribe?token=${encodeURIComponent(unsubscribeToken.token)}`
				: `${contactBaseUrl}/marketing/unsubscribe`;

			let renderedHtml = await insertContentBlocks(bodyHtml || '', true);
			let renderedText = await insertContentBlocks(
				bodyText || bodyHtml?.replace(/<[^>]*>/g, '') || '',
				false
			);
			renderedHtml = renderTemplate(renderedHtml, data);
			renderedText = renderTemplate(renderedText, data);
			const renderedSubject = renderTemplate(subject || '', data);
			const renderedPreview = renderTemplate(previewText || '', data);

			const fromEmail =
				branding.sender_email ||
				env.MAILGUN_FROM_EMAIL ||
				(env.MAILGUN_DOMAIN ? `noreply@${env.MAILGUN_DOMAIN}` : 'noreply@onnuma.com');
			const fromName = branding.sender_name || org.name || 'OnNuma';

			const sendResult = await rateLimitedSend(() =>
				sendEmail({
					from: `${fromName} <${fromEmail}>`,
					to: [contact.email],
					subject: renderedSubject,
					html: wrapInEmailLayout(
						renderedHtml,
						renderedPreview,
						branding,
						contactBaseUrl,
						data.unsubscribe_url
					),
					text: appendUnsubscribeToText(renderedText, data.unsubscribe_url)
				})
			);

			const messageId = sendResult?.data?.id ?? null;
			sent++;
			results.push({ email: contact.email, status: 'sent', messageId });

			await create('marketing_send_logs', {
				id: randomUUID(),
				queue_entry_id: null,
				user_id: contact.id,
				template_id: null,
				sequence_id: null,
				sequence_step_id: null,
				organisation_id: organisationId,
				status: 'sent',
				message_id: messageId,
				email: contact.email,
				sent_at: new Date().toISOString(),
				error: null
			});
		} catch (error) {
			failed++;
			results.push({
				email: contact.email,
				status: 'error',
				error: error.message || 'Unknown send error'
			});
		}
	}

	return {
		totalContacts: contacts.length,
		eligible: eligible.length,
		skipped,
		sent,
		failed,
		results
	};
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

/**
 * Get send statistics aggregated by sequence or template.
 */
export async function getSendStats(filters = {}) {
	const logs = await readCollection('marketing_send_logs');
	const filtered = logs.filter((l) => {
		if (filters.sequence_id && l.sequence_id !== filters.sequence_id) return false;
		if (filters.template_id && l.template_id !== filters.template_id) return false;
		if (filters.organisation_id && l.organisation_id !== filters.organisation_id) return false;
		return true;
	});

	const stats = {
		total: filtered.length,
		sent: filtered.filter((l) => l.status === 'sent').length,
		failed: filtered.filter((l) => l.status === 'failed').length,
		byTemplate: {},
		bySequence: {}
	};

	for (const log of filtered) {
		// By template
		if (log.template_id) {
			if (!stats.byTemplate[log.template_id]) {
				stats.byTemplate[log.template_id] = { sent: 0, failed: 0 };
			}
			stats.byTemplate[log.template_id][log.status === 'sent' ? 'sent' : 'failed']++;
		}
		// By sequence
		if (log.sequence_id) {
			if (!stats.bySequence[log.sequence_id]) {
				stats.bySequence[log.sequence_id] = { sent: 0, failed: 0 };
			}
			stats.bySequence[log.sequence_id][log.status === 'sent' ? 'sent' : 'failed']++;
		}
	}

	return stats;
}

/**
 * Get user timeline – all marketing emails sent to a specific user.
 */
export async function getUserTimeline(userId) {
	const logs = await readCollection('marketing_send_logs');
	const queue = await readCollection('marketing_send_queue');

	const userLogs = logs.filter((l) => l.user_id === userId);
	const userQueue = queue.filter((q) => q.user_id === userId);

	// Merge into a timeline
	const timeline = [];

	for (const log of userLogs) {
		const template = await findById('marketing_email_templates', log.template_id);
		timeline.push({
			type: log.status === 'sent' ? 'sent' : 'failed',
			timestamp: log.sent_at,
			template_name: template?.name || 'Unknown',
			template_id: log.template_id,
			sequence_id: log.sequence_id,
			error: log.error || null
		});
	}

	for (const q of userQueue) {
		if (q.status === 'pending' || q.status === 'sending') {
			const template = await findById('marketing_email_templates', q.template_id);
			timeline.push({
				type: 'scheduled',
				timestamp: q.send_at,
				template_name: template?.name || 'Unknown',
				template_id: q.template_id,
				sequence_id: q.sequence_id,
				error: null
			});
		}
	}

	timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
	return timeline;
}

// ---------------------------------------------------------------------------
// Deliverability check
// ---------------------------------------------------------------------------

/**
 * Simple deliverability checklist for an org.
 */
export async function getDeliverabilityChecklist(organisationId) {
	const branding = await getOrgBranding(organisationId);
	const org = organisationId ? await findById('organisations', organisationId) : null;

	const checks = [
		{
			label: '"From" email configured',
			passed: !!(branding.sender_email || env.MAILGUN_FROM_EMAIL),
			tip: 'Set a sender email in Marketing → Branding or .env'
		},
		{
			label: 'Reply-to configured',
			passed: !!(branding.reply_to),
			tip: 'Set a reply-to address in Marketing → Branding'
		},
		{
			label: 'Unsubscribe link present',
			passed: true, // Auto-added by send engine
			tip: 'The send engine auto-adds an unsubscribe link'
		},
		{
			label: 'Organisation name set',
			passed: !!(org?.name),
			tip: 'Set the organisation name in organisation settings'
		}
	];

	return checks;
}
