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
// Professional: 3 fixed prices. Tier 1 = 31–100 (£15); Tier 2 = 101–250 (£25); Tier 3 = 251–500 (£50).
// 1–30 uses TIER1 price. PADDLE_PRICE_ID_PROFESSIONAL_TIER1, _TIER2, _TIER3; each quantity 1.

/**
 * Get all known Paddle price IDs for a given plan.
 * Professional: 3 prices (TIER1/£15, TIER2/£25, TIER3/£50). Enterprise: legacy tier 1/tier 2.
 * @param {'professional'|'enterprise'} plan
 * @returns {string[]}
 */
export function getAllPriceIdsForPlan(plan) {
	const ids = [];
	if (plan === 'professional') {
		if (env.PADDLE_PRICE_ID_PROFESSIONAL_TIER1) ids.push(env.PADDLE_PRICE_ID_PROFESSIONAL_TIER1);
		if (env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2) ids.push(env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2);
		if (env.PADDLE_PRICE_ID_PROFESSIONAL_TIER3) ids.push(env.PADDLE_PRICE_ID_PROFESSIONAL_TIER3);
	} else if (plan === 'enterprise') {
		if (env.PADDLE_PRICE_ID_ENTERPRISE) ids.push(env.PADDLE_PRICE_ID_ENTERPRISE);
		if (env.PADDLE_PRICE_ID_ENTERPRISE_TIER2) ids.push(env.PADDLE_PRICE_ID_ENTERPRISE_TIER2);
	}
	return ids;
}

/**
 * Get Professional price ID by contact tier. Tier 1 = 31–100 (£15); 1–30 uses TIER1. Tier 2 = 101–250 (£25). Tier 3 = 251–500 (£50).
 * @param {number} contactOrSeatCount – contact count (signup) or seat count (Hub), 1–500
 * @returns {string|null} Price ID for PADDLE_PRICE_ID_PROFESSIONAL_TIER1, _TIER2, or _TIER3
 */
function trimPriceId(id) {
	if (typeof id !== 'string') return null;
	const s = id.trim().replace(/[\r\n]+/g, '');
	return s || null;
}

export function getPriceIdForProfessionalByTier(contactOrSeatCount) {
	const n = Math.max(0, Math.min(500, Math.floor(Number(contactOrSeatCount) || 0)));
	if (n <= 100) return trimPriceId(env.PADDLE_PRICE_ID_PROFESSIONAL_TIER1) || null;
	if (n <= 250) return trimPriceId(env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2) || null;
	return trimPriceId(env.PADDLE_PRICE_ID_PROFESSIONAL_TIER3) || null;
}

/**
 * Select the correct Paddle price ID for a plan.
 * Professional: 3 fixed prices (£15 / £25 / £50) by tier, quantity always 1.
 * Enterprise: legacy seat-based (1–300 vs 301+).
 *
 * @param {'professional'|'enterprise'} plan
 * @param {number} seatCount – for Professional used as tier (1–100→£15, 101–250→£25, 251+→£50)
 * @returns {string|null} The price ID, or null if not configured.
 */
export function getPriceIdForPlan(plan, seatCount) {
	if (plan === 'enterprise') {
		const base = env.PADDLE_PRICE_ID_ENTERPRISE || null;
		const tier2 = env.PADDLE_PRICE_ID_ENTERPRISE_TIER2 || null;
		return (seatCount > SEAT_TIER_THRESHOLD && tier2) ? tier2 : base;
	}
	if (plan === 'professional') {
		return getPriceIdForProfessionalByTier(seatCount);
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

		const seatCount = typeof quantityOverride === 'number'
			? Math.max(quantityOverride, 1)
			: await getAdminSeatCount();

		// Professional: 3 fixed prices, quantity always 1. Enterprise: per-seat quantity.
		const priceId = getPriceIdForPlan(plan, seatCount);
		if (!priceId) {
			console.warn('[paddle] syncSubscriptionQuantity: no price ID mapped for plan', plan);
			return false;
		}
		const quantity = plan === 'professional' ? 1 : seatCount;

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
