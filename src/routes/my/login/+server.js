import { redirect } from '@sveltejs/kit';

/** GET: redirect to My home (login form is shown there when not signed in). */
export function GET() {
	throw redirect(302, '/my');
}
import { getCurrentOrganisationId } from '$lib/crm/server/settings.js';
import { readCollection, update } from '$lib/crm/server/fileStore.js';
import { filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { setMemberCookie } from '$lib/crm/server/memberAuth.js';
import { verifyCsrfToken } from '$lib/crm/server/auth.js';
import { env } from '$env/dynamic/private';

function jsonResponse(obj, status = 400) {
	return new Response(JSON.stringify(obj), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

/** POST: name + email form login. Redirects to /my on success. */
export async function POST({ request, cookies, url }) {
	const data = await request.formData();
	if (!verifyCsrfToken(cookies, data.get('_csrf'))) {
		return jsonResponse({ error: 'Invalid request. Please try again.' }, 403);
	}
	const name = (data.get('name') || '').toString().trim();
	const email = (data.get('email') || '').toString().trim();
	if (!name || !email) {
		return jsonResponse({ error: 'Name and email are required.' });
	}
	const normalizedEmail = email.toLowerCase();
	const nameParts = name.split(/\s+/).filter(Boolean);
	const firstName = nameParts[0] || '';
	const lastName = nameParts.slice(1).join(' ') || '';

	let organisationId = null;
	try {
		organisationId = await getCurrentOrganisationId();
	} catch (orgErr) {
		console.warn('[my login] getCurrentOrganisationId failed, using all contacts:', orgErr?.message || orgErr);
	}
	try {
		const contactsRaw = await readCollection('contacts');
		const contacts = organisationId ? filterByOrganisation(contactsRaw, organisationId) : contactsRaw;
		const match = contacts.find((c) => c.email && c.email.toLowerCase() === normalizedEmail);
		if (!match) {
			return jsonResponse({
				error: 'No account found with this email address. Please contact your organiser to be added to the system.'
			});
		}
		if (match.confirmed === false) {
			return jsonResponse({
				error: 'Your details need to be confirmed before you can sign in. Please contact your organiser.'
			});
		}
		const contactFirst = (match.firstName || '').trim().toLowerCase();
		const contactLast = (match.lastName || '').trim().toLowerCase();
		const inputFirst = firstName.toLowerCase();
		const inputLast = lastName.toLowerCase();
		const firstOk = !inputFirst || contactFirst.includes(inputFirst) || inputFirst.includes(contactFirst);
		const lastOk = !inputLast || !contactLast || contactLast.includes(inputLast) || inputLast.includes(contactLast);
		if (!firstOk || !lastOk) {
			return jsonResponse({
				error: 'The name does not match the account for this email. Please check and try again.'
			});
		}
		const existingFull = `${match.firstName || ''} ${match.lastName || ''}`.trim();
		const newFull = name;
		if (!existingFull || (newFull.length > existingFull.length && newFull !== existingFull)) {
			await update('contacts', match.id, {
				...match,
				firstName: firstName || match.firstName || '',
				lastName: lastName || match.lastName || '',
				updatedAt: new Date().toISOString()
			});
		}

		const isProduction = env.NODE_ENV === 'production';
		setMemberCookie(cookies, match.id, isProduction);
	} catch (err) {
		const msg = err?.message || String(err);
		console.error('[my login]', msg, err?.stack || '');
		const isDev = env.NODE_ENV !== 'production';
		return jsonResponse(
			{
				error: isDev ? `Something went wrong: ${msg}` : 'Something went wrong. Please try again.'
			},
			500
		);
	}

	// Return JSON success so the client can do client-side navigation.
	// (Using throw redirect() here would produce an opaque-redirect response
	//  that fetch({redirect:'manual'}) cannot read — status 0, no headers.)
	const redirectTo = url.searchParams.get('redirectTo') || '/my';
	return new Response(JSON.stringify({ ok: true, redirectTo }), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	});
}
