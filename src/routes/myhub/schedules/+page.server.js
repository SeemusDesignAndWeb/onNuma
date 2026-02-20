import { fail } from '@sveltejs/kit';
import { readCollection, findById } from '$lib/crm/server/fileStore.js';
import { getCurrentOrganisationId, filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { getHubSuperAdminEmailForOrganisation } from '$lib/crm/server/settings.js';
import { sendVolunteerCannotAttendNotification } from '$lib/crm/server/email.js';
import { recordAbsenceEvent, checkAndUpdateAbsenceFlag } from '$lib/crm/server/pastoral.js';

/**
 * Automatically load rotas for the logged-in member (contact).
 * The member is resolved by the parent layout from the signed cookie.
 */
export async function load({ parent }) {
	const { member } = await parent();
	if (!member) return { rotas: [] };

	const email = (member.email || '').toLowerCase();
	const contactId = member.id;
	if (!email && !contactId) return { rotas: [] };

	try {
		const organisationId = await getCurrentOrganisationId();
		const [rotasRaw, eventsRaw, occurrencesRaw, contactsRaw, teamsRaw] = await Promise.all([
			readCollection('rotas'),
			readCollection('events'),
			readCollection('occurrences'),
			readCollection('contacts'),
			readCollection('teams')
		]);
		const rotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
		const events = organisationId ? filterByOrganisation(eventsRaw, organisationId) : eventsRaw;
		const occurrences = organisationId ? filterByOrganisation(occurrencesRaw, organisationId) : occurrencesRaw;
		const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;
		const teams = organisationId ? filterByOrganisation(teamsRaw, organisationId) : teamsRaw;

		const eventsMap = new Map(events.map(e => [e.id, e]));
		const occurrencesMap = new Map(occurrences.map(o => [o.id, o]));
		const contactsMap = new Map(contacts.map(c => [c.id, c]));

		// Map rotaId → { teamName, roleName } for team context display
		const rotaTeamMap = new Map();
		for (const team of teams) {
			for (const role of (team.roles || [])) {
				if (role.rotaId) {
					rotaTeamMap.set(role.rotaId, { teamName: team.name, roleName: role.name });
				}
			}
		}

		let userRotas = [];

		for (const rota of rotas) {
			if (!rota.assignees || !Array.isArray(rota.assignees)) continue;

			for (const assignee of rota.assignees) {
				let isMatch = false;
				let assigneeOccurrenceId = null;

				if (typeof assignee === 'string') {
					// assignee is a contactId string
					if (assignee === contactId) {
						isMatch = true;
						assigneeOccurrenceId = rota.occurrenceId || null;
					} else {
						const contact = contactsMap.get(assignee);
						if (contact && contact.email && contact.email.toLowerCase() === email) {
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
						if (contact && contact.email && contact.email.toLowerCase() === email) {
							isMatch = true;
							assigneeOccurrenceId = assignee.occurrenceId || rota.occurrenceId || null;
						}
					}
				}

				if (isMatch) {
					const event = eventsMap.get(rota.eventId);
					let occurrence = null;
					if (assigneeOccurrenceId) {
						occurrence = occurrencesMap.get(assigneeOccurrenceId);
					} else if (rota.occurrenceId) {
						occurrence = occurrencesMap.get(rota.occurrenceId);
					}

					let occurrencesToShow = [];
					if (!assigneeOccurrenceId && !rota.occurrenceId) {
						occurrencesToShow = occurrences
							.filter(o => o.eventId === rota.eventId)
							.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
					} else if (occurrence) {
						occurrencesToShow = [occurrence];
					}

					const teamInfo = rotaTeamMap.get(rota.id);
					if (occurrencesToShow.length > 0) {
						for (const occ of occurrencesToShow) {
							userRotas.push({
								rotaId: rota.id,
								role: rota.role,
								eventId: rota.eventId,
								eventTitle: event?.title || 'Unknown Event',
								occurrenceId: occ.id,
								date: occ.startsAt,
								startTime: occ.startsAt,
								endTime: occ.endsAt,
								location: occ.location || event?.location || '',
								teamName: teamInfo?.teamName || null,
								teamRoleName: teamInfo?.roleName || null
							});
						}
					} else {
						userRotas.push({
							rotaId: rota.id,
							role: rota.role,
							eventId: rota.eventId,
							eventTitle: event?.title || 'Unknown Event',
							occurrenceId: null,
							date: null,
							startTime: null,
							endTime: null,
							location: event?.location || '',
							teamName: teamInfo?.teamName || null,
							teamRoleName: teamInfo?.roleName || null
						});
					}
				}
			}
		}

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		userRotas = userRotas.filter(rota => {
			if (!rota.date) return true;
			return new Date(rota.date) >= today;
		});

		userRotas.sort((a, b) => {
			if (a.date && b.date) return new Date(a.date) - new Date(b.date);
			if (a.date) return -1;
			if (b.date) return 1;
			return a.eventTitle.localeCompare(b.eventTitle);
		});

		return { rotas: userRotas };
	} catch (error) {
		console.error('[my rotas] Error loading rotas:', error);
		return { rotas: [], error: 'Could not load your schedules. Please try again.' };
	}
}

export const actions = {
	cannotVolunteer: async (event) => {
		const { request, cookies } = event;
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.' });
		}

		const contactId = getMemberContactIdFromCookie(cookies);
		if (!contactId) {
			return fail(401, { error: 'You must be signed in. Please refresh and try again.' });
		}

		const rotaId = data.get('rotaId');
		const occurrenceId = data.get('occurrenceId') || null;
		if (!rotaId || typeof rotaId !== 'string') {
			return fail(400, { error: 'Invalid schedule. Please refresh and try again.' });
		}

		const organisationId = await getCurrentOrganisationId();
		const [rotasRaw, eventsRaw, occurrencesRaw, contactsRaw] = await Promise.all([
			readCollection('rotas'),
			readCollection('events'),
			readCollection('occurrences'),
			readCollection('contacts')
		]);
		const rotas = organisationId ? filterByOrganisation(rotasRaw, organisationId) : rotasRaw;
		const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;
		const events = organisationId ? filterByOrganisation(eventsRaw, organisationId) : eventsRaw;
		const occurrences = organisationId ? filterByOrganisation(occurrencesRaw, organisationId) : occurrencesRaw;
		const eventsMap = new Map(events.map((e) => [e.id, e]));
		const occurrencesMap = new Map(occurrences.map((o) => [o.id, o]));

		const rota = rotas.find((r) => r.id === rotaId);
		if (!rota) {
			return fail(404, { error: 'Schedule not found.' });
		}

		const contact = contacts.find((c) => c.id === contactId);
		if (!contact) {
			return fail(400, { error: 'Your account could not be found. Please sign in again.' });
		}
		const memberEmail = (contact.email || '').toLowerCase();

		// Check this member is assigned to this rota for this occurrence
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
			const matchContact = aContactId === contactId || (contact.email && typeof a === 'object' && (a.email || '').toLowerCase() === memberEmail);
			// Same occurrence, or both unspecific, or rota is for all occurrences and assignee has no specific occurrence (they're on every date)
			const matchOcc =
				(aOccId === null && occurrenceId === null) ||
				aOccId === occurrenceId ||
				(rota.occurrenceId === null && aOccId === null && occurrenceId !== null);
			return matchContact && matchOcc;
		});
		if (!isAssigned) {
			return fail(403, { error: "You are not assigned to this schedule for this date, so you don't need to report that you can't volunteer." });
		}

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

		if (rota.ownerId) {
			const owner = await findById('contacts', rota.ownerId);
			if (owner && owner.email) {
				toEmail = owner.email;
				toName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim() || owner.email;
			}
		}
		if (!toEmail) {
			toEmail = await getHubSuperAdminEmailForOrganisation(organisationId);
			toName = toName || 'Administrator';
		}
		if (!toEmail) {
			return fail(500, { error: 'No schedule owner or administrator is set. Please contact your organisation to report that you cannot volunteer.' });
		}

		const volunteerName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim() || contact.email || 'A volunteer';

		try {
			await sendVolunteerCannotAttendNotification(
				{ to: toEmail, name: toName },
				{
					volunteerName,
					volunteerEmail: contact.email || '',
					role: rota.role,
					eventTitle: eventData?.title || 'Event',
					dateDisplay
				},
				event
			);
		} catch (err) {
			console.error('[my rotas] cannotVolunteer email failed:', err);
			return fail(500, { error: 'We could not send the notification. Please try again or contact the schedule owner directly.' });
		}

		// Record absence for pastoral care tracking (church bolt-on; non-fatal if org doesn't have it)
		try {
			const org = organisationId ? await findById('organisations', organisationId) : null;
			if (org?.dbsBoltOn ?? org?.churchBoltOn) {
				const occurrence = occurrenceId ? occurrencesMap.get(occurrenceId) : null;
				await recordAbsenceEvent({
					organisationId,
					contactId,
					type: 'cancelled',
					rotaId: rotaId || null,
					occurrenceId: occurrenceId || null,
					absenceDate: occurrence?.startsAt ? occurrence.startsAt.slice(0, 10) : null,
					notes: null,
					createdBy: null
				});
				await checkAndUpdateAbsenceFlag(organisationId, contactId, contact.firstName || null);
			}
		} catch (pastoralErr) {
			console.warn('[my schedules] pastoral absence record failed (non-fatal):', pastoralErr?.message);
		}

		return {
			success: true,
			message: "We've emailed the schedule owner to let them know you can no longer volunteer on this date."
		};
	}
};
