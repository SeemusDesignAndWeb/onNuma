import { getPage, getPodcasts, getContactInfo, getSettings } from '$lib/server/database';

export const load = async ({ setHeaders, depends }) => {
	// Invalidate cache to ensure fresh podcast data
	depends('podcasts');
	
	// Disable caching for this page to ensure fresh podcast data
	setHeaders({
		'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
		'Pragma': 'no-cache',
		'Expires': '0'
	});

	const page = getPage('audio');
	const podcasts = getPodcasts();
	const contactInfo = getContactInfo();
	const settings = getSettings();
	return {
		page: page || {
			id: 'audio',
			title: 'Audio',
			heroTitle: 'Sermons & Audio',
			heroImage: '/images/audio-bg.jpg',
			content: '',
			sections: []
		},
		podcasts,
		contactInfo,
		spotifyShowUrl: settings.spotifyShowUrl || 'https://open.spotify.com/show/7aczNe2FL8GCTxpaqM9WF1?si=9bab49974d2e48bc'
	};
};
