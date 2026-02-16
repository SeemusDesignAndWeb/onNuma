/**
 * Gather and delete all data related to a contact (Super admin / GDPR).
 * Used from Hub Settings → Advanced → Contact data.
 */

import {
	findById,
	findMany,
	readCollection,
	update,
	remove,
	writeCollection
} from '$lib/crm/server/fileStore.js';
import { filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { logDataChange } from '$lib/crm/server/audit.js';

/**
 * Check if an assignee (rota/meeting_planner) refers to the given contactId.
 * @param {string|object} assignee - string contactId or { contactId, occurrenceId } or { name, email }
 */
function assigneeMatchesContact(assignee, contactId) {
	if (!contactId) return false;
	if (typeof assignee === 'string') return assignee === contactId;
	if (assignee && typeof assignee === 'object') {
		const cid = assignee.contactId || assignee.id;
		return typeof cid === 'string' && cid === contactId;
	}
	return false;
}

/**
 * Gather all data related to a contact for export (GDPR / backup).
 * @param {string} contactId
 * @param {string} organisationId
 * @returns {Promise<{ contact: object | null, lists: array, rotas: array, meetingPlanners: array, holidays: array, contactTokens: array, members: array, eventSignups: array }>}
 */
export async function gatherContactData(contactId, organisationId) {
	const contact = await findById('contacts', contactId);
	if (!contact) {
		return { contact: null, lists: [], rotas: [], meetingPlanners: [], holidays: [], contactTokens: [], members: [], eventSignups: [] };
	}
	if (contact.organisationId != null && contact.organisationId !== organisationId) {
		return { contact: null, lists: [], rotas: [], meetingPlanners: [], holidays: [], contactTokens: [], members: [], eventSignups: [] };
	}

	const contactEmail = (contact.email || '').toLowerCase().trim();

	const [allLists, allRotas, allMeetingPlanners, holidays, contactTokens, members, allEventSignups, allOccurrences] = await Promise.all([
		readCollection('lists'),
		readCollection('rotas'),
		readCollection('meeting_planners'),
		findMany('holidays', (h) => h.contactId === contactId),
		findMany('contact_tokens', (t) => t.contactId === contactId),
		findMany('members', (m) => m.contactId === contactId),
		readCollection('event_signups'),
		readCollection('occurrences')
	]);

	const orgLists = filterByOrganisation(allLists, organisationId);
	const lists = orgLists.filter((l) => Array.isArray(l.contactIds) && l.contactIds.includes(contactId));

	const orgRotas = filterByOrganisation(allRotas, organisationId);
	const rotas = orgRotas.filter((r) => (r.assignees || []).some((a) => assigneeMatchesContact(a, contactId)));

	const orgMeetingPlanners = filterByOrganisation(allMeetingPlanners, organisationId);
	const meetingPlanners = orgMeetingPlanners.filter((mp) =>
		(mp.assignees || []).some((a) => assigneeMatchesContact(a, contactId))
	);

	const orgOccurrences = filterByOrganisation(allOccurrences, organisationId);
	const orgEventSignups = allEventSignups.filter((s) => {
		const occ = orgOccurrences.find((o) => o.id === s.occurrenceId);
		return occ && contactEmail && s.email && s.email.toLowerCase().trim() === contactEmail;
	});

	return {
		exportedAt: new Date().toISOString(),
		contact,
		lists: lists.map((l) => ({ id: l.id, name: l.name, contactIds: l.contactIds })),
		rotas: rotas.map((r) => ({
			id: r.id,
			eventId: r.eventId,
			occurrenceId: r.occurrenceId,
			role: r.role,
			assignees: (r.assignees || []).filter((a) => assigneeMatchesContact(a, contactId))
		})),
		meetingPlanners: meetingPlanners.map((mp) => ({
			id: mp.id,
			eventId: mp.eventId,
			occurrenceId: mp.occurrenceId,
			role: mp.role,
			assignees: (mp.assignees || []).filter((a) => assigneeMatchesContact(a, contactId))
		})),
		holidays,
		contactTokens,
		members,
		eventSignups: orgEventSignups
	};
}

/**
 * Remove contact from a list's contactIds (in-place safe).
 */
function removeContactFromList(list, contactId) {
	if (!list.contactIds || !Array.isArray(list.contactIds)) return list;
	return { ...list, contactIds: list.contactIds.filter((id) => id !== contactId) };
}

/**
 * Remove contact from rota/meeting_planner assignees.
 */
function filterAssigneesForContact(assignees, contactId) {
	if (!Array.isArray(assignees)) return assignees;
	return assignees.filter((a) => !assigneeMatchesContact(a, contactId));
}

/**
 * Delete all data related to a contact. Super admin only.
 * - Deletes contact, holidays, contact_tokens, members
 * - Removes contact from lists (contactIds)
 * - Removes assignee from rotas and meeting_planners
 * - Deletes event_signups that match contact email (same org events)
 * - Updates spouse link if contact had spouseId
 * @param {string} contactId
 * @param {string} organisationId
 * @param {{ adminId?: string, request?: object }} auditContext
 * @returns {Promise<{ deleted: { contact: boolean, holidays: number, contactTokens: number, members: number, eventSignups: number }, updated: { lists: number, rotas: number, meetingPlanners: number } }>}
 */
export async function deleteContactData(contactId, organisationId, auditContext = {}) {
	const contact = await findById('contacts', contactId);
	if (!contact) {
		return {
			deleted: { contact: false, holidays: 0, contactTokens: 0, members: 0, eventSignups: 0 },
			updated: { lists: 0, rotas: 0, meetingPlanners: 0 }
		};
	}
	if (contact.organisationId != null && contact.organisationId !== organisationId) {
		throw new Error('Contact does not belong to the current organisation');
	}

	const contactEmail = (contact.email || '').toLowerCase().trim();
	const result = {
		deleted: { contact: false, holidays: 0, contactTokens: 0, members: 0, eventSignups: 0 },
		updated: { lists: 0, rotas: 0, meetingPlanners: 0 }
	};

	// 1) Remove from spouse if this contact was linked as spouse
	if (contact.spouseId) {
		const spouse = await findById('contacts', contact.spouseId);
		if (spouse && spouse.spouseId === contactId) {
			await update('contacts', contact.spouseId, { spouseId: null });
		}
	}
	// Any contact that had this contact as spouseId: clear their spouseId
	const allContacts = await readCollection('contacts');
	const orgContacts = filterByOrganisation(allContacts, organisationId);
	for (const c of orgContacts) {
		if (c.spouseId === contactId) {
			await update('contacts', c.id, { spouseId: null });
		}
	}

	// 2) Lists: remove contactId from contactIds
	const allLists = await readCollection('lists');
	const orgLists = filterByOrganisation(allLists, organisationId);
	for (const list of orgLists) {
		if (Array.isArray(list.contactIds) && list.contactIds.includes(contactId)) {
			const updated = removeContactFromList(list, contactId);
			await update('lists', list.id, { contactIds: updated.contactIds });
			result.updated.lists += 1;
		}
	}

	// 3) Rotas: remove assignees that are this contact
	const allRotas = await readCollection('rotas');
	const orgRotas = filterByOrganisation(allRotas, organisationId);
	for (const rota of orgRotas) {
		const assignees = rota.assignees || [];
		const newAssignees = filterAssigneesForContact(assignees, contactId);
		if (newAssignees.length !== assignees.length) {
			await update('rotas', rota.id, { assignees: newAssignees });
			result.updated.rotas += 1;
		}
	}

	// 4) Meeting planners: same
	const allMeetingPlanners = await readCollection('meeting_planners');
	const orgMeetingPlanners = filterByOrganisation(allMeetingPlanners, organisationId);
	for (const mp of orgMeetingPlanners) {
		const assignees = mp.assignees || [];
		const newAssignees = filterAssigneesForContact(assignees, contactId);
		if (newAssignees.length !== assignees.length) {
			await update('meeting_planners', mp.id, { assignees: newAssignees });
			result.updated.meetingPlanners += 1;
		}
	}

	// 5) Delete holidays, contact_tokens, members
	const holidays = await findMany('holidays', (h) => h.contactId === contactId);
	for (const h of holidays) {
		await remove('holidays', h.id);
		result.deleted.holidays += 1;
	}
	const contactTokens = await findMany('contact_tokens', (t) => t.contactId === contactId);
	for (const t of contactTokens) {
		await remove('contact_tokens', t.id);
		result.deleted.contactTokens += 1;
	}
	const members = await findMany('members', (m) => m.contactId === contactId);
	for (const m of members) {
		await remove('members', m.id);
		result.deleted.members += 1;
	}

	// 6) Event signups: delete those matching contact email (for this org's events)
	const allOccurrences = await readCollection('occurrences');
	const orgOccurrenceIds = new Set(
		filterByOrganisation(allOccurrences, organisationId).map((o) => o.id)
	);
	const allEventSignups = await readCollection('event_signups');
	for (const s of allEventSignups) {
		if (
			orgOccurrenceIds.has(s.occurrenceId) &&
			contactEmail &&
			s.email &&
			s.email.toLowerCase().trim() === contactEmail
		) {
			await remove('event_signups', s.id);
			result.deleted.eventSignups += 1;
		}
	}

	// 7) Delete the contact
	await remove('contacts', contactId);
	result.deleted.contact = true;

	// Audit
	const adminId = auditContext.adminId || null;
	const event = auditContext.request ? { getClientAddress: () => 'unknown', request: auditContext.request } : null;
	if (event) {
		await logDataChange(adminId, 'delete', 'contact', contactId, {
			email: contact.email,
			name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
			gdprDelete: true,
			...result
		}, event);
	}

	return result;
}
