import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
	if (!locals.admin) {
		throw redirect(302, '/hub/auth/login');
	}
	// Billing data comes from layout (plan, currentOrganisation, showBilling, showBillingPortal, isSuperAdmin)
	return {};
}
