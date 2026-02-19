/**
 * Pastoral care helpers (DBS Bolt-On). Record-keeping only.
 *
 * Absence pattern flags:  if a volunteer cancels or is marked absent 3+ times
 * in a rolling 8-week window, a quiet pastoral flag is raised on their profile.
 * Language is warm and supportive — not disciplinary.
 *
 * Long-service milestones: 1 year, 5 years, 50 sessions, 100 sessions.
 * Coordinator is prompted to send a personal thank-you.
 *
 * Pastoral notes: private, never visible in MyHub.
 */

import { readCollection, create, update, findById } from './fileStore.js';
import { filterByOrganisation } from './orgContext.js';
import { generateId } from './ids.js';

// ─── Absence window ───────────────────────────────────────────────────────────

const ABSENCE_THRESHOLD = 3;     // number of absences in the window
const ABSENCE_WINDOW_DAYS = 56;  // 8 weeks

// ─── Milestone definitions ────────────────────────────────────────────────────

export const MILESTONES = [
	{ key: '1year',       label: '1 year of service',  type: 'duration', years: 1 },
	{ key: '5years',      label: '5 years of service', type: 'duration', years: 5 },
	{ key: '50sessions',  label: '50 sessions served', type: 'sessions', count: 50 },
	{ key: '100sessions', label: '100 sessions served', type: 'sessions', count: 100 }
];

// ─── Absence events ───────────────────────────────────────────────────────────

/**
 * Record an absence event for a volunteer.
 * @param {{ organisationId: string, contactId: string, type: 'cancelled'|'marked_absent', rotaId?: string, occurrenceId?: string, absenceDate?: string, notes?: string, createdBy?: string }} params
 * @returns {Promise<object>} The created record
 */
export async function recordAbsenceEvent({ organisationId, contactId, type, rotaId = null, occurrenceId = null, absenceDate = null, notes = null, createdBy = null }) {
	const record = await create('volunteer_absence_events', {
		id: generateId(),
		organisationId,
		contactId,
		rotaId,
		occurrenceId,
		absenceDate: absenceDate || new Date().toISOString().slice(0, 10),
		type,
		notes: notes || null,
		createdAt: new Date().toISOString(),
		createdBy: createdBy || null
	});
	return record;
}

/**
 * Get absence events for a specific volunteer (most recent first).
 * @param {string} organisationId
 * @param {string} contactId
 * @returns {Promise<object[]>}
 */
export async function getAbsenceEventsForContact(organisationId, contactId) {
	const all = await readCollection('volunteer_absence_events');
	return all
		.filter((e) => e.organisationId === organisationId && e.contactId === contactId)
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Count absences in the rolling 8-week window.
 * @param {object[]} events - sorted absence events
 * @returns {number}
 */
function countRecentAbsences(events) {
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - ABSENCE_WINDOW_DAYS);
	return events.filter((e) => new Date(e.createdAt) >= cutoff).length;
}

// ─── Pastoral flags ───────────────────────────────────────────────────────────

/**
 * Get active pastoral flags for a volunteer.
 * @param {string} organisationId
 * @param {string} contactId
 * @returns {Promise<object[]>}
 */
export async function getActivePastoralFlagsForContact(organisationId, contactId) {
	const all = await readCollection('volunteer_pastoral_flags');
	return all.filter(
		(f) => f.organisationId === organisationId && f.contactId === contactId && f.status === 'active'
	);
}

/**
 * Get all pastoral flags for a volunteer (all statuses).
 * @param {string} organisationId
 * @param {string} contactId
 * @returns {Promise<object[]>}
 */
export async function getAllPastoralFlagsForContact(organisationId, contactId) {
	const all = await readCollection('volunteer_pastoral_flags');
	return all
		.filter((f) => f.organisationId === organisationId && f.contactId === contactId)
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get all active pastoral flags across an entire organisation, enriched with contact name.
 * @param {string} organisationId
 * @returns {Promise<Array<{ flag: object, contactName: string, contactId: string }>>}
 */
export async function getAllActivePastoralFlags(organisationId) {
	const [allFlags, contactsRaw] = await Promise.all([
		readCollection('volunteer_pastoral_flags'),
		readCollection('contacts')
	]);
	const contacts = filterByOrganisation(contactsRaw, organisationId);
	const contactMap = new Map(contacts.map((c) => [c.id, c]));

	return allFlags
		.filter((f) => f.organisationId === organisationId && f.status === 'active')
		.map((flag) => {
			const c = contactMap.get(flag.contactId);
			const contactName = c ? ([c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.email || 'Unknown') : 'Unknown';
			return { flag, contactName, contactId: flag.contactId };
		})
		.sort((a, b) => new Date(b.flag.createdAt) - new Date(a.flag.createdAt));
}

/**
 * Check recent absences and create or refresh an absence_pattern flag if threshold is met.
 * If fewer than threshold, ensures any existing active absence flag is left as-is
 * (flags must be explicitly dismissed by a coordinator).
 * @param {string} organisationId
 * @param {string} contactId
 * @param {string} contactFirstName - for personalised message
 * @returns {Promise<object|null>} Created flag, or null if no flag raised
 */
export async function checkAndUpdateAbsenceFlag(organisationId, contactId, contactFirstName) {
	const events = await getAbsenceEventsForContact(organisationId, contactId);
	const recentCount = countRecentAbsences(events);
	if (recentCount < ABSENCE_THRESHOLD) return null;

	// Check if an active absence flag already exists — don't duplicate
	const existing = await readCollection('volunteer_pastoral_flags');
	const activeFlag = existing.find(
		(f) =>
			f.organisationId === organisationId &&
			f.contactId === contactId &&
			f.type === 'absence_pattern' &&
			f.status === 'active'
	);
	if (activeFlag) {
		// Update the count but don't recreate
		await update('volunteer_pastoral_flags', activeFlag.id, {
			...activeFlag,
			absenceCount: recentCount,
			updatedAt: new Date().toISOString()
		});
		return activeFlag;
	}

	const name = contactFirstName ? contactFirstName : 'This volunteer';
	const message = `${name} has missed ${recentCount} sessions in the past 8 weeks — you may wish to check in.`;

	const flag = await create('volunteer_pastoral_flags', {
		id: generateId(),
		organisationId,
		contactId,
		type: 'absence_pattern',
		status: 'active',
		message,
		absenceCount: recentCount,
		pastoralNote: null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		dismissedAt: null,
		dismissedBy: null,
		followedUpAt: null,
		followedUpBy: null
	});
	return flag;
}

/**
 * Dismiss a pastoral flag.
 * @param {string} flagId
 * @param {string} adminId
 * @returns {Promise<void>}
 */
export async function dismissPastoralFlag(flagId, adminId) {
	const flag = await findById('volunteer_pastoral_flags', flagId);
	if (!flag) throw new Error('Flag not found');
	await update('volunteer_pastoral_flags', flagId, {
		...flag,
		status: 'dismissed',
		dismissedAt: new Date().toISOString(),
		dismissedBy: adminId || null,
		updatedAt: new Date().toISOString()
	});
}

/**
 * Mark a pastoral flag as followed up, optionally adding a private note.
 * @param {string} flagId
 * @param {string} adminId
 * @param {string|null} note
 * @returns {Promise<void>}
 */
export async function markPastoralFlagFollowedUp(flagId, adminId, note = null) {
	const flag = await findById('volunteer_pastoral_flags', flagId);
	if (!flag) throw new Error('Flag not found');
	await update('volunteer_pastoral_flags', flagId, {
		...flag,
		status: 'followed_up',
		followedUpAt: new Date().toISOString(),
		followedUpBy: adminId || null,
		pastoralNote: note ? note.toString().trim() : flag.pastoralNote,
		updatedAt: new Date().toISOString()
	});
}

/**
 * Add or update the private pastoral note on a flag without changing its status.
 * @param {string} flagId
 * @param {string} note
 * @returns {Promise<void>}
 */
export async function addPastoralNote(flagId, note) {
	const flag = await findById('volunteer_pastoral_flags', flagId);
	if (!flag) throw new Error('Flag not found');
	await update('volunteer_pastoral_flags', flagId, {
		...flag,
		pastoralNote: (note || '').toString().trim() || null,
		updatedAt: new Date().toISOString()
	});
}

// ─── Milestones ───────────────────────────────────────────────────────────────

/**
 * Compute volunteer service stats: total sessions served, first service date.
 * Uses the volunteer_absence_events (presence = total assigned occurrences minus
 * absences is too complex without a full register — instead we count distinct
 * rota+occurrence pairs the volunteer was ever assigned to, using rotas data).
 * @param {string} organisationId
 * @param {string} contactId
 * @returns {Promise<{ totalSessions: number, firstServiceDate: string|null }>}
 */
export async function computeVolunteerStats(organisationId, contactId) {
	const rotasRaw = await readCollection('rotas');
	const rotas = filterByOrganisation(rotasRaw, organisationId);
	const occurrencesRaw = await readCollection('occurrences');
	const occurrences = filterByOrganisation(occurrencesRaw, organisationId);
	const occurrenceMap = new Map(occurrences.map((o) => [o.id, o]));

	// Find all rotas this contact is assigned to
	const assignedRotas = rotas.filter((r) => {
		const assignees = r.assignees || [];
		return assignees.some((a) => {
			if (typeof a === 'string') return a === contactId;
			if (a && typeof a === 'object') return a.contactId === contactId;
			return false;
		});
	});

	// Count sessions: each rota+occurrence combination = 1 session
	// For rotas without a specific occurrence (recurring), count all future+past occurrences of that event
	const sessionDates = new Set();
	let firstDate = null;

	for (const rota of assignedRotas) {
		// Find which occurrenceIds this assignee is linked to
		const assignees = rota.assignees || [];
		for (const a of assignees) {
			let aContactId, aOccId;
			if (typeof a === 'string') { aContactId = a; aOccId = rota.occurrenceId || null; }
			else if (a && typeof a === 'object') { aContactId = a.contactId; aOccId = a.occurrenceId || rota.occurrenceId || null; }
			else continue;
			if (aContactId !== contactId) continue;

			if (aOccId) {
				const occ = occurrenceMap.get(aOccId);
				if (occ?.startsAt) {
					const dateKey = `${rota.id}:${aOccId}`;
					if (!sessionDates.has(dateKey)) {
						sessionDates.add(dateKey);
						const d = occ.startsAt.slice(0, 10);
						if (!firstDate || d < firstDate) firstDate = d;
					}
				}
			} else {
				// Rota spans all occurrences of this event
				const eventOccs = occurrences.filter((o) => o.eventId === rota.eventId);
				for (const occ of eventOccs) {
					const dateKey = `${rota.id}:${occ.id}`;
					if (!sessionDates.has(dateKey)) {
						sessionDates.add(dateKey);
						const d = occ.startsAt.slice(0, 10);
						if (!firstDate || d < firstDate) firstDate = d;
					}
				}
			}
		}
	}

	// Also consider the contact's join date / first rota assignment date
	const contact = await findById('contacts', contactId);
	const joinDate = contact?.dateJoined || null;
	if (joinDate && (!firstDate || joinDate < firstDate)) firstDate = joinDate;

	return { totalSessions: sessionDates.size, firstServiceDate: firstDate };
}

/**
 * Check for newly reached milestones and record them.
 * @param {string} organisationId
 * @param {string} contactId
 * @returns {Promise<object[]>} Newly recorded milestones
 */
export async function checkAndRecordMilestones(organisationId, contactId) {
	const { totalSessions, firstServiceDate } = await computeVolunteerStats(organisationId, contactId);

	const existingRaw = await readCollection('volunteer_milestones');
	const existing = existingRaw.filter((m) => m.organisationId === organisationId && m.contactId === contactId);
	const existingKeys = new Set(existing.map((m) => m.milestoneKey));

	const today = new Date();
	const newMilestones = [];

	for (const milestone of MILESTONES) {
		if (existingKeys.has(milestone.key)) continue;

		let reached = false;
		if (milestone.type === 'sessions') {
			reached = totalSessions >= milestone.count;
		} else if (milestone.type === 'duration' && firstServiceDate) {
			const start = new Date(firstServiceDate);
			const yearsServed = (today - start) / (1000 * 60 * 60 * 24 * 365.25);
			reached = yearsServed >= milestone.years;
		}

		if (reached) {
			const record = await create('volunteer_milestones', {
				id: generateId(),
				organisationId,
				contactId,
				milestoneKey: milestone.key,
				reachedAt: new Date().toISOString(),
				notifiedAt: null,
				acknowledgedAt: null
			});
			newMilestones.push(record);
		}
	}

	return newMilestones;
}

/**
 * Get unacknowledged milestones for a volunteer (coordinator prompts).
 * Marks them as notified when returned.
 * @param {string} organisationId
 * @param {string} contactId
 * @returns {Promise<object[]>} Milestones with label attached
 */
export async function getAndNotifyUnacknowledgedMilestones(organisationId, contactId) {
	const allRaw = await readCollection('volunteer_milestones');
	const milestones = allRaw.filter(
		(m) => m.organisationId === organisationId && m.contactId === contactId && !m.acknowledgedAt
	);

	const now = new Date().toISOString();
	const enriched = [];
	for (const m of milestones) {
		if (!m.notifiedAt) {
			await update('volunteer_milestones', m.id, { ...m, notifiedAt: now });
		}
		const def = MILESTONES.find((d) => d.key === m.milestoneKey);
		enriched.push({ ...m, label: def?.label || m.milestoneKey });
	}
	return enriched;
}

/**
 * Acknowledge a milestone (coordinator has acted on it).
 * @param {string} milestoneId
 * @returns {Promise<void>}
 */
export async function acknowledgeMilestone(milestoneId) {
	const m = await findById('volunteer_milestones', milestoneId);
	if (!m) throw new Error('Milestone not found');
	await update('volunteer_milestones', milestoneId, {
		...m,
		acknowledgedAt: new Date().toISOString()
	});
}
