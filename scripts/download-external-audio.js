import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import https from 'https';
import http from 'http';
import { URL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Database path
const DB_PATH = process.env.DATABASE_PATH || './data/database.json';

// Destination directory (Railway volume or configured path)
const DEST_DIR = process.env.AUDIO_UPLOAD_DIR || '/data/audio/uploaded';

function getDbPath() {
	if (DB_PATH.startsWith('./') || DB_PATH.startsWith('../')) {
		return join(process.cwd(), DB_PATH);
	}
	return DB_PATH;
}

function getDestPath() {
	if (DEST_DIR.startsWith('./') || DEST_DIR.startsWith('../')) {
		return join(process.cwd(), DEST_DIR);
	}
	return DEST_DIR;
}

function readDatabase() {
	const dbPath = getDbPath();
	if (!existsSync(dbPath)) {
		throw new Error(`Database file not found: ${dbPath}`);
	}
	const data = readFileSync(dbPath, 'utf-8');
	return JSON.parse(data);
}

function writeDatabase(data) {
	const dbPath = getDbPath();
	writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
}

function formatBytes(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function downloadFile(url, destPath) {
	return new Promise((resolve, reject) => {
		const parsedUrl = new URL(url);
		const protocol = parsedUrl.protocol === 'https:' ? https : http;
		
		let fileStream;
		
		const request = protocol.get(url, (response) => {
			// Handle redirects
			if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
				const redirectUrl = response.headers.location;
				if (!redirectUrl) {
					reject(new Error('Redirect location not found'));
					return;
				}
				// Resolve relative redirects
				const absoluteUrl = redirectUrl.startsWith('http') ? redirectUrl : new URL(redirectUrl, url).href;
				return downloadFile(absoluteUrl, destPath).then(resolve).catch(reject);
			}
			
			if (response.statusCode !== 200) {
				reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
				return;
			}
			
			// Get content length for progress tracking
			const contentLength = parseInt(response.headers['content-length'] || '0', 10);
			
			// Create write stream
			fileStream = createWriteStream(destPath);
			
			response.pipe(fileStream);
			
			fileStream.on('finish', () => {
				fileStream.close();
				// Get actual file size after download
				try {
					const stats = statSync(destPath);
					resolve({
						size: stats.size,
						expectedSize: contentLength
					});
				} catch (error) {
					reject(new Error(`Failed to get file size: ${error.message}`));
				}
			});
			
			fileStream.on('error', (error) => {
				fileStream.destroy();
				reject(error);
			});
			
			response.on('error', (error) => {
				if (fileStream) {
					fileStream.destroy();
				}
				reject(error);
			});
		});
		
		request.on('error', (error) => {
			reject(error);
		});
		
		request.setTimeout(300000, () => { // 5 minute timeout
			request.destroy();
			if (fileStream) {
				fileStream.destroy();
			}
			reject(new Error('Download timeout'));
		});
	});
}

function getFileExtension(url) {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const ext = pathname.split('.').pop()?.toLowerCase();
		// Validate extension
		if (ext && ['mp3', 'm4a', 'ogg', 'wav', 'aac', 'flac', 'mp4'].includes(ext)) {
			return ext;
		}
	} catch (e) {
		// Invalid URL, try to extract from string
	}
	
	// Default to mp3 if we can't determine
	return 'mp3';
}

async function downloadExternalAudio() {
	console.log('🚀 Starting download of external audio files...\n');
	console.log(`📂 Destination directory: ${getDestPath()}\n`);

	const destPath = getDestPath();

	// Create destination directory if it doesn't exist
	if (!existsSync(destPath)) {
		console.log(`📁 Creating destination directory: ${destPath}`);
		try {
			mkdirSync(destPath, { recursive: true });
			console.log('✅ Destination directory created\n');
		} catch (error) {
			console.error(`❌ Failed to create destination directory: ${error.message}`);
			process.exit(1);
		}
	}

	// Read database
	console.log('📖 Reading database...');
	const db = readDatabase();
	const podcasts = db.podcasts || [];

	if (podcasts.length === 0) {
		console.log('ℹ️  No podcasts found in database\n');
		return;
	}

	// Find podcasts with external URLs
	const externalPodcasts = podcasts.filter(p => {
		if (!p.audioUrl) return false;
		return p.audioUrl.startsWith('http://') || p.audioUrl.startsWith('https://');
	});

	if (externalPodcasts.length === 0) {
		console.log('ℹ️  No podcasts with external URLs found');
		console.log('   All podcasts already use local paths\n');
		return;
	}

	console.log(`📊 Found ${externalPodcasts.length} podcast(s) with external URLs\n`);

	let downloaded = 0;
	let skipped = 0;
	let errors = 0;
	let totalSize = 0;

	for (const podcast of externalPodcasts) {
		const url = podcast.audioUrl;
		const podcastTitle = podcast.title || podcast.id;

		try {
			// Generate unique filename
			const ext = getFileExtension(url);
			const filename = `${randomUUID()}.${ext}`;
			const filePath = join(destPath, filename);

			// Check if we already have this file (by checking if URL was already downloaded)
			// We'll check by looking for podcasts with the same URL that already have local paths
			const alreadyDownloaded = podcasts.find(p => 
				p.audioUrl === url && 
				!p.audioUrl.startsWith('http') && 
				p.audioUrl.startsWith('/audio/uploaded/')
			);

			if (alreadyDownloaded) {
				console.log(`⏭️  Skipping "${podcastTitle}" (already downloaded)`);
				// Update this podcast to use the same local file
				const index = db.podcasts.findIndex(p => p.id === podcast.id);
				if (index >= 0) {
					db.podcasts[index].audioUrl = alreadyDownloaded.audioUrl;
					db.podcasts[index].filename = alreadyDownloaded.filename;
					if (alreadyDownloaded.size) {
						db.podcasts[index].size = alreadyDownloaded.size;
					}
				}
				skipped++;
				continue;
			}

			console.log(`📥 Downloading "${podcastTitle}"...`);
			console.log(`   URL: ${url}`);

			// Download the file
			const result = await downloadFile(url, filePath);

			// Verify file exists and get size
			if (!existsSync(filePath)) {
				throw new Error('File was not created');
			}

			const stats = statSync(filePath);
			const fileSize = stats.size;

			if (fileSize === 0) {
				throw new Error('Downloaded file is empty');
			}

			// Update podcast in database
			const newAudioUrl = `/audio/uploaded/${filename}`;
			const index = db.podcasts.findIndex(p => p.id === podcast.id);
			if (index >= 0) {
				db.podcasts[index].audioUrl = newAudioUrl;
				db.podcasts[index].filename = filename;
				db.podcasts[index].size = fileSize;
			}

			console.log(`✅ Downloaded "${podcastTitle}" (${formatBytes(fileSize)})`);
			console.log(`   Saved as: ${filename}\n`);

			downloaded++;
			totalSize += fileSize;

			// Save database after each successful download (in case script is interrupted)
			writeDatabase(db);

		} catch (error) {
			console.error(`❌ Error downloading "${podcastTitle}": ${error.message}`);
			errors++;
		}
	}

	// Final summary
	console.log('\n' + '='.repeat(50));
	console.log('📊 Download Summary:');
	console.log(`   ✅ Downloaded: ${downloaded} file(s)`);
	console.log(`   ⏭️  Skipped: ${skipped} file(s)`);
	console.log(`   ❌ Errors: ${errors} file(s)`);
	console.log(`   📦 Total size: ${formatBytes(totalSize)}`);
	console.log('='.repeat(50) + '\n');

	if (errors > 0) {
		console.error('⚠️  Some files failed to download. Please check the errors above.');
	}

	console.log('🎉 Download complete!');
	console.log(`\n💡 Note: Audio files are now stored in: ${destPath}`);
	console.log('   Database has been updated with local file paths.\n');
}

// Run the download
downloadExternalAudio().catch(error => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});

