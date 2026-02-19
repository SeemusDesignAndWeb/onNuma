/**
 * Church Bolt-On: email template definitions for parishes and churches.
 * Used when creating a new email template from template in the Hub (org must have churchBoltOn).
 * Placeholders: {{first_name}}, {{org_name}}, etc. (same as newsletter personalisation).
 */

export const CHURCH_EMAIL_TEMPLATES = [
	{
		id: 'service-reminder',
		name: 'Service Reminder',
		description: 'Remind volunteers about an upcoming service. Use with a list or segment.',
		subject: 'Reminder: {{event_title}} – {{date}}',
		htmlContent: `<p>Hi {{first_name}},</p>
<p>This is a quick reminder that you're scheduled for <strong>{{event_title}}</strong> on {{date}}.</p>
<p>If you're no longer able to make it, please let us know as soon as possible so we can find a replacement.</p>
<p>Thank you for serving!</p>
<p>{{org_name}}</p>`,
		textContent: `Hi {{first_name}},\n\nThis is a quick reminder that you're scheduled for {{event_title}} on {{date}}.\n\nIf you're no longer able to make it, please let us know as soon as possible.\n\nThank you for serving!\n\n{{org_name}}`
	},
	{
		id: 'volunteer-thank-you',
		name: 'Volunteer Thank You',
		description: 'Thank volunteers after a service or event.',
		subject: 'Thank you for serving, {{first_name}}!',
		htmlContent: `<p>Hi {{first_name}},</p>
<p>Thank you for serving at <strong>{{event_title}}</strong>. We're grateful for your time and commitment.</p>
<p>Your contribution helps make our services run smoothly and blesses our community.</p>
<p>We look forward to serving with you again soon.</p>
<p>With thanks,<br>{{org_name}}</p>`,
		textContent: `Hi {{first_name}},\n\nThank you for serving at {{event_title}}. We're grateful for your time and commitment.\n\nYour contribution helps make our services run smoothly.\n\nWith thanks,\n{{org_name}}`
	},
	{
		id: 'weekly-notice',
		name: 'Weekly Notice',
		description: 'Weekly update or notice to the congregation (e.g. news, upcoming events).',
		subject: '{{org_name}} – Weekly update',
		htmlContent: `<p>Hi {{first_name}},</p>
<p>Here's your weekly update from {{org_name}}.</p>
<p><strong>This week</strong></p>
<p>{{content}}</p>
<p>If you have any questions, just reply to this email.</p>
<p>Blessings,<br>{{org_name}}</p>`,
		textContent: `Hi {{first_name}},\n\nHere's your weekly update from {{org_name}}.\n\nThis week:\n{{content}}\n\nBlessings,\n{{org_name}}`
	}
];

/**
 * Get a church email template by id.
 * @param {string} id
 * @returns {{ id: string, name: string, description: string, subject: string, htmlContent: string, textContent: string } | null}
 */
export function getChurchEmailTemplateById(id) {
	return CHURCH_EMAIL_TEMPLATES.find((t) => t.id === id) ?? null;
}
