import { fail, redirect } from '@sveltejs/kit';
import { findById, update, updatePartial, readCollection, remove } from '$lib/crm/server/fileStore.js';
import {
	getConfiguredAreaPermissionsForPlan,
	getConfiguredPlanFromAreaPermissions,
	getHubPlanTiersForMultiOrg
} from '$lib/crm/server/permissions.js';
import { isValidHubDomain, normaliseHost, invalidateHubDomainCache, getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { getCurrentOrganisationId, setCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { invalidateOrganisationsCache } from '$lib/crm/server/organisationsCache.js';
import { getAdminByEmail, invalidateAllSessions, invalidateAdminSessions } from '$lib/crm/server/auth.js';
import { seedChurchBoltOnContent } from '$lib/crm/server/churchBoltOnSeed.js';
import { resetTerminologyToDefault } from '$lib/crm/server/settings.js';

const VALID_PLANS = new Set(['free', 'professional', 'enterprise', 'freebie']);

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
		errors.plan = 'Please select a plan (Free, Professional, Enterprise or Freebie)';
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
	const currentPlan = (org.planId ?? (await getConfiguredPlanFromAreaPermissions(org.areaPermissions))) || 'free';

	// Load sequences for onboarding email assignment
	const sequences = await readCollection('marketing_sequences');
	const activeSequences = sequences.filter(s => s && (s.status === 'active' || s.status === 'draft'));

	return {
		organisation: org,
		multiOrgAdmin,
		hubPlanTiers: getHubPlanTiersForMultiOrg(),
		currentPlan,
		sequences: activeSequences
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
		const dbsBoltOn = form.get('dbsBoltOn') === 'on';
		const dbsRenewalYearsRaw = form.get('dbsRenewalYears');
		const dbsRenewalYears = (dbsRenewalYearsRaw === '2' || dbsRenewalYearsRaw === 2) ? 2 : 3;
		const churchBoltOn = form.get('churchBoltOn') === 'on';
		const existingPlan = (org.planId ?? (await getConfiguredPlanFromAreaPermissions(org.areaPermissions))) || 'free';
		const targetPlan = VALID_PLANS.has(plan) ? plan : existingPlan;
		const areaPermissions = await getConfiguredAreaPermissionsForPlan(targetPlan);

		const errors = validateOrganisation({ name, email, hubDomain, plan }, params.id);
		if (errors) {
			return fail(400, {
				errors,
				values: { name, address, telephone, email, contactName, hubDomain, plan: plan || 'free', dbsBoltOn, dbsRenewalYears, churchBoltOn }
			});
		}
		if (hubDomain && (await isHubDomainTaken(normaliseHost(hubDomain), params.id))) {
			return fail(400, {
				errors: { hubDomain: 'This hub domain is already used by another organisation' },
				values: { name, address, telephone, email, contactName, hubDomain, plan, dbsBoltOn, dbsRenewalYears, churchBoltOn }
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
			archivedAt: org.archivedAt ?? null,
			planId: VALID_PLANS.has(plan) ? plan : null,
			dbsBoltOn: !!dbsBoltOn,
			dbsRenewalYears,
			churchBoltOn: !!churchBoltOn
		});
		if (churchBoltOn) {
			await seedChurchBoltOnContent(params.id);
		}
		if (!churchBoltOn && org.churchBoltOn) {
			await resetTerminologyToDefault();
		}
		invalidateHubDomainCache();
		invalidateOrganisationsCache();
		await invalidateAllSessions(); // Force re-login so Hub users see plan/org changes

		throw redirect(302, getMultiOrgPublicPath('/multi-org/organisations/' + params.id + '?organisationsUpdated=1', !!locals.multiOrgAdminDomain));
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
		throw redirect(302, getMultiOrgPublicPath('/multi-org/organisations/' + params.id + '?organisationsUpdated=1', !!locals.multiOrgAdminDomain));
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
		throw redirect(302, getMultiOrgPublicPath('/multi-org/organisations/' + params.id + '?organisationsUpdated=1', !!locals.multiOrgAdminDomain));
	},

	saveOnboarding: async ({ request, params, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const org = await findById('organisations', params.id);
		if (!org) {
			return fail(404, { error: 'Organisation not found' });
		}
		const form = await request.formData();
		const onboardingEmails = {
			enabled: form.get('onboarding_enabled') === 'on',
			sequence_id: form.get('sequence_id')?.toString()?.trim() || null,
			sender_name_override: form.get('sender_name_override')?.toString()?.trim() || '',
			sender_email_override: form.get('sender_email_override')?.toString()?.trim() || '',
			timezone: form.get('timezone')?.toString()?.trim() || 'Europe/London',
			send_hour: parseInt(form.get('send_hour') || '9', 10)
		};
		await updatePartial('organisations', params.id, { onboardingEmails });
		invalidateOrganisationsCache();
		return { onboardingSaved: true };
	},

	delete: async ({ params, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const org = await findById('organisations', params.id);
		if (!org) {
			return fail(404, { error: 'Organisation not found' });
		}
		const currentHubId = await getCurrentOrganisationId();
		if (currentHubId === params.id) {
			const all = await readCollection('organisations');
			const other = (Array.isArray(all) ? all : []).find((o) => o && o.id !== params.id && !o.archivedAt);
			await setCurrentOrganisationId(other?.id ?? null);
		}
		// Delete this org's Hub super admin so we don't leave an orphaned admin
		const superAdminEmail = org.hubSuperAdminEmail || org.email;
		if (superAdminEmail) {
			const superAdmin = await getAdminByEmail(superAdminEmail, params.id);
			if (superAdmin) {
				await invalidateAdminSessions(superAdmin.id);
				await remove('admins', superAdmin.id);
			}
		}
		await remove('organisations', params.id);
		invalidateHubDomainCache();
		invalidateOrganisationsCache();
		await invalidateAllSessions();
		// Redirect to canonical multi-org path so we always get the sidebar layout and avoid cached /organisations (old top-nav) response
		throw redirect(302, '/multi-org/organisations?organisationsUpdated=1');
	}
};
