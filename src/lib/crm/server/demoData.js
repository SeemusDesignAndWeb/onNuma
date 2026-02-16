/**
 * Shared logic for creating demo/test data for an organisation.
 * Used by multi-org Settings and by the organisation detail page.
 */
import { readCollection, writeCollection, create, update, updatePartial } from '$lib/crm/server/fileStore.js';
import { filterByOrganisation, withOrganisationId } from '$lib/crm/server/orgContext.js';
import {
	validateContact,
	validateEvent,
	validateOccurrence,
	validateRota,
	validateForm,
	validateNewsletterTemplate
} from '$lib/crm/server/validators.js';

/**
 * Run demo data creation for an organisation.
 * @param {string} organisationId
 * @param {{ createContacts: boolean, contactCount: number, createEvents: boolean, createRotas: boolean, createForms: boolean, createEmailTemplates: boolean, assignContactsToRotas: boolean }} options
 * @returns {Promise<{ contactsCreated: number, eventsCreated: number, rotasCreated: number, formsCreated: number, templatesCreated: number, assigneesAdded: number, bookingsCreated: number }>}
 */
export async function runDemoData(organisationId, options) {
	const {
		createContacts,
		contactCount,
		createEvents,
		createRotas,
		createForms,
		createEmailTemplates,
		assignContactsToRotas
	} = options;

	let contactsCreated = 0;
	let eventsCreated = 0;
	let rotasCreated = 0;
	let formsCreated = 0;
	let templatesCreated = 0;
	let assigneesAdded = 0;
	let bookingsCreated = 0;
	/** @type {string[]} */
	const createdContactIds = [];
	/** @type {{ eventId: string, occurrenceIds: string[] }[]} */
	const createdEventsWithOccurrences = [];

	if (createContacts) {
		const count = Math.max(1, Math.min(1000, contactCount));
		const allContacts = await readCollection('contacts');
		const orgContacts = filterByOrganisation(allContacts, organisationId);
		const removedContactIds = new Set(orgContacts.map((c) => c.id));
		const otherContacts = (Array.isArray(allContacts) ? allContacts : []).filter(
			(c) => c.organisationId !== organisationId
		);
		await writeCollection('contacts', otherContacts);

		const allRotas = await readCollection('rotas');
		const orgRotas = (Array.isArray(allRotas) ? allRotas : []).filter((r) => r.organisationId === organisationId);
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

		const titles = ['Staff meeting', 'Team meeting', 'Planning meeting', 'Outreach event', 'Local group'];
		const locations = ['Main Hall', 'Main Building', 'Community Room', 'Meeting Room A', 'The Hub'];
		const hourStarts = [9, 10, 14, 19, 11];
		const start = new Date();
		start.setHours(0, 0, 0, 0);

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

		// Create demo bookings (event signups) so the Hub Bookings panel has data
		const demoFirstNames = ['Sam', 'Jordan', 'Alex', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Taylor', 'Jamie', 'Reese'];
		const demoLastNames = ['Smith', 'Jones', 'Lee', 'Brown', 'Clark', 'Wright', 'Hall', 'Green', 'King', 'Scott'];
		const demoDomains = ['example.com', 'mail.test', 'demo.org'];
		for (const { eventId, occurrenceIds } of createdEventsWithOccurrences) {
			const numSignups = Math.floor(Math.random() * 9) + 4; // 4–12 per event
			for (let i = 0; i < numSignups; i++) {
				const occurrenceId = occurrenceIds[i % occurrenceIds.length];
				const firstName = demoFirstNames[i % demoFirstNames.length];
				const lastName = demoLastNames[Math.floor(i / demoFirstNames.length) % demoLastNames.length];
				const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}@${demoDomains[i % demoDomains.length]}`;
				const signup = {
					eventId,
					occurrenceId,
					name: `${firstName} ${lastName}`,
					email,
					guestCount: Math.random() > 0.8 ? Math.floor(Math.random() * 2) + 1 : 0
				};
				await create('event_signups', withOrganisationId(signup, organisationId));
				bookingsCreated++;
			}
		}
	}

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

	return {
		contactsCreated,
		eventsCreated,
		rotasCreated,
		formsCreated,
		templatesCreated,
		assigneesAdded,
		bookingsCreated
	};
}
