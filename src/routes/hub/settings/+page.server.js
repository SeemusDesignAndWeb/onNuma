import { error } from '@sveltejs/kit';
import { getAdminFromCookies } from '$lib/crm/server/auth.js';
import { isSuperAdmin, getConfiguredPlanFromAreaPermissions } from '$lib/crm/server/permissions.js';
import { getSettings, getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { readCollection, getStoreMode, findById } from '$lib/crm/server/fileStore.js';
import { filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { env } from '$env/dynamic/private';

export async function load({ cookies }) {
	const admin = await getAdminFromCookies(cookies);

	if (!admin) {
		throw error(401, 'Unauthorized');
	}

	if (!isSuperAdmin(admin)) {
		throw error(403, 'Forbidden: Superadmin access required');
	}

	const settings = await getSettings();
	const storeMode = await getStoreMode();

	// Organisation context (for Multi-org): show current org so super admin can verify Hub recognises it
	const currentOrganisationId = await getCurrentOrganisationId();
	const currentOrganisation = currentOrganisationId
		? await findById('organisations', currentOrganisationId)
		: null;

	// Org-filtered events for Meeting planner dropdown
	const eventsRaw = await readCollection('events');
	const events = currentOrganisationId ? filterByOrganisation(eventsRaw, currentOrganisationId) : eventsRaw;

	// Get unique rota roles for current org (for meeting planner defaults)
	const rotas = await readCollection('rotas');
	const rotasForOrg = currentOrganisationId ? filterByOrganisation(rotas, currentOrganisationId) : rotas;
	const uniqueRoles = [...new Set(rotasForOrg.map((r) => r.role))].sort();

	// Only include meeting planner rotas whose role exists in this org (avoid showing "rotas that do not exist")
	const roleSet = new Set(uniqueRoles);
	const meetingPlannerRotasFiltered = Array.isArray(settings.meetingPlannerRotas)
		? settings.meetingPlannerRotas.filter((r) => roleSet.has((r.role || '').trim()))
		: [];

	// Billing: plan, subscription state, and feature flags (no secrets exposed)
	const plan = currentOrganisation && Array.isArray(currentOrganisation.areaPermissions)
		? ((await getConfiguredPlanFromAreaPermissions(currentOrganisation.areaPermissions)) || 'free')
		: 'free';
	const subscriptionStatus = currentOrganisation?.subscriptionStatus ?? null;
	const currentPeriodEnd = currentOrganisation?.currentPeriodEnd ?? null;
	const cancelAtPeriodEnd = !!currentOrganisation?.cancelAtPeriodEnd;
	const hasPaddleCustomer = !!(currentOrganisation?.paddleCustomerId);
	const showBilling =
		!!(env.PADDLE_API_KEY && (env.PADDLE_PRICE_ID_PROFESSIONAL || env.PADDLE_PRICE_ID_ENTERPRISE));
	const showBillingPortal = !!(env.BOATHOUSE_PORTAL_ID && env.BOATHOUSE_SECRET);

	return {
		admin,
		settings: { ...settings, meetingPlannerRotas: meetingPlannerRotasFiltered },
		availableRoles: uniqueRoles,
		events,
		storeMode,
		currentOrganisationId,
		currentOrganisation,
		plan,
		subscriptionStatus,
		currentPeriodEnd,
		cancelAtPeriodEnd,
		hasPaddleCustomer,
		showBilling,
		showBillingPortal
	};
}
