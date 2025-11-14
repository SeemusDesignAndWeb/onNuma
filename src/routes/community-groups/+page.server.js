import { getPage, getContactInfo, getCommunityGroups } from '$lib/server/database';

export const load = async () => {
	const page = getPage('community-groups');
	const contactInfo = getContactInfo();
	const communityGroups = getCommunityGroups();
	if (page) {
		return { page, contactInfo, communityGroups };
	}
	const fallbackPage = {
		id: 'community-groups',
		title: 'Community Groups',
		heroTitle: 'Community groups',
		heroImage: '/images/community-groups-bg.jpg',
		content: '',
		sections: [],
		published: true
	};
	return { page: fallbackPage, contactInfo, communityGroups };
};
