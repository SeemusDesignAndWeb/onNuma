import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import {
	getPages,
	getPage,
	savePage,
	deletePage,
	getTeam,
	getTeamMember,
	saveTeamMember,
	deleteTeamMember,
	getServices,
	saveService,
	deleteService,
	getHeroSlides,
	saveHeroSlide,
	deleteHeroSlide,
	getContactInfo,
	saveContactInfo,
	getServiceTimes,
	saveServiceTimes,
	getSettings,
	saveSettings,
	getPodcasts,
	getActivities,
	getActivity,
	saveActivity,
	deleteActivity,
	getCommunityGroups,
	getCommunityGroup,
	saveCommunityGroup,
	deleteCommunityGroup,
	getEvents,
	getEvent,
	saveEvent,
	deleteEvent
} from '$lib/server/database';

export const GET = async ({ url, cookies }) => {
	requireAuth({ cookies });

	const type = url.searchParams.get('type');
	const id = url.searchParams.get('id');

	try {
		switch (type) {
			case 'pages':
				return json(id ? getPage(id) : getPages());
			case 'team':
				return json(id ? getTeamMember(id) : getTeam());
			case 'services':
				return json(getServices());
			case 'hero-slides':
				return json(getHeroSlides());
			case 'contact':
				return json(getContactInfo());
			case 'service-times':
				return json(getServiceTimes());
			case 'settings':
				return json(getSettings());
			case 'activities':
				return json(id ? getActivity(id) : getActivities());
			case 'community-groups':
				return json(id ? getCommunityGroup(id) : getCommunityGroups());
			case 'events':
				return json(id ? getEvent(id) : getEvents());
			default:
				return json({ error: 'Invalid type' }, { status: 400 });
		}
	} catch (error) {
		return json({ error: 'Failed to fetch data' }, { status: 500 });
	}
};

export const POST = async ({ request, cookies }) => {
	requireAuth({ cookies });

	const { type, data } = await request.json();

	try {
		switch (type) {
			case 'page':
				// Debug logging for page saves
				console.log('[API] Saving page:', {
					id: data.id,
					title: data.title,
					hasSections: !!data.sections,
					sectionsCount: data.sections?.length || 0,
					sectionsTypes: data.sections?.map(s => s?.type) || [],
					sectionsPreview: data.sections?.slice(0, 2).map(s => ({ type: s.type, title: s.title })) || []
				});
				savePage(data);
				return json({ success: true });
			case 'team':
				saveTeamMember(data);
				return json({ success: true });
			case 'service':
				saveService(data);
				return json({ success: true });
			case 'hero-slide':
				saveHeroSlide(data);
				return json({ success: true });
			case 'contact':
				saveContactInfo(data);
				return json({ success: true });
			case 'service-times':
				saveServiceTimes(data);
				return json({ success: true });
			case 'settings':
				saveSettings(data);
				return json({ success: true });
			case 'activity':
				saveActivity(data);
				return json({ success: true });
			case 'community-group':
				saveCommunityGroup(data);
				return json({ success: true });
			case 'event':
				saveEvent(data);
				return json({ success: true });
			default:
				return json({ error: 'Invalid type' }, { status: 400 });
		}
	} catch (error) {
		return json({ error: 'Failed to save data' }, { status: 500 });
	}
};

export const DELETE = async ({ url, cookies }) => {
	requireAuth({ cookies });

	const type = url.searchParams.get('type');
	const id = url.searchParams.get('id');

	if (!id) {
		return json({ error: 'ID required' }, { status: 400 });
	}

	try {
		switch (type) {
			case 'page':
				deletePage(id);
				return json({ success: true });
			case 'team':
				deleteTeamMember(id);
				return json({ success: true });
			case 'service':
				deleteService(id);
				return json({ success: true });
			case 'hero-slide':
				deleteHeroSlide(id);
				return json({ success: true });
			case 'activity':
				deleteActivity(id);
				return json({ success: true });
			case 'community-group':
				deleteCommunityGroup(id);
				return json({ success: true });
			case 'event':
				deleteEvent(id);
				return json({ success: true });
			default:
				return json({ error: 'Invalid type' }, { status: 400 });
		}
	} catch (error) {
		return json({ error: 'Failed to delete' }, { status: 500 });
	}
};
