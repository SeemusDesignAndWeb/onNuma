import { getPage, getContactInfo, getSettings } from '$lib/server/database';
import { getPlaylistVideos, getPlaylistInfo, getChannelInfo, getChannelVideos } from '$lib/server/youtube';

export const load = async () => {
	const page = getPage('media');
	const contactInfo = getContactInfo();
	const settings = getSettings();
	
	let videos = [];
	let playlistInfo = null;
	
	// Get YouTube playlist ID or channel ID from settings
	const playlistId = settings.youtubePlaylistId;
	const channelId = settings.youtubeChannelId;
	
	if (channelId && channelId.trim() !== '') {
		try {
			console.log('Fetching YouTube channel:', channelId);
			playlistInfo = await getChannelInfo(channelId);
			if (!playlistInfo) {
				console.warn('Channel info returned null - channel may not exist or be private');
			} else {
				console.log('Channel found:', playlistInfo.title);
				videos = await getChannelVideos(channelId, 50);
				console.log(`Loaded ${videos.length} videos from channel`);
			}
		} catch (error) {
			console.error('Failed to load YouTube channel videos:', error);
			console.error('Error details:', error.message);
			console.error('Full error:', error);
			// Set playlistInfo to indicate an error occurred
			playlistInfo = { error: true, message: error.message };
		}
	} else if (playlistId && playlistId.trim() !== '') {
		try {
			console.log('Fetching YouTube playlist:', playlistId);
			playlistInfo = await getPlaylistInfo(playlistId);
			if (!playlistInfo) {
				console.warn('Playlist info returned null - playlist may not exist or be private');
			} else {
				console.log('Playlist found:', playlistInfo.title);
				videos = await getPlaylistVideos(playlistId, 50);
				console.log(`Loaded ${videos.length} videos from playlist`);
			}
		} catch (error) {
			console.error('Failed to load YouTube videos:', error);
			console.error('Error details:', error.message);
			console.error('Full error:', error);
			// Set playlistInfo to indicate an error occurred
			playlistInfo = { error: true, message: error.message };
		}
	} else {
		console.log('No YouTube playlist ID or channel ID configured in settings');
	}
	
	if (page) {
		return { page, contactInfo, videos, playlistInfo };
	}
	const fallbackPage = {
		id: 'media',
		title: 'Online',
		heroTitle: 'Online',
		heroImage: '/images/media-bg.jpg',
		content: '',
		sections: [],
		published: true
	};
	return { page: fallbackPage, contactInfo, videos, playlistInfo };
};
