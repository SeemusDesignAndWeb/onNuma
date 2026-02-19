import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection, findById } from '$lib/crm/server/fileStore.js';
import { validateEvent, validateOccurrence, validateRota, getEventColors } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { sanitizeHtml } from '$lib/crm/server/sanitize.js';
import { generateOccurrences } from '$lib/crm/server/recurrence.js';
import { logDataChange } from '$lib/crm/server/audit.js';
import { getCurrentOrganisationId, filterByOrganisation, withOrganisationId } from '$lib/crm/server/orgContext.js';
import { getTeamsForOrganisation, getTeamById, updateTeam } from '$lib/crm/server/teams.js';

export async function load({ url, cookies }) {
	const organisationId = await getCurrentOrganisationId();
	const eventId = url.searchParams.get('eventId') || '';
	const eventColors = await getEventColors();
	const allLists = await readCollection('lists');
	const lists = filterByOrganisation(allLists, organisationId);
	const teams = await getTeamsForOrganisation(organisationId);

	let event = null;
	if (eventId) {
		event = await findById('events', eventId);
		if (event && event.organisationId !== organisationId) event = null;
	}

	const csrfToken = getCsrfToken(cookies) || '';
	return { event, eventId, teams, eventColors, lists, csrfToken };
}

export const actions = {
	createEvent: async ({ request, cookies, url, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const description = data.get('description') || '';
			const sanitized = await sanitizeHtml(description);
			const listIds = data.getAll('listIds').filter(id => id && id.trim().length > 0);

			const eventData = {
				title: data.get('title'),
				description: sanitized,
				location: data.get('location'),
				visibility: ['public', 'private', 'internal'].includes(data.get('visibility')) ? data.get('visibility') : 'private',
				enableSignup: data.get('enableSignup') === 'on' || data.get('enableSignup') === 'true',
				hideFromEmail: data.get('hideFromEmail') === 'on' || data.get('hideFromEmail') === 'true',
				showDietaryRequirements: data.get('showDietaryRequirements') === 'on' || data.get('showDietaryRequirements') === 'true',
				color: data.get('color') || '#9333ea',
				listIds,
				repeatType: data.get('repeatType') || 'none',
				repeatInterval: data.get('repeatInterval') ? parseInt(data.get('repeatInterval')) : 1,
				repeatEndType: data.get('repeatEndType') || 'never',
				repeatEndDate: data.get('repeatEndDate') || null,
				repeatCount: data.get('repeatCount') ? parseInt(data.get('repeatCount')) : null,
				repeatDayOfMonth: data.get('repeatDayOfMonth') ? parseInt(data.get('repeatDayOfMonth')) : null,
				repeatDayOfWeek: data.get('repeatDayOfWeek') || null,
				repeatWeekOfMonth: data.get('repeatWeekOfMonth') || null
			};

			const validated = await validateEvent(eventData);
			const organisationId = await getCurrentOrganisationId();
			const event = await create('events', withOrganisationId(validated, organisationId));

			let firstStart = data.get('firstStart');
			let firstEnd = data.get('firstEnd');
			const allDay = data.get('allDay') === 'true';
			const firstDate = data.get('firstDate');

			if (allDay && firstDate && (!firstStart || !firstEnd)) {
				firstStart = `${firstDate}T00:00`;
				firstEnd = `${firstDate}T23:59`;
			}

			if (firstStart && firstEnd) {
				if (validated.repeatType !== 'none') {
					const occurrences = generateOccurrences({
						repeatType: validated.repeatType,
						repeatInterval: validated.repeatInterval,
						startDate: new Date(firstStart),
						endDate: new Date(firstEnd),
						repeatEndType: validated.repeatEndType,
						repeatEndDate: validated.repeatEndDate ? new Date(validated.repeatEndDate) : null,
						repeatCount: validated.repeatCount,
						repeatDayOfMonth: validated.repeatDayOfMonth,
						repeatDayOfWeek: validated.repeatDayOfWeek,
						repeatWeekOfMonth: validated.repeatWeekOfMonth,
						location: validated.location
					});
					for (const occ of occurrences) {
						const occurrenceData = {
							eventId: event.id,
							startsAt: occ.startsAt,
							endsAt: occ.endsAt,
							location: occ.location,
							allDay: allDay
						};
						const validatedOcc = validateOccurrence(occurrenceData);
						await create('occurrences', withOrganisationId(validatedOcc, organisationId));
					}
				} else {
					const occurrenceData = {
						eventId: event.id,
						startsAt: new Date(firstStart).toISOString(),
						endsAt: new Date(firstEnd).toISOString(),
						location: validated.location,
						allDay: allDay
					};
					const validatedOcc = validateOccurrence(occurrenceData);
					await create('occurrences', withOrganisationId(validatedOcc, organisationId));
				}
			} else if (allDay && firstDate) {
				const occurrenceData = {
					eventId: event.id,
					startsAt: new Date(`${firstDate}T00:00`).toISOString(),
					endsAt: new Date(`${firstDate}T23:59`).toISOString(),
					location: validated.location,
					allDay: true
				};
				const validatedOcc = validateOccurrence(occurrenceData);
				await create('occurrences', withOrganisationId(validatedOcc, organisationId));
			}

			const adminId = locals?.admin?.id || null;
			const eventObj = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'create', 'event', event.id, { title: event.title }, eventObj);

			throw redirect(302, `${url.pathname}?eventId=${event.id}`);
		} catch (e) {
			if (e.status === 302) throw e;
			return fail(400, { error: e.message || 'Failed to create event' });
		}
	},

	createSchedules: async ({ request, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const eventId = (data.get('eventId') || '').toString().trim();
		const scheduleItemsJson = data.get('scheduleItems') || '[]';
		if (!eventId) return fail(400, { error: 'Event is required' });

		let scheduleItems;
		try {
			scheduleItems = JSON.parse(scheduleItemsJson);
			if (!Array.isArray(scheduleItems)) scheduleItems = [];
		} catch {
			return fail(400, { error: 'Invalid schedule data' });
		}

		const organisationId = await getCurrentOrganisationId();
		const event = await findById('events', eventId);
		if (!event || event.organisationId !== organisationId) {
			return fail(404, { error: 'Event not found' });
		}

		const visibility = data.get('visibility') === 'internal' ? 'internal' : 'public';
		const adminId = locals?.admin?.id || null;
		const eventObj = { getClientAddress: () => 'unknown', request };

		for (const item of scheduleItems) {
			if (item.type === 'team' && item.teamId) {
				const team = await getTeamById(item.teamId);
				if (!team || team.organisationId !== organisationId) continue;
				const roles = team.roles || [];
				if (roles.length === 0) continue;

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
					updatedRoles.push({ ...role, rotaId: rota.id });
					await logDataChange(adminId, 'create', 'rota', rota.id, {
						role: rota.role,
						eventId,
						eventName: event.title,
						fromTeam: team.name
					}, eventObj);
				}
				await updateTeam(team.id, { roles: updatedRoles });
			} else if (item.type === 'single' && item.role) {
				const rotaData = {
					eventId,
					occurrenceId: null,
					role: String(item.role).trim(),
					capacity: typeof item.capacity === 'number' && item.capacity > 0 ? item.capacity : 1,
					assignees: [],
					notes: '',
					ownerId: null,
					visibility,
					helpFiles: []
				};
				const validated = validateRota(rotaData);
				const rota = await create('rotas', withOrganisationId(validated, organisationId));
				await logDataChange(adminId, 'create', 'rota', rota.id, {
					role: rota.role,
					eventId,
					eventName: event.title
				}, eventObj);
			}
		}

		const message = 'Event and schedules created.';
		throw redirect(302, `/hub/events/${eventId}?scheduleCreated=${encodeURIComponent(message)}`);
	}
};
