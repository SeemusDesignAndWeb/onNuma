/**
 * Email provider abstraction: Mailgun by default.
 * Set EMAIL_PROVIDER in .env to override (e.g. 'mailgun' or 'resend').
 *
 * Both providers expose the same interface:
 *   provider.emails.send({ from, to, subject, html, text?, replyTo? }) -> { data?: { id }, error? }
 *   provider.batch.send([...]) -> { data?: Array<{ id }>, error? }
 */

import { env } from '$env/dynamic/private';
import { Resend } from 'resend';
import * as mailgunAdapter from './mailgun.js';
let cachedResend = null;

/**
 * Resolve provider name: env EMAIL_PROVIDER (if set); else 'mailgun'.
 * @returns {Promise<'resend'|'mailgun'>}
 */
export async function resolveProviderName() {
	const fromEnv = (env.EMAIL_PROVIDER || '').toLowerCase().trim();
	if (fromEnv === 'mailgun' || fromEnv === 'resend') return fromEnv;
	return 'mailgun';
}

/**
 * @returns {Promise<{ emails: { send: (p: object) => Promise<{ data?: { id }, error? }> }, batch: { send: (p: object[]) => Promise<{ data?: Array<{ id }>, error? }> } }>}
 */
export async function getEmailProvider() {
	const name = await resolveProviderName();
	if (name === 'mailgun') {
		return {
			emails: mailgunAdapter.emails,
			batch: mailgunAdapter.batch
		};
	}
	if (!cachedResend) {
		cachedResend = new Resend(env.RESEND_API_KEY || '');
	}
	return {
		emails: { send: (p) => cachedResend.emails.send(p) },
		batch: { send: (payloads) => cachedResend.batch.send(payloads) }
	};
}

/** Current provider name for logging: 'resend' | 'mailgun' */
export async function getEmailProviderName() {
	return resolveProviderName();
}
