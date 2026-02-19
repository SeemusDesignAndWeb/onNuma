// API endpoint for sending schedule reminder notifications
// Access: GET or POST /api/cron/schedule-reminders?secret=SCHEDULE_REMINDER_CRON_SECRET
// Runs daily, respects each volunteer's reminderTiming preference (1 day / 2 days / 1 week / 1 week + 1 day)
// Deduplicates via rota_reminder_log — safe to call multiple times per day
// Optional: ?daysAhead=N for legacy single-day override (testing)
// Protected by SCHEDULE_REMINDER_CRON_SECRET environment variable

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { sendRotaReminders, sendMyhubRotaReminders } from '$lib/crm/server/rotaReminders.js';

/** Canonical base URL for email links (prefer APP_BASE_URL so cron hit at internal URL still produces correct links). */
function getCronBaseUrl(request) {
	const base = (env.APP_BASE_URL && String(env.APP_BASE_URL).trim().startsWith('http'))
		? env.APP_BASE_URL.trim()
		: request.url;
	return new URL(base).origin;
}

export async function GET({ url, request }) {
	return handleRequest(url, request);
}

export async function POST({ url, request }) {
	return handleRequest(url, request);
}

async function handleRequest(url, request) {
	// Parse body once for POST (so we can use it for secret and daysAhead); GET has no body
	const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
	// Validate secret token (query param or JSON body)
	const secret = url.searchParams.get('secret') || body.secret;
	const expectedSecret = env.SCHEDULE_REMINDER_CRON_SECRET;

	if (!expectedSecret) {
		console.error('[Schedule Reminders API] SCHEDULE_REMINDER_CRON_SECRET not configured');
		return json({ 
			error: 'Service not configured',
			message: 'SCHEDULE_REMINDER_CRON_SECRET environment variable is not set'
		}, { status: 500 });
	}

	if (!secret || secret !== expectedSecret) {
		console.warn('[Schedule Reminders API] Unauthorized access attempt');
		return json({ 
			error: 'Unauthorized',
			message: 'Invalid or missing secret token'
		}, { status: 401 });
	}

	try {
		// Use canonical public URL for email links so "View in My Hub" etc. work when cron is hit at internal URL
		const origin = getCronBaseUrl(request);
		const sveltekitEvent = { url: { origin } };

		// ?daysAhead=N overrides to the old single-day path (useful for testing)
		const daysAheadParam = url.searchParams.get('daysAhead') ?? (body.daysAhead != null ? String(body.daysAhead) : null);
		if (daysAheadParam !== null) {
			const daysAhead = parseInt(daysAheadParam, 10);
			if (isNaN(daysAhead) || daysAhead < 0) {
				return json({ error: 'Invalid daysAhead parameter', message: 'daysAhead must be a non-negative integer' }, { status: 400 });
			}
			console.log(`[Rota Reminders API] Override mode: running for ${daysAhead} days ahead`);
			const results = await sendRotaReminders(daysAhead, sveltekitEvent);
			console.log(`[Rota Reminders API] Override job done: ${results.sent} sent, ${results.failed} failed`);
			return json({
				success: true,
				message: `Rota reminders processed for ${daysAhead} days ahead (override)`,
				results: {
					totalContacts: results.totalContacts,
					totalAssignments: results.totalAssignments,
					sent: results.sent,
					failed: results.failed,
					errors: results.errors.length > 0 ? results.errors : undefined
				},
				timestamp: new Date().toISOString()
			});
		}

		// Default: run for all timing buckets (1, 2, 7 days) respecting per-volunteer preferences
		console.log('[Rota Reminders API] Starting MyHub reminder job (all timing buckets)');
		const results = await sendMyhubRotaReminders(sveltekitEvent);
		console.log(`[Rota Reminders API] Job complete: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);

		return json({
			success: true,
			message: 'Rota reminders processed for all volunteer timing preferences',
			results: {
				totalAssignments: results.totalAssignments,
				sent: results.sent,
				skipped: results.skipped,
				failed: results.failed,
				errors: results.errors.length > 0 ? results.errors : undefined
			},
			timestamp: new Date().toISOString()
		});

	} catch (error) {
		console.error('[Rota Reminders API] Error processing reminders:', error);
		return json({ 
			error: 'Internal server error',
			message: error.message || 'An error occurred while processing rota reminders',
			timestamp: new Date().toISOString()
		}, { status: 500 });
	}
}
