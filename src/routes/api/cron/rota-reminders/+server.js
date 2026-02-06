// API endpoint for sending rota reminder notifications
// Access: GET or POST /api/cron/rota-reminders?secret=ROTA_REMINDER_CRON_SECRET
// Optional: ?daysAhead=N to override Hub setting (Settings → Advanced → Rota reminder emails)
// Protected by ROTA_REMINDER_CRON_SECRET environment variable
// Designed to be called by Railway cron or external cron (e.g. cron-job.org) daily.
// See docs/ROTA_REMINDER_SETUP.md for setup.

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getSettings } from '$lib/crm/server/settings.js';
import { sendRotaReminders } from '$lib/crm/server/rotaReminders.js';

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
	const expectedSecret = env.ROTA_REMINDER_CRON_SECRET;

	if (!expectedSecret) {
		console.error('[Rota Reminders API] ROTA_REMINDER_CRON_SECRET not configured');
		return json({ 
			error: 'Service not configured',
			message: 'ROTA_REMINDER_CRON_SECRET environment variable is not set'
		}, { status: 500 });
	}

	if (!secret || secret !== expectedSecret) {
		console.warn('[Rota Reminders API] Unauthorized access attempt');
		return json({ 
			error: 'Unauthorized',
			message: 'Invalid or missing secret token'
		}, { status: 401 });
	}

	try {
		// Get days ahead: query/body override > Hub settings (rotaReminderDaysAhead) > env ROTA_REMINDER_DAYS_AHEAD > 3
		const daysAheadParam = url.searchParams.get('daysAhead');
		let daysAhead = daysAheadParam ? parseInt(daysAheadParam, 10) : null;
		if (daysAhead == null || isNaN(daysAhead)) {
			daysAhead = body.daysAhead != null ? parseInt(String(body.daysAhead), 10) : null;
		}
		if (daysAhead == null || isNaN(daysAhead)) {
			const settings = await getSettings();
			daysAhead = settings.rotaReminderDaysAhead ?? (parseInt(env.ROTA_REMINDER_DAYS_AHEAD, 10) || 3);
		}

		if (isNaN(daysAhead) || daysAhead < 0) {
			return json({ 
				error: 'Invalid daysAhead parameter',
				message: 'daysAhead must be a non-negative integer'
			}, { status: 400 });
		}

		console.log(`[Rota Reminders API] Starting reminder job for ${daysAhead} days ahead`);

		// Create a mock event object for getBaseUrl (we only need the URL)
		const event = {
			url: new URL(request.url)
		};

		// Send reminders
		const results = await sendRotaReminders(daysAhead, event);

		console.log(`[Rota Reminders API] Reminder job completed: ${results.sent} sent, ${results.failed} failed`);

		return json({
			success: true,
			message: `Rota reminders processed for ${daysAhead} days ahead`,
			results: {
				totalContacts: results.totalContacts,
				totalAssignments: results.totalAssignments,
				sent: results.sent,
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
