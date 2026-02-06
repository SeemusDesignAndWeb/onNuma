/**
 * Email provider abstraction: Resend or Mailgun.
 * Priority: env EMAIL_PROVIDER (if set) overrides; else hub_settings.emailProvider (multi-org Settings); else 'resend'.
 *
 * Both providers expose the same interface:
 *   provider.emails.send({ from, to, subject, html, text?, replyTo? }) -> { data?: { id }, error? }
 *   provider.batch.send([...]) -> { data?: Array<{ id }>, error? }
 */

import { env } from '$env/dynamic/private';
import { Resend } from 'resend';
import * as mailgunAdapter from './mailgun.js';
import { getSettings } from '$lib/crm/server/settings.js';

let cachedResend = null;

/**
 * Resolve provider name: env EMAIL_PROVIDER (if set) overrides; else hub_settings.emailProvider; else 'resend'.
 * So: set EMAIL_PROVIDER in .env to override the multi-org Settings choice (e.g. per environment).
 * @returns {Promise<'resend'|'mailgun'>}
 */
export async function resolveProviderName() {
	const fromEnv = (env.EMAIL_PROVIDER || '').toLowerCase().trim();
	if (fromEnv === 'mailgun' || fromEnv === 'resend') return fromEnv;
	try {
		const settings = await getSettings();
		const fromSettings = settings?.emailProvider;
		if (fromSettings === 'mailgun' || fromSettings === 'resend') return fromSettings;
	} catch (_) {
		// ignore
	}
	return 'resend';
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
