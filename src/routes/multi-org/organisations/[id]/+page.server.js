import { fail, redirect } from '@sveltejs/kit';
import { findById, update, readCollection } from '$lib/crm/server/fileStore.js';
import { getAreaPermissionsForPlan, getPlanFromAreaPermissions, getHubPlanTiers } from '$lib/crm/server/permissions.js';
import { isValidHubDomain, normaliseHost, invalidateHubDomainCache, getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';

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

export async function load({ params, locals }) {
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
	return {
		organisation: org,
		multiOrgAdmin,
		hubPlanTiers: getHubPlanTiers(),
		currentPlan
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
			isHubOrganisation: true
		});
		invalidateHubDomainCache();

		throw redirect(302, getMultiOrgPublicPath('/multi-org/organisations/' + params.id, !!locals.multiOrgAdminDomain));
	}
};
