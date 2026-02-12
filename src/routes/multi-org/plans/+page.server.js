import { redirect, fail } from '@sveltejs/kit';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { getPlanSetupDetails, PLAN_MODULE_OPTIONS } from '$lib/crm/server/permissions.js';
import { getSettings, updatePlanSetup } from '$lib/crm/server/settings.js';

const VALID_PLAN_IDS = new Set(['free', 'professional', 'enterprise']);

function mergePlansWithOverrides(planSetupOverrides) {
	const basePlans = getPlanSetupDetails();
	const overrides = planSetupOverrides && typeof planSetupOverrides === 'object' ? planSetupOverrides : {};
	return basePlans.map((plan) => {
		const o = overrides[plan.value];
		if (!o) return plan;
		const num = (v) => (v === '' || v === null || v === undefined) ? null : (typeof v === 'number' ? v : parseFloat(v));
		const areaPermissions = Array.isArray(o.areaPermissions) ? o.areaPermissions : plan.areaPermissions;
		return {
			...plan,
			description: typeof o.description === 'string' ? o.description.trim() || plan.description : plan.description,
			maxContacts: typeof o.maxContacts === 'number' && o.maxContacts >= 0 ? o.maxContacts : plan.maxContacts,
			maxAdmins: typeof o.maxAdmins === 'number' && o.maxAdmins >= 0 ? o.maxAdmins : plan.maxAdmins,
			costPerContact: 'costPerContact' in o ? (num(o.costPerContact) ?? null) : plan.costPerContact,
			costPerAdmin: 'costPerAdmin' in o ? (num(o.costPerAdmin) ?? null) : plan.costPerAdmin,
			areaPermissions
		};
	});
}

export async function load({ locals }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
	if (!multiOrgAdmin) {
		throw redirect(302, base('/multi-org/auth/login'));
	}
	const settings = await getSettings();
	const plans = mergePlansWithOverrides(settings.planSetup);
	return {
		plans,
		planModules: PLAN_MODULE_OPTIONS,
		multiOrgAdmin,
		multiOrgBasePath: '/multi-org'
	};
}

export const actions = {
	updatePlan: async ({ request, locals }) => {
		if (!locals.multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const form = await request.formData();
		const planValue = form.get('planValue')?.toString()?.trim();
		if (!planValue || !VALID_PLAN_IDS.has(planValue)) {
			return fail(400, { error: 'Invalid plan' });
		}
		const description = form.get('description')?.toString()?.trim() ?? '';
		const maxContactsRaw = form.get('maxContacts')?.toString()?.trim();
		const maxAdminsRaw = form.get('maxAdmins')?.toString()?.trim();
		const costPerContactRaw = form.get('costPerContact')?.toString()?.trim();
		const costPerAdminRaw = form.get('costPerAdmin')?.toString()?.trim();

		const maxContacts = maxContactsRaw !== '' && maxContactsRaw !== undefined
			? parseInt(maxContactsRaw, 10)
			: null;
		const maxAdmins = maxAdminsRaw !== '' && maxAdminsRaw !== undefined
			? parseInt(maxAdminsRaw, 10)
			: null;
		const costPerContact = costPerContactRaw !== '' && costPerContactRaw !== undefined && costPerContactRaw !== null
			? parseFloat(costPerContactRaw)
			: null;
		const costPerAdmin = costPerAdminRaw !== '' && costPerAdminRaw !== undefined && costPerAdminRaw !== null
			? parseFloat(costPerAdminRaw)
			: null;
		const areaPermissions = form.getAll('areaPermissions').filter((v) => typeof v === 'string' && v.trim());

		if (maxContacts !== null && (Number.isNaN(maxContacts) || maxContacts < 0)) {
			return fail(400, { error: 'Contacts allowed must be 0 or more' });
		}
		if (maxAdmins !== null && (Number.isNaN(maxAdmins) || maxAdmins < 0)) {
			return fail(400, { error: 'Admins allowed must be 0 or more' });
		}
		if (costPerContact !== null && Number.isNaN(costPerContact)) {
			return fail(400, { error: 'Cost per contact must be a number' });
		}
		if (costPerAdmin !== null && Number.isNaN(costPerAdmin)) {
			return fail(400, { error: 'Cost per admin must be a number' });
		}

		const patch = {
			[planValue]: {
				...(description !== '' && { description }),
				...(maxContacts !== null && { maxContacts }),
				...(maxAdmins !== null && { maxAdmins }),
				costPerContact: costPerContact !== null ? costPerContact : null,
				costPerAdmin: costPerAdmin !== null ? costPerAdmin : null,
				areaPermissions
			}
		};
		await updatePlanSetup(patch);
		return { success: true, message: 'Plan updated.', planValue };
	}
};
