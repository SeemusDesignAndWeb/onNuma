import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection, findById } from '$lib/crm/server/fileStore.js';
import { validateRota } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId, filterByOrganisation, withOrganisationId, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';
import { getTeamsForOrganisation, getTeamById, updateTeam } from '$lib/crm/server/teams.js';

export async function load({ url, cookies, parent }) {
	const organisationId = await getCurrentOrganisationId();
	const { plan } = await parent();
	const eventId = url.searchParams.get('eventId') || '';
	const events = filterByOrganisation(await readCollection('events'), organisationId);
	const occurrences = filterByOrganisation(await readCollection('occurrences'), organisationId);
	const orgContacts = filterByOrganisation(await readCollection('contacts'), organisationId);
	const contacts = contactsWithinPlanLimit(orgContacts, plan);
	const teams = await getTeamsForOrganisation(organisationId);

	const csrfToken = getCsrfToken(cookies) || '';
	return { events, occurrences, eventId, contacts, teams, csrfToken };
}

export const actions = {
	create: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const eventId = (data.get('eventId') || '').toString().trim();
		const teamId = (data.get('teamId') || '').toString().trim() || null;
		const organisationId = await getCurrentOrganisationId();

		// Mode: if teamId provided, create one rota per team role and link team; otherwise single rota
		if (teamId) {
			const team = await getTeamById(teamId);
			if (!team) return fail(404, { error: 'Team not found' });
			if (team.organisationId !== organisationId) return fail(404, { error: 'Team not found' });

			const event = await findById('events', eventId);
			if (!event) return fail(404, { error: 'Event not found' });
			if (event.organisationId !== organisationId) return fail(404, { error: 'Event not found' });

			const visibility = data.get('visibility') === 'internal' ? 'internal' : 'public';
			const roles = team.roles || [];
			if (roles.length === 0) return fail(400, { error: 'This team has no roles. Add roles to the team first.' });

			const createdRotaIds = [];
			const updatedRoles = [];

			for (const role of roles) {
				const rotaData = {
					eventId,
					occurrenceId: null,
					role: role.name || 'Unnamed',
					capacity: typeof role.capacity === 'number' && role.capacity > 0 ? role.capacity : 1,
					assignees: [],
					notes: '',
					ownerId: null,
					visibility,
					helpFiles: []
				};
				const validated = validateRota(rotaData);
				const rota = await create('rotas', withOrganisationId(validated, organisationId));
				createdRotaIds.push(rota.id);
				updatedRoles.push({ ...role, rotaId: rota.id });

				const adminId = locals?.admin?.id || null;
				const eventObj = { getClientAddress: () => 'unknown', request };
				await logDataChange(adminId, 'create', 'rota', rota.id, {
					role: rota.role,
					eventId: rota.eventId,
					eventName: event.title || 'unknown',
					fromTeam: team.name
				}, eventObj);
			}

			await updateTeam(teamId, { roles: updatedRoles });

			const count = createdRotaIds.length;
			const message = count === 1
				? `Added 1 role from ${team.name} to this event.`
				: `Added ${team.name} (${count} roles) to this event.`;
			throw redirect(302, `/hub/events/${eventId}?scheduleCreated=${encodeURIComponent(message)}`);
		}

		// Single role
		try {
			const notes = data.get('notes') || '';
			const sanitized = await sanitizeHtml(notes);

			let helpFiles = [];
			const helpFilesJson = data.get('helpFiles');
			if (helpFilesJson) {
				try {
					helpFiles = JSON.parse(helpFilesJson);
				} catch (e) {
					console.error('Error parsing helpFiles:', e);
				}
			}

			const rotaData = {
				eventId: data.get('eventId'),
				occurrenceId: data.get('occurrenceId') || null,
				role: data.get('role'),
				capacity: parseInt(data.get('capacity') || '1', 10),
				assignees: [],
				notes: sanitized,
				ownerId: data.get('ownerId') || null,
				visibility: data.get('visibility') || 'public',
				helpFiles: helpFiles
			};

			const validated = validateRota(rotaData);
			const rota = await create('rotas', withOrganisationId(validated, organisationId));

			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			const eventRecord = await findById('events', rota.eventId);
			await logDataChange(adminId, 'create', 'rota', rota.id, {
				role: rota.role,
				eventId: rota.eventId,
				eventName: eventRecord?.title || 'unknown'
			}, event);

			throw redirect(302, `/hub/schedules/${rota.id}`);
		} catch (error) {
			if (error.status === 302) throw error;
			return fail(400, { error: error.message });
		}
	}
};

