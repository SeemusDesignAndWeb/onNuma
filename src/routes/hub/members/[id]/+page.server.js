import { redirect, fail } from '@sveltejs/kit';
import { findById, readCollection, findMany, create, update } from '$lib/crm/server/fileStore.js';
import { getCsrfToken, verifyCsrfToken } from '$lib/crm/server/auth.js';
import { validateMember } from '$lib/crm/server/validators.js';
import { logDataChange } from '$lib/crm/server/audit.js';

export async function load({ params, cookies }) {
	// Get the contact (member)
	const contact = await findById('contacts', params.id);
	if (!contact) {
		throw redirect(302, '/hub/members');
	}

	// Verify this is actually a member
	if (contact.membershipStatus !== 'member') {
		throw redirect(302, '/hub/contacts/' + params.id);
	}

	// Get member-specific data if it exists
	const members = await readCollection('members');
	const memberData = members.find(m => m.contactId === params.id) || null;
	
	const csrfToken = getCsrfToken(cookies) || '';
	return { 
		member: contact,
		contact: contact, // Alias for clarity
		memberData: memberData,
		csrfToken 
	};
}

export const actions = {
	update: async ({ request, params, cookies, locals }) => {
		const data = await request.formData();
		const csrfToken = data.get('_csrf');

		if (!csrfToken || !verifyCsrfToken(cookies, csrfToken)) {
			return fail(403, { error: 'CSRF token validation failed' });
		}

		try {
			// Get existing member data or create new
			const members = await readCollection('members');
			const existingMember = members.find(m => m.contactId === params.id);

			const isChristFollowerVal = data.get('isChristFollower');
			const hasBeenWaterBaptisedVal = data.get('hasBeenWaterBaptised');
			const hasBeenFilledWithHolySpiritVal = data.get('hasBeenFilledWithHolySpirit');
			const attendingCommunityGroupVal = data.get('attendingCommunityGroup');
			const currentlyServingVal = data.get('currentlyServing');

			const memberData = {
				contactId: params.id,
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
				isChristFollower: isChristFollowerVal === 'yes',
				becameChristFollowerDate: data.get('becameChristFollowerDate') || null,
				wantsHelpBecomingChristFollower: data.get('wantsHelpBecomingChristFollower') === 'on' || data.get('wantsHelpBecomingChristFollower') === 'true',
				hasBeenWaterBaptised: hasBeenWaterBaptisedVal === 'yes',
				wantsToTalkAboutBaptism: data.get('wantsToTalkAboutBaptism') === 'on' || data.get('wantsToTalkAboutBaptism') === 'true',
				hasBeenFilledWithHolySpirit: hasBeenFilledWithHolySpiritVal === 'yes',
				wantsToKnowMoreAboutHolySpirit: data.get('wantsToKnowMoreAboutHolySpirit') === 'on' || data.get('wantsToKnowMoreAboutHolySpirit') === 'true',
				// Membership reflections
				membershipReflections: data.get('membershipReflections') || '',
				// Community involvement
				attendingCommunityGroup: attendingCommunityGroupVal === 'yes',
				wantsCommunityGroupInfo: data.get('wantsCommunityGroupInfo') === 'on' || data.get('wantsCommunityGroupInfo') === 'true',
				// Serving
				currentlyServing: currentlyServingVal === 'yes',
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

			const validated = validateMember(memberData);
			
			let memberRecord;
			if (existingMember) {
				memberRecord = await update('members', existingMember.id, validated);
			} else {
				memberRecord = await create('members', validated);
			}

			// Log audit event
			const adminId = locals?.admin?.id || null;
			const event = { getClientAddress: () => 'unknown', request };
			const contact = await findById('contacts', params.id);
			await logDataChange(adminId, existingMember ? 'update' : 'create', 'member', memberRecord.id, {
				contactId: params.id,
				email: contact?.email,
				name: contact ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim() : 'unknown'
			}, event);

			return { success: true };
		} catch (error) {
			return fail(400, { error: error.message });
		}
	}
};
