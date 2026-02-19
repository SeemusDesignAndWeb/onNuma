import { redirect, fail } from '@sveltejs/kit';
import { findById, update, remove, readCollection, create } from '$lib/crm/server/fileStore.js';
import { getHubBaseUrlFromOrg } from '$lib/crm/server/hubDomain.js';
import { validateContact } from '$lib/crm/server/validators.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { logDataChange, getAdminIdFromEvent } from '$lib/crm/server/audit.js';
import { getSettings } from '$lib/crm/server/settings.js';
import { getCurrentOrganisationId, filterByOrganisation, contactsWithinPlanLimit } from '$lib/crm/server/orgContext.js';
import { generateId } from '$lib/crm/server/ids.js';
import { getDbsStatus } from '$lib/crm/server/dbs.js';
import { getSafeguardingStatus } from '$lib/crm/server/safeguarding.js';
import {
	getAllPastoralFlagsForContact,
	getAbsenceEventsForContact,
	checkAndRecordMilestones,
	getAndNotifyUnacknowledgedMilestones
} from '$lib/crm/server/pastoral.js';

export async function load({ params, cookies, parent }) {
	const organisationId = await getCurrentOrganisationId();
	const contact = await findById('contacts', params.id);
	if (!contact) {
		throw redirect(302, '/hub/contacts');
	}
	// Ensure contact belongs to current organisation (or legacy null)
	if (contact.organisationId != null && contact.organisationId !== organisationId) {
		throw redirect(302, '/hub/contacts');
	}

	// Load spouse information if spouseId exists
	let spouse = null;
	if (contact.spouseId) {
		spouse = await findById('contacts', contact.spouseId);
	}

	// Load contacts for spouse dropdown (plan-limited, excluding current contact)
	const { plan } = await parent();
	const allContacts = await readCollection('contacts');
	const orgContacts = filterByOrganisation(allContacts, organisationId);
	const capped = contactsWithinPlanLimit(orgContacts, plan);
	const contacts = capped.filter(c => c.id !== params.id);

	const csrfToken = getCsrfToken(cookies) || '';
	const settings = await getSettings();

	// DBS Bolt-On: get current org flag and DBS renewal years (for contact profile sections)
	const org = organisationId ? await findById('organisations', organisationId) : null;
	const dbsBoltOn = !!(org?.dbsBoltOn ?? org?.churchBoltOn);
	const dbsRenewalYears = org?.dbsRenewalYears ?? 3;

	// Load thank-you messages sent to this volunteer
	const allThankyou = await readCollection('volunteer_thankyou').catch(() => []);
	const thankyouMessages = allThankyou
		.filter((t) => t.contactId === params.id && (!organisationId || !t.organisationId || t.organisationId === organisationId))
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

	// MyHub invitations for this contact (outstanding = pending; also show accepted/declined for context)
	const allInvitations = await readCollection('myhub_invitations').catch(() => []);
	const contactInvitations = allInvitations.filter(
		(inv) => inv.contactId === params.id && (!organisationId || inv.organisationId == null || inv.organisationId === organisationId)
	);
	const myhubInvitations = await Promise.all(
		contactInvitations.map(async (inv) => {
			const rota = inv.rotaId ? await findById('rotas', inv.rotaId) : null;
			const event = rota?.eventId ? await findById('events', rota.eventId) : null;
			const occurrence = inv.occurrenceId ? await findById('occurrences', inv.occurrenceId) : null;
			return { inv, rota, event, occurrence };
		})
	);
	// Sort by invitedAt descending (most recent first)
	myhubInvitations.sort((a, b) => new Date((b.inv.invitedAt || 0)) - new Date((a.inv.invitedAt || 0)));

	const dbsStatus = dbsBoltOn && contact.dbs ? getDbsStatus(contact.dbs, dbsRenewalYears) : null;
	const safeguardingStatus = dbsBoltOn && contact.safeguarding ? getSafeguardingStatus(contact.safeguarding) : null;

	// Pastoral care (DBS bolt-on only): flags, absence history, milestones
	let pastoralFlags = [];
	let absenceEvents = [];
	let milestones = [];
	if (dbsBoltOn) {
		// Check for newly reached milestones, then load all pastoral data
		await checkAndRecordMilestones(organisationId, params.id).catch(() => null);
		[pastoralFlags, absenceEvents, milestones] = await Promise.all([
			getAllPastoralFlagsForContact(organisationId, params.id),
			getAbsenceEventsForContact(organisationId, params.id),
			getAndNotifyUnacknowledgedMilestones(organisationId, params.id)
		]);
	}

	return { contact, spouse, contacts, csrfToken, theme: settings?.theme || null, thankyouMessages, myhubInvitations, dbsBoltOn, dbsRenewalYears, dbsStatus, safeguardingStatus, pastoralFlags, absenceEvents, milestones };
}

export const actions = {
	update: async ({ request, params, cookies, locals, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		try {
			// Get old data for audit log and spouse relationship sync
			const oldContact = await findById('contacts', params.id);
			
			const contactData = {
				email: data.get('email'),
				firstName: data.get('firstName'),
				lastName: data.get('lastName'),
				phone: data.get('phone'),
				addressLine1: data.get('addressLine1'),
				addressLine2: data.get('addressLine2'),
				city: data.get('city'),
				county: data.get('county'),
				postcode: data.get('postcode'),
				country: data.get('country'),
				membershipStatus: data.get('membershipStatus'),
				dateJoined: data.get('dateJoined') || null,
				notes: data.get('notes'),
				subscribed: data.get('subscribed') === 'on' || data.get('subscribed') === 'true',
				spouseId: data.get('spouseId') || null
			};

			const validated = validateContact(contactData);
			const toUpdate = { ...validated };

			// DBS Bolt-On: merge DBS, coordinatorNotes only when org has bolt-on
			const orgId = oldContact?.organisationId;
			const org = orgId ? await findById('organisations', orgId) : null;
			if (org?.dbsBoltOn ?? org?.churchBoltOn) {
				const dbsLevel = (data.get('dbs_level') || '').toString().trim() || null;
				toUpdate.dbs = {
					level: dbsLevel,
					dateIssued: (data.get('dbs_dateIssued') || '').toString().trim() || null,
					renewalDueDate: (data.get('dbs_renewalDueDate') || '').toString().trim() || null,
					updateServiceRegistered: data.get('dbs_updateService') === 'on' || data.get('dbs_updateService') === 'true',
					certificateRef: (data.get('dbs_certificateRef') || '').toString().trim() || null,
					notes: (data.get('dbs_notes') || '').toString().trim() || null
				};
				if (!toUpdate.dbs.level && !toUpdate.dbs.dateIssued && !toUpdate.dbs.renewalDueDate && !toUpdate.dbs.certificateRef && !toUpdate.dbs.notes) {
					toUpdate.dbs = null;
				}

				const sgLevel = (data.get('sg_level') || '').toString().trim() || null;
				toUpdate.safeguarding = {
					level: sgLevel,
					dateCompleted: (data.get('sg_dateCompleted') || '').toString().trim() || null,
					renewalDueDate: (data.get('sg_renewalDueDate') || '').toString().trim() || null,
					notes: (data.get('sg_notes') || '').toString().trim() || null
				};
				if (!toUpdate.safeguarding.level && !toUpdate.safeguarding.dateCompleted && !toUpdate.safeguarding.renewalDueDate && !toUpdate.safeguarding.notes) {
					toUpdate.safeguarding = null;
				}

				const coordNotes = (data.get('coordinatorNotes') || '').toString().trim() || null;
				toUpdate.coordinatorNotes = coordNotes || null;
			}

			await update('contacts', params.id, toUpdate);

			// Sync bidirectional spouse relationship
			const oldSpouseId = oldContact?.spouseId || null;
			const newSpouseId = validated.spouseId;

			// If spouseId changed, update both old and new spouses
			if (oldSpouseId !== newSpouseId) {
				// Remove spouseId from old spouse if it exists
				if (oldSpouseId) {
					const oldSpouse = await findById('contacts', oldSpouseId);
					if (oldSpouse && oldSpouse.spouseId === params.id) {
						await update('contacts', oldSpouseId, { spouseId: null });
					}
				}
				// Set spouseId on new spouse if it exists
				if (newSpouseId) {
					await update('contacts', newSpouseId, { spouseId: params.id });
				}
			}

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			await logDataChange(adminId, 'update', 'contact', params.id, {
				email: validated.email,
				name: `${validated.firstName || ''} ${validated.lastName || ''}`.trim()
			}, event);

			return { success: true };
		} catch (error) {
			return { error: error.message };
		}
	},

	delete: async ({ params, cookies, request, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return { error: 'CSRF token validation failed' };
		}

		// Get contact data before deletion for audit log
		const contact = await findById('contacts', params.id);
		
		await remove('contacts', params.id);

		// Log audit event
		const adminId = locals?.admin?.id || null;
		const event = { getClientAddress: () => 'unknown', request };
		await logDataChange(adminId, 'delete', 'contact', params.id, {
			email: contact?.email,
			name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : 'unknown'
		}, event);

		throw redirect(302, '/hub/contacts');
	},

	sendThankyou: async ({ request, params, cookies, locals, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');
		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'Invalid request. Please refresh and try again.', action: 'sendThankyou' });
		}

		const message = (data.get('message') || '').toString().trim();
		if (!message) return fail(400, { error: 'Please write a message before sending.', action: 'sendThankyou' });
		if (message.length > 1000) return fail(400, { error: 'Message is too long (max 1000 characters).', action: 'sendThankyou' });

		const organisationId = await getCurrentOrganisationId();
		const contact = await findById('contacts', params.id);
		if (!contact) return fail(404, { error: 'Contact not found.', action: 'sendThankyou' });

		const admin = locals?.admin;
		// Never store email as fromName — use display name or "Your coordinator" (same as personal email fix)
		const fromName = admin
			? (admin.name && !String(admin.name).includes('@') ? admin.name.trim() : null) ||
				([admin.firstName, admin.lastName].filter(Boolean).join(' ').trim() || null) ||
				'Your coordinator'
			: 'Your coordinator';
		// First name for signature: from admin.name (account info) or firstName if ever added
		const fromFirstName = admin?.firstName ||
			(admin?.name && !String(admin.name).includes('@') ? String(admin.name).trim().split(/\s+/)[0] : null);

		await create('volunteer_thankyou', {
			id: generateId(),
			contactId: params.id,
			organisationId: organisationId || '',
			fromName,
			fromAdminId: admin?.id || null,
			message,
			createdAt: new Date().toISOString()
		});

		// Send email notification to the volunteer (non-fatal)
		if (contact.email) {
			try {
				const { sendThankyouEmail } = await import('$lib/crm/server/email.js');
				const settings = await getSettings();
				const orgName = settings?.organisationName || settings?.name || '';
				const org = organisationId ? await findById('organisations', organisationId) : null;
				const fallbackOrigin = url?.origin;
				const hubBaseUrl = getHubBaseUrlFromOrg(org, fallbackOrigin);
				// Always pass hubBaseUrl in locals so getBaseUrl() uses it (not APP_BASE_URL) for logo and links
				const eventWithHub = {
					url: url || { origin: hubBaseUrl },
					locals: { hubBaseUrl }
				};
				await sendThankyouEmail(
					{
						to: contact.email,
						firstName: contact.firstName || contact.email,
						fromName,
						fromEmail: admin?.email || null,
						fromFirstName: fromFirstName || null,
						message,
						orgName
					},
					eventWithHub
				);
			} catch (err) {
				console.error('[sendThankyou] Email failed (non-fatal):', err?.message);
			}
		}

		return { success: true, action: 'sendThankyou' };
	}
};

