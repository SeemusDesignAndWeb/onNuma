/**
 * Get a Boathouse billing portal URL for the current organisation.
 * Requires Hub auth and current organisation. Uses paddleCustomerId or org email.
 * @see https://help.boathouse.co/docs/boathouse-api
 */

import { json } from '@sveltejs/kit';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { findById } from '$lib/crm/server/fileStore.js';
import { isSuperAdmin } from '$lib/crm/server/permissions.js';
import { env } from '$env/dynamic/private';

const BOATHOUSE_API = 'https://my.boathouse.co/api/v1';

export async function GET({ locals }) {
	const admin = locals?.admin;
	if (!admin) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}
	if (!isSuperAdmin(admin)) {
		return json({ error: 'Forbidden: Superadmin required for billing' }, { status: 403 });
	}

	const portalId = env.BOATHOUSE_PORTAL_ID;
	const secret = env.BOATHOUSE_SECRET;
	if (!portalId || !secret) {
		return json({ error: 'Billing portal not configured' }, { status: 503 });
	}

	const organisationId = await getCurrentOrganisationId();
	if (!organisationId) {
		return json({ error: 'No organisation selected' }, { status: 400 });
	}

	const org = await findById('organisations', organisationId);
	if (!org) {
		return json({ error: 'Organisation not found' }, { status: 404 });
	}

	const payload = { portalId, secret };
	if (org.paddleCustomerId) {
		payload.paddleCustomerId = org.paddleCustomerId;
	} else {
		const email = org.email || org.hubSuperAdminEmail || admin.email;
		if (!email) {
			return json({ error: 'No customer or email for billing portal' }, { status: 400 });
		}
		payload.email = email;
	}

	const res = await fetch(BOATHOUSE_API, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});

	if (!res.ok) {
		const errText = await res.text();
		console.error('[billing-portal] Boathouse API error:', res.status, errText);
		return json({ error: 'Failed to get billing portal URL' }, { status: 502 });
	}

	const data = await res.json();
	const url = data?.billingPortalUrl;
	if (!url || typeof url !== 'string') {
		console.error('[billing-portal] No billingPortalUrl in response:', data);
		return json({ error: 'Invalid portal response' }, { status: 502 });
	}

	return json({ url });
}
