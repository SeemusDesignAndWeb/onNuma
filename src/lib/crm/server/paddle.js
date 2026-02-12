/**
 * Paddle Billing API utilities.
 * Provides helpers for per-seat subscription management:
 * – counting the current admin (seat) quantity for an organisation
 * – updating the subscription quantity in Paddle when admins are added / removed
 *
 * @see https://developer.paddle.com/api-reference/subscriptions/update-subscription
 */

import { env } from '$env/dynamic/private';
import { readCollection, findById, updatePartial } from '$lib/crm/server/fileStore.js';
import { invalidateOrganisationsCache } from '$lib/crm/server/organisationsCache.js';

// ── Paddle API base URLs ────────────────────────────────────────────────────

const PADDLE_SANDBOX = 'https://sandbox-api.paddle.com';
const PADDLE_PROD = 'https://api.paddle.com';

export function getPaddleBaseUrl() {
	const envName = (env.PADDLE_ENVIRONMENT || 'sandbox').toLowerCase();
	return envName === 'production' ? PADDLE_PROD : PADDLE_SANDBOX;
}

// ── Admin / seat counting ───────────────────────────────────────────────────

/**
 * Count the current number of admin users (seats).
 * All admins in the store belong to the current hub instance.
 * @returns {Promise<number>} The admin count (minimum 1).
 */
export async function getAdminSeatCount() {
	const admins = await readCollection('admins');
	return Math.max(admins.length, 1);
}

// ── Subscription quantity sync ──────────────────────────────────────────────

/**
 * Update the subscription item quantity in Paddle to match the current admin
 * seat count for the given organisation.
 *
 * This is a fire-and-forget helper – it logs errors but never throws, so
 * callers (admin create / delete actions) won't fail if Paddle is unreachable.
 *
 * @param {string} organisationId – the organisation whose subscription to update
 * @param {number} [quantityOverride] – if provided, use this value instead of counting admins
 * @returns {Promise<boolean>} true if the update succeeded
 */
export async function syncSubscriptionQuantity(organisationId, quantityOverride) {
	try {
		const apiKey = env.PADDLE_API_KEY;
		if (!apiKey) {
			// Billing not configured – nothing to sync
			return false;
		}

		const org = await findById('organisations', organisationId);
		if (!org) {
			console.warn('[paddle] syncSubscriptionQuantity: organisation not found:', organisationId);
			return false;
		}

		const subscriptionId = org.paddleSubscriptionId;
		if (!subscriptionId) {
			// No active subscription – nothing to update
			return false;
		}

		// Determine the price ID from the org's current plan
		const priceId = getPriceIdForOrg(org);
		if (!priceId) {
			console.warn('[paddle] syncSubscriptionQuantity: no price ID mapped for org plan');
			return false;
		}

		const quantity = typeof quantityOverride === 'number'
			? Math.max(quantityOverride, 1)
			: await getAdminSeatCount();

		const baseUrl = getPaddleBaseUrl();
		const res = await fetch(`${baseUrl}/subscriptions/${subscriptionId}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				items: [{ price_id: priceId, quantity }],
				proration_billing_mode: 'prorated_immediately'
			})
		});

		if (!res.ok) {
			const errText = await res.text();
			console.error('[paddle] syncSubscriptionQuantity error:', res.status, errText);
			return false;
		}

		// Persist the quantity we just sent so the UI can show it
		await updatePartial('organisations', organisationId, {
			paddleSeatQuantity: quantity
		});
		invalidateOrganisationsCache();

		console.log(`[paddle] subscription ${subscriptionId} quantity updated to ${quantity}`);
		return true;
	} catch (err) {
		console.error('[paddle] syncSubscriptionQuantity unexpected error:', err?.message || err);
		return false;
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Resolve the Paddle price ID that matches the organisation's current plan.
 * Returns null if the org is on the free plan or env vars are missing.
 */
function getPriceIdForOrg(org) {
	const plan = org.subscriptionPlan;
	if (!plan || plan === 'free') return null;
	if (plan === 'enterprise') return env.PADDLE_PRICE_ID_ENTERPRISE || null;
	if (plan === 'professional') return env.PADDLE_PRICE_ID_PROFESSIONAL || null;
	return null;
}
