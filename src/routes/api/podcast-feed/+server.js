import { getPodcasts, readDatabase } from '$lib/server/database';

// Helper function to format duration (MM:SS or HH:MM:SS)
function formatDuration(duration) {
	if (!duration) return '';
	// If already formatted, return as is
	if (duration.includes(':')) return duration;
	// Otherwise assume it's seconds
	const seconds = parseInt(duration);
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	if (hours > 0) {
		return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	}
	return `${minutes}:${String(secs).padStart(2, '0')}`;
}

// Helper function to format date for RSS
function formatRSSDate(date) {
	return new Date(date).toUTCString();
}

// Helper function to escape XML
function escapeXml(unsafe) {
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET = async ({ url, request }) => {
	try {
		const db = readDatabase();
		const podcasts = getPodcasts();
		const settings = db.settings || {};
		
		// Get base URL from request
		let baseUrl = 'https://www.egcc.co.uk';
		
		try {
			// url is a URL object in SvelteKit
			baseUrl = `${url.protocol}//${url.host}`;
		} catch (e) {
			// Fallback to headers if URL parsing fails
			const host = request.headers.get('host') || 'www.egcc.co.uk';
			const protocol = request.headers.get('x-forwarded-proto') || 'https';
			baseUrl = `${protocol}://${host}`;
		}

		const podcastAuthor = settings.podcastAuthor || 'Eltham Green Community Church';
		const podcastEmail = settings.podcastEmail || 'johnawatson72@gmail.com';
		const podcastImage = settings.podcastImage || `${baseUrl}/assets/onnuma-logo.png`;
		const podcastDescription = settings.podcastDescription || 'Latest sermons from Eltham Green Community Church';
		const siteName = settings.siteName || 'Eltham Green Community Church';

		// Build RSS feed
		let rss = `<?xml version="1.0" encoding="utf-8" ?>
<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" version="2.0">
    <channel>
        <title>${escapeXml(siteName)} Audio // Sermons</title>
        <link>${baseUrl}</link>
        <itunes:author>${escapeXml(podcastAuthor)}</itunes:author>
        <itunes:owner>
            <itunes:name>${escapeXml(podcastAuthor)}</itunes:name>
            <itunes:email>${escapeXml(podcastEmail)}</itunes:email>
        </itunes:owner>
        <itunes:image href="${escapeXml(podcastImage)}" />
        <itunes:explicit>Clean</itunes:explicit>
        <itunes:category text="Religion">
            <itunes:category text="Christianity" />
        </itunes:category>
        <itunes:summary>${escapeXml(podcastDescription)}</itunes:summary>
        <category>Religion</category>
        <description>${escapeXml(podcastDescription)}</description>
        <language>en-gb</language>
        <copyright>© ${escapeXml(siteName)}</copyright>
        <ttl>86400</ttl>
`;

		// Add podcast items
		for (const podcast of podcasts) {
			// Handle both relative and absolute URLs
			let audioUrl = podcast.audioUrl;
			if (!audioUrl.startsWith('http')) {
				audioUrl = `${baseUrl}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
			}
			
			const duration = formatDuration(podcast.duration);
			const pubDate = formatRSSDate(podcast.publishedAt);
			const guid = podcast.guid || podcast.id;
			const speaker = podcast.speaker || 'Various Speakers';
			const speakerEmail = podcast.speakerEmail || podcastEmail;
			const category = podcast.category || 'Talk';
			const description = podcast.description || `By ${speaker}`;

			rss += `        <item>
            <title>${escapeXml(podcast.title)}</title>
            <link>${escapeXml(audioUrl)}</link>
            <itunes:author>${escapeXml(speaker)}</itunes:author>
            <itunes:email>${escapeXml(speakerEmail)}</itunes:email>
            <itunes:category text="Religion">
                <itunes:category text="Christianity" />
            </itunes:category>
            <category>${escapeXml(category)}</category>
            ${duration ? `<duration>${escapeXml(duration)}</duration>` : ''}
            <description>${escapeXml(description)}</description>
            <pubDate>${pubDate}</pubDate>
            <enclosure url="${escapeXml(audioUrl)}" length="${podcast.size}" type="audio/mpeg" />
            <guid>${escapeXml(guid)}</guid>
        </item>
`;
		}

		rss += `    </channel>
</rss>`;

		return new Response(rss, {
			headers: {
				'Content-Type': 'application/rss+xml; charset=utf-8',
				'Cache-Control': 'public, max-age=3600'
			}
		});
	} catch (error) {
		console.error('RSS feed error:', error);
		return new Response('Failed to generate RSS feed', { status: 500 });
	}
};
