import { readCollection, create, findMany } from './fileStore.js';
import { generateId } from './ids.js';

/**
 * Generate a rota token
 * @returns {string} Token string (RTA_ prefix)
 */
export function generateRotaToken() {
	return `RTA_${generateId()}`;
}

/**
 * Ensure rota tokens exist for a rota and occurrence
 * @param {string} eventId - Event ID
 * @param {string} rotaId - Rota ID
 * @param {string|null} occurrenceId - Occurrence ID (null for recurring)
 * @returns {Promise<object>} Rota token
 */
export async function ensureRotaToken(eventId, rotaId, occurrenceId) {
	// Check if token already exists
	// Normalize null/undefined for comparison
	const normalizedOccurrenceId = occurrenceId || null;
	const existing = await findMany('rota_tokens', token => 
		token.eventId === eventId &&
		token.rotaId === rotaId &&
		(token.occurrenceId || null) === normalizedOccurrenceId
	);

	if (existing.length > 0) {
		return existing[0];
	}

	// Create new token
	const token = await create('rota_tokens', {
		eventId,
		rotaId,
		occurrenceId: normalizedOccurrenceId,
		token: generateRotaToken(),
		createdAt: new Date().toISOString()
	});

	return token;
}

/**
 * Get rota token by token string
 * @param {string} tokenStr - Token string
 * @returns {Promise<object|null>} Token or null
 */
export async function getRotaTokenByToken(tokenStr) {
	const tokens = await findMany('rota_tokens', t => t.token === tokenStr);
	return tokens.length > 0 ? tokens[0] : null;
}

/**
 * Get all tokens for a rota
 * @param {string} rotaId - Rota ID
 * @returns {Promise<Array>} Array of tokens
 */
export async function getRotaTokens(rotaId) {
	return findMany('rota_tokens', t => t.rotaId === rotaId);
}

/**
 * Ensure tokens for multiple rotas and occurrences
 * @param {Array} rotaOccurrences - Array of {eventId, rotaId, occurrenceId}
 * @returns {Promise<Array>} Array of tokens
 */
export async function ensureRotaTokens(rotaOccurrences) {
	const tokens = [];
	
	for (const { eventId, rotaId, occurrenceId } of rotaOccurrences) {
		const token = await ensureRotaToken(eventId, rotaId, occurrenceId);
		tokens.push(token);
	}

	return tokens;
}

/**
 * Generate an event token
 * @returns {string} Token string (EVT_ prefix)
 */
export function generateEventToken() {
	return `EVT_${generateId()}`;
}

/**
 * Ensure an event token exists for an event
 * @param {string} eventId - Event ID
 * @returns {Promise<object>} Event token
 */
export async function ensureEventToken(eventId) {
	// Check if token already exists
	const existing = await findMany('event_tokens', token => token.eventId === eventId);

	if (existing.length > 0) {
		return existing[0];
	}

	// Create new token
	const token = await create('event_tokens', {
		eventId,
		token: generateEventToken(),
		createdAt: new Date().toISOString()
	});

	return token;
}

/**
 * Get event token by token string
 * @param {string} tokenStr - Token string
 * @returns {Promise<object|null>} Token or null
 */
export async function getEventTokenByToken(tokenStr) {
	const tokens = await findMany('event_tokens', t => t.token === tokenStr);
	return tokens.length > 0 ? tokens[0] : null;
}

/**
 * Generate an occurrence token
 * @returns {string} Token string (OCC_ prefix)
 */
export function generateOccurrenceToken() {
	return `OCC_${generateId()}`;
}

/**
 * Ensure an occurrence token exists for an occurrence
 * @param {string} eventId - Event ID
 * @param {string} occurrenceId - Occurrence ID
 * @returns {Promise<object>} Occurrence token
 */
export async function ensureOccurrenceToken(eventId, occurrenceId) {
	// Check if token already exists
	const existing = await findMany('occurrence_tokens', token => 
		token.eventId === eventId && token.occurrenceId === occurrenceId
	);

	if (existing.length > 0) {
		return existing[0];
	}

	// Create new token
	const token = await create('occurrence_tokens', {
		eventId,
		occurrenceId,
		token: generateOccurrenceToken(),
		createdAt: new Date().toISOString()
	});

	return token;
}

/**
 * Get occurrence token by token string
 * @param {string} tokenStr - Token string
 * @returns {Promise<object|null>} Token or null
 */
export async function getOccurrenceTokenByToken(tokenStr) {
	const tokens = await findMany('occurrence_tokens', t => t.token === tokenStr);
	return tokens.length > 0 ? tokens[0] : null;
}

/**
 * Generate a contact unsubscribe token
 * @returns {string} Token string (UNS_ prefix)
 */
export function generateUnsubscribeToken() {
	return `UNS_${generateId()}`;
}

/**
 * Ensure an unsubscribe token exists for a contact
 * @param {string} contactId - Contact ID
 * @param {string} email - Contact email (fallback if no ID)
 * @returns {Promise<object>} Unsubscribe token
 */
export async function ensureUnsubscribeToken(contactId, email) {
	// Use contactId if available, otherwise use email as identifier
	const identifier = contactId || email;
	
	// Check if token already exists
	const existing = await findMany('contact_tokens', token => 
		(contactId && token.contactId === contactId) || 
		(!contactId && token.email === email)
	);

	if (existing.length > 0) {
		return existing[0];
	}

	// Create new token
	const token = await create('contact_tokens', {
		contactId: contactId || null,
		email: email || null,
		token: generateUnsubscribeToken(),
		createdAt: new Date().toISOString()
	});

	return token;
}

/**
 * Get unsubscribe token by token string
 * @param {string} tokenStr - Token string
 * @returns {Promise<object|null>} Token or null
 */
export async function getUnsubscribeTokenByToken(tokenStr) {
	const tokens = await findMany('contact_tokens', t => t.token === tokenStr);
	return tokens.length > 0 ? tokens[0] : null;
}

