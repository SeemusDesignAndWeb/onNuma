import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { readDatabase, writeDatabase } from '$lib/server/database';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';
import { randomUUID } from 'crypto';

// Configure Cloudinary
function configureCloudinary() {
	const cloudName = env.CLOUDINARY_CLOUD_NAME || 'dl8kjhwjs';
	const apiKey = env.CLOUDINARY_API_KEY;
	const apiSecret = env.CLOUDINARY_API_SECRET;

	if (!apiKey || !apiSecret) {
		throw new Error('Cloudinary API credentials are missing');
	}

	cloudinary.config({
		cloud_name: cloudName,
		api_key: apiKey,
		api_secret: apiSecret
	});

	return { cloudName, apiKey, apiSecret };
}

async function getAllCloudinaryImages() {
	const allImages = [];
	let nextCursor = null;
	let pageCount = 0;
	const maxPages = 100; // Safety limit to prevent infinite loops

	do {
		try {
			pageCount++;
			if (pageCount > maxPages) {
				console.warn(`[Cloudinary Sync] Reached max pages limit (${maxPages}), stopping`);
				break;
			}

			const options = {
				expression: 'folder:egcc',
				max_results: 500
			};

			if (nextCursor) {
				options.next_cursor = nextCursor;
			}

			console.log(`[Cloudinary Sync] Fetching page ${pageCount}...`);
			const result = await cloudinary.search.execute(options);
			console.log(`[Cloudinary Sync] Page ${pageCount} returned ${result.resources?.length || 0} images`);

			if (result.resources && result.resources.length > 0) {
				allImages.push(...result.resources);
			}

			nextCursor = result.next_cursor;
		} catch (error) {
			// Check for rate limit error
			if (error.error && error.error.http_code === 420) {
				console.error('[Cloudinary Sync] Rate limit exceeded');
				const rateLimitMessage = error.error.message || 'Rate limit exceeded';
				throw new Error('RATE_LIMIT_EXCEEDED: ' + rateLimitMessage);
			}
			console.error('[Cloudinary Sync] Error fetching images:', error);
			throw error;
		}
	} while (nextCursor);

	console.log(`[Cloudinary Sync] Total images fetched: ${allImages.length}`);
	return allImages;
}

// GET endpoint to list Cloudinary images for selection
export const GET = async ({ cookies }) => {
	requireAuth({ cookies });

	try {
		console.log('[Cloudinary Sync] Starting to fetch images...');
		
		// Configure Cloudinary
		configureCloudinary();
		console.log('[Cloudinary Sync] Cloudinary configured');

		// Fetch all images from Cloudinary
		const cloudinaryImages = await getAllCloudinaryImages();
		console.log(`[Cloudinary Sync] Fetched ${cloudinaryImages.length} images from Cloudinary`);

		// Read current database to check which images already exist
		const db = readDatabase();
		const existingImages = db.images || [];
		const existingPublicIds = new Set();
		existingImages.forEach(img => {
			if (img.cloudinaryPublicId) {
				existingPublicIds.add(img.cloudinaryPublicId);
			}
		});

		// Format images for display
		const formattedImages = cloudinaryImages.map(img => ({
			publicId: img.public_id,
			filename: img.filename || img.public_id.split('/').pop(),
			url: img.secure_url,
			width: img.width,
			height: img.height,
			size: img.bytes || 0,
			format: img.format,
			createdAt: img.created_at,
			alreadyImported: existingPublicIds.has(img.public_id)
		}));

		console.log(`[Cloudinary Sync] Returning ${formattedImages.length} formatted images`);
		return json({
			success: true,
			images: formattedImages
		});
	} catch (error) {
		console.error('[Cloudinary Sync] Error fetching Cloudinary images:', error);
		console.error('[Cloudinary Sync] Error details:', {
			message: error.message,
			stack: error.stack,
			error: error.error
		});
		
		if (error.message && error.message.includes('RATE_LIMIT_EXCEEDED')) {
			// Extract reset time from error message if available
			const resetTimeMatch = error.message.match(/Try again on ([\d\s:-]+ UTC)/);
			const resetTime = resetTimeMatch ? resetTimeMatch[1] : null;
			
			return json({
				success: false,
				error: 'Cloudinary rate limit exceeded. Please try again later.',
				details: error.message,
				resetTime: resetTime
			}, { status: 429 });
		}

		const errorMessage = error.message || 'Unknown error occurred';
		return json({
			success: false,
			error: 'Failed to fetch images: ' + errorMessage
		}, { status: 500 });
	}
};

// POST endpoint to import selected images
export const POST = async ({ request, cookies }) => {
	requireAuth({ cookies });

	try {
		const { publicIds } = await request.json();

		if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
			return json({
				success: false,
				error: 'No images selected for import'
			}, { status: 400 });
		}

		// Configure Cloudinary
		configureCloudinary();

		// Fetch all images from Cloudinary
		const cloudinaryImages = await getAllCloudinaryImages();

		// Filter to only selected images
		const selectedImages = cloudinaryImages.filter(img => 
			publicIds.includes(img.public_id)
		);

		if (selectedImages.length === 0) {
			return json({
				success: false,
				error: 'Selected images not found in Cloudinary'
			}, { status: 404 });
		}

		// Read current database
		const db = readDatabase();
		const existingImages = db.images || [];

		// Create a map of existing images by Cloudinary public ID
		const existingByPublicId = new Map();
		existingImages.forEach(img => {
			if (img.cloudinaryPublicId) {
				existingByPublicId.set(img.cloudinaryPublicId, img);
			}
		});

		let added = 0;
		let updated = 0;

		// Process each selected Cloudinary image
		for (const cloudinaryImg of selectedImages) {
			const publicId = cloudinaryImg.public_id;
			const existingImage = existingByPublicId.get(publicId);

			if (existingImage) {
				// Update existing image metadata
				existingImage.path = cloudinaryImg.secure_url;
				existingImage.width = cloudinaryImg.width;
				existingImage.height = cloudinaryImg.height;
				existingImage.size = cloudinaryImg.bytes || existingImage.size;
				existingImage.mimeType = cloudinaryImg.format ? `image/${cloudinaryImg.format}` : existingImage.mimeType;

				const index = existingImages.findIndex(img => img.id === existingImage.id);
				if (index >= 0) {
					existingImages[index] = existingImage;
				}

				updated++;
			} else {
				// Add new image
				const filename = cloudinaryImg.filename || publicId.split('/').pop();
				const newImage = {
					id: randomUUID(),
					filename: filename,
					originalName: filename,
					path: cloudinaryImg.secure_url,
					cloudinaryPublicId: publicId,
					size: cloudinaryImg.bytes || 0,
					mimeType: cloudinaryImg.format ? `image/${cloudinaryImg.format}` : 'image/jpeg',
					width: cloudinaryImg.width,
					height: cloudinaryImg.height,
					uploadedAt: cloudinaryImg.created_at || new Date().toISOString()
				};

				existingImages.push(newImage);
				added++;
			}
		}

		// Update database
		db.images = existingImages;
		writeDatabase(db);

		return json({
			success: true,
			message: `Successfully imported ${selectedImages.length} images from Cloudinary`,
			added,
			updated,
			total: existingImages.length
		});
	} catch (error) {
		console.error('Error syncing images:', error);
		
		if (error.message && error.message.includes('RATE_LIMIT_EXCEEDED')) {
			// Extract reset time from error message if available
			const resetTimeMatch = error.message.match(/Try again on ([\d\s:-]+ UTC)/);
			const resetTime = resetTimeMatch ? resetTimeMatch[1] : null;
			
			return json({
				success: false,
				error: 'Cloudinary rate limit exceeded. Please try again later.',
				details: error.message,
				resetTime: resetTime
			}, { status: 429 });
		}

		return json({
			success: false,
			error: 'Failed to sync images: ' + error.message
		}, { status: 500 });
	}
};

