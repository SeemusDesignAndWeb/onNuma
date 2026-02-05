import { fail, redirect } from '@sveltejs/kit';
import { create, readCollection } from '$lib/crm/server/fileStore.js';
import { invalidateHubDomainCache } from '$lib/crm/server/hubDomain.js';
import { getOrganisationHubAreas } from '$lib/crm/server/permissions.js';
import { isValidHubDomain, normaliseHost } from '$lib/crm/server/hubDomain.js';

const VALID_AREAS = new Set(getOrganisationHubAreas().map((a) => a.value));

function validateOrganisation(data) {
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
	const perms = Array.isArray(data.areaPermissions) ? data.areaPermissions : [];
	for (const p of perms) {
		if (!VALID_AREAS.has(p)) {
			errors.areaPermissions = 'Invalid area selected';
			break;
		}
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

export async function load({ locals }) {
	if (!locals.multiOrgAdmin) {
		throw redirect(302, '/auth/login');
	}
	return {
		hubAreas: getOrganisationHubAreas()
	};
}

export const actions = {
	create: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const form = await request.formData();
		const name = form.get('name')?.toString()?.trim() || '';
		const address = form.get('address')?.toString()?.trim() || '';
		const telephone = form.get('telephone')?.toString()?.trim() || '';
		const email = form.get('email')?.toString()?.trim() || '';
		const contactName = form.get('contactName')?.toString()?.trim() || '';
		const hubDomain = form.get('hubDomain')?.toString()?.trim() || '';
		const areaPermissions = form.getAll('areaPermissions').filter((p) => VALID_AREAS.has(p));

		const errors = validateOrganisation({ name, email, hubDomain, areaPermissions });
		if (errors) {
			return fail(400, {
				errors,
				values: { name, address, telephone, email, contactName, hubDomain, areaPermissions }
			});
		}
		if (hubDomain && (await isHubDomainTaken(normaliseHost(hubDomain), null))) {
			return fail(400, {
				errors: { hubDomain: 'This hub domain is already used by another organisation' },
				values: { name, address, telephone, email, contactName, hubDomain, areaPermissions }
			});
		}

		const org = await create('organisations', {
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
		throw redirect(302, '/organisations/' + org.id);
	}
};
