import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { getPodcasts, savePodcast, deletePodcast } from '$lib/server/database';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// Use Railway volume path if available, otherwise use static directory
// In production, use /data/audio/uploaded for persistence on Railway volumes
const UPLOAD_DIR = process.env.AUDIO_UPLOAD_DIR || (process.env.NODE_ENV === 'production' ? '/data/audio/uploaded' : 'static/audio/uploaded');

// Ensure upload directory exists
function ensureUploadDir() {
	let uploadPath;
	if (UPLOAD_DIR.startsWith('./') || UPLOAD_DIR.startsWith('../')) {
		uploadPath = join(process.cwd(), UPLOAD_DIR);
	} else {
		uploadPath = UPLOAD_DIR;
	}
	
	if (!existsSync(uploadPath)) {
		mkdirSync(uploadPath, { recursive: true });
	}
	return uploadPath;
}

export const GET = async ({ url, cookies }) => {
	requireAuth({ cookies });

	const id = url.searchParams.get('id');

	try {
		if (id) {
			const podcast = getPodcasts().find((p) => p.id === id);
			return podcast ? json(podcast) : json({ error: 'Podcast not found' }, { status: 404 });
		}
		return json(getPodcasts());
	} catch (error) {
		return json({ error: 'Failed to fetch podcasts' }, { status: 500 });
	}
};

export const POST = async ({ request, cookies }) => {
	requireAuth({ cookies });

	try {
		const formData = await request.formData();
		const file = formData.get('file');
		const podcastData = formData.get('podcast');

		if (!file && !podcastData) {
			return json({ error: 'No file or podcast data provided' }, { status: 400 });
		}

		// If uploading a file
		if (file) {
			// Validate file type
			if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3')) {
				return json({ error: 'File must be an audio file (MP3)' }, { status: 400 });
			}

			// Validate file size (max 100MB for audio)
			if (file.size > 100 * 1024 * 1024) {
				return json({ error: 'File size must be less than 100MB' }, { status: 400 });
			}

			// Generate unique filename
			const fileExt = file.name.split('.').pop() || 'mp3';
			const filename = `${randomUUID()}.${fileExt}`;
			const uploadPath = ensureUploadDir();
			const filePath = join(uploadPath, filename);

			// Save file
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);
			writeFileSync(filePath, buffer);

			const audioUrl = `/audio/uploaded/${filename}`;

			return json({
				success: true,
				audioUrl,
				filename,
				originalName: file.name,
				size: file.size
			});
		}

		// If saving podcast metadata
		if (podcastData) {
			const podcast = JSON.parse(podcastData);
			
			// Ensure required fields
			if (!podcast.id) {
				podcast.id = randomUUID();
			}
			if (!podcast.publishedAt) {
				podcast.publishedAt = new Date().toISOString();
			}
			if (!podcast.guid) {
				podcast.guid = podcast.id;
			}

			savePodcast(podcast);
			return json({ success: true, podcast });
		}

		return json({ error: 'Invalid request' }, { status: 400 });
	} catch (error) {
		console.error('Audio upload error:', error);
		console.error('Error stack:', error.stack);
		return json({ 
			error: 'Failed to process request',
			message: error.message || 'Unknown error',
			details: process.env.NODE_ENV === 'development' ? error.stack : undefined
		}, { status: 500 });
	}
};

export const DELETE = async ({ url, cookies }) => {
	requireAuth({ cookies });

	const id = url.searchParams.get('id');

	if (!id) {
		return json({ error: 'ID required' }, { status: 400 });
	}

	try {
		const podcast = getPodcasts().find((p) => p.id === id);
		if (!podcast) {
			return json({ error: 'Podcast not found' }, { status: 404 });
		}

		// Delete file from filesystem
		// Handle both /audio/uploaded/ paths and old static paths
		let filePath;
		if (podcast.audioUrl.startsWith('/audio/uploaded/')) {
			const filename = podcast.audioUrl.replace('/audio/uploaded/', '');
			filePath = join(ensureUploadDir(), filename);
		} else {
			// Legacy path handling
			filePath = join(process.cwd(), 'static', podcast.audioUrl.replace(/^\//, ''));
		}
		
		if (existsSync(filePath)) {
			unlinkSync(filePath);
		}

		// Delete from database
		deletePodcast(id);

		return json({ success: true });
	} catch (error) {
		console.error('Podcast delete error:', error);
		return json({ error: 'Failed to delete podcast' }, { status: 500 });
	}
};
