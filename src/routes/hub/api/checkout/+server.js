/**
 * Create a Paddle checkout for the current organisation and return the checkout URL.
 * Requires Hub auth and current organisation. Plan is professional or enterprise.
 */

import { json } from '@sveltejs/kit';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { findById } from '$lib/crm/server/fileStore.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { getPaddleBaseUrl, getAdminSeatCount } from '$lib/crm/server/paddle.js';
import { env } from '$env/dynamic/private';

const VALID_PLANS = new Set(['professional', 'enterprise']);

export async function GET({ url, locals }) {
	const admin = locals?.admin;
	if (!admin) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!isSuperAdmin(admin)) {
		return json({ error: 'Forbidden: Superadmin required for billing' }, { status: 403 });
	}

	const apiKey = env.PADDLE_API_KEY;
	if (!apiKey) {
		return json({ error: 'Billing not configured' }, { status: 503 });
	}

	const plan = (url.searchParams.get('plan') || '').toLowerCase().trim();
	if (!VALID_PLANS.has(plan)) {
		return json({ error: 'Invalid plan. Use plan=professional or plan=enterprise' }, { status: 400 });
	}

	const priceId = plan === 'enterprise'
		? env.PADDLE_PRICE_ID_ENTERPRISE
		: env.PADDLE_PRICE_ID_PROFESSIONAL;
	if (!priceId) {
		return json({ error: `Price ID for ${plan} not configured` }, { status: 503 });
	}

	const organisationId = await getCurrentOrganisationId();
	if (!organisationId) {
		return json({ error: 'No organisation selected' }, { status: 400 });
	}

	const org = await findById('organisations', organisationId);
	if (!org) {
		return json({ error: 'Organisation not found' }, { status: 404 });
	}

	// Per-seat pricing: quantity = current number of admin users
	const seatCount = await getAdminSeatCount();

	const body = {
		items: [{ price_id: priceId, quantity: seatCount }],
		custom_data: { organisation_id: organisationId },
		collection_mode: 'automatic'
	};
	if (org.paddleCustomerId) {
		body.customer_id = org.paddleCustomerId;
	}

	const baseUrl = getPaddleBaseUrl();
	const res = await fetch(`${baseUrl}/transactions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify(body)
	});

	if (!res.ok) {
		const errText = await res.text();
		console.error('[checkout] Paddle API error:', res.status, errText);
		return json({ error: 'Failed to create checkout' }, { status: 502 });
	}

	const data = await res.json();
	const checkoutUrl = data?.data?.checkout?.url;
	if (!checkoutUrl) {
		console.error('[checkout] No checkout URL in response:', data);
		return json({ error: 'Invalid checkout response' }, { status: 502 });
	}

	return json({ url: checkoutUrl });
}
