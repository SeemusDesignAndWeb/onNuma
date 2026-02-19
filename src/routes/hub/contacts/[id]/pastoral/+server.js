/**
 * Pastoral care actions for a specific volunteer profile.
 * All actions require DBS Bolt-On and appropriate access.
 *
 * POST body (JSON): { action, ...params }
 *
 * Actions:
 *   record-absence   – { rotaId?, occurrenceId?, absenceDate?, type?, notes? }
 *   dismiss-flag     – { flagId }
 *   follow-up        – { flagId, note? }
 *   add-note         – { flagId, note }
 *   acknowledge-milestone – { milestoneId }
 */

import { json } from '@sveltejs/kit';
import { findById } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { isSuperAdmin, hasRouteAccess } from '$lib/crm/server/permissions.js';
import {
	recordAbsenceEvent,
	checkAndUpdateAbsenceFlag,
	dismissPastoralFlag,
	markPastoralFlagFollowedUp,
	addPastoralNote,
	acknowledgeMilestone
} from '$lib/crm/server/pastoral.js';

export async function POST({ request, params, locals }) {
	const admin = locals?.admin;
	if (!admin) return json({ error: 'Not authenticated' }, { status: 401 });

	const organisationId = await getCurrentOrganisationId();
	const org = organisationId ? await findById('organisations', organisationId) : null;
	if (!(org?.dbsBoltOn ?? org?.churchBoltOn)) return json({ error: 'DBS Bolt-On not enabled' }, { status: 403 });

	// Require contacts or schedules access, or team leader
	const superAdminEmail = locals?.superAdminEmail || null;
	const orgAreaPermissions = locals?.organisationAreaPermissions || null;
	const canAccess =
		isSuperAdmin(admin, superAdminEmail) ||
		hasRouteAccess(admin, '/hub/contacts', superAdminEmail, orgAreaPermissions) ||
		hasRouteAccess(admin, '/hub/schedules', superAdminEmail, orgAreaPermissions) ||
		(Array.isArray(admin.teamLeaderForTeamIds) && admin.teamLeaderForTeamIds.length > 0);
	if (!canAccess) return json({ error: 'Access denied' }, { status: 403 });

	const contactId = params.id;
	const contact = await findById('contacts', contactId);
	if (!contact) return json({ error: 'Contact not found' }, { status: 404 });

	let body;
	try { body = await request.json(); } catch { return json({ error: 'Invalid request body' }, { status: 400 }); }

	const { action } = body;

	try {
		switch (action) {
			case 'record-absence': {
				const { rotaId = null, occurrenceId = null, absenceDate = null, type = 'marked_absent', notes = null } = body;
				const event = await recordAbsenceEvent({
					organisationId,
					contactId,
					type,
					rotaId,
					occurrenceId,
					absenceDate,
					notes,
					createdBy: admin.id || null
				});
				// Check if this triggers an absence pattern flag
				const flag = await checkAndUpdateAbsenceFlag(organisationId, contactId, contact.firstName || null);
				return json({ success: true, event, flag });
			}

			case 'dismiss-flag': {
				const { flagId } = body;
				if (!flagId) return json({ error: 'flagId required' }, { status: 400 });
				await dismissPastoralFlag(flagId, admin.id || null);
				return json({ success: true });
			}

			case 'follow-up': {
				const { flagId, note = null } = body;
				if (!flagId) return json({ error: 'flagId required' }, { status: 400 });
				const trimmedNote = note ? note.toString().trim().slice(0, 2000) : null;
				await markPastoralFlagFollowedUp(flagId, admin.id || null, trimmedNote);
				return json({ success: true });
			}

			case 'add-note': {
				const { flagId, note } = body;
				if (!flagId) return json({ error: 'flagId required' }, { status: 400 });
				await addPastoralNote(flagId, (note || '').toString().trim().slice(0, 2000));
				return json({ success: true });
			}

			case 'acknowledge-milestone': {
				const { milestoneId } = body;
				if (!milestoneId) return json({ error: 'milestoneId required' }, { status: 400 });
				await acknowledgeMilestone(milestoneId);
				return json({ success: true });
			}

			default:
				return json({ error: `Unknown action: ${action}` }, { status: 400 });
		}
	} catch (err) {
		console.error('[pastoral] action error:', err);
		return json({ error: err?.message || 'An error occurred' }, { status: 500 });
	}
}
