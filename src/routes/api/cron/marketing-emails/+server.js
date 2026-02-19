/**
 * API endpoint for processing marketing onboarding email sequences.
 * Access: GET or POST /api/cron/marketing-emails?secret=MARKETING_CRON_SECRET
 * Protected by MARKETING_CRON_SECRET environment variable.
 * Designed to be called by Railway cron or external cron daily.
 *
 * Steps:
 * 1. Evaluate all active sequences → enqueue due emails
 * 2. Process the send queue → send due emails
 */

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { evaluateSequences, processSendQueue } from '$lib/crm/server/marketing.js';

export async function GET({ url, request }) {
	return handleRequest(url, request);
}

export async function POST({ url, request }) {
	return handleRequest(url, request);
}

async function handleRequest(url, request) {
	const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
	const secret = url.searchParams.get('secret') || body.secret;
	const expectedSecret = env.MARKETING_CRON_SECRET;

	if (!expectedSecret) {
		console.error('[Marketing Cron] MARKETING_CRON_SECRET not configured');
		return json({
			error: 'Service not configured',
			message: 'MARKETING_CRON_SECRET environment variable is not set'
		}, { status: 500 });
	}

	if (!secret || secret !== expectedSecret) {
		console.warn('[Marketing Cron] Unauthorized access attempt');
		return json({
			error: 'Unauthorized',
			message: 'Invalid or missing secret token'
		}, { status: 401 });
	}

	try {
		// Prefer APP_BASE_URL so email links use the canonical public URL when cron is hit at internal URL
		const baseUrl = (env.APP_BASE_URL && String(env.APP_BASE_URL).trim().startsWith('http'))
			? String(env.APP_BASE_URL).trim().replace(/\/$/, '')
			: (url.origin || 'http://localhost:5173');

		console.log('[Marketing Cron] Starting sequence evaluation...');
		const evalResult = await evaluateSequences(baseUrl);
		console.log(`[Marketing Cron] Evaluation done: ${evalResult.enqueued} enqueued, ${evalResult.orgsProcessed} orgs processed`);

		console.log('[Marketing Cron] Processing send queue...');
		const sendResult = await processSendQueue(baseUrl);
		console.log(`[Marketing Cron] Send done: ${sendResult.sent} sent, ${sendResult.failed} failed, ${sendResult.skipped} skipped`);

		return json({
			success: true,
			evaluation: evalResult,
			sending: sendResult,
			timestamp: new Date().toISOString()
		});

	} catch (error) {
		console.error('[Marketing Cron] Error:', error);
		return json({
			error: 'Internal server error',
			message: error.message || 'An error occurred',
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
}
