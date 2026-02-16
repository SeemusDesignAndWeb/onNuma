import { hasRouteAccess } from '$lib/crm/permissions.js';

/**
 * Step definitions in display order.
 * Each: id, title, description, href, route (for permission check), helpHref, helpContent (HTML string for step help page).
 */
export const ONBOARDING_STEP_DEFS = [
	{
		id: 'settings',
		title: 'Settings',
		description: 'Set your organisation name, logo, colours and Privacy policy contact (Settings → Privacy).',
		href: '/hub/settings',
		route: '/hub/users',
		helpHref: '/hub/help/step/settings',
		helpContent: `
			<p>Settings is where you configure your organisation’s identity and how TheHUB looks and behaves.</p>
			<h3>Organisation name & logo</h3>
			<p>Set your organisation name and upload a logo so it appears in the sidebar and on emails.</p>
			<h3>Theme & colours</h3>
			<p>Choose primary and button colours so the hub matches your branding.</p>
			<h3>Privacy policy contact</h3>
			<p>Under <strong>Settings → Privacy</strong> you can set the contact name, email and phone shown to users for data protection enquiries. This is required for GDPR-style transparency.</p>
			<p><a href="/hub/settings">Go to Settings</a></p>
		`
	},
	{
		id: 'contacts',
		title: 'Contacts',
		description: 'Add and manage your contacts.',
		href: '/hub/contacts',
		route: '/hub/contacts',
		helpHref: '/hub/help/step/contacts',
		helpContent: `
			<p>Contacts are the people in your organisation. Everything else—lists, emails, rotas, events—builds on your contact list.</p>
			<h3>Adding contacts</h3>
			<p>Use <strong>New Contact</strong> to add people one by one. You can also <strong>Import</strong> from a CSV or Excel file and map columns to TheHUB fields.</p>
			<h3>Editing & deleting</h3>
			<p>Open a contact to edit details or remove them. Deleting a contact cannot be undone.</p>
			<h3>Organising</h3>
			<p>Use <strong>Lists</strong> to group contacts (e.g. Welcome Team, Newsletter subscribers). Lists are used when sending emails and managing rotas.</p>
			<p><a href="/hub/contacts">Go to Contacts</a></p>
		`
	},
	{
		id: 'lists',
		title: 'Lists',
		description: 'Create lists to group contacts for emails and events.',
		href: '/hub/lists',
		route: '/hub/lists',
		helpHref: '/hub/help/step/lists',
		helpContent: `
			<p>Lists let you group contacts so you can send targeted emails and manage rotas by team or role.</p>
			<h3>Creating a list</h3>
			<p>Go to <strong>Lists → New List</strong>, give it a name, then add contacts by searching or selecting from your contact list.</p>
			<h3>Using lists</h3>
			<p>When creating an email you can choose “Send to a list”. Rotas and events can also use lists to invite or assign people.</p>
			<h3>Keeping lists up to date</h3>
			<p>Add or remove contacts from a list anytime by opening the list and editing its members.</p>
			<p><a href="/hub/lists">Go to Lists</a></p>
		`
	},
	{
		id: 'events',
		title: 'Events',
		description: 'Create events and manage dates on the calendar.',
		href: '/hub/events/calendar',
		route: '/hub/events',
		helpHref: '/hub/help/step/events',
		helpContent: `
			<p>Events are things that happen on specific dates—services, meetings, courses. Each event can have multiple dates (occurrences).</p>
			<h3>Creating an event</h3>
			<p>Go to <strong>Events → New Event</strong>. Add a title, location, description and choose visibility (Public, Internal or Private). You can set a colour for the calendar.</p>
			<h3>Adding dates</h3>
			<p>Open an event and add occurrences (e.g. every Sunday, or a one-off date). This is useful for weekly meetings or multi-date courses.</p>
			<h3>Public signup</h3>
			<p>You can enable a public signup link so people can register for an event without logging in.</p>
			<p><a href="/hub/events/calendar">Go to Events</a></p>
		`
	},
	{
		id: 'rotas',
		title: 'Rotas',
		description: 'Assign rotas to events and invite volunteers.',
		href: '/hub/rotas',
		route: '/hub/rotas',
		helpHref: '/hub/help/step/rotas',
		helpContent: `
			<p>Rotas let you assign volunteers to roles (e.g. Welcome Team, Session Lead) for specific dates.</p>
			<h3>Creating a rota</h3>
			<p>Create a rota, add roles (each with a name and optional capacity), then link it to an event or use it standalone.</p>
			<h3>Assigning people</h3>
			<p>Open a rota and use <strong>Assign</strong> to add contacts to roles for chosen dates. You can also send <strong>bulk invitations</strong> so people can pick their own dates.</p>
			<h3>Help files</h3>
			<p>Attach PDFs or links to each rota so volunteers know what to do. These appear when they view their assignments.</p>
			<p><a href="/hub/rotas">Go to Rotas</a></p>
		`
	},
	{
		id: 'emails',
		title: 'Emails',
		description: 'Send newsletters and one-off emails to contacts and lists.',
		href: '/hub/emails',
		route: '/hub/emails',
		helpHref: '/hub/help/step/emails',
		helpContent: `
			<p>Send newsletters and one-off emails to all contacts or to specific lists. You can personalise content with placeholders like {{first_name}}.</p>
			<h3>Creating an email</h3>
			<p>Go to <strong>Emails → New Email</strong>. Add a subject and use the editor to write the body. Use variables such as <code>{{first_name}}</code> and <code>{{org_name}}</code> for personalisation.</p>
			<h3>Choosing recipients</h3>
			<p>Send to all contacts, to one or more lists, or to a custom selection. Preview before sending.</p>
			<h3>Templates</h3>
			<p>Save an email as a template to reuse for regular newsletters or similar mailouts.</p>
			<p><a href="/hub/emails">Go to Emails</a></p>
		`
	},
	{
		id: 'forms',
		title: 'Forms',
		description: 'Create forms and collect submissions.',
		href: '/hub/forms',
		route: '/hub/forms',
		helpHref: '/hub/help/step/forms',
		helpContent: `
			<p>Forms let you collect information from people via a shareable link. Submissions are stored in TheHUB and can be linked to contacts.</p>
			<h3>Creating a form</h3>
			<p>Go to <strong>Forms → New Form</strong>. Add fields (text, email, phone, date, dropdown, etc.) and set which are required. Share the public link—no login needed for respondents.</p>
			<h3>Viewing submissions</h3>
			<p>Open a form to see all submissions. You can export or use the data to create or update contacts.</p>
			<h3>Public signup pages</h3>
			<p>TheHUB also provides built-in signup pages for members, events and rotas. These are separate from custom forms but work in a similar way.</p>
			<p><a href="/hub/forms">Go to Forms</a></p>
		`
	}
];

/**
 * Returns onboarding steps the user is allowed to see.
 * @param {object} admin
 * @param {string|null} superAdminEmail
 * @param {object|null} organisationAreaPermissions
 * @returns {{ id: string, title: string, description: string, href: string, route: string, helpHref?: string, helpContent?: string }[]}
 */
export function getOnboardingSteps(admin, superAdminEmail = null, organisationAreaPermissions = null) {
	if (!admin) return [];
	return ONBOARDING_STEP_DEFS.filter((step) =>
		hasRouteAccess(admin, step.route, superAdminEmail, organisationAreaPermissions)
	);
}

/** Get a single step by id, or null if not found / no access. */
export function getOnboardingStepById(stepId, admin, superAdminEmail = null, organisationAreaPermissions = null) {
	const steps = getOnboardingSteps(admin, superAdminEmail, organisationAreaPermissions);
	return steps.find((s) => s.id === stepId) ?? null;
}

export const ONBOARDING_ROUTE_STORAGE_KEY = 'showOnboardingRoute';
export const ONBOARDING_SEEN_STEPS_KEY = 'onboardingSeenSteps';
