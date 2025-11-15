import { v2 as cloudinary } from 'cloudinary';
import { readFileSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
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

async function listAllCloudinaryImages() {
	console.log('📋 Fetching images from Cloudinary (updated in last 3 days)...\n');
	
	// Calculate date 3 days ago
	const threeDaysAgo = new Date();
	threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
	const threeDaysAgoTimestamp = Math.floor(threeDaysAgo.getTime() / 1000);
	
	const allImages = [];
	let nextCursor = null;
	
	do {
		try {
			// Only fetch images updated in the last 3 days
			const options = {
				expression: `folder:egcc AND updated_at>=${threeDaysAgoTimestamp}`,
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
			console.error('❌ Error fetching images:', error);
			break;
		}
	} while (nextCursor);
	
	return allImages;
}

async function syncCloudinaryImagesToDatabase() {
	try {
		console.log('🚀 Starting Cloudinary image sync...\n');
		
		// Fetch all images from Cloudinary
		const cloudinaryImages = await listAllCloudinaryImages();
		
		if (cloudinaryImages.length === 0) {
			console.log('⚠️  No images found in Cloudinary folder "egcc"');
			return;
		}
		
		console.log(`\n📦 Found ${cloudinaryImages.length} images in Cloudinary\n`);
		
		// Read current database
		const dbPath = process.env.DATABASE_PATH || './data/database.json';
		let db;
		
		if (existsSync(dbPath)) {
			const dbData = readFileSync(dbPath, 'utf-8');
			db = JSON.parse(dbData);
		} else {
			// Initialize with default structure
			db = {
				pages: [],
				team: [],
				services: [],
				heroSlides: [],
				images: [],
				podcasts: [],
				communityGroups: [],
				events: [],
				contact: {
					address: '542 Westhorne Avenue, Eltham, London, SE9 6RR',
					phone: '020 8850 1331',
					email: 'enquiries@egcc.co.uk',
					googleMapsUrl: 'https://www.google.com/maps/place/Eltham+Green+Community+Church/@51.4551128,0.0400237,15z'
				},
				serviceTimes: {
					sunday: '11:00 AM (Doors open at 10:30 AM)',
					weekday: 'Various times - see Community Groups',
					notes: ''
				},
				settings: {
					siteName: 'Eltham Green Community Church',
					primaryColor: '#4BB170',
					podcastAuthor: 'Eltham Green Community Church',
					podcastEmail: 'johnawatson72@gmail.com',
					podcastImage: 'http://www.egcc.co.uk/company/egcc/images/EGCC-Audio.png',
					podcastDescription: 'Latest sermons from Eltham Green Community Church',
					teamDescription: 'EGCC is led by an Eldership Team. The team is led by our Lead Pastor John Watson who will seek God for the vision of the church.&nbsp; We take responsibility together for the life and care of the church.&nbsp; The Elders, with their wives, are supported by many others who take a leadership role whether that be in leading Worship, Ministry, Community Groups, Youth and Children\'s work and other church and community activities.',
					teamHeroTitle: 'Developing leaders of tomorrow',
					youtubePlaylistId: '',
					youtubeChannelId: ''
				}
			};
		}
		
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
		let skipped = 0;
		
		// Process each Cloudinary image
		for (const cloudinaryImg of cloudinaryImages) {
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
				console.log(`🔄 Updated: ${cloudinaryImg.filename || publicId.split('/').pop()}`);
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
				console.log(`➕ Added: ${filename}`);
			}
		}
		
		// Update database
		db.images = existingImages;
		
		// Write database (reuse dbPath from earlier)
		writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
		console.log(`💾 Database saved to: ${dbPath}`);
		
		console.log(`\n✅ Sync complete!`);
		console.log(`   Added: ${added} images`);
		console.log(`   Updated: ${updated} images`);
		console.log(`   Skipped: ${skipped} images`);
		console.log(`   Total in database: ${existingImages.length} images\n`);
		
	} catch (error) {
		console.error('❌ Error syncing images:', error);
		process.exit(1);
	}
}

// Run the sync
syncCloudinaryImagesToDatabase();

