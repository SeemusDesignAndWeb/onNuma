import { fail, redirect } from '@sveltejs/kit';
import { findById, update, updatePartial, readCollection, writeCollection, create } from '$lib/crm/server/fileStore.js';
import { getAreaPermissionsForPlan, getPlanFromAreaPermissions, getHubPlanTiers } from '$lib/crm/server/permissions.js';
import { isValidHubDomain, normaliseHost, invalidateHubDomainCache, getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { getCurrentOrganisationId, setCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { filterByOrganisation, withOrganisationId } from '$lib/crm/server/orgContext.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { invalidateOrganisationsCache } from '$lib/crm/server/organisationsCache.js';
import { invalidateAllSessions } from '$lib/crm/server/auth.js';

const VALID_PLANS = new Set(['free', 'professional', 'enterprise']);

function validateOrganisation(data, excludeOrgId = null) {
	const errors = {};
	if (!data.name || !String(data.name).trim()) {
		errors.name = 'Organisation name is required';
	}
	if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email).trim())) {
		errors.email = 'Please enter a valid email address';
	}
	const hubDomain = data.hubDomain ? String(data.hubDomain).trim() : '';
	if (hubDomain && !isValidHubDomain(hubDomain)) {
		errors.hubDomain = 'Enter a valid hostname (e.g. hub.yourchurch.org)';
	}
	const plan = data.plan ? String(data.plan).toLowerCase().trim() : 'free';
	if (!VALID_PLANS.has(plan)) {
		errors.plan = 'Please select a plan (Free, Professional or Enterprise)';
	}
	return Object.keys(errors).length ? errors : null;
}

async function isHubDomainTaken(normalisedDomain, excludeOrgId) {
	const orgs = await readCollection('organisations');
	return orgs.some(
		(o) =>
			o.hubDomain &&
			normaliseHost(String(o.hubDomain).trim()) === normalisedDomain &&
			o.id !== excludeOrgId
	);
}

export async function load({ params, locals, url }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
	if (!multiOrgAdmin) {
		throw redirect(302, base('/multi-org/auth/login'));
	}
	const org = await findById('organisations', params.id);
	if (!org) {
		throw redirect(302, base('/multi-org/organisations'));
	}
	const currentPlan = getPlanFromAreaPermissions(org.areaPermissions) || 'free';
	const anonymisedCreated = url.searchParams.get('anonymised');
	return {
		organisation: org,
		multiOrgAdmin,
		hubPlanTiers: getHubPlanTiers(),
		currentPlan,
		anonymisedCreated: anonymisedCreated ? parseInt(anonymisedCreated, 10) : null
	};
}

export const actions = {
	save: async ({ request, params, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const org = await findById('organisations', params.id);
		if (!org) {
			return fail(404, { error: 'Organisation not found' });
		}

		const form = await request.formData();
		const name = form.get('name')?.toString()?.trim() || '';
		const address = form.get('address')?.toString()?.trim() || '';
		const telephone = form.get('telephone')?.toString()?.trim() || '';
		const email = form.get('email')?.toString()?.trim() || '';
		const contactName = form.get('contactName')?.toString()?.trim() || '';
		const hubDomain = form.get('hubDomain')?.toString()?.trim() || '';
		const plan = (form.get('plan')?.toString() || 'free').toLowerCase().trim();
		const areaPermissions = VALID_PLANS.has(plan) ? getAreaPermissionsForPlan(plan) : getAreaPermissionsForPlan(getPlanFromAreaPermissions(org.areaPermissions) || 'free');

		const errors = validateOrganisation({ name, email, hubDomain, plan }, params.id);
		if (errors) {
			return fail(400, {
				errors,
				values: { name, address, telephone, email, contactName, hubDomain, plan: plan || 'free' }
			});
		}
		if (hubDomain && (await isHubDomainTaken(normaliseHost(hubDomain), params.id))) {
			return fail(400, {
				errors: { hubDomain: 'This hub domain is already used by another organisation' },
				values: { name, address, telephone, email, contactName, hubDomain, plan }
			});
		}

		await update('organisations', params.id, {
			name,
			address,
			telephone,
			email,
			contactName,
			hubDomain: hubDomain || null,
			areaPermissions,
			isHubOrganisation: true,
			archivedAt: org.archivedAt ?? null
		});
		invalidateHubDomainCache();
		invalidateOrganisationsCache();
		await invalidateAllSessions(); // Force re-login so Hub users see plan/org changes

		throw redirect(302, getMultiOrgPublicPath('/multi-org/organisations/' + params.id, !!locals.multiOrgAdminDomain));
	},
	archive: async ({ params, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const org = await findById('organisations', params.id);
		if (!org) {
			return fail(404, { error: 'Organisation not found' });
		}
		await updatePartial('organisations', params.id, { archivedAt: new Date().toISOString() });
		invalidateHubDomainCache();
		invalidateOrganisationsCache();
		const currentHubId = await getCurrentOrganisationId();
		if (currentHubId === params.id) {
			const all = await readCollection('organisations');
			const other = (Array.isArray(all) ? all : []).find((o) => o && o.id !== params.id && !o.archivedAt);
			await setCurrentOrganisationId(other?.id ?? null);
		}
		throw redirect(302, getMultiOrgPublicPath('/multi-org/organisations/' + params.id, !!locals.multiOrgAdminDomain));
	},
	unarchive: async ({ params, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const org = await findById('organisations', params.id);
		if (!org) {
			return fail(404, { error: 'Organisation not found' });
		}
		await updatePartial('organisations', params.id, { archivedAt: null });
		invalidateHubDomainCache();
		invalidateOrganisationsCache();
		throw redirect(302, getMultiOrgPublicPath('/multi-org/organisations/' + params.id, !!locals.multiOrgAdminDomain));
	},

	createAnonymisedContacts: async ({ request, params, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const org = await findById('organisations', params.id);
		if (!org) {
			return fail(404, { error: 'Organisation not found' });
		}

		const form = await request.formData();
		const countInput = form.get('count')?.toString()?.trim() ?? '';
		const count = parseInt(countInput, 10);
		if (Number.isNaN(count) || count < 1 || count > 1000) {
			return fail(400, {
				anonymisedError: 'Please enter a number between 1 and 1000.',
				anonymisedCount: countInput
			});
		}

		const organisationId = params.id;
		const allContacts = await readCollection('contacts');
		const orgContacts = filterByOrganisation(allContacts, organisationId);
		const removedContactIds = new Set(orgContacts.map((c) => c.id));
		const otherContacts = (Array.isArray(allContacts) ? allContacts : []).filter(
			(c) => c.organisationId !== organisationId
		);

		await writeCollection('contacts', otherContacts);

		// Remove deleted contacts from rota assignees (rotas are org-scoped)
		const allRotas = await readCollection('rotas');
		const orgRotas = (Array.isArray(allRotas) ? allRotas : []).filter(
			(r) => r.organisationId === organisationId
		);
		for (const rota of orgRotas) {
			const assignees = Array.isArray(rota.assignees) ? rota.assignees : [];
			const keptAssignees = assignees.filter((assignee) => {
				let contactId = null;
				if (typeof assignee === 'string') {
					contactId = assignee;
				} else if (assignee && typeof assignee === 'object' && typeof assignee.contactId === 'string') {
					contactId = assignee.contactId;
				} else if (assignee && typeof assignee === 'object' && assignee.id) {
					contactId = assignee.id;
				}
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

		throw redirect(
			302,
			getMultiOrgPublicPath('/multi-org/organisations/' + params.id + '?anonymised=' + count, !!locals.multiOrgAdminDomain)
		);
	}
};
