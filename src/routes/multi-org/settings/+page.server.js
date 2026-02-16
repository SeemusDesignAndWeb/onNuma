import { fail, redirect } from '@sveltejs/kit';
import { findById, readCollection } from '$lib/crm/server/fileStore.js';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { runDemoData } from '$lib/crm/server/demoData.js';
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
	const demoBookingsParam = url.searchParams.get('demo_bookings');
	const demoBookingsCreated = demoBookingsParam ? parseInt(demoBookingsParam, 10) : null;

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
		assigneesCount: Number.isNaN(assigneesCount) ? null : assigneesCount,
		demoBookingsCreated: Number.isNaN(demoBookingsCreated) ? null : demoBookingsCreated
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

		const result = await runDemoData(organisationId, {
			createContacts,
			contactCount: count,
			createEvents,
			createRotas,
			createForms,
			createEmailTemplates,
			assignContactsToRotas
		});

		const params = new URLSearchParams();
		if (result.contactsCreated > 0) params.set('anonymised', String(result.contactsCreated));
		if (result.eventsCreated > 0) params.set('demo_events', String(result.eventsCreated));
		if (result.rotasCreated > 0) params.set('demo_rotas', String(result.rotasCreated));
		if (result.formsCreated > 0) params.set('demo_forms', String(result.formsCreated));
		if (result.templatesCreated > 0) params.set('demo_templates', String(result.templatesCreated));
		if (result.assigneesAdded > 0) params.set('assignees', String(result.assigneesAdded));
		if (result.bookingsCreated > 0) params.set('demo_bookings', String(result.bookingsCreated));
		params.set('org', organisationId);
		throw redirect(
			302,
			getMultiOrgPublicPath('/multi-org/settings?' + params.toString(), !!locals.multiOrgAdminDomain)
		);
	}
};
