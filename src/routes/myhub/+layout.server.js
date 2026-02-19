import { getThemeForCurrentOrganisation, getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { getMemberContactIdFromCookie } from '$lib/crm/server/memberAuth.js';
import { getCsrfToken, generateCsrfToken, setCsrfToken } from '$lib/crm/server/auth.js';
import { readCollection, findById } from '$lib/crm/server/fileStore.js';
import { filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { env } from '$env/dynamic/private';

/**
 * Member (volunteer) self-service portal layout.
 * Resolves member from signed cookie (set after name+email login).
 * Theme (logo etc.) from current org so MyHUB shows the same logo as the Hub.
 */
export async function load({ cookies }) {
	let member = null;
	const contactId = getMemberContactIdFromCookie(cookies);
	if (contactId) {
		try {
			const organisationId = await getCurrentOrganisationId();
			const contactsRaw = await readCollection('contacts');
			const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;
			const contact = contacts.find((c) => c.id === contactId) || (await findById('contacts', contactId));
			if (contact && (!organisationId || contact.organisationId === organisationId)) {
				member = contact;
			}
		} catch (err) {
			console.error('[my layout] resolve member failed:', err?.message || err);
		}
	}
	let theme = null;
	try {
		theme = await getThemeForCurrentOrganisation();
	} catch (err) {
		console.error('[my layout] load theme failed:', err?.message || err);
	}
	let csrfToken = getCsrfToken(cookies);
	if (!csrfToken) {
		csrfToken = generateCsrfToken();
		setCsrfToken(cookies, csrfToken, env.NODE_ENV === 'production');
	}
	return {
		member,
		theme,
		csrfToken: csrfToken || ''
	};
}
