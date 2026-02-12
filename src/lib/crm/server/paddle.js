/**
 * Paddle Billing API utilities.
 * Provides helpers for per-seat subscription management:
 * – counting the current admin (seat) quantity for an organisation
 * – selecting the correct tiered price based on seat count
 * – updating the subscription quantity in Paddle when admins are added / removed
 *
 * Pricing tiers (configured via two Paddle prices per plan):
 *   Tier 1: 1–300 seats  → PADDLE_PRICE_ID_PROFESSIONAL / PADDLE_PRICE_ID_ENTERPRISE
 *   Tier 2: 301+ seats   → PADDLE_PRICE_ID_PROFESSIONAL_TIER2 / PADDLE_PRICE_ID_ENTERPRISE_TIER2
 *
 * @see https://developer.paddle.com/api-reference/subscriptions/update-subscription
 */

import { env } from '$env/dynamic/private';
import { readCollection, findById, updatePartial } from '$lib/crm/server/fileStore.js';
import { invalidateOrganisationsCache } from '$lib/crm/server/organisationsCache.js';

// ── Paddle API base URLs ────────────────────────────────────────────────────

const PADDLE_SANDBOX = 'https://sandbox-api.paddle.com';
const PADDLE_PROD = 'https://api.paddle.com';

/** Seat threshold: above this number the higher-tier price kicks in. */
export const SEAT_TIER_THRESHOLD = 300;

export function getPaddleBaseUrl() {
	const envName = (env.PADDLE_ENVIRONMENT || 'sandbox').toLowerCase();
	return envName === 'production' ? PADDLE_PROD : PADDLE_SANDBOX;
}

/**
 * Paddle API key sanitized for Bearer header.
 * Trims whitespace, strips surrounding quotes, and removes newlines so the header is valid.
 * Avoids "authentication_malformed" from .env formatting (quotes, line breaks).
 */
export function getPaddleApiKey() {
	let key = (env.PADDLE_API_KEY || '').trim();
	// Remove newlines/carriage returns that can slip into .env (invalid in Authorization header)
	key = key.replace(/[\r\n]+/g, '').trim();
	// Strip surrounding quotes (e.g. PADDLE_API_KEY="pdl_..." in .env)
	if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
		key = key.slice(1, -1).trim();
	}
	return key;
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

// ── Price tier selection ────────────────────────────────────────────────────

/**
 * Get all known Paddle price IDs for a given plan (both tiers).
 * Used by the webhook to recognise any of these as belonging to the plan.
 * @param {'professional'|'enterprise'} plan
 * @returns {string[]}
 */
export function getAllPriceIdsForPlan(plan) {
	const ids = [];
	if (plan === 'professional') {
		if (env.PADDLE_PRICE_ID_PROFESSIONAL) ids.push(env.PADDLE_PRICE_ID_PROFESSIONAL);
		if (env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2) ids.push(env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2);
	} else if (plan === 'enterprise') {
		if (env.PADDLE_PRICE_ID_ENTERPRISE) ids.push(env.PADDLE_PRICE_ID_ENTERPRISE);
		if (env.PADDLE_PRICE_ID_ENTERPRISE_TIER2) ids.push(env.PADDLE_PRICE_ID_ENTERPRISE_TIER2);
	}
	return ids;
}

/**
 * Select the correct Paddle price ID for a plan based on the seat count.
 *   - 1–300 seats  → base price (PADDLE_PRICE_ID_PROFESSIONAL / _ENTERPRISE) — must allow quantity 1 in Paddle
 *   - 301+ seats   → tier 2 price (_TIER2), falls back to base if tier 2 not configured
 *
 * In Paddle: create two prices per plan if you use tiered pricing — one with quantity range 1–300
 * (for signup and small orgs), one with 301+ for large orgs. Set them to _PROFESSIONAL and _TIER2.
 *
 * @param {'professional'|'enterprise'} plan
 * @param {number} seatCount
 * @returns {string|null} The price ID, or null if not configured.
 */
export function getPriceIdForPlan(plan, seatCount) {
	if (plan === 'enterprise') {
		const base = env.PADDLE_PRICE_ID_ENTERPRISE || null;
		const tier2 = env.PADDLE_PRICE_ID_ENTERPRISE_TIER2 || null;
		return (seatCount > SEAT_TIER_THRESHOLD && tier2) ? tier2 : base;
	}
	if (plan === 'professional') {
		const base = env.PADDLE_PRICE_ID_PROFESSIONAL || null;
		const tier2 = env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2 || null;
		return (seatCount > SEAT_TIER_THRESHOLD && tier2) ? tier2 : base;
	}
	return null;
}

// ── Subscription quantity sync ──────────────────────────────────────────────

/**
 * Update the subscription item quantity (and price tier) in Paddle to match
 * the current admin seat count for the given organisation.
 *
 * If the seat count crosses the tier threshold the price ID is switched
 * automatically so Paddle charges the correct per-seat rate.
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
		const apiKey = getPaddleApiKey();
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

		const plan = org.subscriptionPlan;
		if (!plan || plan === 'free') return false;

		const quantity = typeof quantityOverride === 'number'
			? Math.max(quantityOverride, 1)
			: await getAdminSeatCount();

		// Pick the right price ID for the current seat count (may cross tier boundary)
		const priceId = getPriceIdForPlan(plan, quantity);
		if (!priceId) {
			console.warn('[paddle] syncSubscriptionQuantity: no price ID mapped for plan', plan);
			return false;
		}

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

		console.log(`[paddle] subscription ${subscriptionId} quantity updated to ${quantity} (price: ${priceId})`);
		return true;
	} catch (err) {
		console.error('[paddle] syncSubscriptionQuantity unexpected error:', err?.message || err);
		return false;
	}
}
