import { fail } from '@sveltejs/kit';
import { readCollection, findById, update, create, findMany } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation, withOrganisationId } from '$lib/crm/server/orgContext.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { validateContact, validateRota } from '$lib/crm/server/validators.js';
import { createMagicLinkToken } from '$lib/crm/server/memberAuth.js';
import { sendVolunteerApprovedEmail, sendVolunteerDeclinedEmail } from '$lib/crm/server/email.js';
import { filterUpcomingOccurrences } from '$lib/crm/utils/occurrenceFilters.js';
import { env } from '$env/dynamic/private';

export async function load({ cookies, locals }) {
	const csrfToken = getCsrfToken(cookies) || '';
	const organisationId = await getCurrentOrganisationId();

	const allPending = await readCollection('pending_volunteers');
	const pending = (organisationId
		? allPending.filter((p) => !p.organisationId || p.organisationId === organisationId)
		: allPending
	).filter((p) => p.status === 'pending');

	// Sort newest first
	pending.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

	// Enrich with event titles (deduplicate lookups)
	const eventIds = [...new Set(pending.flatMap((p) => (p.rotaSlots || []).map((s) => s.eventId).filter(Boolean)))];
	const eventsMap = new Map();
	await Promise.all(
		eventIds.map(async (id) => {
			const ev = await findById('events', id);
			if (ev) eventsMap.set(id, ev.title || 'Event');
		})
	);

	const enriched = pending.map((p) => ({
		...p,
		rotaSlots: (p.rotaSlots || []).map((s) => ({
			...s,
			eventTitle: s.eventTitle || eventsMap.get(s.eventId) || 'Event'
		}))
	}));

	return { pending: enriched, csrfToken };
}

export const actions = {
	approve: async ({ request, cookies, locals, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request.' });
		}

		const pendingId = data.get('pendingId');
		if (!pendingId) return fail(400, { error: 'Missing pending volunteer ID.' });

		const pending = await findById('pending_volunteers', pendingId);
		if (!pending) return fail(404, { error: 'Pending volunteer not found.' });
		if (pending.status !== 'pending') return fail(400, { error: 'This volunteer has already been processed.' });

		const organisationId = await getCurrentOrganisationId();

		try {
			// Resolve or create the contact
			const existingContacts = await findMany('contacts', (c) =>
				c.email && c.email.toLowerCase() === pending.email.toLowerCase()
			);
			let contact = existingContacts[0] || null;

			if (contact) {
				// Update: ensure confirmed = true, fill in any missing name fields
				if (contact.confirmed === false || !contact.firstName) {
					contact = await update('contacts', contact.id, {
						...contact,
						firstName: contact.firstName || pending.firstName || '',
						lastName: contact.lastName || pending.lastName || '',
						phone: contact.phone || pending.phone || '',
						confirmed: true
					});
				}
			} else {
				// Create new contact
				const validated = validateContact({
					email: pending.email,
					firstName: pending.firstName || '',
					lastName: pending.lastName || '',
					phone: pending.phone || '',
					subscribed: true
				});
				contact = await create('contacts', withOrganisationId({ ...validated, confirmed: true }, organisationId));
			}

			// Add contact to rota assignees for each requested slot
			const allOccurrences = filterUpcomingOccurrences(await readCollection('occurrences'));
			const errors = [];

			for (const slot of pending.rotaSlots || []) {
				const rota = await findById('rotas', slot.rotaId);
				if (!rota) { errors.push(`Rota not found for slot.`); continue; }

				const targetOccId = slot.occurrenceId || null;
				if (targetOccId && !allOccurrences.find((o) => o.id === targetOccId)) {
					// Occurrence has passed — skip silently (coordinator can manually re-assign)
					continue;
				}

				const existing = Array.isArray(rota.assignees) ? [...rota.assignees] : [];

				// Don't double-add
				const alreadyAssigned = existing.some((a) => {
					if (typeof a === 'string') return a === contact.id;
					if (a && typeof a === 'object' && typeof a.contactId === 'string') return a.contactId === contact.id;
					return false;
				});
				if (alreadyAssigned) continue;

				existing.push({ contactId: contact.id, occurrenceId: targetOccId });
				await update('rotas', rota.id, validateRota({ ...rota, assignees: existing }));
			}

			// Mark pending as approved
			await update('pending_volunteers', pendingId, {
				...pending,
				status: 'approved',
				contactId: contact.id,
				resolvedAt: new Date().toISOString()
			});

			// Create MyHUB magic link and send welcome email
			try {
				const baseUrl =
					(env.APP_BASE_URL ? String(env.APP_BASE_URL).trim().replace(/\/$/, '') : '') ||
					'http://localhost:5173';
				const token = await createMagicLinkToken(contact.id);
				const magicUrl = `${baseUrl}/myhub/auth?token=${token}`;
				await sendVolunteerApprovedEmail(contact, magicUrl, { url });
			} catch (emailErr) {
				console.error('[volunteers] approve email failed:', emailErr?.message || emailErr);
				// Non-fatal — contact is approved regardless
			}

			return { success: true, type: 'approve', message: `${pending.firstName || pending.email} approved and added to rotas.` };
		} catch (err) {
			console.error('[volunteers] approve error:', err?.message || err);
			return fail(500, { error: err?.message || 'Failed to approve volunteer.' });
		}
	},

	decline: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request.' });
		}

		const pendingId = data.get('pendingId');
		if (!pendingId) return fail(400, { error: 'Missing pending volunteer ID.' });

		const pending = await findById('pending_volunteers', pendingId);
		if (!pending) return fail(404, { error: 'Pending volunteer not found.' });
		if (pending.status !== 'pending') return fail(400, { error: 'This volunteer has already been processed.' });

		await update('pending_volunteers', pendingId, {
			...pending,
			status: 'declined',
			resolvedAt: new Date().toISOString()
		});

		try {
			await sendVolunteerDeclinedEmail(pending, { url });
		} catch (emailErr) {
			console.error('[volunteers] decline email failed:', emailErr?.message || emailErr);
		}

		return { success: true, type: 'decline', message: `${pending.firstName || pending.email} declined.` };
	}
};
