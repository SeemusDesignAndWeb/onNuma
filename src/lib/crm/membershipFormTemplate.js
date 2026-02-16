/**
 * Template for the Membership Form, matching the fields from the signup membership form.
 * Used to create a form in the Hub Forms section that stores submissions in the database (registers).
 */
export const MEMBERSHIP_FORM_TEMPLATE = {
	name: 'Membership Form',
	description: 'Apply for church membership. Submissions are stored in Forms and can be linked to contacts.',
	fields: [
		{ type: 'text', label: 'Title', name: 'title', required: false, placeholder: 'Mr, Mrs, Miss' },
		{ type: 'select', label: 'Marital Status', name: 'maritalStatus', required: false, options: ['Single', 'Married', 'Divorced', 'Widowed'] },
		{ type: 'date', label: 'Date of Birth', name: 'dateOfBirth', required: false },
		{ type: 'text', label: 'Place of Birth', name: 'placeOfBirth', required: false },
		{ type: 'text', label: 'First Name', name: 'firstName', required: true, placeholder: 'John' },
		{ type: 'text', label: 'Last Name', name: 'lastName', required: false, placeholder: 'Smith' },
		{ type: 'email', label: 'Email', name: 'email', required: true, placeholder: 'your.email@example.com' },
		{ type: 'tel', label: 'Phone', name: 'phone', required: false },
		{ type: 'text', label: 'Name of Spouse', name: 'spouseName', required: false },
		{ type: 'textarea', label: 'Children Names and Ages', name: 'childrenNamesAndAges', required: false, placeholder: 'e.g., John (12), Sarah (8)' },
		{ type: 'text', label: 'Previous Church', name: 'previousChurch', required: false, placeholder: 'What church were you at immediately before?' },
		{ type: 'textarea', label: 'How did they feel about your move?', name: 'previousChurchFeelings', required: false },
		{ type: 'radio', label: 'Christ-Follower?', name: 'isChristFollower', required: false, options: ['yes', 'no'] },
		{ type: 'date', label: 'When did you become one?', name: 'becameChristFollowerDate', required: false },
		{ type: 'checkbox', label: 'Would like help becoming a Christ-follower?', name: 'wantsHelpBecomingChristFollower', required: false, options: ['Yes'] },
		{ type: 'radio', label: 'Water Baptised?', name: 'hasBeenWaterBaptised', required: false, options: ['yes', 'no'] },
		{ type: 'checkbox', label: 'Would like to talk about baptism?', name: 'wantsToTalkAboutBaptism', required: false, options: ['Yes'] },
		{ type: 'radio', label: 'Filled with Holy Spirit?', name: 'hasBeenFilledWithHolySpirit', required: false, options: ['yes', 'no'] },
		{ type: 'checkbox', label: 'Would like to know more about the Holy Spirit?', name: 'wantsToKnowMoreAboutHolySpirit', required: false, options: ['Yes'] },
		{ type: 'textarea', label: 'After reading the Membership booklet, what are your initial reflections or questions?', name: 'membershipReflections', required: false },
		{ type: 'radio', label: 'Attending Community Group?', name: 'attendingCommunityGroup', required: false, options: ['yes', 'no'] },
		{ type: 'checkbox', label: 'Would like more info on community groups?', name: 'wantsCommunityGroupInfo', required: false, options: ['Yes'] },
		{ type: 'radio', label: 'Currently Serving?', name: 'currentlyServing', required: false, options: ['yes', 'no'] },
		{ type: 'text', label: 'Serving Area', name: 'servingArea', required: false },
		{ type: 'text', label: 'Desired Serving Area', name: 'desiredServingArea', required: false, placeholder: 'e.g., Kids, Worship' },
		{ type: 'select', label: 'Elder Meeting Availability', name: 'elderMeetingAvailability', required: false, options: ['Anytime', 'Morning', 'Afternoon', 'Evening'] },
		{ type: 'textarea', label: 'Anything else about yourself that would be helpful for us to know? (hobbies, talents, life experiences)', name: 'additionalInfo', required: false },
		{ type: 'textarea', label: 'Anything where you could benefit from prayer, guidance, or support?', name: 'prayerSupportNeeds', required: false },
		{ type: 'checkbox', label: 'Subscribe to weekly newsletter', name: 'subscribed', required: false, options: ['Yes'] }
	]
};
