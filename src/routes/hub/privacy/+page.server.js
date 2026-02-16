import { readFileSync } from 'fs';
import { join } from 'path';
import { markdownToHtml } from '$lib/server/markdownToHtml.js';
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { getCachedOrganisations } from '$lib/crm/server/organisationsCache.js';
import { readCollection } from '$lib/crm/server/fileStore.js';
import { replaceOrgPlaceholder } from '$lib/crm/server/hubPrivacyPolicy.js';

async function getSuperAdminFallback(org) {
	if (!org) return null;
	const admins = await readCollection('admins');
	const email = (org.hubSuperAdminEmail || org.email || '').toLowerCase().trim();
	if (!email) return null;
	const admin = (Array.isArray(admins) ? admins : []).find(
		(a) => (a.email || '').toLowerCase().trim() === email
	) || null;
	return admin ? { name: admin.name || '', email: admin.email || '' } : null;
}

export async function load() {
	const privacyPolicyPath = join(process.cwd(), 'static/docs/HUB_PRIVACY_POLICY.md');
	let privacyPolicyHtml = '';

	try {
		const markdownContent = readFileSync(privacyPolicyPath, 'utf-8');
		const organisationId = await getCurrentOrganisationId();
		const orgs = await getCachedOrganisations();
		const org = organisationId && orgs?.length ? orgs.find((o) => o.id === organisationId) ?? null : null;
		const superAdminFallback = org ? await getSuperAdminFallback(org) : null;
		const contentWithOrg = replaceOrgPlaceholder(markdownContent, org || null, superAdminFallback);
		privacyPolicyHtml = markdownToHtml(contentWithOrg);
	} catch (error) {
		console.error('Error reading Hub privacy policy:', error);
		privacyPolicyHtml = '<h1>Hub Privacy Policy</h1><p>Unable to load privacy policy content.</p>';
	}

	return {
		privacyPolicyHtml
	};
}
