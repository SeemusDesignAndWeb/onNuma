import { fail, redirect } from '@sveltejs/kit';
import { findById, updatePartial, readCollection, writeCollection, create } from '$lib/crm/server/fileStore.js';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { filterByOrganisation, withOrganisationId } from '$lib/crm/server/orgContext.js';
import { validateContact, validateEvent, validateOccurrence } from '$lib/crm/server/validators.js';
import { getLanding, saveLanding } from '$lib/server/database.js';

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
	const pricingSaved = url.searchParams.get('pricing_saved') === '1';

	// Get current landing/pricing config
	const landing = getLanding();
	const pricing = landing.pricing || {};

	return {
		organisations,
		multiOrgAdmin,
		anonymisedCreated: Number.isNaN(anonymisedCreated) ? null : anonymisedCreated,
		demoEventsCreated: Number.isNaN(demoEventsCreated) ? null : demoEventsCreated,
		pricing,
		pricingSaved
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

		if (!organisationId) {
			return fail(400, {
				error: 'Please select an organisation.',
				organisationId: '',
				organisationNameConfirm,
				createContacts: !!createContacts,
				contactCount: countInput,
				createEvents: !!createEvents
			});
		}
		const org = await findById('organisations', organisationId);
		if (!org) {
			return fail(404, { error: 'Organisation not found' });
		}
		const orgName = (org.name || '').trim();
		if (organisationNameConfirm !== orgName) {
			return fail(400, {
				error: 'The organisation name you entered does not match the selected organisation. Type the exact name to confirm.',
				organisationId,
				organisationNameConfirm,
				createContacts: !!createContacts,
				contactCount: countInput,
				createEvents: !!createEvents
			});
		}
		if (!createContacts && !createEvents) {
			return fail(400, {
				error: 'Select at least one option: anonymised contacts and/or demo events.',
				organisationId,
				organisationNameConfirm,
				createContacts: !!createContacts,
				contactCount: countInput,
				createEvents: !!createEvents
			});
		}
		if (createContacts && (Number.isNaN(count) || count < 1 || count > 1000)) {
			return fail(400, {
				error: 'Contact count must be between 1 and 1000.',
				organisationId,
				organisationNameConfirm,
				createContacts: true,
				contactCount: countInput,
				createEvents: !!createEvents
			});
		}

		let contactsCreated = 0;
		let eventsCreated = 0;

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

			for (let i = 1; i <= count; i++) {
				const email = `contact${i}@anonymised.example.com`;
				const validated = validateContact({
					email,
					firstName: 'Contact',
					lastName: String(i),
					phone: i <= 999 ? `07000 000${String(i).padStart(3, '0')}` : `07000 ${i}`,
					addressLine1: `${i} Example Street`,
					addressLine2: i % 3 === 0 ? 'Flat ' + Math.floor(i / 3) : '',
					city: 'Anonymised',
					county: 'Demo',
					postcode: `AN${Math.min(99, Math.ceil(i / 10))} ${i % 10}AA`,
					country: 'United Kingdom',
					membershipStatus: ['member', 'regular-attender', 'visitor'][i % 3] || 'member',
					dateJoined: i % 2 === 0 ? new Date(2020 + (i % 4), i % 12, 1).toISOString().slice(0, 10) : null,
					notes: 'Anonymised demo contact.',
					subscribed: true,
					spouseId: null
				});
				await create('contacts', withOrganisationId(validated, organisationId));
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
					await create('occurrences', withOrganisationId(validatedOcc, organisationId));
				}
			}
			eventsCreated = 5;
		}

		const params = new URLSearchParams();
		if (contactsCreated > 0) params.set('anonymised', String(contactsCreated));
		if (eventsCreated > 0) params.set('demo_events', String(eventsCreated));
		params.set('org', organisationId);
		throw redirect(
			302,
			getMultiOrgPublicPath('/multi-org/settings?' + params.toString(), !!locals.multiOrgAdminDomain)
		);
	},

	savePricing: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const form = await request.formData();

		const basePrice = parseInt(form.get('basePrice')?.toString() ?? '12', 10);
		const pricePerTenUsers = parseInt(form.get('pricePerTenUsers')?.toString() ?? '1', 10);
		const pricePerTenUsersAbove = parseInt(form.get('pricePerTenUsersAbove')?.toString() ?? '2', 10);
		const threshold = parseInt(form.get('threshold')?.toString() ?? '300', 10);
		const minUsers = parseInt(form.get('minUsers')?.toString() ?? '50', 10);
		const maxUsers = parseInt(form.get('maxUsers')?.toString() ?? '500', 10);
		const defaultUsers = parseInt(form.get('defaultUsers')?.toString() ?? '100', 10);

		// Validate
		if (basePrice < 0 || basePrice > 1000) {
			return fail(400, { pricingError: 'Base price must be between 0 and 1000' });
		}
		if (pricePerTenUsers < 0 || pricePerTenUsers > 100) {
			return fail(400, { pricingError: 'Price per 10 users must be between 0 and 100' });
		}
		if (pricePerTenUsersAbove < 0 || pricePerTenUsersAbove > 100) {
			return fail(400, { pricingError: 'Price per 10 users (above threshold) must be between 0 and 100' });
		}
		if (threshold < 10 || threshold > 10000) {
			return fail(400, { pricingError: 'Threshold must be between 10 and 10000' });
		}
		if (minUsers < 1 || minUsers > 1000) {
			return fail(400, { pricingError: 'Minimum users must be between 1 and 1000' });
		}
		if (maxUsers < minUsers || maxUsers > 10000) {
			return fail(400, { pricingError: 'Maximum users must be greater than minimum and at most 10000' });
		}
		if (defaultUsers < minUsers || defaultUsers > maxUsers) {
			return fail(400, { pricingError: 'Default users must be between min and max users' });
		}

		const pricing = {
			basePrice,
			pricePerTenUsers,
			pricePerTenUsersAbove,
			threshold,
			minUsers,
			maxUsers,
			defaultUsers
		};

		const landing = getLanding();
		saveLanding({ ...landing, pricing });

		throw redirect(
			302,
			getMultiOrgPublicPath('/multi-org/settings?pricing_saved=1', !!locals.multiOrgAdminDomain)
		);
	}
};
