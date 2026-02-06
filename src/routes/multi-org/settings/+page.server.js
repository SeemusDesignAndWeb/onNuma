import { redirect, fail } from '@sveltejs/kit';
import { getMultiOrgPublicPath } from '$lib/crm/server/hubDomain.js';
import { getSettings, writeSettings } from '$lib/crm/server/settings.js';

export async function load({ locals }) {
	const multiOrgAdmin = locals.multiOrgAdmin;
	const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
	if (!multiOrgAdmin) {
		throw redirect(302, base('/multi-org/auth/login'));
	}
	const settings = await getSettings();
	return {
		multiOrgAdmin,
		multiOrgBasePath: locals.multiOrgAdminDomain ? '' : '/multi-org',
		emailProvider: settings?.emailProvider ?? 'resend'
	};
}

export const actions = {
	save: async ({ request, locals }) => {
		const multiOrgAdmin = locals.multiOrgAdmin;
		const base = (path) => getMultiOrgPublicPath(path, !!locals.multiOrgAdminDomain);
		if (!multiOrgAdmin) {
			return fail(403, { error: 'Not authorised' });
		}
		const form = await request.formData();
		const emailProvider = (form.get('emailProvider')?.toString() || 'resend').toLowerCase().trim();
		if (emailProvider !== 'resend' && emailProvider !== 'mailgun') {
			return fail(400, { error: 'Invalid email provider. Choose Resend or Mailgun.', emailProvider: 'resend' });
		}
		const settings = await getSettings();
		settings.emailProvider = emailProvider;
		await writeSettings(settings);
		throw redirect(302, base('/multi-org/settings') + '?saved=1');
	}
};
