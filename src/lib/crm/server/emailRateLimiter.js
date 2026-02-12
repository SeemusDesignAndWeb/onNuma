/**
 * Email Rate Limiter
 * Enforces configurable delay between email sends
 * to comply with email provider rate limits
 */

import { getSettings } from './settings.js';
import { readCollection, writeCollection } from './fileStore.js';

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

		const { sendFn, resolve, reject, emailCount = 1 } = emailQueue.shift();
		console.log('[Email Rate Limiter] Processing queue item, calling sendFn...');

		try {
			lastSendTime = Date.now();
			const result = await sendFn();
			console.log('[Email Rate Limiter] sendFn resolved successfully');
			// Track successful email send (don't await to avoid blocking)
			trackEmailSent(emailCount).catch(err => {
				console.error('[Email Rate Limiter] Error tracking email:', err);
			});
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
				console.error('[Email Rate Limiter] sendFn failed, rejecting:', error?.message || error);
				reject(error);
			}
		}
	}

	isProcessing = false;
}

/**
 * Rate-limited email send wrapper
 * @param {Function} sendFn - Function that returns a promise for the email send operation
 * @param {number} emailCount - Number of emails being sent (for batch sends, default: 1)
 * @returns {Promise} Promise that resolves when email is sent (or rejected on error)
 */
export function rateLimitedSend(sendFn, emailCount = 1) {
	console.log('[Email Rate Limiter] rateLimitedSend called, queue length will be:', emailQueue.length + 1);
	return new Promise((resolve, reject) => {
		emailQueue.push({ sendFn, resolve, reject, emailCount });
		processQueue();
	});
}

/**
 * Track emails sent (increments daily counter)
 * @param {number} count - Number of emails sent (default: 1)
 * @returns {Promise<void>}
 */
async function trackEmailSent(count = 1) {
	try {
		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
		const stats = await readCollection('email_stats');
		
		// Find today's stat record
		let todayStat = stats.find(s => s.date === today);
		
		if (todayStat) {
			// Increment count
			todayStat.count = (todayStat.count || 0) + count;
			todayStat.updatedAt = new Date().toISOString();
			
			// Update the record in the array
			const index = stats.findIndex(s => s.date === today);
			stats[index] = todayStat;
		} else {
			// Create new record for today
			todayStat = {
				id: `email_stats_${today}`,
				date: today,
				count: count,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
			stats.push(todayStat);
		}
		
		await writeCollection('email_stats', stats);
	} catch (error) {
		// Don't fail email sending if tracking fails
		console.error('[Email Rate Limiter] Error tracking email sent:', error);
	}
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
