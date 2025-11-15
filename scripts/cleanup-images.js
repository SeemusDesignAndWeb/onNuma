import { v2 as cloudinary } from 'cloudinary';
import { readFileSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Configure Cloudinary
cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dl8kjhwjs',
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Get the date for last Thursday (or today if today is Thursday)
 * Returns a Date object set to midnight of that day
 */
function getLastThursday() {
	const today = new Date();
	const dayOfWeek = today.getDay(); // 0 = Sunday, 4 = Thursday
	
	// Calculate days to subtract to get to last Thursday
	// If today is Thursday (4), we want today
	// If today is Friday (5), we want yesterday (1 day ago)
	// If today is Saturday (6), we want 2 days ago
	// etc.
	let daysToSubtract = 0;
	if (dayOfWeek >= 4) {
		// Thursday (4) or later in the week
		daysToSubtract = dayOfWeek - 4;
	} else {
		// Sunday (0) through Wednesday (3)
		daysToSubtract = dayOfWeek + 3; // Go back to previous Thursday
	}
	
	const thursday = new Date(today);
	thursday.setDate(today.getDate() - daysToSubtract);
	thursday.setHours(0, 0, 0, 0); // Set to midnight
	
	return thursday;
}

async function getAllCloudinaryImages() {
	console.log('📋 Fetching all images from Cloudinary...\n');
	
	const allImages = [];
	let nextCursor = null;
	
	do {
		try {
			const options = {
				expression: 'folder:egcc',
				max_results: 500
			};
			
			if (nextCursor) {
				options.next_cursor = nextCursor;
			}
			
			const result = await cloudinary.search.execute(options);
			
			if (result.resources && result.resources.length > 0) {
				allImages.push(...result.resources);
				console.log(`✅ Fetched ${result.resources.length} images (total: ${allImages.length})`);
			}
			
			nextCursor = result.next_cursor;
		} catch (error) {
			// Check for rate limit error
			if (error.error && error.error.http_code === 420) {
				console.error('\n❌ Rate Limit Exceeded!');
				console.error(`   ${error.error.message}`);
				console.error('\n💡 Please wait until the rate limit resets and run this script again.');
				console.error('   The duplicate removal has already been completed.\n');
				throw new Error('RATE_LIMIT_EXCEEDED');
			}
			console.error('❌ Error fetching images:', error);
			break;
		}
	} while (nextCursor);
	
	return allImages;
}

async function cleanupImages() {
	try {
		console.log('🚀 Starting image cleanup...\n');
		
		// Get last Thursday date
		const lastThursday = getLastThursday();
		const thursdayTimestamp = Math.floor(lastThursday.getTime() / 1000);
		console.log(`📅 Last Thursday: ${lastThursday.toISOString()}\n`);
		
		// Fetch all images from Cloudinary
		let cloudinaryImages;
		try {
			cloudinaryImages = await getAllCloudinaryImages();
		} catch (error) {
			if (error.message === 'RATE_LIMIT_EXCEEDED') {
				process.exit(1);
			}
			throw error;
		}
		
		if (cloudinaryImages.length === 0) {
			console.log('⚠️  No images found in Cloudinary folder "egcc"');
			return;
		}
		
		console.log(`\n📦 Found ${cloudinaryImages.length} images in Cloudinary\n`);
		
		// Create a Set of Cloudinary public IDs for quick lookup
		const cloudinaryPublicIds = new Set();
		const cloudinaryImagesSinceThursday = new Set();
		
		cloudinaryImages.forEach(img => {
			cloudinaryPublicIds.add(img.public_id);
			
			// Check if image was created/updated since Thursday
			const createdAt = img.created_at ? new Date(img.created_at) : null;
			const updatedAt = img.updated_at ? new Date(img.updated_at) : null;
			
			if (createdAt && createdAt >= lastThursday) {
				cloudinaryImagesSinceThursday.add(img.public_id);
			} else if (updatedAt && updatedAt >= lastThursday) {
				cloudinaryImagesSinceThursday.add(img.public_id);
			}
		});
		
		console.log(`📊 Images in Cloudinary since Thursday: ${cloudinaryImagesSinceThursday.size}\n`);
		
		// Read current database
		const dbPath = process.env.DATABASE_PATH || './data/database.json';
		let db;
		
		if (!existsSync(dbPath)) {
			console.error(`❌ Database file not found: ${dbPath}`);
			process.exit(1);
		}
		
		const dbData = readFileSync(dbPath, 'utf-8');
		db = JSON.parse(dbData);
		
		const existingImages = db.images || [];
		console.log(`📋 Found ${existingImages.length} images in database\n`);
		
		// Track statistics
		let duplicatesRemoved = 0;
		let notInCloudinaryRemoved = 0;
		let notSinceThursdayRemoved = 0;
		const keptImages = [];
		
		// Track seen public IDs and paths to identify duplicates
		const seenPublicIds = new Set();
		const seenPaths = new Set();
		
		// Process each image
		for (const image of existingImages) {
			const publicId = image.cloudinaryPublicId;
			const path = image.path;
			
			// Check for duplicates by public ID
			if (publicId && seenPublicIds.has(publicId)) {
				console.log(`🗑️  Removing duplicate (by public ID): ${image.filename || image.originalName || 'unknown'} (${publicId})`);
				duplicatesRemoved++;
				continue;
			}
			
			// Check for duplicates by path
			if (path && seenPaths.has(path)) {
				console.log(`🗑️  Removing duplicate (by path): ${image.filename || image.originalName || 'unknown'} (${path})`);
				duplicatesRemoved++;
				continue;
			}
			
			// Check if image exists in Cloudinary
			if (publicId && !cloudinaryPublicIds.has(publicId)) {
				console.log(`🗑️  Removing (not in Cloudinary): ${image.filename || image.originalName || 'unknown'} (${publicId})`);
				notInCloudinaryRemoved++;
				continue;
			}
			
			// Check if image was added since Thursday
			if (publicId && !cloudinaryImagesSinceThursday.has(publicId)) {
				console.log(`🗑️  Removing (not added since Thursday): ${image.filename || image.originalName || 'unknown'} (${publicId})`);
				notSinceThursdayRemoved++;
				continue;
			}
			
			// Keep this image
			seenPublicIds.add(publicId);
			if (path) seenPaths.add(path);
			keptImages.push(image);
		}
		
		// Update database
		db.images = keptImages;
		
		// Write database
		writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
		console.log(`💾 Database saved to: ${dbPath}`);
		
		console.log(`\n✅ Cleanup complete!`);
		console.log(`   Duplicates removed: ${duplicatesRemoved}`);
		console.log(`   Not in Cloudinary removed: ${notInCloudinaryRemoved}`);
		console.log(`   Not added since Thursday removed: ${notSinceThursdayRemoved}`);
		console.log(`   Total removed: ${duplicatesRemoved + notInCloudinaryRemoved + notSinceThursdayRemoved}`);
		console.log(`   Images kept: ${keptImages.length}`);
		console.log(`   Total in database: ${keptImages.length} images\n`);
		
	} catch (error) {
		console.error('❌ Error cleaning up images:', error);
		process.exit(1);
	}
}

// Run the cleanup
cleanupImages();

