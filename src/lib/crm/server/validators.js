/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
	if (!email || typeof email !== 'string') {
		return false;
	}
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return re.test(email);
}

/**
 * Validate required field
 * @param {any} value - Value to check
 * @param {string} fieldName - Field name for error message
 * @throws {Error} If value is empty
 */
export function requireField(value, fieldName) {
	if (value === null || value === undefined || value === '') {
		throw new Error(`${fieldName} is required`);
	}
}

/**
 * Validate and sanitize string
 * @param {any} value - Value to validate
 * @param {string} fieldName - Field name
 * @param {number} maxLength - Maximum length
 * @returns {string} Sanitized string
 */
export function validateString(value, fieldName, maxLength = 1000) {
	if (value === null || value === undefined) {
		return '';
	}
	const str = String(value).trim();
	if (str.length > maxLength) {
		throw new Error(`${fieldName} must be less than ${maxLength} characters`);
	}
	return str;
}

/**
 * Validate date string (ISO format)
 * @param {string} dateStr - Date string
 * @returns {boolean} True if valid ISO date
 */
export function isValidDate(dateStr) {
	if (!dateStr || typeof dateStr !== 'string') {
		return false;
	}
	const date = new Date(dateStr);
	return !isNaN(date.getTime()) && dateStr === date.toISOString();
}

/**
 * Validate contact data
 * @param {object} data - Contact data
 * @returns {object} Validated contact data
 * @throws {Error} If validation fails
 */
export function validateContact(data) {
	requireField(data.email, 'Email');
	if (!isValidEmail(data.email)) {
		throw new Error('Invalid email address');
	}

	return {
		email: data.email.trim().toLowerCase(),
		firstName: validateString(data.firstName || '', 'First name', 100),
		lastName: validateString(data.lastName || '', 'Last name', 100),
		phone: validateString(data.phone || '', 'Phone', 50),
		// Address fields
		addressLine1: validateString(data.addressLine1 || '', 'Address Line 1', 200),
		addressLine2: validateString(data.addressLine2 || '', 'Address Line 2', 200),
		city: validateString(data.city || '', 'City', 100),
		county: validateString(data.county || '', 'County', 100),
		postcode: validateString(data.postcode || '', 'Postcode', 20),
		country: validateString(data.country || '', 'Country', 100),
		// Church membership fields
		membershipStatus: validateString(data.membershipStatus || '', 'Membership Status', 50),
		// Newsletter subscription (default to true if not explicitly set to false)
		subscribed: data.subscribed !== false && data.subscribed !== 'false',
		dateJoined: data.dateJoined || null,
		notes: validateString(data.notes || '', 'Notes', 5000)
	};
}

/**
 * Validate list data
 * @param {object} data - List data
 * @returns {object} Validated list data
 * @throws {Error} If validation fails
 */
export function validateList(data) {
	requireField(data.name, 'Name');
	return {
		name: validateString(data.name, 'Name', 200),
		description: validateString(data.description || '', 'Description', 2000),
		contactIds: Array.isArray(data.contactIds) ? data.contactIds : (data.contactIds ? [data.contactIds] : [])
	};
}

/**
 * Validate event data
 * @param {object} data - Event data
 * @returns {object} Validated event data
 * @throws {Error} If validation fails
 */
// Predefined event colors
export const EVENT_COLORS = [
	{ value: '#9333ea', label: 'Purple' },
	{ value: '#3b82f6', label: 'Blue' },
	{ value: '#10b981', label: 'Green' },
	{ value: '#ef4444', label: 'Red' },
	{ value: '#f97316', label: 'Orange' },
	{ value: '#eab308', label: 'Yellow' },
	{ value: '#ec4899', label: 'Pink' },
	{ value: '#6366f1', label: 'Indigo' },
	{ value: '#14b8a6', label: 'Teal' },
	{ value: '#f59e0b', label: 'Amber' }
];

export function validateEvent(data) {
	requireField(data.title, 'Title');
	
	// Validate color - must be one of the predefined colors
	const allowedColors = EVENT_COLORS.map(c => c.value);
	const color = allowedColors.includes(data.color) ? data.color : '#9333ea';
	
	return {
		title: validateString(data.title, 'Title', 200),
		description: validateString(data.description || '', 'Description', 10000),
		location: validateString(data.location || '', 'Location', 500),
		visibility: ['public', 'private', 'internal'].includes(data.visibility) ? data.visibility : 'private',
		enableSignup: data.enableSignup === true || data.enableSignup === 'true' || data.enableSignup === 'on',
		hideFromEmail: data.hideFromEmail === true || data.hideFromEmail === 'true' || data.hideFromEmail === 'on',
		maxSpaces: typeof data.maxSpaces === 'number' && data.maxSpaces > 0 ? data.maxSpaces : (data.maxSpaces ? parseInt(data.maxSpaces) || null : null),
		color: color, // Default to purple if not provided or invalid
		// Recurrence fields
		repeatType: ['none', 'daily', 'weekly', 'monthly', 'yearly'].includes(data.repeatType) ? data.repeatType : 'none',
		repeatInterval: typeof data.repeatInterval === 'number' && data.repeatInterval > 0 ? data.repeatInterval : (data.repeatInterval ? parseInt(data.repeatInterval) || 1 : 1),
		repeatEndType: ['never', 'date', 'count'].includes(data.repeatEndType) ? data.repeatEndType : 'never',
		repeatEndDate: data.repeatEndDate || null,
		repeatCount: typeof data.repeatCount === 'number' && data.repeatCount > 0 ? data.repeatCount : (data.repeatCount ? parseInt(data.repeatCount) || null : null),
		repeatDayOfMonth: typeof data.repeatDayOfMonth === 'number' && data.repeatDayOfMonth >= 1 && data.repeatDayOfMonth <= 31 ? data.repeatDayOfMonth : (data.repeatDayOfMonth ? parseInt(data.repeatDayOfMonth) || null : null),
		repeatDayOfWeek: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(data.repeatDayOfWeek?.toLowerCase()) ? data.repeatDayOfWeek.toLowerCase() : null,
		repeatWeekOfMonth: ['first', 'second', 'third', 'fourth', 'last'].includes(data.repeatWeekOfMonth?.toLowerCase()) ? data.repeatWeekOfMonth.toLowerCase() : null,
		meta: data.meta || {}
	};
}

/**
 * Validate occurrence data
 * @param {object} data - Occurrence data
 * @returns {object} Validated occurrence data
 * @throws {Error} If validation fails
 */
export function validateOccurrence(data) {
	requireField(data.eventId, 'Event ID');
	requireField(data.startsAt, 'Start date');
	requireField(data.endsAt, 'End date');

	if (!isValidDate(data.startsAt)) {
		throw new Error('Invalid start date format');
	}
	if (!isValidDate(data.endsAt)) {
		throw new Error('Invalid end date format');
	}

	const start = new Date(data.startsAt);
	const end = new Date(data.endsAt);

	if (end <= start) {
		throw new Error('End date must be after start date');
	}

	return {
		eventId: validateString(data.eventId, 'Event ID', 50),
		startsAt: data.startsAt,
		endsAt: data.endsAt,
		location: validateString(data.location || '', 'Location', 500),
		maxSpaces: typeof data.maxSpaces === 'number' && data.maxSpaces > 0 ? data.maxSpaces : (data.maxSpaces ? parseInt(data.maxSpaces) || null : null),
		information: validateString(data.information || '', 'Information', 5000),
		allDay: data.allDay === true || data.allDay === 'true'
	};
}

/**
 * Validate rota data
 * @param {object} data - Rota data
 * @returns {object} Validated rota data
 * @throws {Error} If validation fails
 */
export function validateRota(data) {
	requireField(data.eventId, 'Event ID');
	requireField(data.role, 'Role');

	// Validate assignees structure - should be array of { contactId/contact, occurrenceId }
	const assignees = Array.isArray(data.assignees) ? data.assignees : [];
	const validatedAssignees = assignees.map(assignee => {
		// Support both old format (backward compatibility) and new format
		if (typeof assignee === 'string') {
			// Old format: just contact ID, assume occurrenceId from rota
			return {
				contactId: assignee,
				occurrenceId: data.occurrenceId || null
			};
		}
		if (typeof assignee === 'object') {
			// New format: { contactId or {name, email}, occurrenceId }
			return {
				contactId: assignee.contactId || assignee.id || (assignee.name && assignee.email ? { name: assignee.name, email: assignee.email } : null),
				occurrenceId: assignee.occurrenceId || data.occurrenceId || null
			};
		}
		return null;
	}).filter(a => a !== null);

	// Validate visibility - must be 'public' or 'internal', default to 'public' for backward compatibility
	const visibility = data.visibility === 'internal' ? 'internal' : 'public';

	return {
		eventId: validateString(data.eventId, 'Event ID', 50),
		occurrenceId: data.occurrenceId ? validateString(data.occurrenceId, 'Occurrence ID', 50) : null,
		role: validateString(data.role, 'Role', 100),
		capacity: typeof data.capacity === 'number' && data.capacity > 0 ? data.capacity : 1,
		assignees: validatedAssignees,
		notes: validateString(data.notes || '', 'Notes', 10000),
		ownerId: data.ownerId ? validateString(data.ownerId, 'Owner ID', 50) : null,
		visibility: visibility
	};
}

/**
 * Validate form data
 * @param {object} data - Form data
 * @returns {object} Validated form data
 * @throws {Error} If validation fails
 */
export function validateForm(data) {
	requireField(data.name, 'Name');
	requireField(data.fields, 'Fields');
	
	if (!Array.isArray(data.fields) || data.fields.length === 0) {
		throw new Error('Form must have at least one field');
	}

	// Validate each field
	for (const field of data.fields) {
		if (!field.type || !field.label) {
			throw new Error('Each field must have a type and label');
		}
		const validTypes = ['text', 'email', 'tel', 'date', 'number', 'textarea', 'select', 'checkbox', 'radio'];
		if (!validTypes.includes(field.type)) {
			throw new Error(`Invalid field type: ${field.type}`);
		}
	}

	return {
		name: validateString(data.name, 'Name', 200),
		description: validateString(data.description || '', 'Description', 2000),
		fields: data.fields,
		isSafeguarding: data.isSafeguarding === true,
		requiresEncryption: data.isSafeguarding === true,
		meta: data.meta || {}
	};
}

/**
 * Validate newsletter data
 * @param {object} data - Newsletter data
 * @returns {object} Validated newsletter data
 * @throws {Error} If validation fails
 */
export function validateNewsletter(data) {
	requireField(data.subject, 'Subject');
	return {
		subject: validateString(data.subject, 'Subject', 500),
		htmlContent: validateString(data.htmlContent || '', 'HTML Content', 50000),
		textContent: validateString(data.textContent || '', 'Text Content', 50000),
		status: ['draft', 'sent'].includes(data.status) ? data.status : 'draft'
	};
}

/**
 * Validate newsletter template data
 * @param {object} data - Template data
 * @returns {object} Validated template data
 * @throws {Error} If validation fails
 */
export function validateNewsletterTemplate(data) {
	requireField(data.name, 'Template name');
	return {
		name: validateString(data.name, 'Template name', 200),
		subject: validateString(data.subject || '', 'Subject', 500),
		htmlContent: validateString(data.htmlContent || '', 'HTML Content', 50000),
		textContent: validateString(data.textContent || '', 'Text Content', 50000),
		description: validateString(data.description || '', 'Description', 1000)
	};
}

/**
 * Validate member data (member-specific fields not in contacts)
 * @param {object} data - Member data
 * @returns {object} Validated member data
 * @throws {Error} If validation fails
 */
export function validateMember(data) {
	// Member data is linked to a contact, so we need contactId
	if (!data.contactId) {
		throw new Error('Contact ID is required for member data');
	}

	return {
		contactId: validateString(data.contactId, 'Contact ID', 50),
		// Personal information
		title: validateString(data.title || '', 'Title', 20),
		dateOfBirth: data.dateOfBirth || null,
		placeOfBirth: validateString(data.placeOfBirth || '', 'Place of Birth', 200),
		maritalStatus: ['single', 'married', 'divorced', 'widowed', ''].includes(data.maritalStatus?.toLowerCase()) 
			? data.maritalStatus.toLowerCase() 
			: '',
		spouseName: validateString(data.spouseName || '', 'Spouse Name', 200),
		childrenNamesAndAges: validateString(data.childrenNamesAndAges || '', 'Children Names and Ages', 1000),
		// Previous church
		previousChurch: validateString(data.previousChurch || '', 'Previous Church', 200),
		previousChurchFeelings: validateString(data.previousChurchFeelings || '', 'Previous Church Feelings', 1000),
		// Faith journey
		isChristFollower: data.isChristFollower === true || data.isChristFollower === 'true' || data.isChristFollower === 'yes',
		becameChristFollowerDate: data.becameChristFollowerDate || null,
		wantsHelpBecomingChristFollower: data.wantsHelpBecomingChristFollower === true || data.wantsHelpBecomingChristFollower === 'true' || data.wantsHelpBecomingChristFollower === 'yes',
		hasBeenWaterBaptised: data.hasBeenWaterBaptised === true || data.hasBeenWaterBaptised === 'true' || data.hasBeenWaterBaptised === 'yes',
		wantsToTalkAboutBaptism: data.wantsToTalkAboutBaptism === true || data.wantsToTalkAboutBaptism === 'true' || data.wantsToTalkAboutBaptism === 'yes',
		hasBeenFilledWithHolySpirit: data.hasBeenFilledWithHolySpirit === true || data.hasBeenFilledWithHolySpirit === 'true' || data.hasBeenFilledWithHolySpirit === 'yes',
		wantsToKnowMoreAboutHolySpirit: data.wantsToKnowMoreAboutHolySpirit === true || data.wantsToKnowMoreAboutHolySpirit === 'true' || data.wantsToKnowMoreAboutHolySpirit === 'yes',
		// Membership reflections
		membershipReflections: validateString(data.membershipReflections || '', 'Membership Reflections', 5000),
		// Community involvement
		attendingCommunityGroup: data.attendingCommunityGroup === true || data.attendingCommunityGroup === 'true' || data.attendingCommunityGroup === 'yes',
		wantsCommunityGroupInfo: data.wantsCommunityGroupInfo === true || data.wantsCommunityGroupInfo === 'true' || data.wantsCommunityGroupInfo === 'yes',
		// Serving
		currentlyServing: data.currentlyServing === true || data.currentlyServing === 'true' || data.currentlyServing === 'yes',
		servingArea: validateString(data.servingArea || '', 'Serving Area', 200),
		desiredServingArea: validateString(data.desiredServingArea || '', 'Desired Serving Area', 200),
		// Additional information
		additionalInfo: validateString(data.additionalInfo || '', 'Additional Info', 5000),
		prayerSupportNeeds: validateString(data.prayerSupportNeeds || '', 'Prayer Support Needs', 5000),
		// Meeting availability
		elderMeetingAvailability: ['anytime', 'morning', 'afternoon', 'evening', ''].includes(data.elderMeetingAvailability?.toLowerCase())
			? data.elderMeetingAvailability.toLowerCase()
			: '',
		// Metadata
		createdAt: data.createdAt || new Date().toISOString(),
		updatedAt: new Date().toISOString()
	};
}

/**
 * Validate meeting planner data
 * @param {object} data - Meeting planner data
 * @returns {object} Validated meeting planner data
 * @throws {Error} If validation fails
 */
export function validateMeetingPlanner(data) {
	requireField(data.eventId, 'Event ID');
	
	return {
		eventId: validateString(data.eventId, 'Event ID', 50),
		occurrenceId: data.occurrenceId ? validateString(data.occurrenceId, 'Occurrence ID', 50) : null,
		communionHappening: data.communionHappening === true || data.communionHappening === 'true' || data.communionHappening === 'on',
		notes: validateString(data.notes || '', 'Notes', 10000),
		speakerTopic: validateString(data.speakerTopic || '', 'Speaker Topic', 200),
		speakerSeries: validateString(data.speakerSeries || '', 'Speaker Series', 200),
		meetingLeaderRotaId: data.meetingLeaderRotaId ? validateString(data.meetingLeaderRotaId, 'Meeting Leader Rota ID', 50) : null,
		worshipLeaderRotaId: data.worshipLeaderRotaId ? validateString(data.worshipLeaderRotaId, 'Worship Leader Rota ID', 50) : null,
		speakerRotaId: data.speakerRotaId ? validateString(data.speakerRotaId, 'Speaker Rota ID', 50) : null,
		callToWorshipRotaId: data.callToWorshipRotaId ? validateString(data.callToWorshipRotaId, 'Call to Worship Rota ID', 50) : null
	};
}
