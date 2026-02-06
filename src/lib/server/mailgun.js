/**
 * Mailgun email client with a Resend-compatible interface (emails.send, batch.send).
 * Use EMAIL_PROVIDER=mailgun and set MAILGUN_API_KEY, MAILGUN_DOMAIN.
 */

import Mailgun from 'mailgun.js';
import { env } from '$env/dynamic/private';

// mailgun.js requires FormData. Node 18+ provides global FormData.
const FormData = globalThis.FormData;
if (!FormData) {
	throw new Error('Mailgun adapter requires FormData (Node 18+ or form-data polyfill).');
}
const mailgun = new Mailgun(FormData);

function getClient() {
	const key = env.MAILGUN_API_KEY;
	if (!key) {
		throw new Error('MAILGUN_API_KEY is not set. Set it in .env when using EMAIL_PROVIDER=mailgun.');
	}
	const opts = { username: 'api', key };
	if (env.MAILGUN_EU === 'true' || env.MAILGUN_EU === '1') {
		opts.url = 'https://api.eu.mailgun.net';
	}
	return mailgun.client(opts);
}

function getDomain() {
	const domain = env.MAILGUN_DOMAIN;
	if (!domain) {
		throw new Error('MAILGUN_DOMAIN is not set (e.g. mg.yourdomain.com or sandboxXXX.mailgun.org).');
	}
	return domain;
}

/**
 * Normalize Resend-style payload to Mailgun format.
 * Resend: to is string[]; Mailgun: to can be string or string[].
 * @param {object} p - { from, to, subject, html, text?, replyTo? }
 * @returns {object} Mailgun message params
 */
function toMailgunPayload(p) {
	const to = Array.isArray(p.to) ? p.to : [p.to];
	const params = {
		from: p.from,
		to,
		subject: p.subject,
		html: p.html ?? '',
		text: p.text ?? (p.html ? undefined : '')
	};
	if (p.replyTo) {
		params['h:Reply-To'] = p.replyTo;
	}
	return params;
}

/**
 * Resend-compatible single send. Returns { data: { id } } or { error: { message } }.
 */
export const emails = {
	async send(payload) {
		const mg = getClient();
		const domain = getDomain();
		const params = toMailgunPayload(payload);
		try {
			const result = await mg.messages.create(domain, params);
			const id = result?.id ?? null;
			return { data: id ? { id } : null, error: null };
		} catch (err) {
			const message = err?.message ?? err?.toString?.() ?? 'Mailgun send failed';
			return { data: null, error: { message } };
		}
	}
};

/**
 * Resend-compatible batch send. Mailgun has no native batch API, so we send in sequence.
 * Returns { data: Array<{ id }>, error?: { message } }.
 */
export const batch = {
	async send(payloads) {
		if (!Array.isArray(payloads) || payloads.length === 0) {
			return { data: [], error: null };
		}
		const mg = getClient();
		const domain = getDomain();
		const ids = [];
		try {
			for (const p of payloads) {
				const params = toMailgunPayload(p);
				const result = await mg.messages.create(domain, params);
				ids.push({ id: result?.id ?? null });
			}
			return { data: ids, error: null };
		} catch (err) {
			const message = err?.message ?? err?.toString?.() ?? 'Mailgun batch send failed';
			return { data: ids, error: { message } };
		}
	}
};
