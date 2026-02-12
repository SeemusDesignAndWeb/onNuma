#!/usr/bin/env node
/**
 * Seeds plan-specific onboarding sequences (Free + Professional).
 * Creates plan-specific email templates and assembles them into sequences.
 * Reuses shared templates (events, rotas) from the default seed where possible.
 *
 * Usage: node scripts/seed-plan-sequences.js
 */

import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env
try {
	const envContent = await readFile(join(__dirname, '..', '.env'), 'utf8');
	for (const line of envContent.split('\n')) {
		const t = line.trim();
		if (!t || t.startsWith('#')) continue;
		const eq = t.indexOf('=');
		if (eq === -1) continue;
		const k = t.slice(0, eq).trim();
		if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
	}
} catch { /* no .env */ }

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const TABLE_NAME = 'crm_records';
const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });
const now = () => new Date().toISOString();
const uid = () => randomUUID();

async function readCollection(collection) {
	const res = await pool.query(`SELECT id, body FROM ${TABLE_NAME} WHERE collection = $1`, [collection]);
	return res.rows.map(r => ({ id: r.id, ...r.body }));
}

async function createRecord(collection, data) {
	const record = { ...data, id: data.id || uid(), createdAt: data.createdAt || now(), updatedAt: now() };
	const { id, createdAt, updatedAt, ...body } = record;
	await pool.query(
		`INSERT INTO ${TABLE_NAME} (collection, id, body, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)`,
		[collection, id, JSON.stringify(body), createdAt, updatedAt]
	);
	return record;
}

// ─── HTML Helpers ────────────────────────────────────────────────────────────

const btn = (text, url, bg = '#EB9486') =>
	`<a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin:8px 0;">${text}</a>`;

const heading = (text) =>
	`<h2 style="color:#272838;font-size:20px;font-weight:700;margin:28px 0 12px 0;padding-bottom:8px;border-bottom:2px solid #F3DE8A;">${text}</h2>`;

const subheading = (text) =>
	`<h3 style="color:#7E7F9A;font-size:16px;font-weight:600;margin:20px 0 8px 0;">${text}</h3>`;

const tip = (text) =>
	`<div style="background:#FEF9E7;border-left:4px solid #F3DE8A;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0;font-size:14px;color:#272838;"><strong style="color:#272838;">Tip:</strong> ${text}</div>`;

const stepsList = (steps) => {
	let h = '<ol style="padding-left:20px;margin:12px 0;">';
	for (const s of steps) h += `<li style="margin:8px 0;font-size:14px;color:#272838;line-height:1.6;">${s}</li>`;
	return h + '</ol>';
};

const featureCard = (icon, title, desc) =>
	`<div style="background:#f8f8fa;border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin:10px 0;">
		<div style="font-size:24px;margin-bottom:6px;">${icon}</div>
		<p style="font-weight:600;color:#272838;margin:0 0 4px 0;font-size:15px;">${title}</p>
		<p style="color:#7E7F9A;margin:0;font-size:13px;line-height:1.5;">${desc}</p>
	</div>`;

const divider = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />';

const upgradeBanner = (title, desc, ctaText = 'Explore Professional') =>
	`<div style="background:linear-gradient(135deg,#272838 0%,#7E7F9A 100%);border-radius:12px;padding:28px;margin:20px 0;text-align:center;">
		<p style="font-size:18px;font-weight:700;color:#F3DE8A;margin:0 0 8px 0;">${title}</p>
		<p style="font-size:14px;color:rgba(255,255,255,0.9);margin:0 0 16px 0;">${desc}</p>
		${btn(ctaText, '{{login_url}}', '#EB9486')}
	</div>`;

// ─── Templates ───────────────────────────────────────────────────────────────

const planTemplates = [

	// ═══════════════════════════════════════════════════════════════════════
	// FREE PLAN TEMPLATES
	// ═══════════════════════════════════════════════════════════════════════

	{
		name: 'Welcome to TheHUB (Free Plan)',
		internal_notes: 'Sent immediately to Free plan users. Highlights available features and sets expectations.',
		subject: 'Welcome to TheHUB, {{first_name}}!',
		preview_text: 'Your free community management toolkit is ready.',
		tags: ['onboarding', 'welcome', 'free-plan', 'essential'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Welcome to <strong>TheHUB</strong> — your new home for managing <strong>{{org_name}}</strong>'s community. We're glad you're here!</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Your Free plan gives you everything you need to get started:</p>

			${heading('What\'s included in your Free plan')}
			<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">
				${featureCard('👥', 'Up to 30 Contacts', 'Manage your community directory — add, import, search, and organise people.')}
				${featureCard('📅', 'Events & Calendar', 'Create events with multiple dates, public signup links, and attendance tracking.')}
				${featureCard('🙋', 'Volunteer Rotas', 'Assign volunteers, send invitations, and automate reminders.')}
				${featureCard('📋', 'Meeting Planners', 'Plan meetings with presenters, session leads, and rota assignments.')}
			</div>

			${divider}
			{{block:getting_started_steps}}

			<div style="text-align:center;margin:28px 0;">
				${btn('Log in to TheHUB', '{{login_url}}')}
			</div>

			<div style="background:#f8f8fa;border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin:20px 0;">
				<p style="font-size:13px;color:#7E7F9A;margin:0;line-height:1.6;">
					<strong style="color:#272838;">Looking for more?</strong> Upgrade to Professional for email campaigns, forms, membership management, custom branding, and up to 500 contacts. You can upgrade anytime from Settings → Billing.
				</p>
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nWelcome to TheHUB — your new home for managing {{org_name}}'s community.\n\nYour Free plan includes:\n- Up to 30 contacts\n- Events & calendar\n- Volunteer rotas with reminders\n- Meeting planners\n\nLog in: {{login_url}}\n\nLooking for more? Upgrade to Professional for email campaigns, forms, membership management, and up to 500 contacts.\n\nNeed help? {{support_url}}`
	},

	{
		name: 'Getting Started with Contacts (Free Plan)',
		internal_notes: 'Day 1 for Free plan. Covers adding contacts within the 30-person limit.',
		subject: 'Add your first contacts, {{first_name}}',
		preview_text: 'Your community directory starts with just a few people.',
		tags: ['onboarding', 'contacts', 'free-plan'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">The heart of TheHUB is your <strong>contacts</strong>. On your Free plan, you can manage up to <strong>30 contacts</strong> — perfect for getting started with your core team.</p>

			${heading('Add contacts manually')}
			${stepsList([
				'Go to <strong>Contacts → New Contact</strong>',
				'Add their name, email, phone, and address',
				'Set their membership status (member, regular attender, visitor)',
				'Optionally link spouses together'
			])}

			${heading('Import from a spreadsheet')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Already have a list? Import up to 30 contacts from CSV or Excel:</p>
			${stepsList([
				'Go to <strong>Contacts → Import</strong>',
				'Upload your file',
				'Map columns to TheHUB fields',
				'Preview and click <strong>Import</strong>'
			])}
			${tip('Start with your key volunteers and leaders — the people who\'ll appear on rotas and need event updates.')}

			${heading('Organise with Lists')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Create lists to group contacts — for example, "Events Team" or "Welcome Team". Lists make it easy to assign rotas and keep things organised.</p>

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Contacts', '{{link:contacts_page}}')}
			</div>

			<div style="background:#f0f9ff;border-left:4px solid #3b82f6;border-radius:0 8px 8px 0;padding:14px 18px;margin:16px 0;font-size:14px;color:#272838;">
				<strong>Need more than 30 contacts?</strong> Professional plan supports up to 500 contacts, plus email campaigns and forms. Upgrade anytime in Settings → Billing.
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nYour Free plan includes up to 30 contacts.\n\nAdd contacts manually:\n1. Go to Contacts → New Contact\n2. Add name, email, phone\n3. Set membership status\n\nImport from a spreadsheet:\n1. Go to Contacts → Import\n2. Upload CSV/Excel\n3. Map columns and import\n\nTip: Start with your key volunteers and leaders.\n\nNeed more than 30 contacts? Upgrade to Professional in Settings → Billing.\n\nGo to Contacts: {{link:contacts_page}}\n\nNeed help? {{support_url}}`
	},

	{
		name: 'Making the Most of Your Free Plan',
		internal_notes: 'Day 10 for Free plan. Summary of what they can do + upgrade nudge.',
		subject: 'You\'re getting the hang of it, {{first_name}}!',
		preview_text: 'Quick tips to make the most of your free TheHUB account.',
		tags: ['onboarding', 'tips', 'free-plan'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">You've been using TheHUB for a little while now — here are some tips to make the most of your Free plan.</p>

			${heading('Quick wins with your Free plan')}

			${subheading('1. Set up recurring events')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">If you have a weekly meeting or regular event, add all the dates as <strong>occurrences</strong>. This way you can see everything in the calendar and attach rotas to each date.</p>

			${subheading('2. Use public signup links')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Every event and rota has a <strong>shareable public link</strong>. Send it to volunteers or share on social media — people can sign up without needing an account.</p>

			${subheading('3. Attach help files to rotas')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Upload a PDF or add a link to each rota role explaining what volunteers need to do. New volunteers will thank you!</p>

			${subheading('4. Try Meeting Planners')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">If you run regular meetings, Meeting Planners bring together the presenter, session lead, rotas, and notes in one view. You can even export them as PDF.</p>

			${subheading('5. Automate rota reminders')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">TheHUB automatically emails volunteers before their rota assignments. By default, reminders go out 3 days ahead — you can change this in Settings.</p>

			${divider}

			${upgradeBanner(
				'Ready to do more?',
				'Professional plan adds email newsletters, custom forms, membership management, branding, and up to 500 contacts.',
				'See Professional Features'
			)}

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nHere are tips to make the most of your Free plan:\n\n1. Set up recurring events with multiple occurrences\n2. Use public signup links for events and rotas\n3. Attach help files (PDFs) to rota roles\n4. Try Meeting Planners for session planning\n5. Automate rota reminders (3 days ahead by default)\n\nReady to do more? Professional adds newsletters, forms, members, branding, and 500 contacts.\n\nNeed help? {{support_url}}`
	},

	{
		name: 'Unlock More with Professional',
		internal_notes: 'Day 14 for Free plan. Clear upgrade pitch showing what Professional offers.',
		subject: 'Here\'s what you\'re missing, {{first_name}}',
		preview_text: 'See what Professional plan could do for {{org_name}}.',
		tags: ['onboarding', 'upgrade', 'free-plan', 'non-essential'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">You've been doing great things with TheHUB's Free plan. But there's so much more your community management could do with <strong>Professional</strong>.</p>

			${heading('What you\'ll unlock with Professional')}

			<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">
				${featureCard('✉️', 'Email Campaigns & Newsletters', 'Create beautiful, personalised emails. Send to contact lists or individual people. Use templates, add images, and track delivery.')}
				${featureCard('📝', 'Custom Forms', 'Build any form — registrations, feedback, applications. Share a public link. View and manage all submissions in TheHUB.')}
				${featureCard('👤', 'Membership Management', 'Track membership status, join dates, and renewals. Dedicated members section with filtering and reporting.')}
				${featureCard('🎨', 'Your Branding', 'Add your logo, customise colours, and make TheHUB look like your own. Your branding appears in emails and public pages too.')}
			</div>

			${heading('Plus bigger limits')}
			<div style="background:#f8f8fa;border-radius:10px;padding:18px;margin:12px 0;">
				<div style="display:flex;justify-content:space-around;text-align:center;">
					<div>
						<p style="font-size:24px;font-weight:700;color:#272838;margin:0;">500</p>
						<p style="font-size:12px;color:#7E7F9A;margin:4px 0 0 0;">contacts</p>
					</div>
					<div>
						<p style="font-size:24px;font-weight:700;color:#272838;margin:0;">5</p>
						<p style="font-size:12px;color:#7E7F9A;margin:4px 0 0 0;">admin users</p>
					</div>
					<div>
						<p style="font-size:24px;font-weight:700;color:#272838;margin:0;">Unlimited</p>
						<p style="font-size:12px;color:#7E7F9A;margin:4px 0 0 0;">emails & forms</p>
					</div>
				</div>
			</div>

			<p style="font-size:14px;color:#272838;line-height:1.7;margin-top:20px;">Everything you've set up on the Free plan carries over — nothing is lost. You just unlock more.</p>

			<div style="text-align:center;margin:28px 0;">
				${btn('Upgrade to Professional', '{{link:settings_page}}', '#EB9486')}
			</div>

			<p style="font-size:13px;color:#7E7F9A;text-align:center;margin:0;">Upgrade, downgrade, or cancel anytime. No lock-in.</p>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nThere's more your community management could do with Professional:\n\n- Email Campaigns & Newsletters\n- Custom Forms\n- Membership Management\n- Your Branding (logo, colours)\n- 500 contacts (vs 30)\n- 5 admin users (vs 1)\n- Unlimited emails & forms\n\nEverything you've set up carries over — nothing is lost.\n\nUpgrade in Settings → Billing.\nNo lock-in — cancel anytime.\n\nNeed help? {{support_url}}`
	},

	// ═══════════════════════════════════════════════════════════════════════
	// PROFESSIONAL PLAN TEMPLATES
	// ═══════════════════════════════════════════════════════════════════════

	{
		name: 'Welcome to TheHUB Professional',
		internal_notes: 'Sent immediately to Professional plan users. Covers the full feature set.',
		subject: 'Welcome to TheHUB Professional, {{first_name}}!',
		preview_text: 'Your professional community management toolkit is ready.',
		tags: ['onboarding', 'welcome', 'professional', 'essential'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Welcome to <strong>TheHUB Professional</strong> — the complete toolkit for managing <strong>{{org_name}}</strong>'s community. You've made a great choice!</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Professional gives you everything you need to run your community effortlessly:</p>

			${heading('Your Professional features')}
			<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">
				${featureCard('👥', 'Up to 500 Contacts', 'Full community directory with import, search, lists, membership tracking, and spouse linking.')}
				${featureCard('📅', 'Events & Calendar', 'Create events with multiple dates, public signups, attendance tracking, and colour-coded calendar views.')}
				${featureCard('🙋', 'Volunteer Rotas', 'Assign volunteers, bulk invite from lists, automate reminders, PDF export, and conflict checking.')}
				${featureCard('✉️', 'Email Campaigns', 'Beautiful personalised newsletters. Send to lists, use templates, track delivery.')}
				${featureCard('📝', 'Custom Forms', 'Build any form with a public link — registrations, feedback, applications.')}
				${featureCard('👤', 'Members', 'Dedicated member section. Track status, join dates, and manage renewals.')}
				${featureCard('🎨', 'Your Branding', 'Custom logo, colours, and styling. Your brand in emails, login page, and public pages.')}
				${featureCard('📋', 'Meeting Planners', 'Plan meetings with presenters, session leads, rotas, notes, and PDF export.')}
			</div>

			${divider}
			{{block:getting_started_steps}}

			<div style="text-align:center;margin:28px 0;">
				${btn('Log in to TheHUB', '{{login_url}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nWelcome to TheHUB Professional — the complete toolkit for {{org_name}}.\n\nYour Professional features:\n- Up to 500 contacts with membership tracking\n- Events with signups and calendar views\n- Volunteer rotas with reminders\n- Email campaigns and newsletters\n- Custom forms with public links\n- Member management\n- Custom branding\n- Meeting planners\n\nLog in: {{login_url}}\n\nNeed help? {{support_url}}`
	},

	{
		name: 'Getting Started with Contacts (Professional)',
		internal_notes: 'Day 1 for Professional plan. Full contacts walkthrough with 500 limit.',
		subject: 'Your community directory starts here, {{first_name}}',
		preview_text: 'Import up to 500 contacts in minutes.',
		tags: ['onboarding', 'contacts', 'professional'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Your Professional plan supports up to <strong>500 contacts</strong> — enough for your entire community. Let's get them set up.</p>

			${heading('Import your existing contacts')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Got a spreadsheet? Import everyone in a few clicks:</p>
			${stepsList([
				'Go to <strong>Contacts → Import</strong>',
				'Upload your CSV or Excel file',
				'Map your columns (name, email, phone, address, membership status)',
				'Preview the data and click <strong>Import</strong>'
			])}
			${tip('Don\'t worry about getting it perfect — you can edit contacts individually afterwards.')}

			${heading('Add contacts manually')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Click <strong>Contacts → New Contact</strong> and capture:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;">Name, email, phone, full address</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Membership status (member, regular attender, visitor, former member)</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Spouse linking, notes, and newsletter subscription</li>
			</ul>

			${heading('Organise with Lists')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Lists are powerful. Use them to:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;">Send <strong>targeted email campaigns</strong> to specific groups</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Bulk-invite volunteers to <strong>rotas</strong></li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Organise people by team, interest group, or demographic</li>
			</ul>

			${heading('Members section')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Your Professional plan includes a dedicated <strong>Members</strong> section. Contacts marked as "member" appear here with their join date, status, and member-specific details.</p>

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Contacts', '{{link:contacts_page}}', '#EB9486')}
				<span style="display:inline-block;width:12px;"></span>
				${btn('Import Contacts', '{{link:import_contacts}}', '#7E7F9A')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nYour Professional plan supports up to 500 contacts.\n\nImport contacts:\n1. Go to Contacts → Import\n2. Upload CSV/Excel\n3. Map columns and import\n\nAdd manually: Name, email, phone, address, membership status, spouse linking.\n\nOrganise with Lists for targeted emails, rota invitations, and team management.\n\nMembers section: Contacts marked "member" get their own dedicated section.\n\nGo to Contacts: {{link:contacts_page}}\n\nNeed help? {{support_url}}`
	},

	{
		name: 'Sending Newsletters & Email Campaigns',
		internal_notes: 'Day 7 for Professional plan. Deep dive into email features (Pro only).',
		subject: 'Keep your community connected, {{first_name}}',
		preview_text: 'Send beautiful personalised emails to your community.',
		tags: ['onboarding', 'emails', 'professional'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">One of the most powerful features in your Professional plan is <strong>email campaigns</strong>. Keep your community informed with beautiful, personalised newsletters.</p>

			${heading('Create your first email')}
			${stepsList([
				'Go to <strong>Emails → New Email</strong>',
				'Write a compelling subject line',
				'Use the <strong>visual editor</strong> — add text, images, formatting',
				'Personalise with <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;">{{first_name}}</code> and other variables'
			])}

			${heading('Personalisation that works')}
			<div style="background:#f8f8fa;border-radius:10px;padding:18px;margin:12px 0;">
				<p style="margin:0;font-size:14px;color:#272838;"><strong>You write:</strong> "Hi {{first_name}}, here's what's coming up at {{org_name}}..."</p>
				<p style="margin:8px 0 0 0;font-size:14px;color:#7E7F9A;"><strong>Sarah sees:</strong> "Hi Sarah, here's what's coming up at {{org_name}}..."</p>
			</div>

			${heading('Send to the right people')}
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>All contacts</strong> — weekly newsletter to everyone</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>A specific list</strong> — "Youth Group", "New Visitors", "Events Team"</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Hand-picked</strong> — select individual recipients</li>
			</ul>

			${heading('Save time with templates')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Created a great layout? Save it as a <strong>template</strong>. Next time, load the template and just update the content. You can also create a <strong>weekly template</strong> for recurring newsletters.</p>

			${heading('Event-to-email workflow')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Here's a trick: after creating an event, click <strong>"Create email from event"</strong>. TheHUB auto-populates a newsletter with the event details — ready to send.</p>

			${tip('Emails automatically include an unsubscribe link. Contacts who opt out won\'t receive future campaigns, but they\'ll still get essential notifications like rota reminders.')}

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Emails', '{{link:emails_page}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nEmail campaigns are one of your most powerful Professional features.\n\nCreate an email:\n1. Go to Emails → New Email\n2. Write your subject line\n3. Use the visual editor\n4. Personalise with {{first_name}} and other variables\n\nSend to: All contacts, a specific list, or hand-picked individuals.\n\nSave time: Save layouts as templates. Create weekly templates for recurring newsletters.\n\nPro tip: After creating an event, click "Create email from event" to auto-populate a newsletter.\n\nGo to Emails: {{link:emails_page}}\n\nNeed help? {{support_url}}`
	},

	{
		name: 'Using Forms to Collect Information',
		internal_notes: 'Day 10 for Professional plan. How to create and manage forms (Pro only).',
		subject: 'Collect information easily with forms',
		preview_text: 'Build any form and share it with a public link.',
		tags: ['onboarding', 'forms', 'professional'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Need to collect information from your community? Your Professional plan includes <strong>custom forms</strong> with public links — no login required for respondents.</p>

			${heading('Build any form')}
			${stepsList([
				'Go to <strong>Forms → New Form</strong>',
				'Give it a name and description',
				'Add fields: text, email, phone, date, number, textarea, dropdown, checkboxes, or radio buttons',
				'Set fields as required or optional, add placeholders',
				'Share the <strong>public link</strong> — anyone can fill it in'
			])}

			${heading('Ideas for forms')}
			<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">
				${featureCard('📋', 'Newcomer Registration', 'Welcome visitors and collect their details in one place.')}
				${featureCard('💬', 'Feedback Survey', 'Gather opinions after events or sessions.')}
				${featureCard('🙋', 'Volunteer Application', 'Let people apply for serving roles.')}
				${featureCard('📝', 'Event RSVP', 'Custom registration with dietary requirements and more.')}
			</div>

			${heading('Managing responses')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">All submissions appear in TheHUB where you can view, filter, and manage them. You can also <strong>export forms</strong> as JSON for backup or sharing with other organisations.</p>

			${heading('Public signup pages')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">In addition to custom forms, TheHUB has built-in signup pages:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Member Signup</strong> — for new members to register directly</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Event Signup</strong> — shareable registration for any event</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Rota Signup</strong> — unique links for volunteer sign-ups</li>
			</ul>

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Forms', '{{link:forms_page}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nYour Professional plan includes custom forms with public links.\n\nBuild any form:\n1. Go to Forms → New Form\n2. Add fields (text, email, dropdown, etc.)\n3. Share the public link\n\nIdeas: Newcomer registration, feedback surveys, volunteer applications, event RSVPs.\n\nAll submissions appear in TheHUB for you to manage.\n\nGo to Forms: {{link:forms_page}}\n\nNeed help? {{support_url}}`
	},

	{
		name: 'Brand TheHUB Your Way',
		internal_notes: 'Day 12 for Professional plan. Branding and customisation (Pro only).',
		subject: 'Make TheHUB look like yours, {{first_name}}',
		preview_text: 'Add your logo, colours, and make it your own.',
		tags: ['onboarding', 'branding', 'professional'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Your Professional plan lets you <strong>brand TheHUB</strong> to match {{org_name}}'s identity. Here's how to make it look like yours.</p>

			${heading('Add your logo')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Go to <strong>Settings → Theme</strong> and upload your logo. It appears in three places:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;">The <strong>navigation bar</strong> — top of every page</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">The <strong>login page</strong> — first thing users see</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Your <strong>emails</strong> — professional branded communications</li>
			</ul>

			${heading('Customise your colours')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">You can customise:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Primary colour</strong> — the main accent across the interface</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Brand colour</strong> — for headers and key elements</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Navigation bar</strong> — background colour</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Buttons</strong> — up to 5 different button styles</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Panel headers</strong> — section header colours</li>
			</ul>

			${heading('Calendar event colours')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Create custom colour labels for different event types — e.g. blue for regular meetings, green for social events, orange for training. These appear in the calendar for easy visual identification.</p>

			${tip('Your branding settings also apply to public pages like event signups and forms — giving everything a cohesive, professional look.')}

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Settings', '{{link:settings_page}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nMake TheHUB match {{org_name}}'s identity.\n\nAdd your logo: Settings → Theme. Appears in navbar, login page, and emails.\n\nCustomise colours: Primary, brand, navbar, buttons, panel headers.\n\nCalendar colours: Create colour labels for different event types.\n\nYour branding also applies to public pages like event signups and forms.\n\nGo to Settings: {{link:settings_page}}\n\nNeed help? {{support_url}}`
	},

	{
		name: 'Pro Tips & Advanced Features',
		internal_notes: 'Day 21 for Professional plan. Power-user tips and encouragement.',
		subject: 'Pro tips for getting the most out of TheHUB',
		preview_text: 'Advanced features and workflows for power users.',
		tags: ['onboarding', 'tips', 'professional', 'non-essential'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">You've been using TheHUB Professional for three weeks — here are some advanced features and workflows to take things further.</p>

			{{block:pro_tips}}

			${heading('Professional power moves')}

			${subheading('1. Weekly newsletter template')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Create a <strong>weekly template</strong> with your standard layout — logo, greeting, upcoming events section, and footer. Each week, load the template and just update the content. Saves 20+ minutes every time.</p>

			${subheading('2. Event-to-email pipeline')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">After creating an event, click <strong>"Create email from event"</strong> to auto-generate a newsletter. Add week notes to events and they'll automatically appear in your next email.</p>

			${subheading('3. Member signup forms')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Share the public <strong>member signup link</strong> on your website. New members register themselves and appear in your contacts — no manual data entry needed.</p>

			${subheading('4. Rota + list power combo')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Create a contact list for each serving team (e.g. "AV Team"). Then use <strong>bulk invite</strong> to send rota signup links to the entire team in one click.</p>

			${subheading('5. Add more admins')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Your Professional plan supports up to <strong>5 admin users</strong>. Share the workload — let team leaders manage their own rotas and events.</p>

			${divider}

			<div style="background:linear-gradient(135deg,#EB9486 0%,#c75a4a 100%);border-radius:12px;padding:28px;margin:20px 0;text-align:center;">
				<p style="font-size:18px;font-weight:700;color:#ffffff;margin:0 0 8px 0;">You're a TheHUB pro!</p>
				<p style="font-size:14px;color:rgba(255,255,255,0.9);margin:0 0 16px 0;">Keep exploring — there's always more to discover.</p>
				${btn('Log in to TheHUB', '{{login_url}}', '#ffffff').replace('color:#ffffff', 'color:#EB9486')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nAdvanced tips for TheHUB Professional:\n\n1. Create a weekly newsletter template to save 20+ minutes\n2. Use event-to-email pipeline for automatic newsletter content\n3. Share the public member signup link on your website\n4. Combine contact lists with bulk rota invitations\n5. Add up to 5 admin users to share the workload\n\nKeep exploring! Log in: {{login_url}}\n\nNeed help? {{support_url}}`
	}
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
	const adminId = 'seed-script';
	const counts = { templates: 0, versions: 0, sequences: 0, steps: 0 };

	console.log('Seeding plan-specific sequences…\n');

	// Load existing templates (including previously seeded shared ones)
	const existingTemplates = await readCollection('marketing_email_templates');
	const existingNames = new Set(existingTemplates.map(t => t.name));
	const templateIdByName = {};

	// Map existing template names → IDs
	for (const t of existingTemplates) {
		templateIdByName[t.name] = t.id;
	}

	// Create new plan-specific templates
	console.log('Creating plan-specific templates…');
	for (const tmpl of planTemplates) {
		if (existingNames.has(tmpl.name)) {
			console.log(`  ⏭  "${tmpl.name}" already exists`);
			continue;
		}
		const tid = uid();
		templateIdByName[tmpl.name] = tid;
		await createRecord('marketing_email_templates', {
			id: tid, name: tmpl.name, internal_notes: tmpl.internal_notes,
			subject: tmpl.subject, preview_text: tmpl.preview_text,
			body_html: tmpl.body_html, body_text: tmpl.body_text,
			placeholders: [], status: 'active', tags: tmpl.tags,
			created_at: now(), updated_at: now(), created_by: adminId
		});
		await createRecord('marketing_template_versions', {
			id: uid(), template_id: tid,
			snapshot: { name: tmpl.name, subject: tmpl.subject, preview_text: tmpl.preview_text, body_html: tmpl.body_html, body_text: tmpl.body_text, tags: tmpl.tags },
			updated_at: now(), updated_by: adminId, change_summary: 'Initial creation (seeded)'
		});
		counts.templates++;
		counts.versions++;
		console.log(`  ✅ "${tmpl.name}"`);
	}

	// Load existing sequences
	const existingSequences = await readCollection('marketing_sequences');
	const existingSeqNames = new Set(existingSequences.map(s => s.name));

	// Helper to find template ID by name
	const tid = (name) => {
		const id = templateIdByName[name];
		if (!id) console.log(`  ⚠️  Template not found: "${name}"`);
		return id;
	};

	// ── FREE PLAN SEQUENCE ─────────────────────────────────────────────────
	const freeSeqName = 'Free Plan Onboarding';
	if (existingSeqNames.has(freeSeqName)) {
		console.log(`\n⏭  Sequence "${freeSeqName}" already exists`);
	} else {
		console.log(`\nCreating "${freeSeqName}"…`);
		const seqId = uid();
		await createRecord('marketing_sequences', {
			id: seqId, name: freeSeqName,
			description: 'A focused onboarding sequence for Free plan users. Covers contacts (30 limit), events, rotas, meeting planners, and includes an upgrade prompt for Professional.',
			status: 'active', applies_to: 'default',
			organisation_id: null, org_group: null,
			created_at: now(), updated_at: now(), created_by: adminId
		});
		counts.sequences++;

		const freeSteps = [
			{ name: 'Welcome to TheHUB (Free Plan)',            delay: 0,  unit: 'minutes' },
			{ name: 'Getting Started with Contacts (Free Plan)', delay: 1,  unit: 'days' },
			{ name: 'Creating Your First Event',                 delay: 3,  unit: 'days' },   // shared template
			{ name: 'Managing Volunteer Rotas',                  delay: 5,  unit: 'days' },   // shared template
			{ name: 'Meeting Planners & Advanced Features',      delay: 8,  unit: 'days' },   // shared template
			{ name: 'Making the Most of Your Free Plan',         delay: 10, unit: 'days' },
			{ name: 'Unlock More with Professional',             delay: 14, unit: 'days' }
		];

		for (let i = 0; i < freeSteps.length; i++) {
			const step = freeSteps[i];
			const templateId = tid(step.name);
			if (!templateId) continue;
			await createRecord('marketing_sequence_steps', {
				id: uid(), sequence_id: seqId, email_template_id: templateId,
				order: i + 1, delay_value: step.delay, delay_unit: step.unit,
				conditions: [], created_at: now(), updated_at: now()
			});
			counts.steps++;
			console.log(`  ✅ Step ${i + 1}: "${step.name}" (${step.delay} ${step.unit})`);
		}
	}

	// ── PROFESSIONAL PLAN SEQUENCE ──────────────────────────────────────────
	const proSeqName = 'Professional Plan Onboarding';
	if (existingSeqNames.has(proSeqName)) {
		console.log(`\n⏭  Sequence "${proSeqName}" already exists`);
	} else {
		console.log(`\nCreating "${proSeqName}"…`);
		const seqId = uid();
		await createRecord('marketing_sequences', {
			id: seqId, name: proSeqName,
			description: 'A comprehensive onboarding sequence for Professional plan users. Covers all features including email campaigns, forms, members, and branding — plus shared features like events, rotas, and meeting planners.',
			status: 'active', applies_to: 'default',
			organisation_id: null, org_group: null,
			created_at: now(), updated_at: now(), created_by: adminId
		});
		counts.sequences++;

		const proSteps = [
			{ name: 'Welcome to TheHUB Professional',               delay: 0,  unit: 'minutes' },
			{ name: 'Getting Started with Contacts (Professional)',  delay: 1,  unit: 'days' },
			{ name: 'Creating Your First Event',                     delay: 3,  unit: 'days' },   // shared
			{ name: 'Managing Volunteer Rotas',                      delay: 5,  unit: 'days' },   // shared
			{ name: 'Sending Newsletters & Email Campaigns',         delay: 7,  unit: 'days' },
			{ name: 'Using Forms to Collect Information',            delay: 10, unit: 'days' },
			{ name: 'Brand TheHUB Your Way',                         delay: 12, unit: 'days' },
			{ name: 'Meeting Planners & Advanced Features',          delay: 15, unit: 'days' },   // shared
			{ name: 'Pro Tips & Advanced Features',                  delay: 21, unit: 'days' }
		];

		for (let i = 0; i < proSteps.length; i++) {
			const step = proSteps[i];
			const templateId = tid(step.name);
			if (!templateId) continue;
			await createRecord('marketing_sequence_steps', {
				id: uid(), sequence_id: seqId, email_template_id: templateId,
				order: i + 1, delay_value: step.delay, delay_unit: step.unit,
				conditions: [], created_at: now(), updated_at: now()
			});
			counts.steps++;
			console.log(`  ✅ Step ${i + 1}: "${step.name}" (${step.delay} ${step.unit})`);
		}
	}

	console.log('\n──────────────────────────────────────────');
	console.log('Done! Created:');
	console.log(`  ✉️  ${counts.templates} plan-specific templates (${counts.versions} versions)`);
	console.log(`  🔄 ${counts.sequences} sequence(s) with ${counts.steps} steps`);
	console.log('──────────────────────────────────────────\n');

	await pool.end();
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
