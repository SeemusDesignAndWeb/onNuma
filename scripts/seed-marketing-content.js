#!/usr/bin/env node
/**
 * Seed marketing content directly into PostgreSQL.
 * Usage: node scripts/seed-marketing-content.js
 *
 * Reads DATABASE_URL from .env (via dotenv) and inserts content blocks,
 * links, email templates, template versions, sequences, and sequence steps.
 * Skips any records whose name/key already exists.
 */

import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Load .env
// ─────────────────────────────────────────────────────────────────────────────
async function loadEnv() {
	try {
		const envPath = join(__dirname, '..', '.env');
		const content = await readFile(envPath, 'utf8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const eqIdx = trimmed.indexOf('=');
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx).trim();
			const val = trimmed.slice(eqIdx + 1).trim();
			if (!process.env[key]) process.env[key] = val;
		}
	} catch { /* no .env file */ }
}

await loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL not set'); process.exit(1); }

const TABLE_NAME = 'crm_records';
const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });

const now = () => new Date().toISOString();
const uid = () => randomUUID();

// ─────────────────────────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────────────────────────

async function readCollection(collection) {
	const res = await pool.query(`SELECT id, body, created_at, updated_at FROM ${TABLE_NAME} WHERE collection = $1`, [collection]);
	return res.rows.map(row => ({ id: row.id, ...row.body, createdAt: row.created_at, updatedAt: row.updated_at }));
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

// ─────────────────────────────────────────────────────────────────────────────
// HTML helpers
// ─────────────────────────────────────────────────────────────────────────────

const btn = (text, url, bg = '#EB9486') =>
	`<a href="${url}" style="display:inline-block;background:${bg};color:#ffffff;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin:8px 0;">${text}</a>`;

const heading = (text) =>
	`<h2 style="color:#272838;font-size:20px;font-weight:700;margin:28px 0 12px 0;padding-bottom:8px;border-bottom:2px solid #F3DE8A;">${text}</h2>`;

const subheading = (text) =>
	`<h3 style="color:#7E7F9A;font-size:16px;font-weight:600;margin:20px 0 8px 0;">${text}</h3>`;

const tip = (text) =>
	`<div style="background:#FEF9E7;border-left:4px solid #F3DE8A;padding:14px 18px;border-radius:0 8px 8px 0;margin:16px 0;font-size:14px;color:#272838;"><strong style="color:#272838;">Tip:</strong> ${text}</div>`;

const stepsList = (steps) => {
	let html = '<ol style="padding-left:20px;margin:12px 0;">';
	for (const s of steps) html += `<li style="margin:8px 0;font-size:14px;color:#272838;line-height:1.6;">${s}</li>`;
	html += '</ol>';
	return html;
};

const featureCard = (icon, title, desc) =>
	`<div style="background:#f8f8fa;border:1px solid #e5e7eb;border-radius:10px;padding:18px;margin:10px 0;">
		<div style="font-size:24px;margin-bottom:6px;">${icon}</div>
		<p style="font-weight:600;color:#272838;margin:0 0 4px 0;font-size:15px;">${title}</p>
		<p style="color:#7E7F9A;margin:0;font-size:13px;line-height:1.5;">${desc}</p>
	</div>`;

const divider = '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />';

// ─────────────────────────────────────────────────────────────────────────────
// Content blocks
// ─────────────────────────────────────────────────────────────────────────────

const contentBlocks = [
	{
		title: 'Getting Started Steps',
		key: 'getting_started_steps',
		tags: ['onboarding'],
		body_html: `<div style="background:linear-gradient(135deg,#f8f8fa 0%,#FEF9E7 100%);border:1px solid #F3DE8A;border-radius:12px;padding:24px;margin:16px 0;">
			${subheading('Quick Start Checklist')}
			${stepsList([
				'<strong>Add your contacts</strong> — Import from a spreadsheet or add them one by one',
				'<strong>Create your first event</strong> — Set up a recurring meeting or upcoming event',
				'<strong>Set up rotas</strong> — Create volunteer roles and start assigning people',
				'<strong>Send your first email</strong> — Keep your community informed with newsletters',
				'<strong>Customise your settings</strong> — Add your logo and branding colours'
			])}
		</div>`,
		body_text: `Quick Start Checklist:\n1. Add your contacts — Import from a spreadsheet or add them one by one\n2. Create your first event — Set up a recurring meeting or upcoming event\n3. Set up rotas — Create volunteer roles and start assigning people\n4. Send your first email — Keep your community informed with newsletters\n5. Customise your settings — Add your logo and branding colours`
	},
	{
		title: 'How to Sign Up for a Rota',
		key: 'how_to_rota',
		tags: ['rotas', 'help'],
		body_html: `<div style="background:#f0fdf4;border-left:4px solid #22c55e;border-radius:0 10px 10px 0;padding:18px;margin:16px 0;">
			${subheading('How to Sign Up for a Rota')}
			${stepsList([
				'Click the <strong>signup link</strong> in your rota invitation email',
				'You\'ll see the available dates and your role',
				'Select the dates that work for you',
				'Click <strong>Confirm</strong> — you\'ll receive a confirmation'
			])}
			<p style="font-size:13px;color:#7E7F9A;margin-top:12px;">You don\'t need an account to sign up — the link is unique to you.</p>
		</div>`,
		body_text: `How to Sign Up for a Rota:\n1. Click the signup link in your rota invitation email\n2. You'll see the available dates and your role\n3. Select the dates that work for you\n4. Click Confirm — you'll receive a confirmation\n\nYou don't need an account to sign up — the link is unique to you.`
	},
	{
		title: 'How Reminders Work',
		key: 'how_reminders_work',
		tags: ['rotas', 'help'],
		body_html: `<div style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:0 10px 10px 0;padding:18px;margin:16px 0;">
			${subheading('How Reminders Work')}
			<p style="font-size:14px;color:#272838;line-height:1.6;">TheHUB automatically sends email reminders to volunteers before their rota assignments. By default, reminders go out <strong>3 days before</strong> the event.</p>
			<p style="font-size:14px;color:#272838;line-height:1.6;">Each reminder includes the event details, your role, date, time, and location — plus a link to view who else is on the rota.</p>
			${tip('You can change the reminder timing in Settings → Advanced → Rota Reminders.')}
		</div>`,
		body_text: `How Reminders Work:\nTheHUB automatically sends email reminders to volunteers before their rota assignments. By default, reminders go out 3 days before the event.\n\nEach reminder includes the event details, your role, date, time, and location — plus a link to view who else is on the rota.\n\nTip: You can change the reminder timing in Settings → Advanced → Rota Reminders.`
	},
	{
		title: 'Need Help? Contact Us',
		key: 'need_help',
		tags: ['footer', 'support'],
		body_html: `<div style="background:#f8f8fa;border-radius:12px;padding:20px;margin:24px 0;text-align:center;">
			<p style="font-size:15px;font-weight:600;color:#272838;margin:0 0 8px 0;">Need a hand?</p>
			<p style="font-size:14px;color:#7E7F9A;margin:0 0 14px 0;">We're here to help you get the most out of TheHUB.</p>
			<p style="margin:0;">
				<a href="{{support_url}}" style="color:#EB9486;text-decoration:underline;font-size:14px;font-weight:600;">Visit Help Centre</a>
				<span style="color:#7E7F9A;margin:0 12px;">|</span>
				<a href="mailto:{{support_email}}" style="color:#EB9486;text-decoration:underline;font-size:14px;font-weight:600;">Email Support</a>
			</p>
		</div>`,
		body_text: `Need a hand?\nWe're here to help you get the most out of TheHUB.\n\nVisit Help Centre: {{support_url}}\nEmail Support: {{support_email}}`
	},
	{
		title: 'Events Feature Highlight',
		key: 'feature_events',
		tags: ['features', 'events'],
		body_html: `<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">
			${featureCard('📅', 'Calendar Views', 'See all your events in year, month, week, or agenda view — at a glance.')}
			${featureCard('🔁', 'Recurring Events', 'Set up events with multiple occurrences. Each date can have its own location and capacity.')}
			${featureCard('🔗', 'Public Signup Links', 'Share a link and let people sign up for events — no login needed.')}
			${featureCard('📊', 'Attendance Tracking', 'Track signups, guest counts, and dietary requirements per occurrence.')}
		</div>`,
		body_text: `Events Features:\n- Calendar Views: See all your events in year, month, week, or agenda view\n- Recurring Events: Set up events with multiple occurrences\n- Public Signup Links: Share a link and let people sign up — no login needed\n- Attendance Tracking: Track signups, guest counts, and dietary requirements`
	},
	{
		title: 'Rotas Feature Highlight',
		key: 'feature_rotas',
		tags: ['features', 'rotas'],
		body_html: `<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">
			${featureCard('👥', 'Volunteer Roles', 'Create roles like Welcome Team, Session Lead, AV Tech — each with its own capacity.')}
			${featureCard('✉️', 'Bulk Invitations', 'Invite entire contact lists to sign up for rotas with one click.')}
			${featureCard('⏰', 'Automatic Reminders', 'Volunteers get email reminders before their assigned dates.')}
			${featureCard('📋', 'PDF Export', 'Export rotas as PDF to print and display in your venue.')}
		</div>`,
		body_text: `Rota Features:\n- Volunteer Roles: Create roles like Welcome Team, Session Lead, AV Tech\n- Bulk Invitations: Invite entire contact lists to sign up with one click\n- Automatic Reminders: Volunteers get email reminders before their dates\n- PDF Export: Export rotas as PDF to print and display`
	},
	{
		title: 'Pro Tips Collection',
		key: 'pro_tips',
		tags: ['tips'],
		body_html: `<div style="background:linear-gradient(135deg,#272838 0%,#7E7F9A 100%);border-radius:12px;padding:24px;margin:16px 0;color:#ffffff;">
			<p style="font-size:16px;font-weight:700;margin:0 0 16px 0;color:#F3DE8A;">Pro Tips</p>
			<ul style="padding-left:18px;margin:0;">
				<li style="margin:8px 0;font-size:14px;line-height:1.6;">Use <strong>contact lists</strong> to organise people by team, group, or role — then send targeted emails</li>
				<li style="margin:8px 0;font-size:14px;line-height:1.6;">Set up <strong>rota help files</strong> — attach a PDF guide to each role so volunteers know what to do</li>
				<li style="margin:8px 0;font-size:14px;line-height:1.6;">Enable <strong>public event signups</strong> so newcomers can register without an account</li>
				<li style="margin:8px 0;font-size:14px;line-height:1.6;">Use <strong>Meeting Planners</strong> to plan meetings — track presenters, topics, session leads, and all rotas in one place</li>
				<li style="margin:8px 0;font-size:14px;line-height:1.6;">Customise your <strong>theme colours and logo</strong> in Settings to match your organisation's branding</li>
			</ul>
		</div>`,
		body_text: `Pro Tips:\n- Use contact lists to organise people by team, group, or role — then send targeted emails\n- Set up rota help files — attach a PDF guide so volunteers know what to do\n- Enable public event signups so newcomers can register without an account\n- Use Meeting Planners to plan sessions — track everything in one place\n- Customise your theme colours and logo in Settings to match your branding`
	}
];

// ─────────────────────────────────────────────────────────────────────────────
// Links
// ─────────────────────────────────────────────────────────────────────────────

const links = [
	{ key: 'hub_login', name: 'Hub Login', url: '{{login_url}}' },
	{ key: 'help_centre', name: 'Help Centre', url: '/hub/help' },
	{ key: 'contacts_page', name: 'Contacts', url: '/hub/contacts' },
	{ key: 'events_page', name: 'Events', url: '/hub/events' },
	{ key: 'rotas_page', name: 'Rotas', url: '/hub/rotas' },
	{ key: 'emails_page', name: 'Emails', url: '/hub/emails' },
	{ key: 'forms_page', name: 'Forms', url: '/hub/forms' },
	{ key: 'settings_page', name: 'Settings', url: '/hub/settings' },
	{ key: 'profile_page', name: 'Profile', url: '/hub/profile' },
	{ key: 'import_contacts', name: 'Import Contacts', url: '/hub/contacts/import' },
	{ key: 'meeting_planners', name: 'Meeting Planners', url: '/hub/meeting-planners' },
	{ key: 'member_signup', name: 'Member Signup Form', url: '/signup/member' },
	{ key: 'get_started', name: 'Getting Started', url: '/hub/help' }
];

// ─────────────────────────────────────────────────────────────────────────────
// Email templates
// ─────────────────────────────────────────────────────────────────────────────

const emailTemplates = [
	// 1. Welcome
	{
		name: 'Welcome to TheHUB',
		internal_notes: 'Sent immediately when a user joins. Introduces the platform and key features.',
		subject: 'Welcome to TheHUB, {{first_name}}!',
		preview_text: 'Everything you need to manage your community — all in one place.',
		tags: ['onboarding', 'welcome', 'essential'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Welcome to <strong>TheHUB</strong> — your new home for managing <strong>{{org_name}}</strong>'s community. We're excited to have you on board!</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">TheHUB brings together everything you need: contacts, events, volunteer rotas, email newsletters, forms, and more — all in one beautifully simple place.</p>

			${heading('What you can do')}
			<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">
				${featureCard('👥', 'Manage Contacts', 'Keep your community directory organised. Import, search, and create targeted lists.')}
				${featureCard('📅', 'Organise Events', 'Create events with multiple dates, public signup links, and attendance tracking.')}
				${featureCard('🙋', 'Coordinate Rotas', 'Assign volunteers, send invitations, and automate reminders.')}
				${featureCard('✉️', 'Send Emails', 'Beautiful newsletters with personalisation — sent to the right people.')}
			</div>

			${divider}
			{{block:getting_started_steps}}

			<div style="text-align:center;margin:28px 0;">
				${btn('Log in to TheHUB', '{{login_url}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nWelcome to TheHUB — your new home for managing {{org_name}}'s community.\n\nTheHUB brings together everything you need: contacts, events, volunteer rotas, email newsletters, forms, and more.\n\nWhat you can do:\n- Manage Contacts: Keep your directory organised\n- Organise Events: Create events with signup links\n- Coordinate Rotas: Assign volunteers with reminders\n- Send Emails: Beautiful newsletters with personalisation\n\nLog in now: {{login_url}}\n\nNeed help? Visit {{support_url}} or email {{support_email}}`
	},

	// 2. Contacts
	{
		name: 'Getting Started with Contacts',
		internal_notes: 'Day 1: Teaches users how to add, import, and organise contacts.',
		subject: 'Your community directory starts here, {{first_name}}',
		preview_text: "Import your contacts in minutes — here's how.",
		tags: ['onboarding', 'contacts'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">The foundation of TheHUB is your <strong>contacts</strong> — everyone in your community, all in one place. Let's get them set up.</p>

			${heading('Import your existing contacts')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Already have a spreadsheet? Perfect. TheHUB can import contacts from CSV or Excel in just a few clicks:</p>
			${stepsList([
				'Go to <strong>Contacts → Import</strong>',
				'Upload your CSV or Excel file',
				'Map your columns (name, email, phone, etc.) to TheHUB fields',
				'Preview the data and click <strong>Import</strong>'
			])}
			${tip("Don't worry about getting it perfect — you can always edit contacts individually afterwards.")}

			${heading('Add contacts manually')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Need to add people one at a time? Click <strong>Contacts → New Contact</strong> and fill in their details. You can capture:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;">Name, email, phone</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Full address</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Membership status (member, regular attender, visitor)</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Notes and spouse linking</li>
			</ul>

			${heading('Organise with Lists')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Lists let you group contacts for targeted emails and event invitations. Create lists like:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Welcome Team</strong> — for rota invitations</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Youth Group</strong> — for targeted event emails</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Newsletter Subscribers</strong> — for weekly updates</li>
			</ul>

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Contacts', '{{link:contacts_page}}', '#EB9486')}
				<span style="display:inline-block;width:12px;"></span>
				${btn('Import Contacts', '{{link:import_contacts}}', '#7E7F9A')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nThe foundation of TheHUB is your contacts. Let's get them set up.\n\nImport your existing contacts:\n1. Go to Contacts → Import\n2. Upload your CSV or Excel file\n3. Map your columns to TheHUB fields\n4. Preview and click Import\n\nAdd contacts manually:\nClick Contacts → New Contact and fill in their details.\n\nOrganise with Lists:\nCreate lists like Welcome Team, Youth Group, Newsletter Subscribers.\n\nGo to Contacts: {{link:contacts_page}}\n\nNeed help? {{support_url}}`
	},

	// 3. Events
	{
		name: 'Creating Your First Event',
		internal_notes: 'Day 3: Shows how to set up events, occurrences, and public signups.',
		subject: 'Set up your first event in minutes',
		preview_text: 'Events with dates, signups, and a calendar — all built in.',
		tags: ['onboarding', 'events'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Time to bring your calendar to life! TheHUB's <strong>Events</strong> system lets you create everything from weekly meetings to one-off gatherings — complete with dates, signups, and beautiful calendar views.</p>

			${heading('Create an event')}
			${stepsList([
				'Go to <strong>Events → New Event</strong>',
				'Add a title, location, and description',
				'Choose visibility: <strong>Public</strong> (anyone can see), <strong>Internal</strong> (contacts only), or <strong>Private</strong>',
				'Pick a colour so it stands out in the calendar'
			])}

			${heading('Add dates (occurrences)')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Each event can have <strong>multiple dates</strong>. This is perfect for:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;">Weekly meetings (e.g. every Tuesday at 7pm)</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">A training series (Wednesdays in March)</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">One-off special events</li>
			</ul>
			<p style="font-size:14px;color:#272838;line-height:1.7;">Each occurrence can have its own location, capacity, and signups.</p>

			${heading('Enable public signups')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Want people to register? TheHUB creates a <strong>public signup link</strong> for each event. Share it on social media, your website, or in emails — anyone can sign up without needing an account.</p>
			${tip("You can set a maximum capacity per occurrence. When it's full, signups close automatically.")}

			${heading('Calendar views')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">View all your events in <strong>Year</strong>, <strong>Month</strong>, <strong>Week</strong>, or <strong>Agenda</strong> mode. Click any empty date to quickly create a new event.</p>

			{{block:feature_events}}

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Events', '{{link:events_page}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nTime to bring your calendar to life! Here's how to set up events.\n\nCreate an event:\n1. Go to Events → New Event\n2. Add title, location, description\n3. Choose visibility (Public/Internal/Private)\n4. Pick a colour\n\nAdd dates: Each event can have multiple dates — perfect for weekly meetings or workshops.\n\nEnable signups: Share a public link — anyone can sign up without an account.\n\nCalendar views: Year, Month, Week, or Agenda.\n\nGo to Events: {{link:events_page}}\n\nNeed help? {{support_url}}`
	},

	// 4. Rotas
	{
		name: 'Managing Volunteer Rotas',
		internal_notes: 'Day 5: Deep dive into the rota system — creation, assignment, invitations.',
		subject: 'Volunteer rotas made simple, {{first_name}}',
		preview_text: 'Assign volunteers, send invitations, and automate reminders.',
		tags: ['onboarding', 'rotas'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Coordinating volunteers can be a headache — but it doesn't have to be. TheHUB's <strong>rota system</strong> takes the pain out of scheduling, inviting, and reminding your team.</p>

			${heading('Create volunteer roles')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Rotas are linked to events. For each event, you can create roles like:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Welcome Team</strong> — 2 people per week</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Session Lead</strong> — 1 person per week</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>AV / Tech</strong> — 2 people per week</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Refreshments</strong> — 3 people per week</li>
			</ul>
			<p style="font-size:14px;color:#272838;line-height:1.7;">Set the capacity for each role — TheHUB tracks who's signed up vs. how many you need.</p>

			${heading('Assign volunteers')}
			${stepsList([
				'Open a rota and click <strong>Assign</strong>',
				'Search for contacts or pick from a list',
				'Choose specific dates or assign to all occurrences',
				'TheHUB checks for <strong>conflicts</strong> (other rotas on the same date) automatically'
			])}

			${heading('Send invitations')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Don't want to assign manually? Send <strong>bulk invitations</strong> to a contact list and let people choose their own dates.</p>
			${stepsList([
				'Go to <strong>Rotas → Invite</strong>',
				'Select a contact list (e.g. "Welcome Team volunteers")',
				'Add a personal message (optional)',
				'Click <strong>Send Invitations</strong> — each person gets a unique signup link'
			])}

			${heading('Automatic reminders')}
			{{block:how_reminders_work}}

			{{block:feature_rotas}}

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Rotas', '{{link:rotas_page}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nCoordinating volunteers doesn't have to be a headache. Here's how rotas work.\n\nCreate roles: Welcome Team, Session Lead, AV Tech, etc. Set capacity for each.\n\nAssign volunteers:\n1. Open a rota and click Assign\n2. Search for contacts or pick from a list\n3. Choose specific dates\n4. TheHUB checks for conflicts\n\nSend invitations: Send bulk invitations to a contact list — people choose their own dates.\n\nAutomatic reminders: Volunteers get email reminders before their assigned dates.\n\nGo to Rotas: {{link:rotas_page}}\n\nNeed help? {{support_url}}`
	},

	// 5. Emails
	{
		name: 'Sending Your First Email',
		internal_notes: 'Day 7: How to create, personalise, and send email newsletters.',
		subject: 'Keep your community connected with emails',
		preview_text: 'Send beautiful personalised newsletters in minutes.',
		tags: ['onboarding', 'emails'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Staying in touch with your community is essential — and TheHUB makes it <strong>effortless</strong>. Create beautiful emails, personalise them for each recipient, and send to exactly the right people.</p>

			${heading('Create an email')}
			${stepsList([
				'Go to <strong>Emails → New Email</strong>',
				'Write your subject line',
				'Use the <strong>visual editor</strong> to compose your message — add text, images, and formatting',
				'Personalise with variables like <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px;">{{first_name}}</code>'
			])}

			${heading('Personalisation that works')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">TheHUB automatically replaces placeholders with real data for each recipient:</p>
			<div style="background:#f8f8fa;border-radius:10px;padding:18px;margin:12px 0;">
				<p style="margin:0;font-size:14px;color:#272838;"><strong>You write:</strong> "Hi {{first_name}}, here's what's coming up..."</p>
				<p style="margin:8px 0 0 0;font-size:14px;color:#7E7F9A;"><strong>They see:</strong> "Hi Sarah, here's what's coming up..."</p>
			</div>
			<p style="font-size:14px;color:#272838;line-height:1.7;">You can also include <strong>upcoming events</strong> and <strong>rota assignments</strong> automatically — each person sees their own schedule.</p>

			${heading('Send to the right people')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Choose who receives your email:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>All contacts</strong> — everyone in your directory</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>A specific list</strong> — e.g. "Newsletter subscribers" or "Youth group"</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Individual contacts</strong> — hand-pick recipients</li>
			</ul>
			${tip("Save your email as a template so you can reuse the layout next time. Go to Emails → Templates to manage them.")}

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Emails', '{{link:emails_page}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nStaying in touch with your community is essential. Here's how to send emails.\n\nCreate an email:\n1. Go to Emails → New Email\n2. Write your subject line\n3. Use the visual editor to compose your message\n4. Personalise with variables like {{first_name}}\n\nPersonalisation: TheHUB replaces placeholders with real data for each recipient.\n\nSend to the right people: All contacts, a specific list, or hand-picked individuals.\n\nTip: Save your email as a template to reuse next time.\n\nGo to Emails: {{link:emails_page}}\n\nNeed help? {{support_url}}`
	},

	// 6. Forms
	{
		name: 'Using Forms & Public Signups',
		internal_notes: 'Day 10: How to create forms, public signups, and member registration.',
		subject: 'Collect information easily with forms',
		preview_text: 'Build custom forms and let people sign up online.',
		tags: ['onboarding', 'forms'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">Need to collect information from your community? TheHUB has you covered with <strong>custom forms</strong> and <strong>public signup pages</strong>.</p>

			${heading('Custom forms')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Build any form you need — registration forms, feedback surveys, volunteer applications, or anything else.</p>
			${stepsList([
				'Go to <strong>Forms → New Form</strong>',
				'Add a name and description',
				'Add fields: text, email, phone, date, number, textarea, dropdown, checkboxes, or radio buttons',
				'Set fields as required or optional',
				'Share the <strong>public link</strong> — no login needed to fill it in'
			])}
			${tip('Enable the "Safeguarding" flag for sensitive forms — data is encrypted for extra protection.')}

			${heading('Public signup pages')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">TheHUB also includes ready-made signup pages:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Member Signup</strong> — a public form for new members to register</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Event Signup</strong> — shareable links for event registration</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Rota Signup</strong> — unique links for volunteer sign-ups</li>
			</ul>
			<p style="font-size:14px;color:#272838;line-height:1.7;">All submissions appear in TheHUB for you to review and manage.</p>

			<div style="text-align:center;margin:28px 0;">
				${btn('Go to Forms', '{{link:forms_page}}')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nNeed to collect information? TheHUB has custom forms and public signup pages.\n\nCustom forms:\n1. Go to Forms → New Form\n2. Add fields: text, email, phone, date, dropdown, etc.\n3. Share the public link — no login needed\n\nPublic signup pages:\n- Member Signup — for new members\n- Event Signup — shareable event registration\n- Rota Signup — unique volunteer sign-up links\n\nGo to Forms: {{link:forms_page}}\n\nNeed help? {{support_url}}`
	},

	// 7. Meeting Planners & Advanced
	{
		name: 'Meeting Planners & Advanced Features',
		internal_notes: 'Day 14: Meeting planners, settings, customisation, theme options.',
		subject: 'Plan meetings and customise TheHUB your way',
		preview_text: 'Meeting planners, themes, and advanced settings.',
		tags: ['onboarding', 'meeting-planners', 'settings'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">You've been using TheHUB for two weeks now — let's unlock some <strong>powerful features</strong> you might not have discovered yet.</p>

			${heading('Meeting Planners')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">If you run regular meetings, <strong>Meeting Planners</strong> are your best friend. They bring together everything for a session in one view:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;">Presenter name and topic (with series tracking)</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Session lead</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">All volunteer rotas for that date</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;">Notes and agenda tracking</li>
			</ul>
			<p style="font-size:14px;color:#272838;line-height:1.7;">You can even <strong>export the next 4 planners as a PDF</strong> to print and share with your team.</p>

			${heading('Make it yours: Themes & Branding')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Head to <strong>Settings</strong> to customise TheHUB's appearance:</p>
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Logo</strong> — appears in the navbar and login page</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Colours</strong> — primary, brand, navbar, buttons, panel headers</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Calendar event colours</strong> — colour-code different event types</li>
			</ul>
			${tip("Your logo also appears in the emails you send — giving every communication a professional, branded feel.")}

			${heading('Advanced settings worth knowing')}
			<ul style="padding-left:18px;margin:12px 0;">
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Rota reminder timing</strong> — change from 3 days to whatever works for you</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Meeting planner rotas</strong> — configure which roles appear by default</li>
				<li style="margin:6px 0;font-size:14px;color:#272838;"><strong>Hub domain</strong> — set up a custom domain like hub.yourorg.org</li>
			</ul>

			<div style="text-align:center;margin:28px 0;">
				${btn('Meeting Planners', '{{link:meeting_planners}}', '#EB9486')}
				<span style="display:inline-block;width:12px;"></span>
				${btn('Settings', '{{link:settings_page}}', '#7E7F9A')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nLet's unlock some powerful features you might not have discovered yet.\n\nMeeting Planners: Bring together presenters, session leads, rotas, and notes in one view. Export as PDF.\n\nThemes & Branding: Customise logo, colours, and calendar event colours in Settings.\n\nAdvanced settings:\n- Rota reminder timing\n- Meeting planner default rotas\n- Custom hub domain\n\nMeeting Planners: {{link:meeting_planners}}\nSettings: {{link:settings_page}}\n\nNeed help? {{support_url}}`
	},

	// 8. Tips for Success
	{
		name: 'Tips for Success with TheHUB',
		internal_notes: 'Day 21: Best practices, pro tips, and encouragement to keep going.',
		subject: 'Pro tips to get the most out of TheHUB',
		preview_text: 'Quick wins and best practices from the TheHUB team.',
		tags: ['onboarding', 'tips', 'non-essential'],
		body_html: `
			<p style="font-size:16px;color:#272838;line-height:1.7;">Hi {{first_name}},</p>
			<p style="font-size:15px;color:#272838;line-height:1.7;">You've been using TheHUB for three weeks now — amazing! Here are some <strong>pro tips</strong> to help you and {{org_name}} get even more out of the platform.</p>

			{{block:pro_tips}}

			${heading('Quick wins you might have missed')}

			${subheading('1. Rota help files')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Attach a PDF or link to any rota role explaining what volunteers need to do. New volunteers will thank you!</p>

			${subheading('2. Week notes in emails')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Add a "week note" to your events — it automatically appears in your next newsletter email. Great for announcements.</p>

			${subheading('3. Spouse linking')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Link spouse contacts together — when you view one person, you can quickly see and navigate to their partner.</p>

			${subheading('4. Event-to-email workflow')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Created an event? Click <strong>"Create email from event"</strong> to automatically populate a newsletter with the event details.</p>

			${subheading('5. PDF exports')}
			<p style="font-size:14px;color:#272838;line-height:1.7;">Export rotas and meeting planners as PDF — perfect for printing and putting on notice boards.</p>

			${divider}

			<div style="background:linear-gradient(135deg,#EB9486 0%,#c75a4a 100%);border-radius:12px;padding:28px;margin:20px 0;text-align:center;">
				<p style="font-size:18px;font-weight:700;color:#ffffff;margin:0 0 8px 0;">You're doing great!</p>
				<p style="font-size:14px;color:rgba(255,255,255,0.9);margin:0 0 16px 0;">Keep exploring TheHUB — there's always more to discover.</p>
				${btn('Log in to TheHUB', '{{login_url}}', '#ffffff').replace('color:#ffffff', 'color:#EB9486')}
			</div>

			${divider}
			{{block:need_help}}
		`,
		body_text: `Hi {{first_name}},\n\nYou've been using TheHUB for three weeks — amazing! Here are some pro tips.\n\nPro Tips:\n- Use contact lists for targeted emails\n- Set up rota help files for volunteers\n- Enable public event signups\n- Use Meeting Planners for session planning\n- Customise your theme and logo\n\nQuick wins:\n1. Rota help files — attach PDFs explaining what volunteers need to do\n2. Week notes — add announcements that appear in newsletters\n3. Spouse linking — link partners together\n4. Event-to-email — create emails from events automatically\n5. PDF exports — print rotas and meeting planners\n\nKeep exploring! Log in: {{login_url}}\n\nNeed help? {{support_url}}`
	}
];

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const adminId = 'seed-script';
	const counts = { blocks: 0, links: 0, templates: 0, versions: 0, sequences: 0, steps: 0 };

	console.log('Seeding marketing content…\n');

	// ── Content blocks ──
	console.log('Creating content blocks…');
	const existingBlocks = await readCollection('marketing_content_blocks');
	const existingBlockKeys = new Set(existingBlocks.map(b => b.key));

	for (const block of contentBlocks) {
		if (existingBlockKeys.has(block.key)) {
			console.log(`  ⏭  Block "${block.key}" already exists`);
			continue;
		}
		await createRecord('marketing_content_blocks', {
			id: uid(), title: block.title, key: block.key,
			body_html: block.body_html, body_text: block.body_text,
			tags: block.tags, status: 'active',
			created_at: now(), updated_at: now(), created_by: adminId
		});
		counts.blocks++;
		console.log(`  ✅ Block "${block.key}"`);
	}

	// ── Links ──
	console.log('\nCreating links…');
	const existingLinks = await readCollection('marketing_links');
	const existingLinkKeys = new Set(existingLinks.map(l => l.key));

	for (const link of links) {
		if (existingLinkKeys.has(link.key)) {
			console.log(`  ⏭  Link "${link.key}" already exists`);
			continue;
		}
		await createRecord('marketing_links', {
			id: uid(), key: link.key, name: link.name, url: link.url,
			scope: 'global', organisationId: null, status: 'active',
			created_at: now(), updated_at: now(), created_by: adminId
		});
		counts.links++;
		console.log(`  ✅ Link "${link.key}"`);
	}

	// ── Email templates ──
	console.log('\nCreating email templates…');
	const existingTemplates = await readCollection('marketing_email_templates');
	const existingTemplateNames = new Set(existingTemplates.map(t => t.name));
	const templateIds = {};

	for (const tmpl of emailTemplates) {
		if (existingTemplateNames.has(tmpl.name)) {
			const existing = existingTemplates.find(t => t.name === tmpl.name);
			if (existing) templateIds[tmpl.name] = existing.id;
			console.log(`  ⏭  Template "${tmpl.name}" already exists`);
			continue;
		}
		const tid = uid();
		templateIds[tmpl.name] = tid;
		await createRecord('marketing_email_templates', {
			id: tid, name: tmpl.name, internal_notes: tmpl.internal_notes,
			subject: tmpl.subject, preview_text: tmpl.preview_text,
			body_html: tmpl.body_html, body_text: tmpl.body_text,
			placeholders: [], status: 'active', tags: tmpl.tags,
			created_at: now(), updated_at: now(), created_by: adminId
		});
		counts.templates++;
		console.log(`  ✅ Template "${tmpl.name}"`);

		// Version snapshot
		await createRecord('marketing_template_versions', {
			id: uid(), template_id: tid,
			snapshot: { name: tmpl.name, subject: tmpl.subject, preview_text: tmpl.preview_text, body_html: tmpl.body_html, body_text: tmpl.body_text, tags: tmpl.tags },
			updated_at: now(), updated_by: adminId, change_summary: 'Initial creation (seeded)'
		});
		counts.versions++;
	}

	// ── Sequence ──
	console.log('\nCreating sequence…');
	const existingSequences = await readCollection('marketing_sequences');
	const seqName = 'Default Onboarding';

	if (existingSequences.some(s => s.name === seqName)) {
		console.log(`  ⏭  Sequence "${seqName}" already exists`);
	} else {
		const seqId = uid();
		await createRecord('marketing_sequences', {
			id: seqId, name: seqName,
			description: 'A comprehensive 21-day onboarding sequence that introduces new users to every feature of TheHUB — from contacts and events to rotas, emails, forms, and advanced features.',
			status: 'active', applies_to: 'default',
			organisation_id: null, org_group: null,
			created_at: now(), updated_at: now(), created_by: adminId
		});
		counts.sequences++;
		console.log(`  ✅ Sequence "${seqName}"`);

		// Steps
		const steps = [
			{ name: 'Welcome to TheHUB', delay: 0, unit: 'minutes' },
			{ name: 'Getting Started with Contacts', delay: 1, unit: 'days' },
			{ name: 'Creating Your First Event', delay: 3, unit: 'days' },
			{ name: 'Managing Volunteer Rotas', delay: 5, unit: 'days' },
			{ name: 'Sending Your First Email', delay: 7, unit: 'days' },
			{ name: 'Using Forms & Public Signups', delay: 10, unit: 'days' },
			{ name: 'Meeting Planners & Advanced Features', delay: 14, unit: 'days' },
			{ name: 'Tips for Success with TheHUB', delay: 21, unit: 'days' }
		];

		console.log('\nCreating sequence steps…');
		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];
			const templateId = templateIds[step.name];
			if (!templateId) {
				console.log(`  ⚠️  No template found for step "${step.name}"`);
				continue;
			}
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
	console.log(`Done! Created:`);
	console.log(`  📦 ${counts.blocks} content blocks`);
	console.log(`  🔗 ${counts.links} links`);
	console.log(`  ✉️  ${counts.templates} email templates (${counts.versions} versions)`);
	console.log(`  🔄 ${counts.sequences} sequence(s) with ${counts.steps} steps`);
	console.log('──────────────────────────────────────────\n');

	await pool.end();
}

main().catch(err => {
	console.error('Error:', err);
	process.exit(1);
});
