import { getHeroSlides, getContactInfo, getServiceTimes, getEvents, getServices, getHome, getSettings } from '$lib/server/database';
import { getPlaylistVideos, getChannelVideos } from '$lib/server/youtube';

export const load = async () => {
	const heroSlides = getHeroSlides();
	const contactInfo = getContactInfo();
	const serviceTimes = getServiceTimes();
	const allEvents = getEvents();
	const services = getServices().sort((a, b) => (a.order || 0) - (b.order || 0));
	const settings = getSettings();
	
	// Get featured events that are published, sorted by date
	const featuredEvents = allEvents
		.filter(e => e.featured && e.published)
		.sort((a, b) => {
			const dateA = new Date(a.date || '9999-12-31');
			const dateB = new Date(b.date || '9999-12-31');
			return dateA.getTime() - dateB.getTime();
		});
	// For hero sidebar, show up to 3
	const heroEvents = featuredEvents.slice(0, 3);
	
	// Get highlighted event (for popup)
	const highlightedEvents = allEvents.filter(e => e.highlighted && e.published);
	console.log(`Found ${highlightedEvents.length} highlighted events`);
	
	const highlightedEvent = highlightedEvents
		.sort((a, b) => {
			const dateA = new Date(a.date || '9999-12-31');
			const dateB = new Date(b.date || '9999-12-31');
			return dateA.getTime() - dateB.getTime();
		})[0] || null;
	
	if (highlightedEvent) {
		console.log('Selected highlighted event:', highlightedEvent.title);
	} else {
		console.log('No highlighted event found');
	}
	
	// Get latest YouTube video from last 5 days
	let latestVideo = null;
	if (settings.showLatestMessagePopup) {
		try {
			const fiveDaysAgo = new Date();
			fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
			fiveDaysAgo.setHours(0, 0, 0, 0); // Set to start of day for consistent comparison
			
			console.log('Fetching latest video, looking for videos after:', fiveDaysAgo.toISOString());
			
			let videos = [];
			if (settings.youtubeChannelId && settings.youtubeChannelId.trim() !== '') {
				console.log('Fetching from channel:', settings.youtubeChannelId);
				videos = await getChannelVideos(settings.youtubeChannelId, 20);
			} else if (settings.youtubePlaylistId && settings.youtubePlaylistId.trim() !== '') {
				console.log('Fetching from playlist:', settings.youtubePlaylistId);
				videos = await getPlaylistVideos(settings.youtubePlaylistId, 20);
			} else {
				console.log('No YouTube channel or playlist configured');
			}
			
			console.log(`Fetched ${videos.length} videos total`);
			
			// Filter videos from last 5 days
			const recentVideos = videos.filter(video => {
				const publishedDate = new Date(video.publishedAt);
				const isRecent = publishedDate >= fiveDaysAgo;
				if (isRecent) {
					console.log('Found recent video:', video.title, 'published:', publishedDate.toISOString());
				}
				return isRecent;
			});
			
			console.log(`Found ${recentVideos.length} videos from last 5 days`);
			
			// Get the most recent one
			if (recentVideos.length > 0) {
				latestVideo = recentVideos[0];
				console.log('Selected latest video:', latestVideo.title);
			} else {
				console.log('No videos found in the last 5 days');
			}
		} catch (error) {
			console.error('Failed to fetch latest YouTube video:', error);
			console.error('Error stack:', error.stack);
		}
	} else {
		console.log('Latest message popup is disabled in settings');
	}
	
	const home = getHome();
	return {
		heroSlides: heroSlides.length > 0 ? heroSlides : null,
		contactInfo,
		serviceTimes,
		services,
		featuredEvents: featuredEvents.length > 0 ? featuredEvents : [],
		heroEvents: heroEvents.length > 0 ? heroEvents : null,
		home,
		settings,
		latestVideo,
		highlightedEvent
	};
};
