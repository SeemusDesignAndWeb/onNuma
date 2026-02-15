import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { getConfiguredPlanSetupDetails, PLAN_MODULE_OPTIONS } from '$lib/crm/server/permissions.js';
import { updatePlanSetup } from '$lib/crm/server/settings.js';

const VALID_PLAN_IDS = new Set(['free', 'professional', 'enterprise']);

export async function load({ locals }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
	if (!multiOrgAdmin) {
		throw redirect(302, base('/multi-org/auth/login'));
	}
	const plans = await getConfiguredPlanSetupDetails();
	const paddleMapping = {
		environment: (env.PADDLE_ENVIRONMENT || 'sandbox').toLowerCase(),
		apiConfigured: !!env.PADDLE_API_KEY,
		webhookConfigured: !!env.PADDLE_WEBHOOK_SECRET,
		professional: [
			{ tier: 'Tier 1 (1-100 contacts)', priceId: env.PADDLE_PRICE_ID_PROFESSIONAL_TIER1 || null },
			{ tier: 'Tier 2 (101-250 contacts)', priceId: env.PADDLE_PRICE_ID_PROFESSIONAL_TIER2 || null },
			{ tier: 'Tier 3 (251-500 contacts)', priceId: env.PADDLE_PRICE_ID_PROFESSIONAL_TIER3 || null }
		],
		enterprise: [
			{ tier: 'Tier 1 (1-300 seats)', priceId: env.PADDLE_PRICE_ID_ENTERPRISE || null },
			{ tier: 'Tier 2 (301+ seats)', priceId: env.PADDLE_PRICE_ID_ENTERPRISE_TIER2 || null }
		]
	};
	return {
		plans,
		planModules: PLAN_MODULE_OPTIONS,
		paddleMapping,
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

		const maxContacts = maxContactsRaw !== '' && maxContactsRaw !== undefined
			? parseInt(maxContactsRaw, 10)
			: null;
		const maxAdmins = maxAdminsRaw !== '' && maxAdminsRaw !== undefined
			? parseInt(maxAdminsRaw, 10)
			: null;
		const areaPermissions = form.getAll('areaPermissions').filter((v) => typeof v === 'string' && v.trim());

		if (maxContacts !== null && (Number.isNaN(maxContacts) || maxContacts < 0)) {
			return fail(400, { error: 'Contacts allowed must be 0 or more' });
		}
		if (maxAdmins !== null && (Number.isNaN(maxAdmins) || maxAdmins < 0)) {
			return fail(400, { error: 'Admins allowed must be 0 or more' });
		}
		const patch = {
			[planValue]: {
				...(description !== '' && { description }),
				...(maxContacts !== null && { maxContacts }),
				...(maxAdmins !== null && { maxAdmins }),
				areaPermissions
			}
		};
		await updatePlanSetup(patch);
		return { success: true, message: 'Plan updated.', planValue };
	}
};
