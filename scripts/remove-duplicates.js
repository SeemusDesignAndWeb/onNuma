import { readFileSync, writeFileSync } from 'fs';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function removeDuplicates() {
	try {
		console.log('🚀 Starting duplicate removal...\n');
		
		// Read current database
		const dbPath = process.env.DATABASE_PATH || './data/database.json';
		
		if (!existsSync(dbPath)) {
			console.error(`❌ Database file not found: ${dbPath}`);
			process.exit(1);
		}
		
		const dbData = readFileSync(dbPath, 'utf-8');
		const db = JSON.parse(dbData);
		
		const existingImages = db.images || [];
		console.log(`📋 Found ${existingImages.length} images in database\n`);
		
		// Track statistics
		let duplicatesRemoved = 0;
		const keptImages = [];
		
		// Track seen public IDs and paths to identify duplicates
		const seenPublicIds = new Set();
		const seenPaths = new Set();
		const duplicatePublicIds = new Map(); // Track which ones are duplicates
		const duplicatePaths = new Map();
		
		// First pass: identify duplicates
		for (const image of existingImages) {
			const publicId = image.cloudinaryPublicId;
			const path = image.path;
			
			if (publicId) {
				if (seenPublicIds.has(publicId)) {
					duplicatePublicIds.set(publicId, (duplicatePublicIds.get(publicId) || 0) + 1);
				} else {
					seenPublicIds.add(publicId);
				}
			}
			
			if (path) {
				if (seenPaths.has(path)) {
					duplicatePaths.set(path, (duplicatePaths.get(path) || 0) + 1);
				} else {
					seenPaths.add(path);
				}
			}
		}
		
		// Reset sets for second pass
		seenPublicIds.clear();
		seenPaths.clear();
		
		// Second pass: keep first occurrence, remove duplicates
		for (const image of existingImages) {
			const publicId = image.cloudinaryPublicId;
			const path = image.path;
			const imageName = image.filename || image.originalName || 'unknown';
			
			let isDuplicate = false;
			
			// Check for duplicates by public ID
			if (publicId) {
				if (seenPublicIds.has(publicId)) {
					console.log(`🗑️  Removing duplicate (by public ID): ${imageName} (${publicId})`);
					duplicatesRemoved++;
					isDuplicate = true;
				} else {
					seenPublicIds.add(publicId);
				}
			}
			
			// Check for duplicates by path (if not already marked as duplicate)
			if (!isDuplicate && path) {
				if (seenPaths.has(path)) {
					console.log(`🗑️  Removing duplicate (by path): ${imageName} (${path})`);
					duplicatesRemoved++;
					isDuplicate = true;
				} else {
					seenPaths.add(path);
				}
			}
			
			if (!isDuplicate) {
				keptImages.push(image);
			}
		}
		
		// Update database
		db.images = keptImages;
		
		// Write database
		writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
		console.log(`💾 Database saved to: ${dbPath}`);
		
		console.log(`\n✅ Duplicate removal complete!`);
		console.log(`   Duplicates removed: ${duplicatesRemoved}`);
		console.log(`   Images kept: ${keptImages.length}`);
		console.log(`   Total in database: ${keptImages.length} images\n`);
		
	} catch (error) {
		console.error('❌ Error removing duplicates:', error);
		process.exit(1);
	}
}

// Run the cleanup
removeDuplicates();

