/**
 * Email Rate Limiter
 * Enforces configurable delay between email sends
 * to comply with email provider rate limits
 */

import { getSettings } from './settings.js';

// Queue of pending email send operations
const emailQueue = [];
let isProcessing = false;
let lastSendTime = 0;

/**
 * Get the minimum delay from settings (with fallback to default)
 */
async function getMinDelay() {
	try {
		const settings = await getSettings();
		return settings.emailRateLimitDelay || 500; // Default: 500ms
	} catch (error) {
		console.error('[Email Rate Limiter] Error reading settings, using default:', error);
		return 500; // Fallback to default
	}
}

/**
 * Process the email queue, sending emails with proper rate limiting
 */
async function processQueue() {
	if (isProcessing || emailQueue.length === 0) {
		return;
	}

	isProcessing = true;

	while (emailQueue.length > 0) {
		const now = Date.now();
		const timeSinceLastSend = now - lastSendTime;
		const minDelay = await getMinDelay();

		// Wait if we need to maintain rate limit
		if (timeSinceLastSend < minDelay) {
			const waitTime = minDelay - timeSinceLastSend;
			await new Promise(resolve => setTimeout(resolve, waitTime));
		}

		const { sendFn, resolve, reject } = emailQueue.shift();

		try {
			lastSendTime = Date.now();
			const result = await sendFn();
			resolve(result);
		} catch (error) {
			// Check if it's a rate limit error (HTTP 429)
			if (error.status === 429 || (error.response && error.response.status === 429)) {
				// Rate limit exceeded - wait longer and retry
				console.warn('[Email Rate Limiter] Rate limit exceeded, waiting before retry...');
				const retryDelay = 1000; // Wait 1 second before retry
				await new Promise(resolve => setTimeout(resolve, retryDelay));
				
				// Re-queue the request
				emailQueue.unshift({ sendFn, resolve, reject });
				lastSendTime = Date.now();
			} else {
				// Other error - reject immediately
				reject(error);
			}
		}
	}

	isProcessing = false;
}

/**
 * Rate-limited email send wrapper
 * @param {Function} sendFn - Function that returns a promise for the email send operation
 * @returns {Promise} Promise that resolves when email is sent (or rejected on error)
 */
export function rateLimitedSend(sendFn) {
	return new Promise((resolve, reject) => {
		emailQueue.push({ sendFn, resolve, reject });
		processQueue();
	});
}

/**
 * Get current queue status (for monitoring/debugging)
 * @returns {Promise<object>} Queue status information
 */
export async function getQueueStatus() {
	const minDelay = await getMinDelay();
	return {
		queueLength: emailQueue.length,
		isProcessing,
		lastSendTime: lastSendTime ? new Date(lastSendTime).toISOString() : null,
		timeSinceLastSend: lastSendTime ? Date.now() - lastSendTime : null,
		minDelayMs: minDelay,
		requestsPerSecond: (1000 / minDelay).toFixed(2)
	};
}
