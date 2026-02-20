import { fail } from '@sveltejs/kit';
import { readCollection, findById, update, findMany } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { getHubSuperAdminEmailForOrganisation } from '$lib/crm/server/settings.js';
import { sendVolunteerCannotAttendNotification, sendInvitationResponseEmail } from '$lib/crm/server/email.js';
import { validateRota } from '$lib/crm/server/validators.js';

/**
 * Load the dashboard data:
 *   nextRota         — the volunteer's single next confirmed upcoming shift
 *   getInvolvedShifts — up to 5 open shifts (one per event) they haven't signed up for
 */
export async function load({ parent }) {
	const { member } = await parent();
	if (!member) return { nextRota: null, pendingInvitations: [], getInvolvedShifts: [], pendingInterests: [] };

	const email = (member.email || '').toLowerCase();
	const contactId = member.id;
	if (!email && !contactId) return { nextRota: null, pendingInvitations: [], getInvolvedShifts: [], pendingInterests: [] };

	try {
		const organisationId = await getCurrentOrganisationId();
		const [rotasRaw, eventsRaw, occurrencesRaw, contactsRaw, invitationsRaw] = await Promise.all([
			readCollection('rotas'),
			readCollection('events'),
			readCollection('occurrences'),
			readCollection('contacts'),
			readCollection('myhub_invitations')
		]);
		const rotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
		const events = organisationId ? filterByOrganisation(eventsRaw, organisationId) : eventsRaw;
		const occurrences = organisationId ? filterByOrganisation(occurrencesRaw, organisationId) : occurrencesRaw;
		const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;

		const eventsMap = new Map(events.map((e) => [e.id, e]));
		const occurrencesMap = new Map(occurrences.map((o) => [o.id, o]));
		const contactsMap = new Map(contacts.map((c) => [c.id, c]));

		const now = new Date();
		now.setHours(0, 0, 0, 0);

		// ---- Section 1: Next Up ----
		// Find all upcoming occurrences this volunteer is assigned to.
		const upcoming = [];

		for (const rota of rotas) {
			if (!rota.assignees || !Array.isArray(rota.assignees)) continue;

			for (const assignee of rota.assignees) {
				let isMatch = false;
				let assigneeOccurrenceId = null;

				if (typeof assignee === 'string') {
					if (assignee === contactId) {
						isMatch = true;
						assigneeOccurrenceId = rota.occurrenceId || null;
					} else {
						const contact = contactsMap.get(assignee);
						if (contact?.email && contact.email.toLowerCase() === email) {
							isMatch = true;
							assigneeOccurrenceId = rota.occurrenceId || null;
						}
					}
				} else if (assignee && typeof assignee === 'object') {
					if (assignee.contactId === contactId) {
						isMatch = true;
						assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
					} else if (assignee.email && assignee.email.toLowerCase() === email) {
						isMatch = true;
						assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
					} else if (assignee.contactId) {
						const contact = contactsMap.get(assignee.contactId);
						if (contact?.email && contact.email.toLowerCase() === email) {
							isMatch = true;
							assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
						}
					}
				}

				if (!isMatch) continue;

				const event = eventsMap.get(rota.eventId);
				let occsToCheck = [];
				if (!assigneeOccurrenceId && !rota.occurrenceId) {
					occsToCheck = occurrences
						.filter((o) => o.eventId === rota.eventId)
						.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
				} else {
					const occ = occurrencesMap.get(assigneeOccurrenceId || rota.occurrenceId);
					if (occ) occsToCheck = [occ];
				}

				for (const occ of occsToCheck) {
					if (!occ.startsAt || new Date(occ.startsAt) < now) continue;
			upcoming.push({
					rotaId: rota.id,
					role: rota.role,
					eventId: rota.eventId,
					eventTitle: event?.title || 'Event',
					occurrenceId: occ.id,
					date: occ.startsAt,
					startTime: occ.startsAt,
					endTime: occ.endsAt || null,
					location: occ.location || event?.location || '',
					coordinatorFirstName: rota.ownerId
						? (() => { const o = contactsMap.get(rota.ownerId); return o?.firstName || null; })()
						: null
				});
				}
			}
		}

		upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
		const nextRota = upcoming[0] ?? null;

		// Who else is on the same next shift? (first names only, per spec)
		if (nextRota) {
			const record = rotas.find((r) => r.id === nextRota.rotaId);
			const shiftmates = [];
			for (const assignee of record?.assignees || []) {
				let aId = null;
				let aOccId = null;
				if (typeof assignee === 'string') {
					aId = assignee;
					aOccId = record.occurrenceId ?? null;
				} else if (assignee && typeof assignee === 'object') {
					aId = assignee.contactId || assignee.id || null;
					aOccId = assignee.occurrenceId ?? record.occurrenceId ?? null;
				}
				if (!aId || aId === contactId) continue;
				// Skip if this assignee is for a different occurrence
				if (aOccId !== null && nextRota.occurrenceId !== null && aOccId !== nextRota.occurrenceId) continue;
				const c = contactsMap.get(aId);
				if (c?.firstName) shiftmates.push(c.firstName);
			}
			nextRota.shiftmates = shiftmates;
		}

		// ---- Section 3: Get Involved ----
		// Upcoming open shifts (with capacity) this volunteer has NOT signed up for.
		// One card per event (the earliest upcoming occurrence), max 5.
		const signedUpEventOccurrences = new Set(
			upcoming.map((r) => `${r.eventId}:${r.occurrenceId}`)
		);

		/** Returns true if the volunteer is already in this rota's assignee list. */
		function volunteerAlreadyIn(rota) {
			return (rota.assignees || []).some((a) => {
				if (typeof a === 'string') return a === contactId;
				if (a && typeof a === 'object') {
					return (
						a.contactId === contactId ||
						(a.email && a.email.toLowerCase() === email)
					);
				}
				return false;
			});
		}

		// Sort all occurrences by date ascending so we pick the soonest per event.
		const sortedOccurrences = [...occurrences]
			.filter((o) => o.startsAt && new Date(o.startsAt) >= now)
			.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

		const seenEventIds = new Set();
		const getInvolvedShifts = [];

		for (const occ of sortedOccurrences) {
			if (getInvolvedShifts.length >= 5) break;
			if (seenEventIds.has(occ.eventId)) continue;
			if (signedUpEventOccurrences.has(`${occ.eventId}:${occ.id}`)) continue;

			// Find a rota for this occurrence that has open slots.
			const rotasForEvent = rotas.filter(
				(r) => r.eventId === occ.eventId && !volunteerAlreadyIn(r)
			);
			const openRota = rotasForEvent.find((r) => {
				const cap = r.capacity ?? r.slots ?? 1;
				return (r.assignees || []).length < cap;
			});

			if (!openRota) continue;

			const event = eventsMap.get(occ.eventId);
			seenEventIds.add(occ.eventId);
			getInvolvedShifts.push({
				eventId: occ.eventId,
				eventTitle: event?.title || 'Event',
				role: openRota.role || '',
				date: occ.startsAt,
				startTime: occ.startsAt,
				endTime: occ.endsAt || null,
				location: occ.location || event?.location || ''
			});
		}

		// ---- Section 2: Shifts Waiting for Your Reply ----
		// Pending invitations for this volunteer, enriched with event/occurrence details.
		const myInvitations = (organisationId
			? filterByOrganisation(invitationsRaw, organisationId)
			: invitationsRaw
		).filter((inv) => inv.contactId === contactId && inv.status === 'pending');

		const pendingInvitations = myInvitations.map((inv) => {
			const event = eventsMap.get(inv.eventId);
			const occ = inv.occurrenceId ? occurrencesMap.get(inv.occurrenceId) : null;
			const rota = rotas.find((r) => r.id === inv.rotaId);
			return {
				id: inv.id,
				rotaId: inv.rotaId,
				occurrenceId: inv.occurrenceId,
				eventId: inv.eventId,
				eventTitle: event?.title || 'Event',
				role: rota?.role || '',
				date: occ?.startsAt || null,
				startTime: occ?.startsAt || null,
				endTime: occ?.endsAt || null,
				location: occ?.location || event?.location || ''
			};
		}).sort((a, b) => {
			if (!a.date) return 1;
			if (!b.date) return -1;
			return new Date(a.date) - new Date(b.date);
		});

		// ---- Section 4: Pending volunteer interests (awaiting coordinator review) ----
		let pendingInterests = [];
		try {
			const allPending = await findMany('pending_volunteers', (p) =>
				p.status === 'pending' &&
				((p.contactId && p.contactId === contactId) ||
					(p.email && p.email.toLowerCase() === email))
			);
			pendingInterests = allPending
				.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
				.map((p) => ({
					id: p.id,
					rotaSlots: (p.rotaSlots || []).map((s) => ({
						rotaRole: s.rotaRole || '',
						eventTitle: s.eventTitle || '',
						occurrenceDate: s.occurrenceDate || null
					})),
					createdAt: p.createdAt || null
				}));
		} catch (e) {
			// non-fatal — collection may not exist yet
		}

		return { nextRota, pendingInvitations, getInvolvedShifts, pendingInterests };
	} catch (err) {
		console.error('[myhub dashboard] load error:', err?.message || err);
		return { nextRota: null, pendingInvitations: [], getInvolvedShifts: [], pendingInterests: [] };
	}
}

/**
 * Let the volunteer cancel their next shift directly from the dashboard.
 * Mirrors the cannotVolunteer action on the rotas page.
 */
export const actions = {
	cannotVolunteer: async (event) => {
		const { request, cookies } = event;
		const data = await request.formData();
		if (!verifyCsrfToken(cookies, data.get('_csrf'))) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.' });
		}

		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in. Please refresh and try again.' });
		}

		const rotaId = (data.get('rotaId') || '').toString().trim();
		const occurrenceId = (data.get('occurrenceId') || '').toString().trim() || null;
		const note = (data.get('note') || '').toString().trim() || null;
		if (!rotaId) {
			return fail(400, { error: 'Invalid rota. Please refresh and try again.' });
		}

		const organisationId = await getCurrentOrganisationId();
		const [rotasRaw, eventsRaw, occurrencesRaw, contactsRaw] = await Promise.all([
			readCollection('rotas'),
			readCollection('events'),
			readCollection('occurrences'),
			readCollection('contacts')
		]);
		const rotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
		const events = organisationId ? filterByOrganisation(eventsRaw, organisationId) : eventsRaw;
		const occurrences = organisationId ? filterByOrganisation(occurrencesRaw, organisationId) : occurrencesRaw;
		const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;

		const rota = rotas.find((r) => r.id === rotaId);
		if (!rota) return fail(404, { error: 'Rota not found.' });

		const contact = contacts.find((c) => c.id === contactId);
		if (!contact) return fail(400, { error: 'Your account could not be found. Please sign in again.' });

		const memberEmail = (contact.email || '').toLowerCase();
		const assignees = rota.assignees || [];
		const isAssigned = assignees.some((a) => {
			let aContactId, aOccId;
			if (typeof a === 'string') {
				aContactId = a;
				aOccId = rota.occurrenceId || null;
			} else if (a && typeof a === 'object') {
				aContactId = a.contactId || a.id;
				aOccId = a.occurrenceId ?? rota.occurrenceId ?? null;
			} else return false;
			const matchContact =
				aContactId === contactId ||
				(contact.email && typeof a === 'object' && (a.email || '').toLowerCase() === memberEmail);
			const matchOcc =
				(aOccId === null && occurrenceId === null) ||
				aOccId === occurrenceId ||
				(rota.occurrenceId === null && aOccId === null && occurrenceId !== null);
			return matchContact && matchOcc;
		});
		if (!isAssigned) {
			return fail(403, { error: "You don't appear to be assigned to this rota." });
		}

		const occurrencesMap = new Map(occurrences.map((o) => [o.id, o]));
		const eventsMap = new Map(events.map((e) => [e.id, e]));
		const occurrence = occurrenceId ? occurrencesMap.get(occurrenceId) : null;
		const eventData = eventsMap.get(rota.eventId);

		const dateDisplay = occurrence
			? new Date(occurrence.startsAt).toLocaleDateString('en-GB', {
					weekday: 'long',
					year: 'numeric',
					month: 'long',
					day: 'numeric',
					hour: '2-digit',
					minute: '2-digit'
				})
			: 'Date to be confirmed';

		let toEmail = null;
		let toName = null;
		let coordinatorFirstName = 'your organiser';
		if (rota.ownerId) {
			const owner = await findById('contacts', rota.ownerId);
			if (owner?.email) {
				toEmail = owner.email;
				toName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email;
				coordinatorFirstName = owner.firstName || toName;
			}
		}
		if (!toEmail) {
			toEmail = await getHubSuperAdminEmailForOrganisation(organisationId);
			toName = toName || 'Administrator';
		}
		if (!toEmail) {
			return fail(500, {
				error: 'No rota owner is set. Please contact your organiser directly.'
			});
		}

		const volunteerName =
			[contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() ||
			contact.email ||
			'A volunteer';

		try {
			await sendVolunteerCannotAttendNotification(
				{ to: toEmail, name: toName },
				{
					volunteerName,
					volunteerEmail: contact.email || '',
					role: rota.role,
					eventTitle: eventData?.title || 'Event',
					dateDisplay,
					note
				},
				event
			);
		} catch (err) {
			console.error('[myhub dashboard] cannotVolunteer email failed:', err);
			return fail(500, { error: 'We could not send the notification. Please try again.' });
		}

		return {
			success: true,
			type: 'cannotVolunteer',
			coordinatorFirstName,
			message: `${coordinatorFirstName} has been notified. Thanks for letting us know — it really helps with planning.`
		};
	},

	acceptInvitation: async ({ request, cookies }) => {
		const data = await request.formData();
		if (!verifyCsrfToken(cookies, data.get('_csrf'))) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.', type: 'acceptInvitation' });
		}
		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in. Please refresh and try again.', type: 'acceptInvitation' });
		}
		const invitationId = (data.get('invitationId') || '').toString().trim();
		if (!invitationId) {
			return fail(400, { error: 'Invalid invitation.', type: 'acceptInvitation' });
		}

		const organisationId = await getCurrentOrganisationId();
		const invitation = await findById('myhub_invitations', invitationId);
		if (!invitation || invitation.contactId !== contactId || invitation.status !== 'pending') {
			return fail(404, { error: 'Invitation not found or already responded to.', type: 'acceptInvitation' });
		}

		// Mark invitation accepted
		await update('myhub_invitations', invitationId, { ...invitation, status: 'accepted', respondedAt: new Date().toISOString() });

		// Add contact as an assignee on the rota (mirrors addAssignees logic)
		try {
			const rota = await findById('rotas', invitation.rotaId);
			if (rota) {
				const existingAssignees = Array.isArray(rota.assignees) ? [...rota.assignees] : [];
				const alreadyAssigned = existingAssignees.some((a) => {
					if (typeof a === 'string') return a === contactId;
					if (a && typeof a === 'object') return a.contactId === contactId;
					return false;
				});
				if (!alreadyAssigned) {
					existingAssignees.push({ contactId, occurrenceId: invitation.occurrenceId || rota.occurrenceId || null });
					const validated = validateRota({ ...rota, assignees: existingAssignees });
					await update('rotas', invitation.rotaId, validated);
				}
			}
		} catch (err) {
			console.error('[acceptInvitation] Failed to add assignee:', err?.message || err);
		}

		// Notify coordinator
		try {
			const [rota, contact, event, occurrence] = await Promise.all([
				findById('rotas', invitation.rotaId),
				findById('contacts', contactId),
				findById('events', invitation.eventId),
				invitation.occurrenceId ? findById('occurrences', invitation.occurrenceId) : Promise.resolve(null)
			]);

			let toEmail = null;
			let toName = null;
			if (rota?.ownerId) {
				const owner = await findById('contacts', rota.ownerId);
				if (owner?.email) { toEmail = owner.email; toName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email; }
			}
			if (!toEmail) {
				toEmail = await getHubSuperAdminEmailForOrganisation(organisationId);
				toName = toName || 'Administrator';
			}
			if (toEmail && contact) {
				const volunteerName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.email;
				const dateDisplay = occurrence
					? new Date(occurrence.startsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
					: 'Date to be confirmed';
				await sendInvitationResponseEmail({
					to: toEmail,
					name: toName,
					volunteerName,
					volunteerEmail: contact.email || '',
					eventTitle: event?.title || 'Event',
					role: rota?.role || '',
					dateDisplay,
					accepted: true
				}, { url: { origin: process.env.APP_BASE_URL || 'https://onnuma.com' } });
			}
		} catch (err) {
			console.error('[acceptInvitation] Notification failed:', err?.message || err);
		}

		// Fetch details for the E3 confirmation overlay
		let confirmEventTitle = 'the shift';
		let confirmDateDisplay = '';
		let confirmTimeDisplay = '';
		try {
			const [ev, occ] = await Promise.all([
				findById('events', invitation.eventId),
				invitation.occurrenceId ? findById('occurrences', invitation.occurrenceId) : Promise.resolve(null)
			]);
			confirmEventTitle = ev?.title || 'the shift';
			if (occ?.startsAt) {
				confirmDateDisplay = new Date(occ.startsAt).toLocaleDateString('en-GB', {
					weekday: 'long', day: 'numeric', month: 'long'
				});
				confirmTimeDisplay = new Date(occ.startsAt).toLocaleTimeString('en-GB', {
					hour: '2-digit', minute: '2-digit', hour12: true
				}).replace(/^0/, '').toLowerCase();
			}
		} catch (_) { /* non-fatal */ }

		return {
			success: true,
			type: 'acceptInvitation',
			eventTitle: confirmEventTitle,
			dateDisplay: confirmDateDisplay,
			timeDisplay: confirmTimeDisplay
		};
	},

	declineInvitation: async ({ request, cookies }) => {
		const data = await request.formData();
		if (!verifyCsrfToken(cookies, data.get('_csrf'))) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.', type: 'declineInvitation' });
		}
		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in. Please refresh and try again.', type: 'declineInvitation' });
		}
		const invitationId = (data.get('invitationId') || '').toString().trim();
		if (!invitationId) {
			return fail(400, { error: 'Invalid invitation.', type: 'declineInvitation' });
		}

		const organisationId = await getCurrentOrganisationId();
		const invitation = await findById('myhub_invitations', invitationId);
		if (!invitation || invitation.contactId !== contactId || invitation.status !== 'pending') {
			return fail(404, { error: 'Invitation not found or already responded to.', type: 'declineInvitation' });
		}

		// Mark invitation declined
		await update('myhub_invitations', invitationId, { ...invitation, status: 'declined', respondedAt: new Date().toISOString() });

		// Notify coordinator
		try {
			const [rota, contact, event, occurrence] = await Promise.all([
				findById('rotas', invitation.rotaId),
				findById('contacts', contactId),
				findById('events', invitation.eventId),
				invitation.occurrenceId ? findById('occurrences', invitation.occurrenceId) : Promise.resolve(null)
			]);

			let toEmail = null;
			let toName = null;
			if (rota?.ownerId) {
				const owner = await findById('contacts', rota.ownerId);
				if (owner?.email) { toEmail = owner.email; toName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email; }
			}
			if (!toEmail) {
				toEmail = await getHubSuperAdminEmailForOrganisation(organisationId);
				toName = toName || 'Administrator';
			}
			if (toEmail && contact) {
				const volunteerName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.email;
				const dateDisplay = occurrence
					? new Date(occurrence.startsAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
					: 'Date to be confirmed';
				await sendInvitationResponseEmail({
					to: toEmail,
					name: toName,
					volunteerName,
					volunteerEmail: contact.email || '',
					eventTitle: event?.title || 'Event',
					role: rota?.role || '',
					dateDisplay,
					accepted: false
				}, { url: { origin: process.env.APP_BASE_URL || 'https://onnuma.com' } });
			}
		} catch (err) {
			console.error('[declineInvitation] Notification failed:', err?.message || err);
		}

		return { success: true, type: 'declineInvitation', message: "No problem — we'll let them know you can't make it." };
	}
};
