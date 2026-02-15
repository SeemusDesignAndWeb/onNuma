/**
 * Member (volunteer) portal auth: signed cookie so we can trust contactId without a session store.
 * Cookie value: base64url(contactId) + '.' + base64url(hmac).
 */

import { createHmac } from 'crypto';

const COOKIE_NAME = 'my_member';
const COOKIE_MAX_AGE_DAYS = 30;
const COOKIE_PATH = '/myhub';

function getSecret() {
	return (typeof process !== 'undefined' && process.env?.MEMBER_SESSION_SECRET?.trim()) || 'my-member-fallback-secret-change-in-production';
}

function base64UrlEncode(buf) {
	return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
	const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
	const pad = base64.length % 4;
	const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
	return Buffer.from(padded, 'base64');
}

/**
 * Create signed cookie value for contactId.
 * @param {string} contactId
 * @returns {string}
 */
export function signContactId(contactId) {
	if (!contactId || typeof contactId !== 'string') return '';
	const secret = getSecret();
	const payload = Buffer.from(contactId, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	const sig = createHmac('sha256', secret).update(payload).digest();
	const sigB64 = base64UrlEncode(sig);
	return `${payload}.${sigB64}`;
}

/**
 * Verify signed cookie value and return contactId or null.
 * @param {string} value
 * @returns {string | null}
 */
export function verifyMemberCookie(value) {
	if (!value || typeof value !== 'string') return null;
	const dot = value.indexOf('.');
	if (dot <= 0) return null;
	const payload = value.slice(0, dot);
	const sigB64 = value.slice(dot + 1);
	if (!payload || !sigB64) return null;
	try {
		const secret = getSecret();
		const sig = createHmac('sha256', secret).update(payload).digest();
		const expectedSig = base64UrlEncode(sig);
		if (sigB64 !== expectedSig) return null;
		const decoded = base64UrlDecode(payload);
		const contactId = decoded.toString('utf8');
		return contactId || null;
	} catch {
		return null;
	}
}

/**
 * Set member cookie (contactId signed).
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {string} contactId
 * @param {boolean} isProduction
 */
export function setMemberCookie(cookies, contactId, isProduction = false) {
	const value = signContactId(contactId);
	if (!value) return;
	const maxAge = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;
	cookies.set(COOKIE_NAME, value, {
		path: COOKIE_PATH,
		httpOnly: true,
		secure: isProduction,
		sameSite: 'lax',
		maxAge
	});
}

/**
 * Clear member cookie.
 * @param {import('@sveltejs/kit').Cookies} cookies
 */
export function clearMemberCookie(cookies) {
	cookies.delete(COOKIE_NAME, { path: COOKIE_PATH });
}

/**
 * Get contactId from member cookie if valid.
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @returns {string | null}
 */
export function getMemberContactIdFromCookie(cookies) {
	const value = cookies.get(COOKIE_NAME);
	return value ? verifyMemberCookie(value) : null;
}

export { COOKIE_NAME, COOKIE_PATH };
