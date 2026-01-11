import { fail, redirect } from '@sveltejs/kit';
import { getCsrfToken, verifyCsrfToken, generateCsrfToken, setCsrfToken } from '$lib/crm/server/auth.js';
import { validateContact, validateMember } from '$lib/crm/server/validators.js';
import { create, findMany, readCollection } from '$lib/crm/server/fileStore.js';
import { env } from '$env/dynamic/private';

export async function load({ cookies, url }) {
	// Ensure CSRF token exists
	let csrfToken = getCsrfToken(cookies);
	if (!csrfToken) {
		csrfToken = generateCsrfToken();
		const isProduction = env.NODE_ENV === 'production';
		setCsrfToken(cookies, csrfToken, isProduction);
	}

	// Check if user has already provided name/email (stored in URL params or session)
	const email = url.searchParams.get('email');
	const firstName = url.searchParams.get('firstName');
	const lastName = url.searchParams.get('lastName');

	return { 
		csrfToken,
		email: email || null,
		firstName: firstName || null,
		lastName: lastName || null
	};
}

export const actions = {
	verify: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		const email = data.get('email');
		const firstName = data.get('firstName');
		const lastName = data.get('lastName');

		if (!email) {
			return fail(400, { error: 'Email is required' });
		}

		// Redirect to the same page with email/name in query params to show the form
		const params = new URLSearchParams();
		params.set('email', email);
		if (firstName) params.set('firstName', firstName);
		if (lastName) params.set('lastName', lastName);
		
		throw redirect(302, `/signup/membership-form?${params.toString()}`);
	},

	submit: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			const email = data.get('email');
			if (!email) {
				return fail(400, { error: 'Email is required' });
			}

			// Get or create contact
			const existingContacts = await findMany('contacts', c => 
				c.email && c.email.toLowerCase() === email.toLowerCase()
			);

			let contact;
			let isUpdate = false;

			// Contact data (fields already in contacts)
			// Note: Address fields and dateJoined are not included as they should already be in the contact from signup
			const contactData = {
				email: email,
				firstName: data.get('firstName') || '',
				lastName: data.get('lastName') || '',
				phone: data.get('phone') || '',
				membershipStatus: 'member', // Set as member when they submit membership form
				notes: '',
				subscribed: data.get('subscribed') === 'on' || data.get('subscribed') === 'true'
			};

			if (existingContacts.length > 0) {
				// Update existing contact - preserve existing address fields and dateJoined
				const existingContact = existingContacts[0];
				const { update } = await import('$lib/crm/server/fileStore.js');
				
				// Merge with existing contact data, preserving address fields and dateJoined
				const updatedContactData = {
					...existingContact,
					...contactData,
					// Preserve address fields from existing contact
					addressLine1: existingContact.addressLine1 || '',
					addressLine2: existingContact.addressLine2 || '',
					city: existingContact.city || '',
					county: existingContact.county || '',
					postcode: existingContact.postcode || '',
					country: existingContact.country || 'United Kingdom',
					// Preserve dateJoined from existing contact
					dateJoined: existingContact.dateJoined || null,
					membershipStatus: 'member', // Ensure they're marked as member
					updatedAt: new Date().toISOString()
				};
				
				const validatedContact = validateContact(updatedContactData);
				contact = await update('contacts', existingContact.id, validatedContact);
				isUpdate = true;
			} else {
				// Create new contact - use default empty address fields
				const newContactData = {
					...contactData,
					addressLine1: '',
					addressLine2: '',
					city: '',
					county: '',
					postcode: '',
					country: 'United Kingdom',
					dateJoined: null
				};
				const validatedContact = validateContact(newContactData);
				contact = await create('contacts', validatedContact);
			}

			// Create or update member data
			const members = await readCollection('members');
			const existingMember = members.find(m => m.contactId === contact.id);

			const memberData = {
				contactId: contact.id,
				// Personal information
				title: data.get('title') || '',
				dateOfBirth: data.get('dateOfBirth') || null,
				placeOfBirth: data.get('placeOfBirth') || '',
				maritalStatus: data.get('maritalStatus') || '',
				spouseName: data.get('spouseName') || '',
				childrenNamesAndAges: data.get('childrenNamesAndAges') || '',
				// Previous church
				previousChurch: data.get('previousChurch') || '',
				previousChurchFeelings: data.get('previousChurchFeelings') || '',
				// Faith journey
				isChristFollower: data.get('isChristFollower') === 'yes',
				becameChristFollowerDate: data.get('becameChristFollowerDate') || null,
				wantsHelpBecomingChristFollower: data.get('wantsHelpBecomingChristFollower') === 'on' || data.get('wantsHelpBecomingChristFollower') === 'true',
				hasBeenWaterBaptised: data.get('hasBeenWaterBaptised') === 'yes',
				wantsToTalkAboutBaptism: data.get('wantsToTalkAboutBaptism') === 'on' || data.get('wantsToTalkAboutBaptism') === 'true',
				hasBeenFilledWithHolySpirit: data.get('hasBeenFilledWithHolySpirit') === 'yes',
				wantsToKnowMoreAboutHolySpirit: data.get('wantsToKnowMoreAboutHolySpirit') === 'on' || data.get('wantsToKnowMoreAboutHolySpirit') === 'true',
				// Membership reflections
				membershipReflections: data.get('membershipReflections') || '',
				// Community involvement
				attendingCommunityGroup: data.get('attendingCommunityGroup') === 'yes',
				wantsCommunityGroupInfo: data.get('wantsCommunityGroupInfo') === 'on' || data.get('wantsCommunityGroupInfo') === 'true',
				// Serving
				currentlyServing: data.get('currentlyServing') === 'yes',
				servingArea: data.get('servingArea') || '',
				desiredServingArea: data.get('desiredServingArea') || '',
				// Additional information
				additionalInfo: data.get('additionalInfo') || '',
				prayerSupportNeeds: data.get('prayerSupportNeeds') || '',
				// Meeting availability
				elderMeetingAvailability: data.get('elderMeetingAvailability') || '',
				// Preserve existing ID and createdAt if updating
				id: existingMember?.id,
				createdAt: existingMember?.createdAt || new Date().toISOString()
			};

			const validatedMember = validateMember(memberData);

			if (existingMember) {
				const { update } = await import('$lib/crm/server/fileStore.js');
				await update('members', existingMember.id, validatedMember);
			} else {
				await create('members', validatedMember);
			}

			return {
				success: true,
				message: isUpdate 
					? 'Thank you! Your membership information has been updated.' 
					: 'Thank you for submitting your membership form! We\'ll be in touch soon.'
			};
		} catch (error) {
			console.error('[Membership Form] Error:', error);
			return fail(400, { error: error.message || 'Failed to submit form. Please try again.' });
		}
	}
};
