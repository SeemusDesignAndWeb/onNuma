import { fail, redirect } from '@sveltejs/kit';
import { findById, update, updatePartial, readCollection, writeCollection, create } from '$lib/crm/server/fileStore.js';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { filterByOrganisation, withOrganisationId } from '$lib/crm/server/orgContext.js';
import { validateContact, validateEvent, validateOccurrence, validateRota, validateForm, validateNewsletterTemplate } from '$lib/crm/server/validators.js';
import { getSettings, getDefaultTheme } from '$lib/crm/server/settings.js';

export async function load({ locals, url }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
	if (!multiOrgAdmin) {
		throw redirect(302, base('/multi-org/auth/login'));
	}
	const raw = await readCollection('organisations');
	const organisations = (Array.isArray(raw) ? raw : []).filter((o) => o && !o.archivedAt);
	organisations.sort((a, b) => ((a && a.name) || '').localeCompare((b && b.name) || ''));
	const anonymisedParam = url.searchParams.get('anonymised');
	const anonymisedCreated = anonymisedParam ? parseInt(anonymisedParam, 10) : null;
	const demoEventsParam = url.searchParams.get('demo_events');
	const demoEventsCreated = demoEventsParam ? parseInt(demoEventsParam, 10) : null;
	const demoRotasParam = url.searchParams.get('demo_rotas');
	const demoRotasCreated = demoRotasParam ? parseInt(demoRotasParam, 10) : null;
	const demoFormsParam = url.searchParams.get('demo_forms');
	const demoFormsCreated = demoFormsParam ? parseInt(demoFormsParam, 10) : null;
	const demoTemplatesParam = url.searchParams.get('demo_templates');
	const demoTemplatesCreated = demoTemplatesParam ? parseInt(demoTemplatesParam, 10) : null;
	const assigneesParam = url.searchParams.get('assignees');
	const assigneesCount = assigneesParam ? parseInt(assigneesParam, 10) : null;

	let hubTheme = getDefaultTheme();
	try {
		const hubSettings = await getSettings();
		if (hubSettings?.theme && typeof hubSettings.theme === 'object') {
			hubTheme = { ...getDefaultTheme(), ...hubSettings.theme };
		}
	} catch (_) {}

	return {
		organisations,
		multiOrgAdmin,
		hubTheme,
		anonymisedCreated: Number.isNaN(anonymisedCreated) ? null : anonymisedCreated,
		demoEventsCreated: Number.isNaN(demoEventsCreated) ? null : demoEventsCreated,
		demoRotasCreated: Number.isNaN(demoRotasCreated) ? null : demoRotasCreated,
		demoFormsCreated: Number.isNaN(demoFormsCreated) ? null : demoFormsCreated,
		demoTemplatesCreated: Number.isNaN(demoTemplatesCreated) ? null : demoTemplatesCreated,
		assigneesCount: Number.isNaN(assigneesCount) ? null : assigneesCount
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const form = await request.formData();
		const organisationId = form.get('organisationId')?.toString()?.trim() ?? '';
		const organisationNameConfirm = form.get('organisationNameConfirm')?.toString()?.trim() ?? '';
		const createContacts = form.get('createContacts') === 'on' || form.get('createContacts') === 'true';
		const countInput = form.get('contactCount')?.toString()?.trim() ?? '30';
		const count = parseInt(countInput, 10);
		const createEvents = form.get('createEvents') === 'on' || form.get('createEvents') === 'true';
		const createRotas = form.get('createRotas') === 'on' || form.get('createRotas') === 'true';
		const createForms = form.get('createForms') === 'on' || form.get('createForms') === 'true';
		const createEmailTemplates = form.get('createEmailTemplates') === 'on' || form.get('createEmailTemplates') === 'true';
		const assignContactsToRotas = form.get('assignContactsToRotas') === 'on' || form.get('assignContactsToRotas') === 'true';

		const formState = {
			organisationId,
			organisationNameConfirm,
			createContacts: !!createContacts,
			contactCount: countInput,
			createEvents: !!createEvents,
			createRotas: !!createRotas,
			createForms: !!createForms,
			createEmailTemplates: !!createEmailTemplates,
			assignContactsToRotas: !!assignContactsToRotas
		};

		if (!organisationId) {
			return fail(400, {
				error: 'Please select an organisation.',
				...formState,
				organisationId: ''
			});
		}
		const org = await findById('organisations', organisationId);
		if (!org) {
			return fail(404, { error: 'Organisation not found', ...formState });
		}
		const orgName = (org.name || '').trim();
		if (organisationNameConfirm !== orgName) {
			return fail(400, {
				error: 'The organisation name you entered does not match the selected organisation. Type the exact name to confirm.',
				...formState
			});
		}
		const anyOption = createContacts || createEvents || createRotas || createForms || createEmailTemplates || assignContactsToRotas;
		if (!anyOption) {
			return fail(400, {
				error: 'Select at least one option to generate (contacts, events, rotas, forms, email templates, or assign contacts to rotas).',
				...formState
			});
		}
		if (createContacts && (Number.isNaN(count) || count < 1 || count > 1000)) {
			return fail(400, {
				error: 'Contact count must be between 1 and 1000.',
				...formState,
				createContacts: true
			});
		}
		if (createRotas && !createEvents) {
			return fail(400, {
				error: 'Demo rotas require demo events. Enable "Demo events" as well.',
				...formState
			});
		}
		if (assignContactsToRotas && !(createContacts || createRotas)) {
			return fail(400, {
				error: 'Assigning contacts to rotas requires both anonymised contacts and demo rotas (or existing contacts and rotas). Enable "Anonymised contacts" and "Demo rotas".',
				...formState
			});
		}

		let contactsCreated = 0;
		let eventsCreated = 0;
		let rotasCreated = 0;
		let formsCreated = 0;
		let templatesCreated = 0;
		let assigneesAdded = 0;
		/** @type {string[]} */
		const createdContactIds = [];
		/** @type {{ eventId: string, occurrenceIds: string[] }[]} */
		const createdEventsWithOccurrences = [];

		if (createContacts) {
			const allContacts = await readCollection('contacts');
			const orgContacts = filterByOrganisation(allContacts, organisationId);
			const removedContactIds = new Set(orgContacts.map((c) => c.id));
			const otherContacts = (Array.isArray(allContacts) ? allContacts : []).filter(
				(c) => c.organisationId !== organisationId
			);
			await writeCollection('contacts', otherContacts);

			const allRotas = await readCollection('rotas');
			const orgRotas = (Array.isArray(allRotas) ? allRotas : []).filter(
				(r) => r.organisationId === organisationId
			);
			for (const rota of orgRotas) {
				const assignees = Array.isArray(rota.assignees) ? rota.assignees : [];
				const keptAssignees = assignees.filter((assignee) => {
					let contactId = null;
					if (typeof assignee === 'string') contactId = assignee;
					else if (assignee?.contactId && typeof assignee.contactId === 'string') contactId = assignee.contactId;
					else if (assignee?.id) contactId = assignee.id;
					return !contactId || !removedContactIds.has(contactId);
				});
				if (keptAssignees.length !== assignees.length) {
					await updatePartial('rotas', rota.id, { assignees: keptAssignees });
				}
			}

			const firstNames = ['Oliver', 'Amelia', 'George', 'Isla', 'Arthur', 'Ava', 'Noah', 'Mia', 'Leo', 'Ivy', 'Oscar', 'Freya', 'Theo', 'Florence', 'Finley', 'Willow', 'Henry', 'Emilia', 'Sophie', 'Ella', 'Jack', 'Grace', 'Thomas', 'Poppy', 'William', 'Charlotte'];
			const lastNames = ['Patel', 'Khan', 'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies', 'Evans', 'Wilson', 'Thomas', 'Roberts', 'Robinson', 'Wright', 'Thompson', 'White', 'Hughes', 'Edwards', 'Green', 'Hall', 'Martin', 'Wood', 'Clarke', 'Jackson', 'Hill', 'Lewis'];
			const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'btinternet.com', 'hotmail.co.uk', 'live.co.uk', 'sky.com'];
			for (let i = 1; i <= count; i++) {
				const firstName = firstNames[(i - 1) % firstNames.length];
				const lastName = lastNames[Math.floor((i - 1) / firstNames.length) % lastNames.length];
				const domain = domains[(i - 1) % domains.length];
				const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${count > 1 ? `.${i}` : ''}@${domain}`;
				const validated = validateContact({
					email,
					firstName,
					lastName,
					phone: i <= 999 ? `07000 000${String(i).padStart(3, '0')}` : `07000 ${i}`,
					addressLine1: `${i} Example Street`,
					addressLine2: i % 3 === 0 ? 'Flat ' + Math.floor(i / 3) : '',
					city: 'Anonymised',
					county: 'Demo',
					postcode: `AN${Math.min(99, Math.ceil(i / 10))} ${i % 10}AA`,
					country: 'United Kingdom',
					membershipStatus: ['member', 'regular-attender', 'visitor'][i % 3] || 'member',
					dateJoined: i % 2 === 0 ? new Date(2020 + (i % 4), i % 12, 1).toISOString().slice(0, 10) : null,
					notes: 'Demo contact (realistic name and email for testing).',
					subscribed: true,
					spouseId: null
				});
				const contact = await create('contacts', withOrganisationId(validated, organisationId));
				createdContactIds.push(contact.id);
			}
			contactsCreated = count;
		}

		if (createEvents) {
			const allEvents = await readCollection('events');
			const orgEvents = (Array.isArray(allEvents) ? allEvents : []).filter((e) => e.organisationId === organisationId);
			const removedEventIds = new Set(orgEvents.map((e) => e.id));

			const allRotas = await readCollection('rotas');
			const otherRotas = (Array.isArray(allRotas) ? allRotas : []).filter(
				(r) => r.organisationId !== organisationId || !removedEventIds.has(r.eventId)
			);
			await writeCollection('rotas', otherRotas);

			const allOccurrences = await readCollection('occurrences');
			const otherOccurrences = (Array.isArray(allOccurrences) ? allOccurrences : []).filter(
				(o) => !removedEventIds.has(o.eventId)
			);
			await writeCollection('occurrences', otherOccurrences);

			const allSignups = await readCollection('event_signups');
			const otherSignups = (Array.isArray(allSignups) ? allSignups : []).filter(
				(s) => !removedEventIds.has(s.eventId)
			);
			await writeCollection('event_signups', otherSignups);

			const otherEvents = (Array.isArray(allEvents) ? allEvents : []).filter((e) => e.organisationId !== organisationId);
			await writeCollection('events', otherEvents);

			const titles = ['Staff meeting', 'Meeting', 'Team meeting', 'Event Launch', 'Community Group'];
			const locations = ['Main Hall', 'Church Building', 'Community Room', 'Meeting Room A', 'The Hub'];
			const hourStarts = [9, 10, 14, 19, 11];
			const start = new Date();
			start.setHours(0, 0, 0, 0);

			const occurrenceIdsByEvent = [];
			for (let i = 0; i < 5; i++) {
				const eventData = {
					title: titles[i],
					description: '<p>Demo event for testing.</p>',
					location: locations[i],
					visibility: 'public',
					enableSignup: true,
					hideFromEmail: false,
					showDietaryRequirements: false,
					color: '#9333ea',
					listIds: [],
					repeatType: 'none',
					repeatInterval: 1,
					repeatEndType: 'never',
					repeatEndDate: null,
					repeatCount: null,
					repeatDayOfMonth: null,
					repeatDayOfWeek: null,
					repeatWeekOfMonth: null
				};
				const validatedEvent = await validateEvent(eventData);
				const event = await create('events', withOrganisationId(validatedEvent, organisationId));
				const occIds = [];

				// Two occurrences per event, a week apart
				const hour = hourStarts[i];
				for (let occ = 0; occ < 2; occ++) {
					const eventDate = new Date(start);
					eventDate.setDate(eventDate.getDate() + i * 2 + occ * 7);
					const startAt = new Date(eventDate);
					startAt.setHours(hour, 0, 0, 0);
					const endAt = new Date(eventDate);
					endAt.setHours(hour + 2, 0, 0, 0);
					const occurrenceData = {
						eventId: event.id,
						startsAt: startAt.toISOString(),
						endsAt: endAt.toISOString(),
						location: locations[i],
						allDay: false
					};
					const validatedOcc = validateOccurrence(occurrenceData);
					const occRecord = await create('occurrences', withOrganisationId(validatedOcc, organisationId));
					occIds.push(occRecord.id);
				}
				createdEventsWithOccurrences.push({ eventId: event.id, occurrenceIds: occIds });
			}
			eventsCreated = 5;
		}

		// Demo rotas (requires events; use created events or existing org events/occurrences)
		if (createRotas) {
			let eventsToUse = createdEventsWithOccurrences;
			if (eventsToUse.length === 0) {
				const allEvents = await readCollection('events');
				const orgEvents = (Array.isArray(allEvents) ? allEvents : []).filter((e) => e.organisationId === organisationId);
				const allOccurrences = await readCollection('occurrences');
				for (const ev of orgEvents) {
					const occs = (Array.isArray(allOccurrences) ? allOccurrences : []).filter((o) => o.eventId === ev.id);
					eventsToUse.push({ eventId: ev.id, occurrenceIds: occs.map((o) => o.id) });
				}
			}
			const rotaRoles = ['Host', 'Setup', 'Welcome', 'Speaker', 'Tech'];
			for (const { eventId, occurrenceIds } of eventsToUse) {
				const firstOccurrenceId = occurrenceIds[0] || null;
				for (let r = 0; r < 2; r++) {
					const role = rotaRoles[r % rotaRoles.length];
					const rotaData = {
						eventId,
						occurrenceId: firstOccurrenceId,
						role: role + ' (demo)',
						capacity: 2,
						assignees: [],
						notes: 'Demo rota for testing.',
						visibility: 'public'
					};
					const validated = validateRota(rotaData);
					await create('rotas', withOrganisationId(validated, organisationId));
					rotasCreated++;
				}
			}
		}

		// Assign contacts to rotas (needs contact IDs and org rotas)
		if (assignContactsToRotas) {
			let contactIdsToAssign = createdContactIds.length > 0 ? [...createdContactIds] : null;
			if (!contactIdsToAssign || contactIdsToAssign.length === 0) {
				const allContacts = await readCollection('contacts');
				const orgContacts = filterByOrganisation(allContacts, organisationId);
				contactIdsToAssign = orgContacts.slice(0, 20).map((c) => c.id).filter(Boolean);
			}
			const allRotas = await readCollection('rotas');
			const orgRotas = (Array.isArray(allRotas) ? allRotas : []).filter((r) => r.organisationId === organisationId);
			for (const rota of orgRotas.slice(0, 15)) {
				const capacity = rota.capacity ?? 1;
				const existingAssignees = Array.isArray(rota.assignees) ? rota.assignees : [];
				const occurrenceId = rota.occurrenceId || (rota.assignees && rota.assignees[0] && typeof rota.assignees[0] === 'object' && rota.assignees[0].occurrenceId) || null;
				const assigneesForOcc = existingAssignees.filter((a) => {
					const aOcc = typeof a === 'object' && a && 'occurrenceId' in a ? a.occurrenceId : rota.occurrenceId;
					return aOcc === occurrenceId;
				});
				const existingContactIds = new Set(
					assigneesForOcc.map((a) => (typeof a === 'string' ? a : a && (a.contactId || a.id) && typeof (a.contactId || a.id) === 'string' ? a.contactId || a.id : null)).filter(Boolean)
				);
				const toAdd = Math.min(Math.max(0, capacity - assigneesForOcc.length), 2);
				let added = 0;
				for (const cid of contactIdsToAssign) {
					if (existingContactIds.has(cid)) continue;
					existingAssignees.push({ contactId: cid, occurrenceId });
					existingContactIds.add(cid);
					added++;
					assigneesAdded++;
					if (added >= toAdd) break;
				}
				if (added > 0) {
					const updated = { ...rota, assignees: existingAssignees };
					const validated = validateRota(updated);
					await update('rotas', rota.id, validated);
				}
			}
		}

		// Demo forms
		if (createForms) {
			const allForms = await readCollection('forms');
			const otherForms = (Array.isArray(allForms) ? allForms : []).filter((f) => f.organisationId !== organisationId);
			await writeCollection('forms', otherForms);

			const formSpecs = [
				{ name: 'Demo Feedback Form', description: 'Collect feedback for testing.', fields: [{ type: 'text', label: 'Name', name: 'name', required: true, placeholder: '', options: [] }, { type: 'email', label: 'Email', name: 'email', required: true, placeholder: '', options: [] }, { type: 'textarea', label: 'Comments', name: 'comments', required: false, placeholder: '', options: [] }] },
				{ name: 'Demo Registration', description: 'Simple registration for demos.', fields: [{ type: 'text', label: 'Full name', name: 'full_name', required: true, placeholder: '', options: [] }, { type: 'email', label: 'Email', name: 'email', required: true, placeholder: '', options: [] }, { type: 'tel', label: 'Phone', name: 'phone', required: false, placeholder: '', options: [] }] },
				{ name: 'Demo Survey', description: 'Short survey for testing.', fields: [{ type: 'text', label: 'Your name', name: 'name', required: true, placeholder: '', options: [] }, { type: 'select', label: 'How did you hear about us?', name: 'hear_about', required: false, placeholder: '', options: ['Website', 'Friend', 'Social media', 'Other'] }, { type: 'radio', label: 'Would you like updates?', name: 'updates', required: false, placeholder: '', options: ['Yes', 'No'] }] }
			];
			for (const spec of formSpecs) {
				const validated = validateForm({ name: spec.name, description: spec.description, fields: spec.fields, isSafeguarding: false });
				await create('forms', withOrganisationId(validated, organisationId));
				formsCreated++;
			}
		}

		// Demo email templates
		if (createEmailTemplates) {
			const allTemplates = await readCollection('email_templates');
			const otherTemplates = (Array.isArray(allTemplates) ? allTemplates : []).filter((t) => t.organisationId !== organisationId);
			await writeCollection('email_templates', otherTemplates);

			const templateSpecs = [
				{ name: 'Demo Welcome Email', subject: 'Welcome – {{firstName}}', description: 'Demo welcome template', htmlContent: '<p>Hi {{firstName}},</p><p>Welcome! This is a demo email template for testing.</p><p>Best wishes</p>' },
				{ name: 'Demo Weekly Update', subject: 'Weekly update – {{org_name}}', description: 'Demo weekly template', htmlContent: '<p>Hi {{firstName}},</p><p>Here is your weekly update.</p><p>{{rotaLinks}}</p><p>{{upcomingEvents}}</p><p>Thanks</p>' },
				{ name: 'Demo Reminder', subject: 'Reminder: {{firstName}}', description: 'Demo reminder template', htmlContent: '<p>Hi {{firstName}},</p><p>This is a friendly reminder.</p><p>Contact us: {{support_email}}</p>' }
			];
			for (const spec of templateSpecs) {
				const textContent = (spec.htmlContent || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
				const validated = validateNewsletterTemplate({
					name: spec.name,
					subject: spec.subject,
					htmlContent: spec.htmlContent,
					textContent,
					description: spec.description
				});
				await create('email_templates', withOrganisationId(validated, organisationId));
				templatesCreated++;
			}
		}

		const params = new URLSearchParams();
		if (contactsCreated > 0) params.set('anonymised', String(contactsCreated));
		if (eventsCreated > 0) params.set('demo_events', String(eventsCreated));
		if (rotasCreated > 0) params.set('demo_rotas', String(rotasCreated));
		if (formsCreated > 0) params.set('demo_forms', String(formsCreated));
		if (templatesCreated > 0) params.set('demo_templates', String(templatesCreated));
		if (assigneesAdded > 0) params.set('assignees', String(assigneesAdded));
		params.set('org', organisationId);
		throw redirect(
			302,
			getMultiOrgPublicPath('/multi-org/settings?' + params.toString(), !!locals.multiOrgAdminDomain)
		);
	}
};
