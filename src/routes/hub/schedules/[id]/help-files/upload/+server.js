import { json, error } from '@sveltejs/kit';
import { randomUUID } from 'crypto';
import { join } from 'path';
import { writeFileSync, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { getDataDir } from '$lib/crm/server/fileStore.js';

/**
 * Upload PDF help file for a rota
 * Auth is handled by The HUB hook
 */
export async function POST({ request, params, locals }) {
	// Check authentication (set by hooks)
	if (!locals.admin) {
		throw error(401, 'Unauthorized');
	}

	try {
		const formData = await request.formData();
		const file = formData.get('file');

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file type - must be PDF
		if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
			return json({ error: 'File must be a PDF' }, { status: 400 });
		}

		// Validate file size (max 10MB)
		if (file.size > 10 * 1024 * 1024) {
			return json({ error: 'File size must be less than 10MB' }, { status: 400 });
		}

		// Ensure uploads directory exists
		const DATA_DIR = getDataDir();
		const UPLOADS_DIR = join(DATA_DIR, 'uploads', 'rota-help-files');
		if (!existsSync(UPLOADS_DIR)) {
			await mkdir(UPLOADS_DIR, { recursive: true });
		}

		// Generate unique filename
		const fileExt = 'pdf';
		const filename = `${randomUUID()}.${fileExt}`;
		const filePath = join(UPLOADS_DIR, filename);

		// Save file
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		writeFileSync(filePath, buffer);

		return json({
			success: true,
			filename,
			originalName: file.name,
			size: file.size
		});
	} catch (err) {
		console.error('Help file upload error:', err);
		return json({ error: 'Failed to upload file: ' + err.message }, { status: 500 });
	}
}
