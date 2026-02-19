// API endpoint for DBS renewal reminders (Church Bolt-On).
// Access: GET or POST /api/cron/dbs-renewal-reminders?secret=DBS_RENEWAL_CRON_SECRET
// Sends one email per organisation (with DBS Bolt-On) to administrators listing volunteers
// whose DBS is due within 60 days (amber status). Record-keeping only — does not block scheduling.

import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { readCollection, findById } from '$lib/crm/server/fileStore.js';
import { getDbsDashboardRows } from '$lib/crm/server/dbs.js';
import { getSafeguardingStatus, SAFEGUARDING_LEVEL_LABELS } from '$lib/crm/server/safeguarding.js';
import { filterByOrganisation } from '$lib/crm/server/orgContext.js';
import { getAdminsForOrganisation } from '$lib/crm/server/auth.js';
import { sendEmail } from '$lib/server/mailgun.js';

const fromEmailDefault = () => env.MAILGUN_FROM_EMAIL || (env.MAILGUN_DOMAIN ? `noreply@${env.MAILGUN_DOMAIN}` : 'noreply@onnuma.com');

function getBaseUrl() {
	const base = (env.APP_BASE_URL && String(env.APP_BASE_URL).trim().startsWith('http'))
		? env.APP_BASE_URL.trim()
		: 'https://app.onnuma.com';
	return new URL(base).origin;
}

export async function GET({ url, request }) {
	return handleRequest(url, request);
}

export async function POST({ url, request }) {
	return handleRequest(url, request);
}

async function handleRequest(url, request) {
	const secret = url.searchParams.get('secret') || (request.method === 'POST' ? (await request.json().catch(() => ({}))).secret : null);
	const expectedSecret = env.DBS_RENEWAL_CRON_SECRET;

	if (!expectedSecret) {
		console.error('[DBS Renewal API] DBS_RENEWAL_CRON_SECRET not configured');
		return json({ error: 'Service not configured', message: 'DBS_RENEWAL_CRON_SECRET is not set' }, { status: 500 });
	}
	if (!secret || secret !== expectedSecret) {
		console.warn('[DBS Renewal API] Unauthorized access attempt');
		return json({ error: 'Unauthorized', message: 'Invalid or missing secret token' }, { status: 401 });
	}

	const baseUrl = getBaseUrl();
	const orgs = await readCollection('organisations');
	const dbsOrgs = orgs.filter((o) => (o.dbsBoltOn ?? o.churchBoltOn) && o.id);

	let totalSent = 0;
	const errors = [];

	for (const org of dbsOrgs) {
		try {
			const dbsRenewalYears = org.dbsRenewalYears ?? 3;
			const [rows, contactsRaw] = await Promise.all([
				getDbsDashboardRows(org.id, dbsRenewalYears, null),
				readCollection('contacts')
			]);
			const amber = rows.filter((r) => r.status === 'amber');

			// Safeguarding: find volunteers with amber/red safeguarding status
			const orgContacts = filterByOrganisation(contactsRaw, org.id);
			const sgAmber = orgContacts.filter((c) => {
				if (!c.safeguarding?.level) return false;
				const { status } = getSafeguardingStatus(c.safeguarding);
				return status === 'amber';
			}).map((c) => ({
				name: [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.email || 'Unknown',
				renewalDueDate: c.safeguarding.renewalDueDate || null,
				level: SAFEGUARDING_LEVEL_LABELS[c.safeguarding.level] || c.safeguarding.level
			}));

			if (amber.length === 0 && sgAmber.length === 0) continue;

			const admins = await getAdminsForOrganisation(org.id);
			const toEmails = admins.map((a) => a.email).filter(Boolean);
			if (toEmails.length === 0) continue;

			const orgName = (org.name || 'Your organisation').trim();

			let sectionsHtml = '';

			if (amber.length > 0) {
				const rowsList = amber
					.map(
						(r) =>
							`<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.name)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.renewalDueDate ? new Date(r.renewalDueDate).toLocaleDateString('en-GB') : '—'}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml((r.roleNames || []).join(', ') || '—')}</td></tr>`
					)
					.join('');
				sectionsHtml += `
  <h2 style="font-size:1rem;margin-top:1.5em;">DBS renewal due within 60 days</h2>
  <p style="font-size:0.9em;color:#555;">Record-keeping reminder only — OnNuma does not process DBS applications.</p>
  <table style="border-collapse: collapse; margin: 0.5em 0 1em;">
    <thead><tr style="background: #f5f5f5;">
      <th style="padding:8px 10px;text-align:left;">Name</th>
      <th style="padding:8px 10px;text-align:left;">Renewal due</th>
      <th style="padding:8px 10px;text-align:left;">Roles</th>
    </tr></thead>
    <tbody>${rowsList}</tbody>
  </table>
  <p><a href="${baseUrl}/hub/dbs" style="color: #0ea5e9;">View DBS Compliance in the Hub</a></p>`;
			}

			if (sgAmber.length > 0) {
				const sgList = sgAmber
					.map(
						(r) =>
							`<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.name)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${r.renewalDueDate ? new Date(r.renewalDueDate).toLocaleDateString('en-GB') : '—'}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.level)}</td></tr>`
					)
					.join('');
				sectionsHtml += `
  <h2 style="font-size:1rem;margin-top:1.5em;">Safeguarding training renewal due within 60 days</h2>
  <p style="font-size:0.9em;color:#555;">Record-keeping reminder only.</p>
  <table style="border-collapse: collapse; margin: 0.5em 0 1em;">
    <thead><tr style="background: #f5f5f5;">
      <th style="padding:8px 10px;text-align:left;">Name</th>
      <th style="padding:8px 10px;text-align:left;">Renewal due</th>
      <th style="padding:8px 10px;text-align:left;">Training level</th>
    </tr></thead>
    <tbody>${sgList}</tbody>
  </table>`;
			}

			const totalCount = amber.length + sgAmber.length;
			const subject = `Compliance renewal reminder: ${totalCount} item${totalCount !== 1 ? 's' : ''} due within 60 days`;
			const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>Hello,</p>
  <p>The following volunteers have DBS or safeguarding training due for renewal within the next 60 days.</p>
  ${sectionsHtml}
  <p style="color:#666;font-size:0.9em;">— ${escapeHtml(orgName)} (OnNuma Hub)</p>
</body>
</html>`;

			await sendEmail({
				from: fromEmailDefault(),
				to: toEmails,
				subject,
				html
			});
			totalSent++;
		} catch (err) {
			errors.push({ organisationId: org.id, organisationName: org.name, error: err?.message || String(err) });
			console.error('[DBS Renewal API] Error for org', org.id, err);
		}
	}

	return json({
		success: true,
		message: `DBS renewal reminders sent to ${totalSent} organisation(s)`,
		totalOrganisations: churchOrgs.length,
		emailsSent: totalSent,
		errors: errors.length > 0 ? errors : undefined,
		timestamp: new Date().toISOString()
	});
}

function escapeHtml(s) {
	if (s == null) return '';
	const str = String(s);
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
