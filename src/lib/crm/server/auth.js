import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { readCollection, create, update, findById, remove, writeCollection } from './fileStore.js';
import { generateId } from './ids.js';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_COOKIE = 'crm_session';
const CSRF_COOKIE = 'crm_csrf';
const PASSWORD_EXPIRATION_DAYS = 90; // Password expires after 90 days
const ACCOUNT_LOCKOUT_ATTEMPTS = 5; // Lock account after 5 failed attempts
const ACCOUNT_LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

// Account-level lockout tracking (email -> { count, lockedUntil })
const accountLockouts = new Map();

/**
 * Validate password complexity
 * @param {string} password - Plain text password
 * @throws {Error} If password doesn't meet requirements
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

/**
 * Hash a password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(password) {
	return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(password, hash) {
	return bcrypt.compare(password, hash);
}

/**
 * Get admin user by email
 * @param {string} email - Admin email
 * @returns {Promise<object|null>} Admin user or null
 */
export async function getAdminByEmail(email) {
	const admins = await readCollection('admins');
	console.log('[getAdminByEmail] Looking for email:', email);
	console.log('[getAdminByEmail] Found', admins.length, 'admins');
	console.log('[getAdminByEmail] Admin emails:', admins.map(a => a.email));
	// Normalize email to lowercase for comparison
	const normalizedEmail = email.toLowerCase().trim();
	const found = admins.find(a => a.email?.toLowerCase().trim() === normalizedEmail) || null;
	console.log('[getAdminByEmail] Result:', found ? 'Found' : 'Not found');
	return found;
}

/**
 * Get admin user by ID
 * @param {string} id - Admin ID
 * @returns {Promise<object|null>} Admin user or null
 */
export async function getAdminById(id) {
	return findById('admins', id);
}

/**
 * Generate email verification token
 * @returns {string} Verification token
 */
export function generateVerificationToken() {
	return randomBytes(32).toString('base64url');
}

/**
 * Create a new admin user
 * @param {object} data - Admin data (email, password, name)
 * @returns {Promise<object>} Created admin or existing admin (to prevent email enumeration)
 */
export async function createAdmin({ email, password, name }) {
	// Validate password complexity
	validatePassword(password);
	
	const existing = await getAdminByEmail(email);
	if (existing) {
		// Don't reveal that email exists - return existing admin without error
		// This prevents email enumeration attacks
		return { id: existing.id, email: existing.email, name: existing.name };
	}

	const hashedPassword = await hashPassword(password);
	const verificationToken = generateVerificationToken();
	const now = new Date();
	
	return create('admins', {
		email,
		passwordHash: hashedPassword,
		name,
		role: 'admin',
		emailVerified: false,
		emailVerificationToken: verificationToken,
		emailVerificationTokenExpires: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
		passwordChangedAt: now.toISOString(),
		failedLoginAttempts: 0,
		accountLockedUntil: null
	});
}

/**
 * Dummy bcrypt hash for timing attack protection
 * This is a valid bcrypt hash that will never match any password
 */
const DUMMY_HASH = '$2b$10$byUjUI3TiiztLYBB6Oz6xe8RWxsx7Q8mVxCnV7la4b37HlP26DIqq';

/**
 * Check if password is expired
 * @param {object} admin - Admin user object
 * @returns {boolean} True if password is expired
 */
export function isPasswordExpired(admin) {
	if (!admin.passwordChangedAt) {
		// Legacy accounts without passwordChangedAt - consider expired for security
		return true;
	}
	const passwordAge = Date.now() - new Date(admin.passwordChangedAt).getTime();
	const expirationTime = PASSWORD_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
	return passwordAge > expirationTime;
}

/**
 * Check if account is locked
 * @param {object} admin - Admin user object
 * @returns {boolean} True if account is locked
 */
export function isAccountLocked(admin) {
	if (!admin.accountLockedUntil) {
		return false;
	}
	return new Date(admin.accountLockedUntil) > new Date();
}

/**
 * Authenticate admin user
 * @param {string} email - Admin email
 * @param {string} password - Plain text password
 * @returns {Promise<object|null>} Admin user or null, or throws error if account locked/password expired
 */
export async function authenticateAdmin(email, password) {
	const admin = await getAdminByEmail(email);
	
	// Check account lockout
	if (admin && isAccountLocked(admin)) {
		const lockedUntil = new Date(admin.accountLockedUntil);
		const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / (60 * 1000));
		throw new Error(`Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}.`);
	}
	
	// Use a dummy hash if admin not found to prevent timing attacks
	// This ensures password verification always takes similar time regardless of whether email exists
	const hashToVerify = admin ? admin.passwordHash : DUMMY_HASH;
	
	const valid = await verifyPassword(password, hashToVerify);
	
	// Only return admin if both admin exists and password is valid
	if (!admin || !valid) {
		// Increment failed attempts for this account
		if (admin) {
			const failedAttempts = (admin.failedLoginAttempts || 0) + 1;
			let accountLockedUntil = null;
			
			if (failedAttempts >= ACCOUNT_LOCKOUT_ATTEMPTS) {
				accountLockedUntil = new Date(Date.now() + ACCOUNT_LOCKOUT_DURATION).toISOString();
			}
			
			await update('admins', admin.id, {
				failedLoginAttempts: failedAttempts,
				accountLockedUntil
			});
		}
		return null;
	}

	// Check password expiration
	if (isPasswordExpired(admin)) {
		throw new Error('Password has expired. Please change your password.');
	}

	// Reset failed attempts on successful login
	if (admin.failedLoginAttempts > 0 || admin.accountLockedUntil) {
		await update('admins', admin.id, {
			failedLoginAttempts: 0,
			accountLockedUntil: null
		});
	}

	return admin;
}

/**
 * Create a session
 * @param {string} adminId - Admin user ID
 * @returns {Promise<object>} Session object
 */
export async function createSession(adminId) {
	const session = {
		id: generateId(),
		adminId,
		createdAt: new Date().toISOString(),
		expiresAt: new Date(Date.now() + SESSION_DURATION).toISOString()
	};

	await create('sessions', session);
	return session;
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<object|null>} Session or null
 */
export async function getSession(sessionId) {
	const session = await findById('sessions', sessionId);
	if (!session) {
		return null;
	}

	// Check if expired
	if (new Date(session.expiresAt) < new Date()) {
		await removeSession(sessionId);
		return null;
	}

	return session;
}

/**
 * Remove a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<void>}
 */
export async function removeSession(sessionId) {
	await remove('sessions', sessionId);
}

/**
 * Cleanup expired sessions
 * @returns {Promise<number>} Number of sessions removed
 */
export async function cleanupExpiredSessions() {
	const sessions = await readCollection('sessions');
	const now = new Date();
	const validSessions = sessions.filter(s => new Date(s.expiresAt) >= now);
	const removedCount = sessions.length - validSessions.length;
	
	if (removedCount > 0) {
		await writeCollection('sessions', validSessions);
	}
	
	return removedCount;
}

/**
 * Invalidate all sessions for an admin (e.g., on password change)
 * @param {string} adminId - Admin user ID
 * @returns {Promise<number>} Number of sessions invalidated
 */
export async function invalidateAdminSessions(adminId) {
	const sessions = await readCollection('sessions');
	const adminSessions = sessions.filter(s => s.adminId === adminId);
	const remainingSessions = sessions.filter(s => s.adminId !== adminId);
	
	if (adminSessions.length > 0) {
		await writeCollection('sessions', remainingSessions);
	}
	
	return adminSessions.length;
}

/**
 * Update admin password
 * @param {string} adminId - Admin user ID
 * @param {string} newPassword - New password
 * @returns {Promise<object>} Updated admin
 */
export async function updateAdminPassword(adminId, newPassword) {
	// Validate password complexity
	validatePassword(newPassword);
	
	const hashedPassword = await hashPassword(newPassword);
	const now = new Date();
	
	// Update password and invalidate all sessions
	await invalidateAdminSessions(adminId);
	
	return update('admins', adminId, {
		passwordHash: hashedPassword,
		passwordChangedAt: now.toISOString(),
		failedLoginAttempts: 0,
		accountLockedUntil: null,
		passwordResetToken: null,
		passwordResetTokenExpires: null
	});
}

/**
 * Generate password reset token
 * @returns {string} Reset token
 */
export function generatePasswordResetToken() {
	return randomBytes(32).toString('base64url');
}

/**
 * Request password reset - generates token and stores it
 * @param {string} email - Admin email
 * @returns {Promise<object|null>} Admin with reset token or null (to prevent email enumeration)
 */
export async function requestPasswordReset(email) {
	console.log('[requestPasswordReset] Starting for email:', email);
	const admin = await getAdminByEmail(email);
	if (!admin) {
		console.log('[requestPasswordReset] Admin not found for email:', email);
		// Don't reveal that email doesn't exist - return null without error
		// This prevents email enumeration attacks
		return null;
	}

	console.log('[requestPasswordReset] Admin found:', {
		id: admin.id,
		email: admin.email,
		hasExistingToken: !!admin.passwordResetToken
	});

	const resetToken = generatePasswordResetToken();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

	console.log('[requestPasswordReset] Generated token:', {
		tokenLength: resetToken.length,
		tokenPreview: resetToken.substring(0, 20) + '...',
		expiresAt: expiresAt.toISOString()
	});

	const updated = await update('admins', admin.id, {
		passwordResetToken: resetToken,
		passwordResetTokenExpires: expiresAt.toISOString()
	});

	console.log('[requestPasswordReset] Update result:', {
		updated: !!updated,
		hasToken: !!updated?.passwordResetToken,
		tokenMatches: updated?.passwordResetToken === resetToken,
		storedTokenLength: updated?.passwordResetToken?.length,
		providedTokenLength: resetToken.length
	});

	// Verify the token was saved correctly
	if (!updated || updated.passwordResetToken !== resetToken) {
		console.error('[requestPasswordReset] Failed to save reset token for admin:', {
			adminId: admin.id,
			updated: !!updated,
			updatedToken: updated?.passwordResetToken?.substring(0, 20),
			expectedToken: resetToken.substring(0, 20),
			tokensMatch: updated?.passwordResetToken === resetToken
		});
		throw new Error('Failed to generate password reset token');
	}

	console.log('[requestPasswordReset] Token saved successfully');
	return {
		id: admin.id,
		email: admin.email,
		name: admin.name,
		passwordResetToken: resetToken,
		passwordResetTokenExpires: expiresAt.toISOString()
	};
}

/**
 * Verify password reset token
 * @param {string} email - Admin email
 * @param {string} token - Reset token
 * @returns {Promise<object|null>} Admin if token is valid, null otherwise
 */
export async function verifyPasswordResetToken(email, token) {
	console.log('[verifyPasswordResetToken] Starting verification:', {
		email: email,
		tokenLength: token?.length,
		tokenPreview: token?.substring(0, 20) + '...'
	});

	const admin = await getAdminByEmail(email);
	if (!admin) {
		console.log('[verifyPasswordResetToken] Admin not found for email:', email);
		return null;
	}

	console.log('[verifyPasswordResetToken] Admin found:', {
		id: admin.id,
		email: admin.email,
		hasPasswordResetToken: !!admin.passwordResetToken,
		storedTokenLength: admin.passwordResetToken?.length,
		storedTokenPreview: admin.passwordResetToken?.substring(0, 20) + '...',
		hasExpiration: !!admin.passwordResetTokenExpires
	});

	if (!admin.passwordResetToken) {
		console.log('[verifyPasswordResetToken] No reset token found for admin:', admin.id);
		return null;
	}

	// Trim tokens to handle any whitespace issues
	const storedToken = admin.passwordResetToken.trim();
	const providedToken = token.trim();

	console.log('[verifyPasswordResetToken] Token comparison:', {
		storedLength: storedToken.length,
		providedLength: providedToken.length,
		storedStart: storedToken.substring(0, 30),
		providedStart: providedToken.substring(0, 30),
		storedEnd: storedToken.substring(storedToken.length - 10),
		providedEnd: providedToken.substring(providedToken.length - 10),
		tokensMatch: storedToken === providedToken
	});

	if (storedToken !== providedToken) {
		console.log('[verifyPasswordResetToken] Token mismatch - tokens do not match');
		return null;
	}

	if (!admin.passwordResetTokenExpires) {
		console.log('[verifyPasswordResetToken] No expiration date found for admin:', admin.id);
		return null;
	}

	const expiresAt = new Date(admin.passwordResetTokenExpires);
	const now = new Date();
	console.log('[verifyPasswordResetToken] Expiration check:', {
		expiresAt: expiresAt.toISOString(),
		now: now.toISOString(),
		isExpired: expiresAt < now,
		timeRemaining: expiresAt < now ? 'EXPIRED' : `${Math.round((expiresAt - now) / 1000 / 60)} minutes`
	});

	if (expiresAt < now) {
		console.log('[verifyPasswordResetToken] Token expired');
		return null; // Token expired
	}

	console.log('[verifyPasswordResetToken] Token verified successfully');
	return admin;
}

/**
 * Reset password using reset token
 * @param {string} email - Admin email
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @returns {Promise<object>} Updated admin
 */
export async function resetPasswordWithToken(email, token, newPassword) {
	const admin = await verifyPasswordResetToken(email, token);
	if (!admin) {
		throw new Error('Invalid or expired reset token');
	}

	// Validate password complexity
	validatePassword(newPassword);
	
	const hashedPassword = await hashPassword(newPassword);
	const now = new Date();
	
	// Update password, invalidate all sessions, and clear reset token
	await invalidateAdminSessions(admin.id);
	
	return update('admins', admin.id, {
		passwordHash: hashedPassword,
		passwordChangedAt: now.toISOString(),
		failedLoginAttempts: 0,
		accountLockedUntil: null,
		passwordResetToken: null,
		passwordResetTokenExpires: null
	});
}

/**
 * Verify email address
 * @param {string} adminId - Admin user ID
 * @param {string} token - Verification token
 * @returns {Promise<boolean>} True if verified
 */
export async function verifyAdminEmail(adminId, token) {
	const admin = await getAdminById(adminId);
	if (!admin) {
		return false;
	}
	
	if (admin.emailVerified) {
		return true; // Already verified
	}
	
	if (!admin.emailVerificationToken || admin.emailVerificationToken !== token) {
		return false; // Invalid token
	}
	
	const expiresAt = new Date(admin.emailVerificationTokenExpires);
	if (expiresAt < new Date()) {
		return false; // Token expired
	}
	
	await update('admins', adminId, {
		emailVerified: true,
		emailVerificationToken: null,
		emailVerificationTokenExpires: null
	});
	
	return true;
}

/**
 * Get admin from request cookies
 * @param {object} cookies - SvelteKit cookies object
 * @returns {Promise<object|null>} Admin user or null
 */
export async function getAdminFromCookies(cookies) {
	const sessionId = cookies.get(SESSION_COOKIE);
	if (!sessionId) {
		return null;
	}

	const session = await getSession(sessionId);
	if (!session) {
		return null;
	}

	const admin = await getAdminById(session.adminId);
	if (!admin) {
		return null;
	}

	// Check if account is locked (don't allow access even with valid session)
	if (isAccountLocked(admin)) {
		return null;
	}

	// Note: Password expiration is checked on login, not on every request
	// This allows users to continue working until they log out or session expires

	return admin;
}

/**
 * Set session cookie
 * @param {object} cookies - SvelteKit cookies object
 * @param {string} sessionId - Session ID
 * @param {boolean} isProduction - Whether in production
 */
export function setSessionCookie(cookies, sessionId, isProduction = false) {
	cookies.set(SESSION_COOKIE, sessionId, {
		path: '/hub',
		maxAge: SESSION_DURATION / 1000,
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict'
	});
}

/**
 * Clear session cookie
 * @param {object} cookies - SvelteKit cookies object
 */
export function clearSessionCookie(cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

/**
 * Generate CSRF token (cryptographically secure)
 * @returns {string} CSRF token
 */
export function generateCsrfToken() {
	return randomBytes(32).toString('base64url');
}

/**
 * Get CSRF token from cookies
 * @param {object} cookies - SvelteKit cookies object
 * @returns {string|null} CSRF token or null
 */
export function getCsrfToken(cookies) {
	return cookies.get(CSRF_COOKIE) || null;
}

/**
 * Set CSRF token cookie
 * @param {object} cookies - SvelteKit cookies object
 * @param {string} token - CSRF token
 * @param {boolean} isProduction - Whether in production
 */
export function setCsrfToken(cookies, token, isProduction = false) {
	cookies.set(CSRF_COOKIE, token, {
		path: '/',
		maxAge: 60 * 60 * 24, // 24 hours
		httpOnly: true,
		secure: isProduction,
		sameSite: 'strict'
	});
}

/**
 * Verify CSRF token
 * @param {object} cookies - SvelteKit cookies object
 * @param {string} providedToken - Token from request
 * @returns {boolean} True if valid
 */
export function verifyCsrfToken(cookies, providedToken) {
	const storedToken = getCsrfToken(cookies);
	return storedToken && storedToken === providedToken;
}

