/**
 * Church Bolt-On: form templates for parishes and churches.
 * Used when creating a new form from template in the Hub (org must have churchBoltOn).
 */

export const CHURCH_FORM_TEMPLATES = [
	{
		id: 'volunteer-registration',
		name: 'Volunteer Registration',
		description: 'Collect volunteer details and areas of interest for ministry teams.',
		fields: [
			{ type: 'text', label: 'First Name', name: 'firstName', required: true, placeholder: 'John' },
			{ type: 'text', label: 'Last Name', name: 'lastName', required: true, placeholder: 'Smith' },
			{ type: 'email', label: 'Email', name: 'email', required: true, placeholder: 'john@example.org' },
			{ type: 'tel', label: 'Phone', name: 'phone', required: false },
			{ type: 'select', label: 'Area of interest', name: 'areaOfInterest', required: false, options: ['Worship', 'Children & Youth', 'Welcome', 'Pastoral', 'Practical (setup/teardown)', 'Other'] },
			{ type: 'textarea', label: 'Notes or experience', name: 'notes', required: false, placeholder: 'Any relevant experience or availability...' }
		]
	},
	{
		id: 'prayer-request',
		name: 'Prayer Request',
		description: 'Allow people to submit prayer requests. Submissions can be linked to contacts.',
		fields: [
			{ type: 'text', label: 'Name (optional)', name: 'name', required: false, placeholder: 'Can be anonymous' },
			{ type: 'email', label: 'Email (optional)', name: 'email', required: false },
			{ type: 'textarea', label: 'Prayer request', name: 'request', required: true, placeholder: 'How can we pray for you?' },
			{ type: 'radio', label: 'Share with prayer team?', name: 'shareWithTeam', required: false, options: ['Yes', 'No'] }
		]
	},
	{
		id: 'event-feedback',
		name: 'Event Feedback',
		description: 'Gather feedback after a service or event.',
		fields: [
			{ type: 'text', label: 'Event name', name: 'eventName', required: false, placeholder: 'e.g. Sunday Service 12 Jan' },
			{ type: 'radio', label: 'How was your experience?', name: 'rating', required: false, options: ['Excellent', 'Good', 'Okay', 'Could improve'] },
			{ type: 'textarea', label: 'Comments or suggestions', name: 'comments', required: false }
		]
	}
];

/**
 * Get a church form template by id.
 * @param {string} id
 * @returns {{ id: string, name: string, description: string, fields: object[] } | null}
 */
export function getChurchFormTemplateById(id) {
	return CHURCH_FORM_TEMPLATES.find((t) => t.id === id) ?? null;
}
