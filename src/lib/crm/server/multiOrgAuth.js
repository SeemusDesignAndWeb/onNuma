/**
 * MultiOrg area authentication.
 * Separate login/session from the Hub. Uses multi_org_admins and multi_org_sessions (file or database per store mode).
 */

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { readCollection, create, update, findById, remove, writeCollection } from './fileStore.js';
import { generateId } from './ids.js';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const MULTI_ORG_SESSION_COOKIE = 'multi_org_session';
const MULTI_ORG_CSRF_COOKIE = 'multi_org_csrf';

/**
 * Validate password complexity (same as Hub)
 */
export function validatePassword(password) {
	if (!password || password.length < 12) {
		throw new Error('Password must be at least 12 characters long');
	}
	if (!/[a-z]/.test(password)) {
		throw new Error('Password must contain at least one lowercase letter');
	}
	if (!/[A-Z]/.test(password)) {
		throw new Error('Password must contain at least one uppercase letter');
	}
	if (!/[0-9]/.test(password)) {
		throw new Error('Password must contain at least one number');
	}
	if (!/[^a-zA-Z0-9]/.test(password)) {
		throw new Error('Password must contain at least one special character');
	}
	return true;
}

export async function hashPassword(password) {
	return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, hash) {
	return bcrypt.compare(password, hash);
}

export async function getMultiOrgAdminByEmail(email) {
	const admins = await readCollection('multi_org_admins');
	const normalized = (email || '').toLowerCase().trim();
	return admins.find((a) => (a.email || '').toLowerCase().trim() === normalized) || null;
}

export async function getMultiOrgAdminById(id) {
	return findById('multi_org_admins', id);
}

export function isMultiOrgSuperAdmin(admin) {
	return admin && admin.role === 'super_admin';
}

/**
 * Create first MultiOrg super admin (e.g. via install script). Idempotent by email.
 */
export async function createMultiOrgSuperAdmin({ email, password, name }) {
	validatePassword(password);
	const existing = await getMultiOrgAdminByEmail(email);
	if (existing) {
		return { id: existing.id, email: existing.email, name: existing.name };
	}
	const hashedPassword = await hashPassword(password);
	const now = new Date().toISOString();
	return create('multi_org_admins', {
		email,
		passwordHash: hashedPassword,
		name: name || email,
		role: 'super_admin',
		createdAt: now,
		updatedAt: now
	});
}

/**
 * Create a MultiOrg admin (only super_admin can do this from the UI).
 */
export async function createMultiOrgAdmin({ email, password, name, role = 'admin' }) {
	validatePassword(password);
	const existing = await getMultiOrgAdminByEmail(email);
	if (existing) {
		return { id: existing.id, email: existing.email, name: existing.name };
	}
	const hashedPassword = await hashPassword(password);
	const now = new Date().toISOString();
	return create('multi_org_admins', {
		email,
		passwordHash: hashedPassword,
		name: name || email,
		role: role === 'super_admin' ? 'super_admin' : 'admin',
		createdAt: now,
		updatedAt: now
	});
}

export async function authenticateMultiOrgAdmin(email, password) {
	const admin = await getMultiOrgAdminByEmail(email);
	const DUMMY_HASH = '$2b$10$byUjUI3TiiztLYBB6Oz6xe8RWxsx7Q8mVxCnV7la4b37HlP26DIqq';
	const hashToVerify = admin ? admin.passwordHash : DUMMY_HASH;
	const valid = await verifyPassword(password, hashToVerify);
	if (!admin || !valid) return null;
	return admin;
}

export async function createMultiOrgSession(adminId) {
	const session = {
		id: generateId(),
		adminId,
		createdAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString()
	};
	await create('multi_org_sessions', session);
	return session;
}

export async function getMultiOrgSession(sessionId) {
	const session = await findById('multi_org_sessions', sessionId);
	if (!session) return null;
	if (new Date(session.expiresAt) < new Date()) {
		await remove('multi_org_sessions', sessionId);
		return null;
	}
	return session;
}

export async function removeMultiOrgSession(sessionId) {
	await remove('multi_org_sessions', sessionId);
}

export async function getMultiOrgAdminFromCookies(cookies) {
	const sessionId = cookies.get(MULTI_ORG_SESSION_COOKIE);
	if (!sessionId) return null;
	const session = await getMultiOrgSession(sessionId);
	if (!session) return null;
	const admin = await getMultiOrgAdminById(session.adminId);
	return admin || null;
}

/** When adminSubdomain (e.g. admin.onnuma.com), use path '/' so cookie is sent for /auth/login, /organisations, etc. */
function multiOrgCookiePath(adminSubdomain) {
	return adminSubdomain ? '/' : '/multi-org';
}

export function setMultiOrgSessionCookie(cookies, sessionId, isProduction = false, adminSubdomain = false) {
	cookies.set(MULTI_ORG_SESSION_COOKIE, sessionId, {
		path: multiOrgCookiePath(adminSubdomain),
		maxAge: SESSION_DURATION / 1000,
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict'
	});
}

export function clearMultiOrgSessionCookie(cookies, adminSubdomain = false) {
	cookies.delete(MULTI_ORG_SESSION_COOKIE, { path: multiOrgCookiePath(adminSubdomain) });
	cookies.delete(MULTI_ORG_SESSION_COOKIE, { path: multiOrgCookiePath(!adminSubdomain) });
}

export function generateMultiOrgCsrfToken() {
	return randomBytes(32).toString('base64url');
}

export function getMultiOrgCsrfToken(cookies) {
	return cookies.get(MULTI_ORG_CSRF_COOKIE) || null;
}

export function setMultiOrgCsrfToken(cookies, token, isProduction = false, adminSubdomain = false) {
	cookies.set(MULTI_ORG_CSRF_COOKIE, token, {
		path: multiOrgCookiePath(adminSubdomain),
		maxAge: 60 * 60 * 24,
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict'
	});
}

export function verifyMultiOrgCsrfToken(cookies, providedToken) {
	const stored = getMultiOrgCsrfToken(cookies);
	return !!stored && stored === providedToken;
}
